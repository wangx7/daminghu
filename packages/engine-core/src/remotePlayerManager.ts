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
import { buildWeaponMesh } from './combatSystem';
import { buildSeasonalTuanMesh } from './skinRenderer';

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
  chatText: string;
  chatExpireAt: number;

  targetPos: THREE.Vector3;
  targetYaw: number;
  labelDirty: boolean;
}

interface RemoteProjectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
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
  private avatars = new Map<string, RemoteAvatar>();
  private projectiles: RemoteProjectile[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
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

    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 320;
    labelCanvas.height = 112;
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

      if (a.skinId !== snap.skinId) {
        a.skinId = snap.skinId;
        while (a.avatarHolder.children.length > 0) a.avatarHolder.remove(a.avatarHolder.children[0]);
        const skin = SKIN_MAP[snap.skinId] || SKIN_MAP.summer_lotus;
        const tuanMesh = buildSeasonalTuanMesh(skin);
        tuanMesh.position.y = 0.12;
        a.avatarHolder.add(tuanMesh);
      }

      if (a.weaponId !== snap.weaponId) {
        a.weaponId = snap.weaponId;
        while (a.weaponHolder.children.length > 0) a.weaponHolder.remove(a.weaponHolder.children[0]);
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
        avatar.labelTex.dispose();
        this.avatars.delete(id);
      }
    }
  }

  showChatBubble(senderId: string, text: string) {
    const a = this.avatars.get(senderId);
    if (!a) return;
    a.chatText = text;
    a.chatExpireAt = performance.now() + 4500;
    a.labelDirty = true;
  }

  spawnProjectileFx(x: number, y: number, z: number, yaw: number, weaponId: WeaponId) {
    const weapon = WEAPON_MAP[weaponId] || WEAPON_MAP.spring_blaster;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(weapon.id === 'lotus_mortar' ? 0.42 : 0.24, 8, 8),
      new THREE.MeshBasicMaterial({ color: weapon.accentColor }),
    );
    mesh.position.set(x + Math.sin(yaw) * 1.4, y + 1.35, z + Math.cos(yaw) * 1.4);
    this.scene.add(mesh);

    const vel = new THREE.Vector3(Math.sin(yaw) * weapon.projectileSpeed, 0, Math.cos(yaw) * weapon.projectileSpeed);
    this.projectiles.push({ mesh, vel, life: weapon.maxRange / Math.max(10, weapon.projectileSpeed) });
  }

  getPlayerPosition(playerId: string): { x: number; y: number; z: number } | null {
    const a = this.avatars.get(playerId);
    if (!a) return null;
    return { x: a.root.position.x, y: a.root.position.y, z: a.root.position.z };
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
    const now = performance.now();
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
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  clear() {
    for (const a of this.avatars.values()) {
      this.scene.remove(a.root);
      a.labelTex.dispose();
    }
    this.avatars.clear();
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
    }
    this.projectiles = [];
  }
}
