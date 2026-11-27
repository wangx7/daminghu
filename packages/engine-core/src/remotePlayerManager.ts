import * as THREE from 'three';
import {
  SKIN_MAP,
  WEAPON_MAP,
  type EquippedWeaponId,
  type MinimapTargetDot,
  type NetEntitySnapshot,
  type SkinId,
  type TeamId,
  type VehicleMode,
  type WeaponId,
} from '@daminghu/shared';
import { selectBestAimTarget, type AimCandidate } from './combatBallistics';
import { buildWeaponMesh } from './combatSystem';
import type { WorldCollider } from './legacy/collider.js';
import { createBrowserPlatformAdapter, type PlatformAdapter } from './platformAdapter';
import { buildSeasonalTuanMesh } from './skinRenderer';
import { disposeObject3D } from './threeDispose';

export interface BoardableVehicleHint {
  driverId: string;
  driverName: string;
  vehicle: VehicleMode;
  actionLabel: string;
  promptLabel: string;
}

export function computeVehicleSeatOffset(vehicle: VehicleMode, seatIndex: number): { lx: number; ly: number; lz: number } {
  if (vehicle === 'car') {
    return { lx: 0.72, ly: 0.75, lz: -0.05 };
  }
  if (vehicle === 'heli') {
    if (seatIndex === 0) return { lx: -1.05, ly: 1.05, lz: 0.25 };
    if (seatIndex === 1) return { lx: 1.05, ly: 1.05, lz: 0.25 };
    return { lx: 0, ly: 1.05, lz: -1.15 };
  }
  if (vehicle === 'boat') {
    return { lx: 0, ly: 0.48, lz: 1.25 };
  }
  return { lx: 0, ly: 0, lz: 0 };
}

export function computeSeatWorldPos(
  driverX: number,
  driverY: number,
  driverZ: number,
  driverYaw: number,
  vehicle: VehicleMode,
  seatIndex: number,
): { x: number; y: number; z: number } {
  const { lx, ly, lz } = computeVehicleSeatOffset(vehicle, seatIndex);
  const sin = Math.sin(driverYaw);
  const cos = Math.cos(driverYaw);
  return {
    x: driverX + lx * cos + lz * sin,
    y: driverY + ly,
    z: driverZ - lx * sin + lz * cos,
  };
}

interface RemoteAvatar {
  id: string;
  root: THREE.Group;
  avatarHolder: THREE.Group;
  weaponHolder: THREE.Group;
  carShell: THREE.Group;
  heliShell: THREE.Group;
  heliRotor: THREE.Group;
  boatShell: THREE.Group;
  parachuteShell: THREE.Group;
  labelSprite: THREE.Sprite;
  labelCanvas: HTMLCanvasElement;
  labelCtx: CanvasRenderingContext2D;
  labelTex: THREE.CanvasTexture;

  skinId: SkinId;
  weaponId: EquippedWeaponId;
  team: TeamId;
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  vehicle: VehicleMode;
  passengerOf: string | null;
  seatIndex: number;
  vehicleHp: number;
  vehicleMaxHp: number;
  chatText: string;
  chatExpireAt: number;

  targetPos: THREE.Vector3;
  targetYaw: number;
  labelDirty: boolean;
}

interface RemoteProjectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  gravity: number;
  life: number;
}

function buildMiniCarShell(primaryHex: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.72, 4.1),
    new THREE.MeshStandardMaterial({ color: primaryHex, roughness: 0.45 }),
  );
  body.position.y = 0.56;
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.48, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x90e0ef, roughness: 0.2 }),
  );
  glass.position.set(0, 1.08, 0.85);
  g.add(body, glass);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  for (const [wx, wz] of [
    [-1.12, 1.25],
    [1.12, 1.25],
    [-1.12, -1.25],
    [1.12, -1.25],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  g.visible = false;
  return g;
}

function buildMiniHeliShell(): { group: THREE.Group; rotor: THREE.Group } {
  const g = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.5 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 });

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.45, 3.2), redMat);
  cabin.position.y = 1.3;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 3.2), whiteMat);
  tail.position.set(0, 1.5, -2.8);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.7), redMat);
  fin.position.set(0, 2.2, -4.1);
  g.add(cabin, tail, fin);

  const rotor = new THREE.Group();
  rotor.position.set(0, 2.75, 0);
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 0.25), darkMat);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 5.2), darkMat);
  rotor.add(b1, b2);
  g.add(rotor);

  g.visible = false;
  return { group: g, rotor };
}

function buildMiniBoatShell(): THREE.Group {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.65, 3.8),
    new THREE.MeshStandardMaterial({ color: 0x4da89b, roughness: 0.7 }),
  );
  hull.position.y = 0.2;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.16, 3.1),
    new THREE.MeshStandardMaterial({ color: 0xa86b38, roughness: 0.8 }),
  );
  deck.position.y = 0.52;
  g.add(hull, deck);
  g.visible = false;
  return g;
}

function buildMiniParachuteShell(): THREE.Group {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.55, 2.1),
    new THREE.MeshStandardMaterial({ color: 0xff4d6d, roughness: 0.7 }),
  );
  canopy.position.y = 3.4;
  g.add(canopy);
  g.visible = false;
  return g;
}

export class RemotePlayerManager {
  private scene: THREE.Scene;
  private collider: WorldCollider | null;
  private platform: PlatformAdapter;
  private avatars = new Map<string, RemoteAvatar>();
  private projectiles: RemoteProjectile[] = [];
  private projGeoCache = new Map<string, THREE.BufferGeometry>();
  private projMatCache = new Map<string, THREE.MeshBasicMaterial>();

  constructor(scene: THREE.Scene, collider?: WorldCollider | null, platform: PlatformAdapter = createBrowserPlatformAdapter()) {
    this.scene = scene;
    this.collider = collider ?? null;
    this.platform = platform;
  }

  private createAvatar(snap: NetEntitySnapshot): RemoteAvatar {
    const root = new THREE.Group();
    root.position.set(snap.x, snap.y, snap.z);
    root.rotation.y = snap.yaw;

    const avatarHolder = new THREE.Group();
    const skin = SKIN_MAP[snap.skinId] || SKIN_MAP.summer_lotus;
    const tuanMesh = buildSeasonalTuanMesh(skin);
    tuanMesh.position.y = 0.12;
    avatarHolder.add(tuanMesh);
    root.add(avatarHolder);

    const weaponHolder = new THREE.Group();
    if (snap.weaponId) {
      weaponHolder.add(buildWeaponMesh(WEAPON_MAP[snap.weaponId]));
    }
    root.add(weaponHolder);

    const carShell = buildMiniCarShell(skin.palette.carPrimary);
    const heli = buildMiniHeliShell();
    const boatShell = buildMiniBoatShell();
    const parachuteShell = buildMiniParachuteShell();
    root.add(carShell, heli.group, boatShell, parachuteShell);

    const labelCanvas = this.platform.createCanvas(320, 112);
    const labelCtx = labelCanvas.getContext('2d')!;
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.needsUpdate = true;
    const spriteMat = new THREE.SpriteMaterial({
      map: labelTex,
      transparent: true,
      depthTest: false,
    });
    const labelSprite = new THREE.Sprite(spriteMat);
    labelSprite.scale.set(4.6, 1.6, 1);
    labelSprite.position.set(0, 3.6, 0);
    root.add(labelSprite);

    this.scene.add(root);

    const avatar: RemoteAvatar = {
      id: snap.id,
      root,
      avatarHolder,
      weaponHolder,
      carShell,
      heliShell: heli.group,
      heliRotor: heli.rotor,
      boatShell,
      parachuteShell,
      labelSprite,
      labelCanvas,
      labelCtx,
      labelTex,
      skinId: snap.skinId,
      weaponId: snap.weaponId,
      team: snap.team,
      name: snap.name,
      hp: snap.hp,
      maxHp: snap.maxHp,
      alive: snap.alive,
      vehicle: snap.vehicle,
      passengerOf: snap.passengerOf,
      seatIndex: snap.seatIndex,
      vehicleHp: snap.vehicleHp,
      vehicleMaxHp: snap.vehicleMaxHp,
      chatText: '',
      chatExpireAt: 0,
      targetPos: new THREE.Vector3(snap.x, snap.y, snap.z),
      targetYaw: snap.yaw,
      labelDirty: true,
    };
    this.redrawLabel(avatar);
    return avatar;
  }

  private redrawLabel(a: RemoteAvatar) {
    const ctx = a.labelCtx;
    const w = a.labelCanvas.width;
    const h = a.labelCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // 快捷聊天气泡（在名牌上方）
    if (a.chatText) {
      ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif';
      const tw = Math.min(w - 24, ctx.measureText(a.chatText).width + 26);
      const bx = (w - tw) / 2;
      ctx.fillStyle = 'rgba(255, 248, 232, 0.94)';
      ctx.strokeStyle = '#c89b45';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, 6, tw, 36, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#2b2116';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.chatText, w / 2, 24, tw - 16);
    }

    // 阵营色名牌胶囊
    const badgeColor =
      a.team === 'red' ? 'rgba(220, 38, 38, 0.88)' : a.team === 'blue' ? 'rgba(37, 99, 235, 0.88)' : 'rgba(15, 23, 42, 0.82)';
    const borderColor = a.team === 'red' ? '#fca5a5' : a.team === 'blue' ? '#93c5fd' : '#e5c17b';
    const tag = a.team === 'red' ? '红 · ' : a.team === 'blue' ? '蓝 · ' : '';
    const displayName = `${tag}${a.name}`;

    ctx.font = 'bold 21px "PingFang SC", "Microsoft YaHei", sans-serif';
    const nw = Math.min(w - 28, Math.max(120, ctx.measureText(displayName).width + 28));
    const nx = (w - nw) / 2;
    ctx.fillStyle = badgeColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(nx, 48, nw, 34, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayName, w / 2, 65, nw - 16);

    // 血条
    const barW = 116;
    const barX = (w - barW) / 2;
    const ratio = Math.max(0, Math.min(1, a.hp / Math.max(1, a.maxHp)));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(barX, 90, barW, 10);
    ctx.fillStyle = ratio > 0.45 ? '#22c55e' : '#ef4444';
    ctx.fillRect(barX + 1, 91, (barW - 2) * ratio, 8);

    a.labelTex.needsUpdate = true;
    a.labelDirty = false;
  }

  syncEntities(entities: NetEntitySnapshot[], localPlayerId: string) {
    const activeIds = new Set<string>();
    for (const snap of entities) {
      if (snap.id === localPlayerId) continue;
      activeIds.add(snap.id);

      let a = this.avatars.get(snap.id);
      if (!a) {
        a = this.createAvatar(snap);
        this.avatars.set(snap.id, a);
      }

      a.targetPos.set(snap.x, snap.y, snap.z);
      a.targetYaw = snap.yaw;
      a.alive = snap.alive;
      a.root.visible = snap.alive;
      a.vehicle = snap.vehicle;
      a.passengerOf = snap.passengerOf;
      a.seatIndex = snap.seatIndex;
      a.vehicleHp = snap.vehicleHp;
      a.vehicleMaxHp = snap.vehicleMaxHp;

      if (a.skinId !== snap.skinId) {
        a.skinId = snap.skinId;
        while (a.avatarHolder.children.length > 0) {
          const child = a.avatarHolder.children[0];
          a.avatarHolder.remove(child);
          disposeObject3D(child);
        }
        const skin = SKIN_MAP[snap.skinId] || SKIN_MAP.summer_lotus;
        const tuanMesh = buildSeasonalTuanMesh(skin);
        tuanMesh.position.y = 0.12;
        a.avatarHolder.add(tuanMesh);
      }

      if (a.weaponId !== snap.weaponId) {
        a.weaponId = snap.weaponId;
        while (a.weaponHolder.children.length > 0) {
          const child = a.weaponHolder.children[0];
          a.weaponHolder.remove(child);
          disposeObject3D(child);
        }
        if (snap.weaponId) {
          a.weaponHolder.add(buildWeaponMesh(WEAPON_MAP[snap.weaponId]));
        }
      }

      if (a.hp !== snap.hp || a.name !== snap.name || a.team !== snap.team) {
        a.hp = snap.hp;
        a.maxHp = snap.maxHp;
        a.name = snap.name;
        a.team = snap.team;
        a.labelDirty = true;
      }

      a.carShell.visible = snap.vehicle === 'car';
      a.heliShell.visible = snap.vehicle === 'heli';
      a.boatShell.visible = snap.vehicle === 'boat';
      a.parachuteShell.visible = snap.vehicle === 'parachute';
      a.avatarHolder.position.y =
        snap.vehicle === 'heli' ? 1.0 : snap.vehicle === 'car' ? 0.72 : snap.vehicle === 'boat' ? 0.35 : 0;
    }

    // 清理离开房间的玩家模型
    for (const [id, avatar] of this.avatars.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(avatar.root);
        disposeObject3D(avatar.root, { disposeTextures: true });
        this.avatars.delete(id);
      }
    }
  }

  showChatBubble(senderId: string, text: string) {
    const a = this.avatars.get(senderId);
    if (!a) return;
    a.chatText = text;
    a.chatExpireAt = this.platform.now() + 4500;
    a.labelDirty = true;
  }

  spawnProjectileFx(x: number, y: number, z: number, yaw: number, weaponId: WeaponId, pitch = 0) {
    const weapon = WEAPON_MAP[weaponId] || WEAPON_MAP.spring_blaster;
    let geo = this.projGeoCache.get(weapon.id);
    if (!geo) {
      geo = new THREE.SphereGeometry(weapon.id === 'lotus_mortar' ? 0.42 : 0.24, 8, 8);
      this.projGeoCache.set(weapon.id, geo);
    }
    let mat = this.projMatCache.get(weapon.id);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color: weapon.accentColor });
      this.projMatCache.set(weapon.id, mat);
    }
    const mesh = new THREE.Mesh(geo, mat);
    const cosP = Math.cos(pitch);
    const fx = Math.sin(yaw) * cosP;
    const fy = Math.sin(pitch);
    const fz = Math.cos(yaw) * cosP;
    mesh.position.set(x + Math.sin(yaw) * 1.4, y + 1.45, z + Math.cos(yaw) * 1.4);
    this.scene.add(mesh);

    const vel = new THREE.Vector3(fx * weapon.projectileSpeed, fy * weapon.projectileSpeed, fz * weapon.projectileSpeed);
    this.projectiles.push({
      mesh,
      vel,
      gravity: weapon.gravity,
      life: Math.min(3.2, weapon.maxRange / Math.max(10, weapon.projectileSpeed) + (weapon.gravity > 0 ? 0.6 : 0)),
    });
  }

  getPlayerPosition(playerId: string): { x: number; y: number; z: number } | null {
    const a = this.avatars.get(playerId);
    if (!a) return null;
    return { x: a.root.position.x, y: a.root.position.y, z: a.root.position.z };
  }

  /** 返回当前联机房内可被准星锁定的远端敌对目标候选列表 */
  getAimCandidates(localTeam: TeamId, roomMode: 'coop_roam' | 'ffa' | 'team'): AimCandidate[] {
    const out: AimCandidate[] = [];
    for (const a of this.avatars.values()) {
      if (!a.alive) continue;
      if (roomMode === 'team' && localTeam !== 'none' && a.team === localTeam) continue;
      const isHeli = a.vehicle === 'heli';
      out.push({
        id: `remote:${a.id}`,
        x: a.root.position.x,
        y: a.root.position.y + 1.25,
        z: a.root.position.z,
        kind: 'enemy',
        name: a.name,
        hpRatio: a.maxHp > 0 ? a.hp / a.maxHp : undefined,
        directRadius: isHeli ? 2.4 : 1.25,
        assistBaseRadius: isHeli ? 3.8 : 2.1,
        assistMaxRadius: 4.6,
      });
    }
    return out;
  }

  /** 联机准星中心射线目标吸附（跳过队友与死亡目标） */
  findAimTarget(
    rayOrigin: THREE.Vector3,
    rayDir: THREE.Vector3,
    maxRange: number,
    localTeam: TeamId,
    roomMode: 'coop_roam' | 'ffa' | 'team',
  ): { point: THREE.Vector3; kind: 'enemy'; name: string; distance: number; hpRatio?: number } | null {
    const best = selectBestAimTarget({
      rayOrigin,
      rayDir,
      maxRange,
      candidates: this.getAimCandidates(localTeam, roomMode),
      mode: 'roam',
      isMultiplayerCombat: roomMode !== 'coop_roam',
    });
    if (!best) return null;
    return {
      point: new THREE.Vector3(best.x, best.y, best.z),
      kind: 'enemy',
      name: best.name,
      distance: best.distance,
      hpRatio: best.hpRatio,
    };
  }

  findAimTargetPoint(
    rayOrigin: THREE.Vector3,
    rayDir: THREE.Vector3,
    maxRange: number,
    localTeam: TeamId,
    roomMode: 'coop_roam' | 'ffa' | 'team',
  ): THREE.Vector3 | null {
    return this.findAimTarget(rayOrigin, rayDir, maxRange, localTeam, roomMode)?.point ?? null;
  }

  getDriverSeatWorldPos(driverId: string, seatIndex: number): { x: number; y: number; z: number; yaw: number; vehicle: VehicleMode } | null {
    const drv = this.avatars.get(driverId);
    if (!drv || !drv.alive) return null;
    const pos = computeSeatWorldPos(
      drv.root.position.x,
      drv.root.position.y,
      drv.root.position.z,
      drv.root.rotation.y,
      drv.vehicle,
      seatIndex,
    );
    return { ...pos, yaw: drv.root.rotation.y, vehicle: drv.vehicle };
  }

  // 检测 9.5m 内可搭乘的好友/队友载具（跑车 / 直升机 / 小木船）
  findNearbyBoardableVehicle(
    px: number,
    py: number,
    pz: number,
    localTeam: TeamId,
    roomMode: 'coop_roam' | 'ffa' | 'team',
    isPlaying: boolean,
  ): BoardableVehicleHint | null {
    let best: BoardableVehicleHint | null = null;
    let bestD = 9.5;
    for (const a of this.avatars.values()) {
      if (!a.alive) continue;
      if (a.vehicle !== 'car' && a.vehicle !== 'heli' && a.vehicle !== 'boat') continue;
      if (isPlaying) {
        if (roomMode === 'ffa') continue;
        if (roomMode === 'team' && a.team !== localTeam) continue;
      }
      if (Math.abs(py - a.root.position.y) > 5.0) continue;
      const d = Math.hypot(px - a.root.position.x, pz - a.root.position.z);
      if (d < bestD) {
        bestD = d;
        const actionLabel = a.vehicle === 'car' ? '上副驾' : a.vehicle === 'heli' ? '登飞机' : '同乘船';
        const vName = a.vehicle === 'car' ? '敞篷跑车' : a.vehicle === 'heli' ? '直升机' : '小木船';
        best = {
          driverId: a.id,
          driverName: a.name,
          vehicle: a.vehicle,
          actionLabel,
          promptLabel: `按 E 或点「${actionLabel}」搭乘 ${a.name} 的${vName}（副驾可自由开火）`,
        };
      }
    }
    return best;
  }

  // 防止本地玩家与联机好友/远端 AI 角色互相穿模（自动忽略同车司机与本车乘客）
  resolvePlayerPushOut(
    px: number,
    py: number,
    pz: number,
    minDist = 1.35,
    ignoreDriverId: string | null = null,
    localPlayerId = '',
  ): { dx: number; dz: number } {
    let pushX = 0;
    let pushZ = 0;
    for (const a of this.avatars.values()) {
      if (!a.alive) continue;
      if (ignoreDriverId && a.id === ignoreDriverId) continue;
      if (localPlayerId && a.passengerOf === localPlayerId) continue;
      if (Math.abs(py - a.root.position.y) > 2.2) continue;
      const dx = px - a.root.position.x;
      const dz = pz - a.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001 && dist < minDist) {
        const overlap = minDist - dist;
        pushX += (dx / dist) * overlap;
        pushZ += (dz / dist) * overlap;
      } else if (dist <= 0.001) {
        pushX += minDist * 0.5;
      }
    }
    return { dx: pushX, dz: pushZ };
  }

  getMinimapDots(): MinimapTargetDot[] {
    const dots: MinimapTargetDot[] = [];
    for (const a of this.avatars.values()) {
      dots.push({
        x: a.root.position.x,
        z: a.root.position.z,
        team: a.team,
        alive: a.alive,
      });
    }
    return dots;
  }

  update(dt: number, elapsed: number) {
    const now = this.platform.now();
    const alpha = Math.min(1, dt * 12);
    for (const a of this.avatars.values()) {
      // 若距离过远（如传送/复活）直接瞬移，否则平滑插值
      if (a.root.position.distanceToSquared(a.targetPos) > 900) {
        a.root.position.copy(a.targetPos);
      } else {
        a.root.position.lerp(a.targetPos, alpha);
      }

      let diff = a.targetYaw - a.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.root.rotation.y += diff * alpha;

      if (a.vehicle === 'heli') {
        a.heliRotor.rotation.y = elapsed * 32;
      }

      if (a.chatText && now >= a.chatExpireAt) {
        a.chatText = '';
        a.labelDirty = true;
      }
      if (a.labelDirty) {
        this.redrawLabel(a);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const prevX = p.mesh.position.x;
      const prevY = p.mesh.position.y;
      const prevZ = p.mesh.position.z;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const hitWall =
        this.collider &&
        this.collider.raycastSolid(prevX, prevY, prevZ, p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 0.45);
      if (p.life <= 0 || hitWall) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  clear() {
    for (const a of this.avatars.values()) {
      this.scene.remove(a.root);
      disposeObject3D(a.root, { disposeTextures: true });
    }
    this.avatars.clear();
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
    }
    this.projectiles = [];
  }

  dispose() {
    this.clear();
    for (const geo of this.projGeoCache.values()) geo.dispose();
    this.projGeoCache.clear();
    for (const mat of this.projMatCache.values()) mat.dispose();
    this.projMatCache.clear();
  }
}
