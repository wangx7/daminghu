import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import {
  DEFAULT_ROOM_CONFIG,
  WEAPON_MAP,
  type ChatBubbleEvent,
  type ClientToHostMsg,
  type EquippedWeaponId,
  type HostToClientMsg,
  type KillFeedItem,
  type MatchResultSummary,
  type NetEntitySnapshot,
  type P2PNetworkOptions,
  type RoomConfig,
  type RoomConnectionStatus,
  type RoomMember,
  type RoomPhase,
  type RoomSnapshot,
  type SkinId,
  type TeamId,
  type VehicleMode,
  type WeaponId,
} from '@daminghu/shared';
import {
  computeSplashFalloff,
  resolveBallisticSegment,
  traceAuthoritativeBallistic,
  type BallisticTarget,
} from './combatBallistics';
import type { WorldCollider } from './legacy/collider.js';
import { sampleTerrain } from './legacy/map_data.js';
import { createBrowserPlatformAdapter, type PlatformAdapter } from './platformAdapter';

export interface LocalPlayerNetState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  vehicle: VehicleMode;
  skinId: SkinId;
  weaponId: EquippedWeaponId;
}

export interface PassengerSyncInfo {
  driverId: string | null;
  seatIndex: number;
  driverVehicle: VehicleMode | null;
  autoParachute: boolean;
  ejectReason?: string;
}

export interface P2PRoomCallbacks {
  onRoomUpdate?: (snapshot: RoomSnapshot) => void;
  onWorldSnapshot?: (entities: NetEntitySnapshot[], localPlayerId: string) => void;
  onProjectileFx?: (shooterId: string, x: number, y: number, z: number, yaw: number, weaponId: WeaponId, pitch?: number) => void;
  onLocalRespawn?: (x: number, z: number, yaw: number) => void;
  onPassengerSync?: (info: PassengerSyncInfo) => void;
  onForceExitVehicle?: (autoParachute: boolean, reason: string) => void;
  onKillFeed?: (item: KillFeedItem) => void;
  onChatBubble?: (event: ChatBubbleEvent) => void;
  onMatchEnd?: (result: MatchResultSummary) => void;
  onNotice?: (title: string, body: string) => void;
  onLocalHit?: (damage: number, eliminated: boolean, kind: 'player' | 'vehicle') => void;
  onLocalDamaged?: (damage: number, remainingHp: number) => void;
}

/**
 * 3D 射线到目标点的精确命中判定（支持高空防空对射，不再受限于水平 dy <= 5.0）
 */
export function compute3DRayHit(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  maxRange: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  hitRadius: number,
): { hit: boolean; proj: number; perpDist: number } {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const dz = targetZ - originZ;
  const proj = dx * dirX + dy * dirY + dz * dirZ;
  if (proj < 0 || proj > maxRange) {
    return { hit: false, proj, perpDist: Infinity };
  }
  const distSq = dx * dx + dy * dy + dz * dz;
  const perpSq = Math.max(0, distSq - proj * proj);
  return {
    hit: perpSq <= hitRadius * hitRadius,
    proj,
    perpDist: Math.sqrt(perpSq),
  };
}

function getVehicleMaxHp(v: VehicleMode): number {
  if (v === 'car') return 180;
  if (v === 'heli') return 140;
  if (v === 'boat') return 120;
  return 0;
}

function getVehicleMaxPassengers(v: VehicleMode): number {
  if (v === 'heli') return 3;
  if (v === 'car' || v === 'boat') return 1;
  return 0;
}

function getVehicleCnName(v: VehicleMode): string {
  if (v === 'car') return '敞篷跑车';
  if (v === 'heli') return '体素直升机';
  if (v === 'boat') return '双人小木船';
  return '载具';
}

interface HostEntity extends NetEntitySnapshot {
  isHost: boolean;
  respawnTimer: number;
  respawnAt: number;
  lastFireAt: number;
  botHomeX: number;
  botHomeZ: number;
  botPhase: number;
  botFireCd: number;
}

interface HostProjectile {
  shooterId: string;
  weaponId: WeaponId;
  originX: number;
  originY: number;
  originZ: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PEER_PREFIX = 'daminghu-p2p-';
const SYNC_INTERVAL = 0.055; // ~18Hz
const BOT_NAMES_RED = ['超然小侠', '明湖赤羽', '鹊华红枫', '历下炎阳', '泉城烈风'];
const BOT_NAMES_BLUE = ['荷风青岚', '汇波沧澜', '碧水游侠', '雪梅清影', '明湖青松'];
const BOT_SKINS: SkinId[] = ['spring_willow', 'summer_lotus', 'autumn_maple', 'winter_snow'];

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

function generateRoomCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

function getSafeSpawnPoint(team: TeamId, slotIdx: number, collider?: WorldCollider | null): { x: number; z: number; yaw: number } {
  // 大明湖正南门广场（红队/自由）与南岸西侧广场（蓝队）开阔陆地出生点
  const base =
    team === 'red'
      ? { x: -217, z: 298, yaw: Math.PI }
      : team === 'blue'
        ? { x: -217, z: 252, yaw: 0 }
        : { x: -217, z: 276, yaw: Math.PI };
  const angle = (slotIdx / 8) * Math.PI * 2;
  const radius = 6 + (slotIdx % 3) * 4;
  for (let r = radius; r <= 28; r += 3) {
    const nx = base.x + Math.cos(angle) * r;
    const nz = base.z + Math.sin(angle) * r;
    const terr = sampleTerrain(nx, nz);
    if (!terr.isWater && (!collider || !collider.collidesBox(nx, terr.height + 0.05, nz, 0.55, 1.8))) {
      return { x: nx, z: nz, yaw: base.yaw };
    }
  }
  return base;
}

export class P2PRoomClient {
  private callbacks: P2PRoomCallbacks;
  private collider: WorldCollider | null;
  private platform: PlatformAdapter;
  private networkOptions: P2PNetworkOptions;
  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private guestConns = new Map<string, DataConnection>();

  private status: RoomConnectionStatus = 'disconnected';
  private roomCode = '';
  private isHost = false;
  private localPlayerId = '';
  private localPlayerName = '团团游侠';
  private phase: RoomPhase = 'idle';
  private config: RoomConfig = { ...DEFAULT_ROOM_CONFIG };
  private redScore = 0;
  private blueScore = 0;
  private timeRemainingSec = 180;
  private errorMessage = '';

  // Host 权威实体表 / Guest 镜像成员表
  private hostEntities = new Map<string, HostEntity>();
  private hostProjectiles: HostProjectile[] = [];
  private matchEndAt = 0;
  private guestMembers: RoomMember[] = [];
  private localHp = 100;
  private localAlive = true;
  private localVehicleHp = 0;
  private localVehicleMaxHp = 0;
  private localPassengerOf: string | null = null;
  private localSeatIndex = -1;
  private localPassengerVehicle: VehicleMode | null = null;

  private syncAcc = 0;
  private msgSeq = 1;
  private joinTimer: number | null = null;

  constructor(
    callbacks: P2PRoomCallbacks = {},
    collider?: WorldCollider | null,
    platform: PlatformAdapter = createBrowserPlatformAdapter(),
    networkOptions: P2PNetworkOptions = {},
  ) {
    this.callbacks = callbacks;
    this.collider = collider ?? null;
    this.platform = platform;
    this.networkOptions = networkOptions;
  }

  private buildPeerOptions(): PeerOptions {
    const opts: PeerOptions = {
      config: {
        iceServers: this.networkOptions.iceServers?.length
          ? (this.networkOptions.iceServers as RTCIceServer[])
          : DEFAULT_ICE_SERVERS,
      },
      debug: 0,
    };
    if (this.networkOptions.peerServer) {
      opts.host = this.networkOptions.peerServer.host;
      if (this.networkOptions.peerServer.port !== undefined) opts.port = this.networkOptions.peerServer.port;
      if (this.networkOptions.peerServer.path !== undefined) opts.path = this.networkOptions.peerServer.path;
      if (this.networkOptions.peerServer.secure !== undefined) opts.secure = this.networkOptions.peerServer.secure;
    }
    return opts;
  }

  get active(): boolean {
    return this.status === 'connected';
  }

  get inPlayingMatch(): boolean {
    return this.status === 'connected' && this.phase === 'playing';
  }

  get isCombatMatch(): boolean {
    return this.inPlayingMatch && this.config.mode !== 'coop_roam';
  }

  get currentHp(): number {
    return this.localHp;
  }

  get currentAlive(): boolean {
    return this.localAlive;
  }

  get currentVehicleHp(): number {
    return this.localVehicleHp;
  }

  get currentVehicleMaxHp(): number {
    return this.localVehicleMaxHp;
  }

  get currentPassengerOf(): string | null {
    return this.localPassengerOf;
  }

  get currentSeatIndex(): number {
    return this.localSeatIndex;
  }

  get currentPassengerVehicle(): VehicleMode | null {
    return this.localPassengerVehicle;
  }

  get currentRoomMode() {
    return this.config.mode;
  }

  get localTeam(): TeamId {
    if (this.isHost) return this.hostEntities.get(this.localPlayerId)?.team ?? 'none';
    return this.guestMembers.find((m) => m.id === this.localPlayerId)?.team ?? 'none';
  }

  getSnapshot(): RoomSnapshot {
    const members: RoomMember[] = this.isHost
      ? Array.from(this.hostEntities.values()).map((e) => ({
          id: e.id,
          name: e.name,
          isHost: e.isHost,
          isBot: e.isBot,
          team: e.team,
          skinId: e.skinId,
          weaponId: e.weaponId,
          kills: e.kills,
          deaths: e.deaths,
          hp: Math.round(e.hp),
          maxHp: e.maxHp,
          alive: e.alive,
        }))
      : this.guestMembers;

    return {
      status: this.status,
      roomCode: this.roomCode,
      isHost: this.isHost,
      localPlayerId: this.localPlayerId,
      localPlayerName: this.localPlayerName,
      phase: this.phase,
      config: { ...this.config },
      members,
      redScore: this.redScore,
      blueScore: this.blueScore,
      timeRemainingSec: Math.max(0, this.timeRemainingSec),
      errorMessage: this.errorMessage,
    };
  }

  private emitRoom() {
    this.callbacks.onRoomUpdate?.(this.getSnapshot());
  }

  private clearJoinTimer() {
    if (this.joinTimer !== null) {
      this.platform.clearTimeout(this.joinTimer);
      this.joinTimer = null;
    }
  }

  // ===== 1. 房主建房 =====
  createRoom(hostName: string, localState: LocalPlayerNetState) {
    this.leaveRoom(false);
    this.localPlayerName = hostName.trim() || '大明湖房主';
    this.roomCode = generateRoomCode();
    this.isHost = true;
    this.status = 'creating';
    this.phase = 'lobby';
    this.errorMessage = '';
    this.config = { ...DEFAULT_ROOM_CONFIG };
    this.redScore = 0;
    this.blueScore = 0;
    this.timeRemainingSec = this.config.matchDurationSec;
    this.localHp = 100;
    this.localAlive = true;
    this.emitRoom();

    const peerId = `${PEER_PREFIX}${this.roomCode}`;
    const peer = new Peer(peerId, this.buildPeerOptions());
    this.peer = peer;

    this.joinTimer = this.platform.setTimeout(() => {
      if (this.status === 'creating') {
        this.failConnection('连接信令服务器超时，请检查网络后重试');
      }
    }, 12000);

    peer.on('open', (id) => {
      this.clearJoinTimer();
      this.localPlayerId = id;
      this.status = 'connected';
      this.hostEntities.clear();
      this.hostEntities.set(id, {
        id,
        name: this.localPlayerName,
        isHost: true,
        isBot: false,
        team: 'red',
        x: localState.x,
        y: localState.y,
        z: localState.z,
        yaw: localState.yaw,
        vehicle: localState.vehicle,
        passengerOf: null,
        seatIndex: -1,
        vehicleHp: getVehicleMaxHp(localState.vehicle),
        vehicleMaxHp: getVehicleMaxHp(localState.vehicle),
        skinId: localState.skinId,
        weaponId: localState.weaponId,
        hp: 100,
        maxHp: 100,
        alive: true,
        kills: 0,
        deaths: 0,
        respawnTimer: 0,
        respawnAt: 0,
        lastFireAt: 0,
        botHomeX: localState.x,
        botHomeZ: localState.z,
        botPhase: 0,
        botFireCd: 0,
      });
      this.emitRoom();
      this.callbacks.onNotice?.('联机房间已创建', `房间码 ${this.roomCode}，好友扫码或点链接即可直连！`);
    });

    peer.on('connection', (conn) => {
      this.setupHostGuestConnection(conn);
    });

    peer.on('error', (err) => {
      this.clearJoinTimer();
      const msg =
        err.type === 'unavailable-id'
          ? '房间码冲突，请重新点击创建房间'
          : '无法连接 P2P 信令服务，请稍后重试';
      this.failConnection(msg);
    });
  }

  private setupHostGuestConnection(conn: DataConnection) {
    conn.on('data', (raw) => {
      const msg = raw as ClientToHostMsg;
      if (!msg || typeof msg !== 'object') return;
      this.handleClientMessage(conn, msg);
    });

    const onDisconnect = () => {
      const guestId = conn.peer;
      const entity = this.hostEntities.get(guestId);
      this.guestConns.delete(guestId);
      if (entity) {
        this.ejectPassengersOf(guestId, entity.vehicle === 'heli' && entity.y > 5.5, '司机已离开房间');
        this.hostEntities.delete(guestId);
        this.callbacks.onNotice?.('好友离开', `「${entity.name}」已退出房间`);
        this.broadcastRoomSync();
        this.emitRoom();
      }
    };

    conn.on('close', onDisconnect);
    conn.on('error', onDisconnect);
  }

  // ===== 2. 好友加入房间 =====
  joinRoom(rawCode: string, playerName: string, localState: LocalPlayerNetState) {
    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) {
      this.errorMessage = '请输入有效的 6 位房间码';
      this.status = 'error';
      this.emitRoom();
      return;
    }

    this.leaveRoom(false);
    this.localPlayerName = playerName.trim() || '明湖游侠';
    this.roomCode = code;
    this.isHost = false;
    this.status = 'joining';
    this.phase = 'lobby';
    this.errorMessage = '';
    this.localHp = 100;
    this.localAlive = true;
    this.emitRoom();

    const peer = new Peer(this.buildPeerOptions());
    this.peer = peer;

    this.joinTimer = this.platform.setTimeout(() => {
      if (this.status === 'joining') {
        this.failConnection('连接房主超时（房间不存在或当前网络 NAT 限制较严，建议切换同一 Wi-Fi / 手机热点重试）');
      }
    }, 13000);

    peer.on('open', (id) => {
      this.localPlayerId = id;
      // 使用 reliable: true 确保 join/welcome/room_sync/respawn/passenger_sync/match_end 等关键控制消息零丢包
      const conn = peer.connect(`${PEER_PREFIX}${code}`, { reliable: true });
      this.hostConn = conn;

      conn.on('open', () => {
        // 保持入房超时计时器，直到真正收到房主 welcome 再结束握手计时
        this.sendToHost({
          type: 'join',
          name: this.localPlayerName,
          skinId: localState.skinId,
          weaponId: localState.weaponId,
        });
      });

      conn.on('data', (raw) => {
        const msg = raw as HostToClientMsg;
        if (!msg || typeof msg !== 'object') return;
        this.handleHostMessage(msg);
      });

      conn.on('close', () => {
        if (this.status === 'joining') {
          this.failConnection('房主已退出或握手中断，请确认房间码后重试');
        } else if (this.status === 'connected') {
          this.callbacks.onNotice?.('房间已断开', '房主已关闭房间或网络连接中断');
          this.leaveRoom(false);
        }
      });

      conn.on('error', () => {
        this.failConnection('与房主建立 P2P 连接失败，请确认房间码正确或更换网络重试');
      });
    });

    peer.on('error', (err) => {
      this.clearJoinTimer();
      const msg =
        err.type === 'peer-unavailable'
          ? `未找到房间 ${code}，请确认房主未关闭页面`
          : '连接 P2P 房间失败，请检查网络或重试';
      this.failConnection(msg);
    });
  }

  private failConnection(message: string) {
    this.clearJoinTimer();
    this.cleanupPeerOnly();
    this.status = 'error';
    this.phase = 'idle';
    this.errorMessage = message;
    this.emitRoom();
  }

  private cleanupPeerOnly() {
    this.hostConn?.close();
    this.hostConn = null;
    for (const c of this.guestConns.values()) c.close();
    this.guestConns.clear();
    this.peer?.destroy();
    this.peer = null;
  }

  leaveRoom(notifyGuests = true) {
    this.clearJoinTimer();
    if (this.isHost && notifyGuests) {
      this.broadcastToGuests({ type: 'room_closed', reason: '房主已解散房间' });
    }
    const wasPassenger = this.localPassengerOf !== null;
    this.cleanupPeerOnly();
    this.hostEntities.clear();
    this.hostProjectiles = [];
    this.matchEndAt = 0;
    this.guestMembers = [];
    this.status = 'disconnected';
    this.phase = 'idle';
    this.roomCode = '';
    this.isHost = false;
    this.errorMessage = '';
    this.localHp = 100;
    this.localAlive = true;
    this.localVehicleHp = 0;
    this.localVehicleMaxHp = 0;
    this.localPassengerOf = null;
    this.localSeatIndex = -1;
    this.localPassengerVehicle = null;
    // 仅在确实处于乘客状态时才通知引擎离座，避免建房/进房误清除正在驾驶的载具
    if (wasPassenger) {
      this.callbacks.onPassengerSync?.({ driverId: null, seatIndex: -1, driverVehicle: null, autoParachute: false });
    }
    this.callbacks.onWorldSnapshot?.([], this.localPlayerId);
    this.emitRoom();
  }

  // ===== 3. 房间配置与开局 =====
  updateConfig(patch: Partial<RoomConfig>) {
    if (!this.isHost || this.status !== 'connected') return;
    this.config = { ...this.config, ...patch };
    if (this.config.mode === 'team') {
      this.rebalanceHumanTeams();
    } else {
      for (const e of this.hostEntities.values()) {
        if (!e.isBot) e.team = 'none';
      }
    }
    this.broadcastRoomSync();
    this.emitRoom();
  }

  switchTeam(team: TeamId) {
    if (this.status !== 'connected') return;
    if (this.isHost) {
      const me = this.hostEntities.get(this.localPlayerId);
      if (me) {
        me.team = team;
        this.broadcastRoomSync();
        this.emitRoom();
      }
    } else {
      this.sendToHost({ type: 'switch_team', team });
    }
  }

  startMatch() {
    if (!this.isHost || this.status !== 'connected') return;
    // 先移除旧 AI
    for (const [id, e] of this.hostEntities.entries()) {
      if (e.isBot) this.hostEntities.delete(id);
    }

    this.phase = 'playing';
    this.hostProjectiles = [];
    this.redScore = 0;
    this.blueScore = 0;
    this.timeRemainingSec = this.config.mode === 'coop_roam' ? 0 : this.config.matchDurationSec;
    this.matchEndAt =
      this.config.mode === 'coop_roam' ? 0 : this.platform.now() + this.config.matchDurationSec * 1000;

    if (this.config.mode === 'team') {
      this.rebalanceHumanTeams();
      if (this.config.fillBots) this.spawnTeamBots();
    } else if (this.config.mode === 'ffa') {
      for (const e of this.hostEntities.values()) e.team = 'none';
      if (this.config.fillBots) this.spawnFfaBots();
    } else {
      for (const e of this.hostEntities.values()) e.team = 'none';
    }

    // 重置血量、战绩并分发出生点
    let idx = 0;
    for (const e of this.hostEntities.values()) {
      e.hp = 100;
      e.maxHp = 100;
      e.alive = true;
      e.kills = 0;
      e.deaths = 0;
      e.respawnTimer = 0;
      e.respawnAt = 0;
      if (this.config.mode !== 'coop_roam') {
        const sp = getSafeSpawnPoint(e.team, idx++, this.collider);
        e.x = sp.x;
        e.z = sp.z;
        e.y = 2;
        e.yaw = sp.yaw;
        e.botHomeX = sp.x;
        e.botHomeZ = sp.z;
        if (e.id === this.localPlayerId) {
          this.callbacks.onLocalRespawn?.(sp.x, sp.z, sp.yaw);
        } else if (!e.isBot) {
          const conn = this.guestConns.get(e.id);
          if (conn?.open) {
            conn.send({ type: 'respawn', targetId: e.id, x: sp.x, z: sp.z, yaw: sp.yaw } satisfies HostToClientMsg);
          }
        }
      }
    }

    this.localHp = 100;
    this.localAlive = true;
    this.broadcastRoomSync();
    this.broadcastWorldSnapshot();
    this.emitRoom();

    const modeTitle =
      this.config.mode === 'coop_roam'
        ? '自由同游已开始'
        : this.config.mode === 'ffa'
          ? '个人混战开始！'
          : `${this.config.teamSize}v${this.config.teamSize} 红蓝对抗开始！`;
    this.callbacks.onNotice?.(modeTitle, '祝各位大明湖游侠玩得开心！');
  }

  private rebalanceHumanTeams() {
    let redCount = 0;
    let blueCount = 0;
    for (const e of this.hostEntities.values()) {
      if (e.isBot) continue;
      if (e.team === 'red') redCount++;
      else if (e.team === 'blue') blueCount++;
    }
    for (const e of this.hostEntities.values()) {
      if (e.isBot) continue;
      if (e.team !== 'red' && e.team !== 'blue') {
        if (redCount <= blueCount) {
          e.team = 'red';
          redCount++;
        } else {
          e.team = 'blue';
          blueCount++;
        }
      }
    }
  }

  private spawnTeamBots() {
    let redCount = 0;
    let blueCount = 0;
    for (const e of this.hostEntities.values()) {
      if (e.team === 'red') redCount++;
      else if (e.team === 'blue') blueCount++;
    }
    const targetPerTeam = this.config.teamSize;
    let botIdx = 0;
    while (redCount < targetPerTeam) {
      this.addBot('red', BOT_NAMES_RED[redCount % BOT_NAMES_RED.length], botIdx++);
      redCount++;
    }
    while (blueCount < targetPerTeam) {
      this.addBot('blue', BOT_NAMES_BLUE[blueCount % BOT_NAMES_BLUE.length], botIdx++);
      blueCount++;
    }
  }

  private spawnFfaBots() {
    const targetTotal = Math.max(4, Math.min(8, this.config.teamSize * 2));
    let count = this.hostEntities.size;
    let botIdx = 0;
    while (count < targetTotal) {
      const name = (botIdx % 2 === 0 ? BOT_NAMES_RED : BOT_NAMES_BLUE)[botIdx % 5];
      this.addBot('none', name, botIdx++);
      count++;
    }
  }

  private addBot(team: TeamId, name: string, idx: number) {
    const id = `bot_${team}_${idx}_${Date.now()}`;
    const sp = getSafeSpawnPoint(team, idx + 2, this.collider);
    this.hostEntities.set(id, {
      id,
      name: `${name}[AI]`,
      isHost: false,
      isBot: true,
      team,
      x: sp.x,
      y: 2,
      z: sp.z,
      yaw: sp.yaw,
      vehicle: 'foot',
      passengerOf: null,
      seatIndex: -1,
      vehicleHp: 0,
      vehicleMaxHp: 0,
      skinId: BOT_SKINS[idx % BOT_SKINS.length],
      weaponId: idx % 3 === 0 ? 'lotus_mortar' : idx % 3 === 1 ? 'quehua_bow' : 'spring_blaster',
      hp: 100,
      maxHp: 100,
      alive: true,
      kills: 0,
      deaths: 0,
      respawnTimer: 0,
      respawnAt: 0,
      lastFireAt: 0,
      botHomeX: sp.x,
      botHomeZ: sp.z,
      botPhase: idx * 1.1,
      botFireCd: 1.4 + Math.random() * 1.2,
    });
  }

  // ===== 4. 开火与快捷气泡聊天 =====
  sendFire(x: number, y: number, z: number, yaw: number, weaponId: WeaponId, pitch = 0) {
    if (this.status !== 'connected' || !this.localAlive) return;
    if (this.isHost) {
      this.processAuthoritativeFire(this.localPlayerId, x, y, z, yaw, weaponId, pitch);
    } else {
      this.sendToHost({ type: 'fire', x, y, z, yaw, pitch, weaponId });
    }
  }

  sendQuickChat(text: string) {
    if (this.status !== 'connected' || !text.trim()) return;
    const clean = text.trim().slice(0, 24);
    if (this.isHost) {
      const me = this.hostEntities.get(this.localPlayerId);
      const team = me?.team ?? 'none';
      this.broadcastChat(this.localPlayerId, this.localPlayerName, clean, team);
    } else {
      this.sendToHost({ type: 'chat', text: clean });
    }
  }

  requestBoardVehicle(driverId: string) {
    if (this.status !== 'connected' || !this.localAlive) return;
    if (this.isHost) {
      this.processBoardVehicle(this.localPlayerId, driverId);
    } else {
      this.sendToHost({ type: 'board_vehicle', driverId });
    }
  }

  requestLeaveVehicle(wantParachute = false) {
    if (this.status !== 'connected' || !this.localPassengerOf) return;
    if (this.isHost) {
      this.processLeaveVehicle(this.localPlayerId, wantParachute);
    } else {
      this.sendToHost({ type: 'leave_vehicle', wantParachute });
    }
  }

  private emitPassengerSync(
    targetId: string,
    driverId: string | null,
    seatIndex: number,
    driverVehicle: VehicleMode | null,
    autoParachute: boolean,
    ejectReason?: string,
  ) {
    if (targetId === this.localPlayerId) {
      this.localPassengerOf = driverId;
      this.localSeatIndex = seatIndex;
      this.localPassengerVehicle = driverVehicle;
      this.callbacks.onPassengerSync?.({ driverId, seatIndex, driverVehicle, autoParachute, ejectReason });
      if (ejectReason) this.callbacks.onNotice?.('载具提示', ejectReason);
    } else {
      const conn = this.guestConns.get(targetId);
      if (conn?.open) {
        conn.send({
          type: 'passenger_sync',
          targetId,
          driverId,
          seatIndex,
          driverVehicle,
          autoParachute,
          ejectReason,
        } satisfies HostToClientMsg);
      }
    }
  }

  private processBoardVehicle(passengerId: string, driverId: string) {
    const passenger = this.hostEntities.get(passengerId);
    const driver = this.hostEntities.get(driverId);
    if (!passenger || !driver || !passenger.alive || !driver.alive) return;
    if (passengerId === driverId) return;

    const maxSeats = getVehicleMaxPassengers(driver.vehicle);
    if (maxSeats <= 0) return;

    // 对战权限：团队战仅允许上队友车；个人混战禁止上对手车；自由同游/大厅不限
    if (this.phase === 'playing') {
      if (this.config.mode === 'ffa') return;
      if (this.config.mode === 'team' && passenger.team !== driver.team) return;
    }

    // 寻找空座位
    const occupied = new Set<number>();
    for (const e of this.hostEntities.values()) {
      if (e.passengerOf === driverId && e.seatIndex >= 0) occupied.add(e.seatIndex);
    }
    let freeSeat = -1;
    for (let s = 0; s < maxSeats; s++) {
      if (!occupied.has(s)) {
        freeSeat = s;
        break;
      }
    }
    if (freeSeat < 0) return;

    passenger.passengerOf = driverId;
    passenger.seatIndex = freeSeat;
    passenger.vehicle = 'foot';
    this.emitPassengerSync(passengerId, driverId, freeSeat, driver.vehicle, false);
    this.broadcastWorldSnapshot();
  }

  private processLeaveVehicle(passengerId: string, wantParachute = false) {
    const passenger = this.hostEntities.get(passengerId);
    if (!passenger || !passenger.passengerOf) return;
    const driver = this.hostEntities.get(passenger.passengerOf);
    const autoParachute = !!(driver && driver.vehicle === 'heli' && (driver.y > 5.5 || wantParachute));
    passenger.passengerOf = null;
    passenger.seatIndex = -1;
    this.emitPassengerSync(passengerId, null, -1, null, autoParachute);
    this.broadcastWorldSnapshot();
  }

  private ejectPassengersOf(driverId: string, autoParachute: boolean, reason?: string) {
    for (const e of this.hostEntities.values()) {
      if (e.passengerOf === driverId) {
        e.passengerOf = null;
        e.seatIndex = -1;
        this.emitPassengerSync(e.id, null, -1, null, autoParachute, reason);
      }
    }
  }

  private broadcastChat(senderId: string, senderName: string, text: string, team: TeamId) {
    const evt: ChatBubbleEvent = {
      id: this.msgSeq++,
      senderId,
      senderName,
      text,
      team,
      timestamp: Date.now(),
    };
    this.callbacks.onChatBubble?.(evt);
    this.broadcastToGuests({ type: 'chat_broadcast', senderId, senderName, text, team });
  }

  // ===== 5. 消息处理 =====
  private handleClientMessage(conn: DataConnection, msg: ClientToHostMsg) {
    const guestId = conn.peer;

    if (msg.type === 'join') {
      if (this.guestConns.size >= 9) {
        conn.send({ type: 'room_closed', reason: '房间人数已满（上限 10 人）' } satisfies HostToClientMsg);
        conn.close();
        return;
      }
      this.guestConns.set(guestId, conn);

      // 如果正在对局且有 AI 占坑，优先替换掉一名 AI
      let assignedTeam: TeamId = 'none';
      if (this.config.mode === 'team') {
        let redH = 0;
        let blueH = 0;
        for (const e of this.hostEntities.values()) {
          if (e.isBot) continue;
          if (e.team === 'red') redH++;
          else if (e.team === 'blue') blueH++;
        }
        assignedTeam = redH <= blueH ? 'red' : 'blue';
        for (const [bid, be] of this.hostEntities.entries()) {
          if (be.isBot && be.team === assignedTeam) {
            this.hostEntities.delete(bid);
            break;
          }
        }
      }

      const sp = getSafeSpawnPoint(assignedTeam, this.hostEntities.size, this.collider);
      const memberName = msg.name.trim() || `游侠${this.hostEntities.size}`;
      this.hostEntities.set(guestId, {
        id: guestId,
        name: memberName,
        isHost: false,
        isBot: false,
        team: assignedTeam,
        x: sp.x,
        y: 2,
        z: sp.z,
        yaw: sp.yaw,
        vehicle: 'foot',
        passengerOf: null,
        seatIndex: -1,
        vehicleHp: 0,
        vehicleMaxHp: 0,
        skinId: msg.skinId,
        weaponId: msg.weaponId,
        hp: 100,
        maxHp: 100,
        alive: true,
        kills: 0,
        deaths: 0,
        respawnTimer: 0,
        respawnAt: 0,
        lastFireAt: 0,
        botHomeX: sp.x,
        botHomeZ: sp.z,
        botPhase: 0,
        botFireCd: 0,
      });

      const snap = this.getSnapshot();
      conn.send({
        type: 'welcome',
        playerId: guestId,
        roomCode: this.roomCode,
        phase: this.phase,
        config: this.config,
        members: snap.members,
      } satisfies HostToClientMsg);

      this.callbacks.onNotice?.('好友加入房间', `「${memberName}」已进入大明湖房间！`);
      this.broadcastRoomSync();
      this.emitRoom();
      return;
    }

    const entity = this.hostEntities.get(guestId);
    if (!entity) return;

    if (msg.type === 'state') {
      if (entity.alive) {
        entity.x = msg.x;
        entity.y = msg.y;
        entity.z = msg.z;
        entity.yaw = msg.yaw;
      }
      const prevVehicle = entity.vehicle;
      entity.vehicle = msg.vehicle;
      if (prevVehicle !== msg.vehicle) {
        const newMax = getVehicleMaxHp(msg.vehicle);
        entity.vehicleMaxHp = newMax;
        entity.vehicleHp = newMax;
        if (getVehicleMaxPassengers(prevVehicle) > 0 && getVehicleMaxPassengers(msg.vehicle) === 0) {
          this.ejectPassengersOf(guestId, prevVehicle === 'heli' && entity.y > 5.5, '司机已离开载具');
        }
      }
      entity.skinId = msg.skinId;
      entity.weaponId = msg.weaponId;
    } else if (msg.type === 'fire') {
      if (entity.alive) {
        this.processAuthoritativeFire(guestId, msg.x, msg.y, msg.z, msg.yaw, msg.weaponId, msg.pitch ?? 0);
      }
    } else if (msg.type === 'switch_team') {
      entity.team = msg.team;
      this.broadcastRoomSync();
      this.emitRoom();
    } else if (msg.type === 'chat') {
      this.broadcastChat(guestId, entity.name, msg.text.slice(0, 24), entity.team);
    } else if (msg.type === 'board_vehicle') {
      this.processBoardVehicle(guestId, msg.driverId);
    } else if (msg.type === 'leave_vehicle') {
      this.processLeaveVehicle(guestId, !!msg.wantParachute);
    }
  }

  private handleHostMessage(msg: HostToClientMsg) {
    if (msg.type === 'welcome') {
      this.clearJoinTimer();
      this.localPlayerId = msg.playerId;
      this.roomCode = msg.roomCode;
      this.phase = msg.phase;
      this.config = { ...msg.config };
      this.guestMembers = msg.members;
      this.status = 'connected';
      this.errorMessage = '';
      this.emitRoom();
      this.callbacks.onNotice?.('已加入联机房间', `成功连入房间 ${this.roomCode}！`);
    } else if (msg.type === 'room_sync') {
      this.phase = msg.phase;
      this.config = { ...msg.config };
      this.guestMembers = msg.members;
      this.redScore = msg.redScore;
      this.blueScore = msg.blueScore;
      this.timeRemainingSec = msg.timeRemainingSec;
      this.emitRoom();
    } else if (msg.type === 'world_snapshot') {
      const prevSec = Math.ceil(this.timeRemainingSec);
      const prevScore = this.redScore * 1000 + this.blueScore;
      this.redScore = msg.redScore;
      this.blueScore = msg.blueScore;
      this.timeRemainingSec = msg.timeRemainingSec;
      const me = msg.entities.find((e) => e.id === this.localPlayerId);
      if (me) {
        if (me.hp < this.localHp && this.phase === 'playing') {
          this.callbacks.onLocalDamaged?.(this.localHp - me.hp, me.hp);
        }
        this.localHp = me.hp;
        this.localAlive = me.alive;
        if (me.passengerOf) {
          const drv = msg.entities.find((e) => e.id === me.passengerOf);
          this.localVehicleHp = drv?.vehicleHp ?? 0;
          this.localVehicleMaxHp = drv?.vehicleMaxHp ?? 0;
        } else {
          this.localVehicleHp = me.vehicleHp;
          this.localVehicleMaxHp = me.vehicleMaxHp;
        }
      }
      this.callbacks.onWorldSnapshot?.(msg.entities, this.localPlayerId);
      if (Math.ceil(this.timeRemainingSec) !== prevSec || this.redScore * 1000 + this.blueScore !== prevScore) {
        this.emitRoom();
      }
    } else if (msg.type === 'passenger_sync') {
      if (msg.targetId === this.localPlayerId) {
        this.localPassengerOf = msg.driverId;
        this.localSeatIndex = msg.seatIndex;
        this.localPassengerVehicle = msg.driverVehicle;
        this.callbacks.onPassengerSync?.({
          driverId: msg.driverId,
          seatIndex: msg.seatIndex,
          driverVehicle: msg.driverVehicle,
          autoParachute: msg.autoParachute,
          ejectReason: msg.ejectReason,
        });
        if (msg.ejectReason) this.callbacks.onNotice?.('载具提示', msg.ejectReason);
      }
    } else if (msg.type === 'force_exit_vehicle') {
      if (msg.targetId === this.localPlayerId) {
        this.localVehicleHp = 0;
        this.localVehicleMaxHp = 0;
        this.callbacks.onForceExitVehicle?.(msg.autoParachute, msg.reason);
      }
    } else if (msg.type === 'hit_confirm') {
      this.callbacks.onLocalHit?.(msg.damage, msg.eliminated, msg.kind);
    } else if (msg.type === 'projectile_fx') {
      if (msg.shooterId !== this.localPlayerId) {
        this.callbacks.onProjectileFx?.(msg.shooterId, msg.x, msg.y, msg.z, msg.yaw, msg.weaponId, msg.pitch ?? 0);
      }
    } else if (msg.type === 'respawn') {
      if (msg.targetId === this.localPlayerId) {
        this.localHp = 100;
        this.localAlive = true;
        this.callbacks.onLocalRespawn?.(msg.x, msg.z, msg.yaw);
      }
    } else if (msg.type === 'kill_feed') {
      this.callbacks.onKillFeed?.({
        id: this.msgSeq++,
        text: msg.text,
        team: msg.team,
        timestamp: Date.now(),
      });
    } else if (msg.type === 'chat_broadcast') {
      this.callbacks.onChatBubble?.({
        id: this.msgSeq++,
        senderId: msg.senderId,
        senderName: msg.senderName,
        text: msg.text,
        team: msg.team,
        timestamp: Date.now(),
      });
    } else if (msg.type === 'match_end') {
      this.phase = 'ended';
    this.hostProjectiles = [];
    this.matchEndAt = 0;
      this.emitRoom();
      this.callbacks.onMatchEnd?.(msg.result);
    } else if (msg.type === 'room_closed') {
      this.callbacks.onNotice?.('房间已关闭', msg.reason);
      this.leaveRoom(false);
    }
  }

  // ===== 6. Host 权威命中与 AI 驱动 =====
  private processAuthoritativeFire(
    shooterId: string,
    x: number,
    y: number,
    z: number,
    yaw: number,
    weaponId: WeaponId,
    pitch = 0,
  ) {
    const shooter = this.hostEntities.get(shooterId);
    if (!shooter || !shooter.alive) return;

    const weapon = WEAPON_MAP[weaponId] || WEAPON_MAP.spring_blaster;
    // 服务端冷却校验（留 20% 网络抖动容差，防止异常高频刷弹）
    const now = this.platform.now();
    const minCdMs = weapon.cooldownSec * 800;
    if (!shooter.isBot && shooter.lastFireAt > 0 && now - shooter.lastFireAt < minCdMs) {
      return;
    }
    shooter.lastFireAt = now;

    // 广播视觉弹道给其他玩家
    this.broadcastToGuests({ type: 'projectile_fx', shooterId, x, y, z, yaw, pitch, weaponId });
    if (shooterId !== this.localPlayerId) {
      this.callbacks.onProjectileFx?.(shooterId, x, y, z, yaw, weaponId, pitch);
    }

    if (this.phase !== 'playing' || this.config.mode === 'coop_roam') return;

    const clampedPitch = Math.max(-1.15, Math.min(1.15, pitch));
    const cosP = Math.cos(clampedPitch);
    const fx = Math.sin(yaw) * cosP;
    const fy = Math.sin(clampedPitch);
    const fz = Math.cos(yaw) * cosP;

    // 与本地 CombatSystem 保持一致的枪口起点、弹道重力步进、最近目标首次碰撞与溅射范围衰减
    const originX = x + Math.sin(yaw) * 1.4;
    const originY = y + 1.45;
    const originZ = z + Math.cos(yaw) * 1.4;

    // 飞行时间明显的抛物线溅射武器（荷花水炮）按房主时钟逐帧推进，使移动靶预判与落点时机和本地练习场一致
    if (weapon.gravity > 0 && weapon.splashRadius > 0) {
      this.hostProjectiles.push({
        shooterId,
        weaponId,
        originX,
        originY,
        originZ,
        x: originX,
        y: originY,
        z: originZ,
        vx: fx * weapon.projectileSpeed,
        vy: fy * weapon.projectileSpeed,
        vz: fz * weapon.projectileSpeed,
        life: 3.2,
      });
      return;
    }

    const targets = this.collectHostBallisticTargets(shooterId, shooter.team, weapon);
    const trace = traceAuthoritativeBallistic({
      originX,
      originY,
      originZ,
      dirX: fx,
      dirY: fy,
      dirZ: fz,
      weapon,
      targets,
      collider: this.collider,
      getGroundHeight: (gx, gz) => sampleTerrain(gx, gz)?.height ?? 1.2,
    });

    if (weapon.splashRadius > 0) {
      for (const sh of trace.splashHits) {
        const target = this.hostEntities.get(sh.targetId);
        if (target?.alive) {
          this.applyAuthoritativeHitToTarget(shooter, target, weaponId, sh.damage);
        }
      }
    } else if (trace.directTargetId) {
      const target = this.hostEntities.get(trace.directTargetId);
      if (target?.alive) {
        this.applyAuthoritativeHitToTarget(shooter, target, weaponId, weapon.damage);
      }
    }
  }

  private collectHostBallisticTargets(
    shooterId: string,
    shooterTeam: TeamId,
    weapon: (typeof WEAPON_MAP)[WeaponId],
  ): BallisticTarget[] {
    const defaultHitRadius = Math.max(2.15, 1.85 + weapon.projectileRadius);
    const targets: BallisticTarget[] = [];
    for (const target of this.hostEntities.values()) {
      if (target.id === shooterId || !target.alive) continue;
      if (this.config.mode === 'team' && target.team === shooterTeam) continue;
      targets.push({
        id: target.id,
        x: target.x,
        y: target.y + 1.25,
        z: target.z,
        hitRadius: target.vehicle === 'heli' ? 4.2 : defaultHitRadius,
        splashX: target.x,
        splashY: target.y,
        splashZ: target.z,
      });
    }
    return targets;
  }

  private updateHostProjectiles(dt: number) {
    if (this.hostProjectiles.length === 0) return;
    for (let i = this.hostProjectiles.length - 1; i >= 0; i--) {
      const p = this.hostProjectiles[i];
      const shooter = this.hostEntities.get(p.shooterId);
      const weapon = WEAPON_MAP[p.weaponId] || WEAPON_MAP.lotus_mortar;
      p.life -= dt;

      const prevX = p.x;
      const prevY = p.y;
      const prevZ = p.z;
      p.vy -= weapon.gravity * dt;
      const nextX = prevX + p.vx * dt;
      const nextY = prevY + p.vy * dt;
      const nextZ = prevZ + p.vz * dt;
      const groundY = Math.max(0.4, sampleTerrain(nextX, nextZ)?.height ?? 1.2);

      const targets = shooter ? this.collectHostBallisticTargets(p.shooterId, shooter.team, weapon) : [];
      const seg = resolveBallisticSegment(prevX, prevY, prevZ, nextX, nextY, nextZ, targets, this.collider, groundY);
      const outOfRange = Math.hypot(nextX - p.originX, nextY - p.originY, nextZ - p.originZ) > weapon.maxRange;

      if (seg.hitType !== 'none' || outOfRange || p.life <= 0) {
        if (shooter && this.phase === 'playing') {
          if (weapon.splashRadius > 0) {
            for (const tgt of targets) {
              const tx = tgt.splashX ?? tgt.x;
              const ty = tgt.splashY ?? tgt.y;
              const tz = tgt.splashZ ?? tgt.z;
              const dist = Math.hypot(tx - seg.impactX, ty - seg.impactY, tz - seg.impactZ);
              if (tgt.id === seg.targetId || dist <= weapon.splashRadius) {
                const falloff = tgt.id === seg.targetId ? 1 : computeSplashFalloff(dist, weapon.splashRadius);
                const entity = this.hostEntities.get(tgt.id);
                if (entity?.alive) {
                  this.applyAuthoritativeHitToTarget(shooter, entity, p.weaponId, Math.round(weapon.damage * falloff));
                }
              }
            }
          } else if (seg.targetId) {
            const entity = this.hostEntities.get(seg.targetId);
            if (entity?.alive) {
              this.applyAuthoritativeHitToTarget(shooter, entity, p.weaponId, weapon.damage);
            }
          }
        }
        this.hostProjectiles.splice(i, 1);
      } else {
        p.x = nextX;
        p.y = nextY;
        p.z = nextZ;
      }
    }
  }

  private applyAuthoritativeHitToTarget(shooter: HostEntity, target: HostEntity, weaponId: WeaponId, baseDamage: number) {
    const weapon = WEAPON_MAP[weaponId] || WEAPON_MAP.spring_blaster;
    // 对战中击中载具司机时优先扣减载具耐久（鹊华长弓对直升机 1.5 倍防空伤害！）
    if (target.vehicleMaxHp > 0 && target.vehicleHp > 0 && getVehicleMaxPassengers(target.vehicle) > 0) {
      const antiAir = weaponId === 'quehua_bow' && target.vehicle === 'heli' ? 1.5 : 1.0;
      const vDmg = Math.round(baseDamage * antiAir);
      target.vehicleHp = Math.max(0, target.vehicleHp - vDmg);
      const destroyed = target.vehicleHp <= 0;
      this.notifyShooterHit(shooter.id, vDmg, destroyed, 'vehicle');
      if (target.id === this.localPlayerId) this.localVehicleHp = target.vehicleHp;
      if (destroyed) {
        const vName = getVehicleCnName(target.vehicle);
        const autoPara = target.vehicle === 'heli' && target.y > 5.5;
        const feedText = `🔥 ${shooter.name} 用 ${weapon.name} 击毁了 ${target.name} 的${vName}！`;
        this.callbacks.onKillFeed?.({ id: this.msgSeq++, text: feedText, team: shooter.team, timestamp: Date.now() });
        this.broadcastToGuests({ type: 'kill_feed', text: feedText, team: shooter.team });
        this.ejectPassengersOf(target.id, autoPara, `${vName}被击毁，已安全弹出！`);
        target.vehicle = autoPara ? 'parachute' : 'foot';
        target.vehicleMaxHp = 0;
        const driverReason = `${vName}被击毁，${autoPara ? '已自动张开降落伞迫降！' : '已安全跳车！'}`;
        if (target.id === this.localPlayerId) {
          this.localVehicleHp = 0;
          this.localVehicleMaxHp = 0;
          this.callbacks.onForceExitVehicle?.(autoPara, driverReason);
        } else if (!target.isBot) {
          const conn = this.guestConns.get(target.id);
          if (conn?.open) {
            conn.send({
              type: 'force_exit_vehicle',
              targetId: target.id,
              autoParachute: autoPara,
              reason: driverReason,
            } satisfies HostToClientMsg);
          }
        }
        // 载具爆破附带轻微震荡扣血（不直接秒杀）
        if (target.hp > 25) {
          target.hp -= 20;
          if (target.id === this.localPlayerId) this.localHp = target.hp;
        }
      }
    } else {
      this.applyDamage(shooter, target, baseDamage, weapon.name);
    }
  }

  private notifyShooterHit(shooterId: string, damage: number, eliminated: boolean, kind: 'player' | 'vehicle') {
    if (shooterId === this.localPlayerId) {
      this.callbacks.onLocalHit?.(damage, eliminated, kind);
    } else {
      const conn = this.guestConns.get(shooterId);
      if (conn?.open) {
        conn.send({ type: 'hit_confirm', damage, eliminated, kind } satisfies HostToClientMsg);
      }
    }
  }

  private applyDamage(shooter: HostEntity, target: HostEntity, damage: number, weaponName: string) {
    target.hp = Math.max(0, target.hp - damage);
    const eliminated = target.hp <= 0;
    this.notifyShooterHit(shooter.id, damage, eliminated, 'player');
    if (target.id === this.localPlayerId) {
      this.localHp = target.hp;
      this.callbacks.onLocalDamaged?.(damage, target.hp);
    }

    if (eliminated) {
      target.alive = false;
      target.deaths++;
      target.respawnTimer = 3.0;
      target.respawnAt = this.platform.now() + 3000;
      shooter.kills++;

      if (target.id === this.localPlayerId) {
        this.localAlive = false;
        this.callbacks.onNotice?.('已被淘汰', `被「${shooter.name}」的${weaponName}命中，3 秒后自动复活`);
      }

      if (this.config.mode === 'team') {
        if (shooter.team === 'red') this.redScore++;
        else if (shooter.team === 'blue') this.blueScore++;
      } else {
        this.redScore = Math.max(this.redScore, shooter.kills);
      }

      const text = `${shooter.name} [${weaponName}] 淘汰了 ${target.name}`;
      this.callbacks.onKillFeed?.({
        id: this.msgSeq++,
        text,
        team: shooter.team,
        timestamp: Date.now(),
      });
      this.broadcastToGuests({ type: 'kill_feed', text, team: shooter.team });
      this.broadcastRoomSync();
      this.emitRoom();

      // 提前达到目标分结束对局
      const scoreTarget = this.config.mode === 'team' ? Math.max(5, this.config.teamSize * 5) : 15;
      if (this.config.mode === 'team' && (this.redScore >= scoreTarget || this.blueScore >= scoreTarget)) {
        this.finishMatch();
      } else if (this.config.mode === 'ffa' && shooter.kills >= scoreTarget) {
        this.finishMatch();
      }
    }
  }

  private updateHostBots(dt: number) {
    if (this.phase !== 'playing' || this.config.mode === 'coop_roam') return;

    const all = Array.from(this.hostEntities.values());
    for (const bot of all) {
      if (!bot.isBot || !bot.alive) continue;
      bot.botPhase += dt;

      // 寻找最近敌对目标
      let nearest: HostEntity | null = null;
      let bestDist = Infinity;
      for (const cand of all) {
        if (cand.id === bot.id || !cand.alive) continue;
        if (this.config.mode === 'team' && cand.team === bot.team) continue;
        const d = Math.hypot(cand.x - bot.x, cand.z - bot.z);
        if (d < bestDist) {
          bestDist = d;
          nearest = cand;
        }
      }

      const canBotStand = (cx: number, cz: number) => {
        const terr = sampleTerrain(cx, cz);
        if (terr?.isWater) return false;
        const gy = Math.max(1.2, terr.height);
        if (this.collider && this.collider.collidesBox(cx, gy + 0.05, cz, 0.52, 1.75)) return false;
        for (const other of all) {
          if (other.id === bot.id || !other.alive) continue;
          if (Math.abs(other.y - gy) < 2.2 && Math.hypot(cx - other.x, cz - other.z) < 1.35) return false;
        }
        return true;
      };

      if (nearest && bestDist < 85) {
        const dx = nearest.x - bot.x;
        const dz = nearest.z - bot.z;
        bot.yaw = Math.atan2(dx, dz);
        if (bestDist > 16) {
          const stepX = Math.sin(bot.yaw) * 6.2 * dt;
          const stepZ = Math.cos(bot.yaw) * 6.2 * dt;
          if (canBotStand(bot.x + stepX, bot.z)) bot.x += stepX;
          if (canBotStand(bot.x, bot.z + stepZ)) bot.z += stepZ;
        }
        bot.botFireCd -= dt;
        if (bot.botFireCd <= 0 && bestDist < 55) {
          const blocked = this.collider?.raycastSolid(
            bot.x,
            bot.y + 1.35,
            bot.z,
            nearest.x,
            nearest.y + 1.35,
            nearest.z,
            0.7,
          );
          if (!blocked) {
            bot.botFireCd = 1.6 + Math.random() * 1.1;
            const spreadYaw = bot.yaw + (Math.random() - 0.5) * 0.22;
            const aimPitch = Math.atan2(nearest.y - bot.y, Math.max(1, bestDist));
            this.processAuthoritativeFire(bot.id, bot.x, bot.y, bot.z, spreadYaw, bot.weaponId || 'spring_blaster', aimPitch);
          }
        }
      } else {
        const tx = bot.botHomeX + Math.cos(bot.botPhase * 0.7) * 9;
        const tz = bot.botHomeZ + Math.sin(bot.botPhase * 0.7) * 9;
        const stepX = (tx - bot.x) * Math.min(1, dt * 3);
        const stepZ = (tz - bot.z) * Math.min(1, dt * 3);
        bot.yaw = Math.atan2(tx - bot.x, tz - bot.z);
        if (canBotStand(bot.x + stepX, bot.z)) bot.x += stepX;
        if (canBotStand(bot.x, bot.z + stepZ)) bot.z += stepZ;
      }
    }
  }

  private finishMatch() {
    if (this.phase !== 'playing') return;
    this.phase = 'ended';
    this.hostProjectiles = [];
    this.matchEndAt = 0;

    const rankings = Array.from(this.hostEntities.values())
      .map((e) => ({
        id: e.id,
        name: e.name,
        isBot: e.isBot,
        team: e.team,
        kills: e.kills,
        deaths: e.deaths,
      }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

    let winnerTeam: TeamId | 'draw' = 'draw';
    if (this.config.mode === 'team') {
      winnerTeam = this.redScore > this.blueScore ? 'red' : this.blueScore > this.redScore ? 'blue' : 'draw';
    } else if (rankings.length > 0) {
      winnerTeam = 'none';
    }

    const result: MatchResultSummary = {
      mode: this.config.mode,
      winnerTeam,
      redScore: this.redScore,
      blueScore: this.blueScore,
      mvpName: rankings[0]?.name || this.localPlayerName,
      rankings,
    };

    this.broadcastRoomSync();
    this.broadcastToGuests({ type: 'match_end', result });
    this.emitRoom();
    this.callbacks.onMatchEnd?.(result);
  }

  // ===== 7. 每帧驱动 =====
  update(dt: number, localState: LocalPlayerNetState) {
    if (this.status !== 'connected') return;

    if (this.isHost) {
      const hostEntity = this.hostEntities.get(this.localPlayerId);
      if (hostEntity) {
        if (hostEntity.alive) {
          hostEntity.x = localState.x;
          hostEntity.y = localState.y;
          hostEntity.z = localState.z;
          hostEntity.yaw = localState.yaw;
        }
        const prevVehicle = hostEntity.vehicle;
        hostEntity.vehicle = localState.vehicle;
        if (prevVehicle !== localState.vehicle) {
          const newMax = getVehicleMaxHp(localState.vehicle);
          hostEntity.vehicleMaxHp = newMax;
          hostEntity.vehicleHp = newMax;
          this.localVehicleMaxHp = newMax;
          this.localVehicleHp = newMax;
          if (getVehicleMaxPassengers(prevVehicle) > 0 && getVehicleMaxPassengers(localState.vehicle) === 0) {
            this.ejectPassengersOf(this.localPlayerId, prevVehicle === 'heli' && hostEntity.y > 5.5, '房主已离开载具');
          }
        } else if (hostEntity.passengerOf) {
          const drv = this.hostEntities.get(hostEntity.passengerOf);
          this.localVehicleHp = drv?.vehicleHp ?? 0;
          this.localVehicleMaxHp = drv?.vehicleMaxHp ?? 0;
        }
        hostEntity.skinId = localState.skinId;
        hostEntity.weaponId = localState.weaponId;
      }

      if (this.phase === 'playing' && this.config.mode !== 'coop_roam') {
        const now = this.platform.now();
        const prevSec = Math.ceil(this.timeRemainingSec);
        if (this.matchEndAt > 0) {
          this.timeRemainingSec = Math.max(0, (this.matchEndAt - now) / 1000);
        } else {
          this.timeRemainingSec = Math.max(0, this.timeRemainingSec - dt);
        }
        if (this.timeRemainingSec <= 0) {
          this.finishMatch();
        } else if (Math.ceil(this.timeRemainingSec) !== prevSec) {
          this.emitRoom();
        }

        // 复活计时（使用真实时钟截止时间，不受房主掉帧影响）
        let slot = 0;
        for (const e of this.hostEntities.values()) {
          slot++;
          if (!e.alive) {
            e.respawnTimer = e.respawnAt > 0 ? Math.max(0, (e.respawnAt - now) / 1000) : Math.max(0, e.respawnTimer - dt);
            if (e.respawnTimer <= 0) {
              const sp = getSafeSpawnPoint(e.team, slot, this.collider);
              e.hp = 100;
              e.alive = true;
              e.respawnAt = 0;
              e.x = sp.x;
              e.y = 2;
              e.z = sp.z;
              e.yaw = sp.yaw;
              if (e.id === this.localPlayerId) {
                this.localHp = 100;
                this.localAlive = true;
                this.callbacks.onLocalRespawn?.(sp.x, sp.z, sp.yaw);
              } else if (!e.isBot) {
                const conn = this.guestConns.get(e.id);
                if (conn?.open) {
                  conn.send({ type: 'respawn', targetId: e.id, x: sp.x, z: sp.z, yaw: sp.yaw } satisfies HostToClientMsg);
                }
              }
            }
          }
        }

        this.updateHostProjectiles(dt);
        this.updateHostBots(dt);
      }

      this.syncAcc += dt;
      if (this.syncAcc >= SYNC_INTERVAL) {
        this.syncAcc = 0;
        this.broadcastWorldSnapshot();
      }
    } else {
      this.syncAcc += dt;
      if (this.syncAcc >= SYNC_INTERVAL) {
        this.syncAcc = 0;
        this.sendToHost({
          type: 'state',
          x: localState.x,
          y: localState.y,
          z: localState.z,
          yaw: localState.yaw,
          vehicle: localState.vehicle,
          skinId: localState.skinId,
          weaponId: localState.weaponId,
        });
      }
    }
  }

  private broadcastWorldSnapshot() {
    const entities: NetEntitySnapshot[] = Array.from(this.hostEntities.values()).map((e) => ({
      id: e.id,
      name: e.name,
      isBot: e.isBot,
      team: e.team,
      x: Number(e.x.toFixed(2)),
      y: Number(e.y.toFixed(2)),
      z: Number(e.z.toFixed(2)),
      yaw: Number(e.yaw.toFixed(3)),
      vehicle: e.vehicle,
      passengerOf: e.passengerOf,
      seatIndex: e.seatIndex,
      vehicleHp: Math.round(e.vehicleHp),
      vehicleMaxHp: e.vehicleMaxHp,
      skinId: e.skinId,
      weaponId: e.weaponId,
      hp: Math.round(e.hp),
      maxHp: e.maxHp,
      alive: e.alive,
      kills: e.kills,
      deaths: e.deaths,
    }));

    this.callbacks.onWorldSnapshot?.(entities, this.localPlayerId);
    this.broadcastToGuests({
      type: 'world_snapshot',
      entities,
      redScore: this.redScore,
      blueScore: this.blueScore,
      timeRemainingSec: this.timeRemainingSec,
    });
  }

  private broadcastRoomSync() {
    const snap = this.getSnapshot();
    this.broadcastToGuests({
      type: 'room_sync',
      phase: snap.phase,
      config: snap.config,
      members: snap.members,
      redScore: snap.redScore,
      blueScore: snap.blueScore,
      timeRemainingSec: snap.timeRemainingSec,
    });
  }

  private broadcastToGuests(msg: HostToClientMsg) {
    for (const conn of this.guestConns.values()) {
      if (conn.open) conn.send(msg);
    }
  }

  private sendToHost(msg: ClientToHostMsg) {
    if (this.hostConn?.open) {
      this.hostConn.send(msg);
    }
  }

  dispose() {
    this.leaveRoom(true);
  }
}
