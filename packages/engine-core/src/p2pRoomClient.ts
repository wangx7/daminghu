import Peer, { type DataConnection } from 'peerjs';
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
import { sampleTerrain } from './legacy/map_data.js';

export interface LocalPlayerNetState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  vehicle: VehicleMode;
  skinId: SkinId;
  weaponId: EquippedWeaponId;
}

export interface P2PRoomCallbacks {
  onRoomUpdate?: (snapshot: RoomSnapshot) => void;
  onWorldSnapshot?: (entities: NetEntitySnapshot[], localPlayerId: string) => void;
  onProjectileFx?: (shooterId: string, x: number, y: number, z: number, yaw: number, weaponId: WeaponId) => void;
  onLocalRespawn?: (x: number, z: number, yaw: number) => void;
  onKillFeed?: (item: KillFeedItem) => void;
  onChatBubble?: (event: ChatBubbleEvent) => void;
  onMatchEnd?: (result: MatchResultSummary) => void;
  onNotice?: (title: string, body: string) => void;
}

interface HostEntity extends NetEntitySnapshot {
  isHost: boolean;
  respawnTimer: number;
  botHomeX: number;
  botHomeZ: number;
  botPhase: number;
  botFireCd: number;
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PEER_PREFIX = 'daminghu-p2p-';
const SYNC_INTERVAL = 0.055; // ~18Hz
const BOT_NAMES_RED = ['超然小侠', '明湖赤羽', '鹊华红枫', '历下炎阳', '泉城烈风'];
const BOT_NAMES_BLUE = ['荷风青岚', '汇波沧澜', '碧水游侠', '雪梅清影', '明湖青松'];
const BOT_SKINS: SkinId[] = ['spring_willow', 'summer_lotus', 'autumn_maple', 'winter_snow'];

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

function generateRoomCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

function getSafeSpawnPoint(team: TeamId, slotIdx: number): { x: number; z: number; yaw: number } {
  // 大明湖正南门广场（红队/自由）与南岸西侧广场（蓝队）开阔陆地出生点
  const base =
    team === 'red'
      ? { x: -217, z: 298, yaw: Math.PI }
      : team === 'blue'
        ? { x: -217, z: 252, yaw: 0 }
        : { x: -217, z: 276, yaw: Math.PI };
  const angle = (slotIdx / 8) * Math.PI * 2;
  const radius = 6 + (slotIdx % 3) * 4;
  for (let r = radius; r <= 24; r += 3) {
    const nx = base.x + Math.cos(angle) * r;
    const nz = base.z + Math.sin(angle) * r;
    if (!sampleTerrain(nx, nz).isWater) {
      return { x: nx, z: nz, yaw: base.yaw };
    }
  }
  return base;
}

export class P2PRoomClient {
  private callbacks: P2PRoomCallbacks;
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
  private guestMembers: RoomMember[] = [];
  private localHp = 100;
  private localAlive = true;

  private syncAcc = 0;
  private msgSeq = 1;
  private joinTimer: number | null = null;

  constructor(callbacks: P2PRoomCallbacks = {}) {
    this.callbacks = callbacks;
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
      window.clearTimeout(this.joinTimer);
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
    const peer = new Peer(peerId, { config: ICE_CONFIG, debug: 0 });
    this.peer = peer;

    this.joinTimer = window.setTimeout(() => {
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
        skinId: localState.skinId,
        weaponId: localState.weaponId,
        hp: 100,
        maxHp: 100,
        alive: true,
        kills: 0,
        deaths: 0,
        respawnTimer: 0,
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

    const peer = new Peer({ config: ICE_CONFIG, debug: 0 });
    this.peer = peer;

    this.joinTimer = window.setTimeout(() => {
      if (this.status === 'joining') {
        this.failConnection('连接房主超时（房间不存在或当前网络 NAT 限制较严，建议切换同一 Wi-Fi / 手机热点重试）');
      }
    }, 13000);

    peer.on('open', (id) => {
      this.localPlayerId = id;
      const conn = peer.connect(`${PEER_PREFIX}${code}`, { reliable: false });
      this.hostConn = conn;

      conn.on('open', () => {
        this.clearJoinTimer();
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
        if (this.status === 'connected') {
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
    this.cleanupPeerOnly();
    this.hostEntities.clear();
    this.guestMembers = [];
    this.status = 'disconnected';
    this.phase = 'idle';
    this.roomCode = '';
    this.isHost = false;
    this.errorMessage = '';
    this.localHp = 100;
    this.localAlive = true;
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
    this.redScore = 0;
    this.blueScore = 0;
    this.timeRemainingSec = this.config.mode === 'coop_roam' ? 0 : this.config.matchDurationSec;

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
      if (this.config.mode !== 'coop_roam') {
        const sp = getSafeSpawnPoint(e.team, idx++);
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
    const sp = getSafeSpawnPoint(team, idx + 2);
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
      skinId: BOT_SKINS[idx % BOT_SKINS.length],
      weaponId: idx % 3 === 0 ? 'lotus_mortar' : idx % 3 === 1 ? 'quehua_bow' : 'spring_blaster',
      hp: 100,
      maxHp: 100,
      alive: true,
      kills: 0,
      deaths: 0,
      respawnTimer: 0,
      botHomeX: sp.x,
      botHomeZ: sp.z,
      botPhase: idx * 1.1,
      botFireCd: 1.4 + Math.random() * 1.2,
    });
  }

  // ===== 4. 开火与快捷气泡聊天 =====
  sendFire(x: number, y: number, z: number, yaw: number, weaponId: WeaponId) {
    if (this.status !== 'connected' || !this.localAlive) return;
    if (this.isHost) {
      this.processAuthoritativeFire(this.localPlayerId, x, y, z, yaw, weaponId);
    } else {
      this.sendToHost({ type: 'fire', x, y, z, yaw, weaponId });
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

      const sp = getSafeSpawnPoint(assignedTeam, this.hostEntities.size);
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
        skinId: msg.skinId,
        weaponId: msg.weaponId,
        hp: 100,
        maxHp: 100,
        alive: true,
        kills: 0,
        deaths: 0,
        respawnTimer: 0,
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
      entity.vehicle = msg.vehicle;
      entity.skinId = msg.skinId;
      entity.weaponId = msg.weaponId;
    } else if (msg.type === 'fire') {
      if (entity.alive) {
        this.processAuthoritativeFire(guestId, msg.x, msg.y, msg.z, msg.yaw, msg.weaponId);
      }
    } else if (msg.type === 'switch_team') {
      entity.team = msg.team;
      this.broadcastRoomSync();
      this.emitRoom();
    } else if (msg.type === 'chat') {
      this.broadcastChat(guestId, entity.name, msg.text.slice(0, 24), entity.team);
    }
  }

  private handleHostMessage(msg: HostToClientMsg) {
    if (msg.type === 'welcome') {
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
        this.localHp = me.hp;
        this.localAlive = me.alive;
      }
      this.callbacks.onWorldSnapshot?.(msg.entities, this.localPlayerId);
      if (Math.ceil(this.timeRemainingSec) !== prevSec || this.redScore * 1000 + this.blueScore !== prevScore) {
        this.emitRoom();
      }
    } else if (msg.type === 'projectile_fx') {
      if (msg.shooterId !== this.localPlayerId) {
        this.callbacks.onProjectileFx?.(msg.shooterId, msg.x, msg.y, msg.z, msg.yaw, msg.weaponId);
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
  ) {
    const shooter = this.hostEntities.get(shooterId);
    if (!shooter || !shooter.alive) return;

    // 广播视觉弹道给其他玩家
    this.broadcastToGuests({ type: 'projectile_fx', shooterId, x, y, z, yaw, weaponId });
    if (shooterId !== this.localPlayerId) {
      this.callbacks.onProjectileFx?.(shooterId, x, y, z, yaw, weaponId);
    }

    if (this.phase !== 'playing' || this.config.mode === 'coop_roam') return;

    const weapon = WEAPON_MAP[weaponId] || WEAPON_MAP.spring_blaster;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const hitRadius = Math.max(2.8, weapon.splashRadius * 0.72);

    // 射线距离判定（手游/Web 轻竞技友好判定）
    for (const target of this.hostEntities.values()) {
      if (target.id === shooterId || !target.alive) continue;
      if (this.config.mode === 'team' && target.team === shooter.team) continue;

      const dx = target.x - x;
      const dz = target.z - z;
      const proj = dx * fx + dz * fz;
      if (proj < 0 || proj > weapon.maxRange) continue;
      const perpSq = dx * dx + dz * dz - proj * proj;
      const dy = Math.abs(target.y - y);
      if (perpSq <= hitRadius * hitRadius && dy <= 5.5) {
        this.applyDamage(shooter, target, weapon.damage, weapon.name);
        if (weapon.splashRadius <= 0) break;
      }
    }
  }

  private applyDamage(shooter: HostEntity, target: HostEntity, damage: number, weaponName: string) {
    target.hp = Math.max(0, target.hp - damage);
    if (target.id === this.localPlayerId) {
      this.localHp = target.hp;
    }

    if (target.hp <= 0) {
      target.alive = false;
      target.deaths++;
      target.respawnTimer = 3.0;
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

      if (nearest && bestDist < 85) {
        const dx = nearest.x - bot.x;
        const dz = nearest.z - bot.z;
        bot.yaw = Math.atan2(dx, dz);
        if (bestDist > 16) {
          const nx = bot.x + Math.sin(bot.yaw) * 6.2 * dt;
          const nz = bot.z + Math.cos(bot.yaw) * 6.2 * dt;
          if (!sampleTerrain(nx, nz).isWater) {
            bot.x = nx;
            bot.z = nz;
          }
        }
        bot.botFireCd -= dt;
        if (bot.botFireCd <= 0 && bestDist < 55) {
          bot.botFireCd = 1.6 + Math.random() * 1.1;
          const spreadYaw = bot.yaw + (Math.random() - 0.5) * 0.22;
          this.processAuthoritativeFire(bot.id, bot.x, bot.y, bot.z, spreadYaw, bot.weaponId || 'spring_blaster');
        }
      } else {
        const nx = bot.botHomeX + Math.cos(bot.botPhase * 0.7) * 9;
        const nz = bot.botHomeZ + Math.sin(bot.botPhase * 0.7) * 9;
        if (!sampleTerrain(nx, nz).isWater) {
          bot.yaw = Math.atan2(nx - bot.x, nz - bot.z);
          bot.x += (nx - bot.x) * Math.min(1, dt * 3);
          bot.z += (nz - bot.z) * Math.min(1, dt * 3);
        }
      }
    }
  }

  private finishMatch() {
    if (this.phase !== 'playing') return;
    this.phase = 'ended';

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
        hostEntity.vehicle = localState.vehicle;
        hostEntity.skinId = localState.skinId;
        hostEntity.weaponId = localState.weaponId;
      }

      if (this.phase === 'playing' && this.config.mode !== 'coop_roam') {
        const prevSec = Math.ceil(this.timeRemainingSec);
        this.timeRemainingSec = Math.max(0, this.timeRemainingSec - dt);
        if (this.timeRemainingSec <= 0) {
          this.finishMatch();
        } else if (Math.ceil(this.timeRemainingSec) !== prevSec) {
          this.emitRoom();
        }

        // 复活计时
        let slot = 0;
        for (const e of this.hostEntities.values()) {
          slot++;
          if (!e.alive) {
            e.respawnTimer -= dt;
            if (e.respawnTimer <= 0) {
              const sp = getSafeSpawnPoint(e.team, slot);
              e.hp = 100;
              e.alive = true;
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
