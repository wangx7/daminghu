import * as THREE from 'three';
import {
  WEAPON_MAP,
  type CombatScoreboard,
  type EquippedWeaponId,
  type GameMode,
  type KillFeedItem,
  type MinimapTargetDot,
  type TeamId,
  type WeaponConfig,
} from '@daminghu/shared';
import type { GuofengBgmEngine } from './bgmEngine';
import { sampleTerrain } from './legacy/map_data.js';

interface Projectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  origin: THREE.Vector3;
  weapon: WeaponConfig;
  ownerTeam: TeamId;
  fromPlayer: boolean;
  life: number;
}

interface SplashRing {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  maxRadius: number;
}

interface PracticeBot {
  id: string;
  name: string;
  team: TeamId;
  root: THREE.Group;
  hpBarFill: THREE.Mesh;
  pos: THREE.Vector3;
  homePos: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  fireCooldown: number;
  patrolPhase: number;
}

interface WildlifeTarget {
  kind: 'bird' | 'fish';
  name: string;
  root: THREE.Group;
  wingL?: THREE.Mesh;
  wingR?: THREE.Mesh;
  tail?: THREE.Mesh;
  center: THREE.Vector3;
  radius: number;
  speed: number;
  phase: number;
  altitude: number;
  alive: boolean;
  respawnTimer: number;
}

export function buildWeaponMesh(weapon: WeaponConfig): THREE.Group {
  const g = new THREE.Group();
  const mainMat = new THREE.MeshStandardMaterial({ color: weapon.color, roughness: 0.42, metalness: 0.12 });
  const accMat = new THREE.MeshStandardMaterial({ color: weapon.accentColor, roughness: 0.32, metalness: 0.18 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.8 });

  if (weapon.id === 'spring_blaster') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.96), mainMat);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.42), accMat);
    barrel.position.set(0, 0.04, 0.58);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.42, 8), accMat);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, 0.22, -0.06);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.18), gripMat);
    grip.position.set(0, -0.22, -0.24);
    g.add(body, barrel, tank, grip);
  } else if (weapon.id === 'lotus_mortar') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 1.12, 8), mainMat);
    tube.rotation.x = Math.PI / 2;
    const petal = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.24, 0.24, 6), accMat);
    petal.rotation.x = Math.PI / 2;
    petal.position.z = 0.52;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12), accMat);
    ring.position.z = -0.15;
    g.add(tube, petal, ring);
  } else {
    // 鹊华长弓
    const bowUpper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.14), mainMat);
    bowUpper.position.set(0, 0.34, 0.06);
    bowUpper.rotation.x = -0.24;
    const bowLower = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.14), mainMat);
    bowLower.position.set(0, -0.34, 0.06);
    bowLower.rotation.x = 0.24;
    const string = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.28, 0.025), accMat);
    string.position.z = -0.12;
    const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.15), accMat);
    arrow.position.z = 0.24;
    g.add(bowUpper, bowLower, string, arrow);
  }
  g.position.set(0.85, 1.05, 0.45);
  return g;
}

function buildBotMesh(team: TeamId): { root: THREE.Group; hpBarFill: THREE.Mesh } {
  const root = new THREE.Group();
  const primary = team === 'red' ? 0xe63946 : team === 'blue' ? 0x2563eb : 0xf59e0b;
  const bodyMat = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.65 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6eb, roughness: 0.7 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.35, 1.1), bodyMat);
  body.position.y = 0.9;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.05), headMat);
  head.position.y = 1.95;
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.08), eyeMat);
  eyeL.position.set(-0.26, 2.02, 0.54);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.26;

  const barBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 0.22),
    new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide }),
  );
  barBg.position.y = 2.95;
  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.62, 0.14),
    new THREE.MeshBasicMaterial({ color: primary, side: THREE.DoubleSide }),
  );
  hpBarFill.position.set(0, 2.95, 0.02);

  root.add(body, head, eyeL, eyeR, barBg, hpBarFill);
  return { root, hpBarFill };
}

function buildBirdTargetMesh(colorHex: number): { root: THREE.Group; wingL: THREE.Mesh; wingR: THREE.Mesh } {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 1.25), bodyMat);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.42), beakMat);
  beak.position.set(0, 0.04, 0.78);
  const wingGeo = new THREE.BoxGeometry(1.15, 0.12, 0.62);
  const wingL = new THREE.Mesh(wingGeo, bodyMat);
  wingL.position.set(-0.85, 0.1, 0);
  const wingR = new THREE.Mesh(wingGeo, bodyMat);
  wingR.position.set(0.85, 0.1, 0);
  root.add(body, beak, wingL, wingR);
  return { root, wingL, wingR };
}

function buildFishTargetMesh(colorHex: number): { root: THREE.Group; tail: THREE.Mesh } {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfff8eb, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 1.45), bodyMat);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.44, 0.38), stripeMat);
  stripe.position.z = 0.15;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.58, 0.62), bodyMat);
  tail.position.z = -0.95;
  root.add(body, stripe, tail);
  return { root, tail };
}

export class CombatSystem {
  private scene: THREE.Scene;
  private bgm: GuofengBgmEngine;
  private projectiles: Projectile[] = [];
  private splashes: SplashRing[] = [];
  private bots: PracticeBot[] = [];
  private wildlife: WildlifeTarget[] = [];
  private playerWeaponMesh: THREE.Group | null = null;
  private mountedRoot: THREE.Group | null = null;

  /** 默认空手（无武器、无对战状态） */
  public weaponId: EquippedWeaponId = null;
  public cooldown = 0;
  public mode: GameMode = 'roam';
  public playerTeam: TeamId = 'none';
  public playerHp = 100;
  public readonly playerMaxHp = 100;

  public scoreboard: CombatScoreboard = {
    mode: 'roam',
    redScore: 0,
    blueScore: 0,
    playerKills: 0,
    playerHits: 0,
    birdsCaught: 0,
    fishCaught: 0,
    timeRemainingSec: 180,
    activeTargets: 0,
  };

  private feedSeq = 1;
  public onKillFeed?: (item: KillFeedItem) => void;

  constructor(scene: THREE.Scene, bgm: GuofengBgmEngine) {
    this.scene = scene;
    this.bgm = bgm;
    this.spawnWildlife(-210, 210);
  }

  mountWeaponToPlayer(playerRoot: THREE.Group) {
    this.mountedRoot = playerRoot;
    this.setWeapon(this.weaponId);
  }

  setWeapon(id: EquippedWeaponId) {
    this.weaponId = id;
    if (this.mountedRoot) {
      if (this.playerWeaponMesh) {
        this.mountedRoot.remove(this.playerWeaponMesh);
        this.playerWeaponMesh = null;
      }
      if (id !== null) {
        this.playerWeaponMesh = buildWeaponMesh(WEAPON_MAP[id]);
        this.mountedRoot.add(this.playerWeaponMesh);
      }
    }
  }

  setMode(mode: GameMode, centerX: number, centerZ: number) {
    this.mode = mode;
    this.clearBots();
    this.playerHp = this.playerMaxHp;
    this.scoreboard = {
      mode,
      redScore: 0,
      blueScore: 0,
      playerKills: 0,
      playerHits: 0,
      birdsCaught: this.scoreboard.birdsCaught,
      fishCaught: this.scoreboard.fishCaught,
      timeRemainingSec: 180,
      activeTargets: 0,
    };

    if (mode === 'roam') {
      this.playerTeam = 'none';
      return;
    }

    if (mode === 'hunt') {
      this.playerTeam = 'none';
      this.clearWildlife();
      this.spawnWildlife(centerX, centerZ - 45);
      return;
    }

    if (mode === 'practice_solo') {
      this.playerTeam = 'red';
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const dist = 26 + (i % 2) * 14;
        this.spawnBot(`solo-${i}`, `游侠靶 ${i + 1}`, 'blue', centerX + Math.cos(angle) * dist, centerZ + Math.sin(angle) * dist, i * 1.1);
      }
    } else if (mode === 'practice_team') {
      this.playerTeam = 'red';
      for (let i = 0; i < 3; i++) {
        const x = centerX - 14 + i * 12;
        const z = centerZ - 14;
        this.spawnBot(`red-${i}`, `超然红队·${i + 1}`, 'red', x, z, i * 1.4);
      }
      for (let i = 0; i < 4; i++) {
        const x = centerX - 20 + i * 13;
        const z = centerZ - 52;
        this.spawnBot(`blue-${i}`, `历下蓝队·${i + 1}`, 'blue', x, z, i * 1.2 + 0.5);
      }
    }
  }

  private clearWildlife() {
    for (const w of this.wildlife) this.scene.remove(w.root);
    this.wildlife = [];
  }

  private spawnWildlife(centerX: number, centerZ: number) {
    // 6 只盘旋的湖畔飞鸟（白鹭/翠鸟/金莺）
    const birdSpecs = [
      { name: '明湖白鹭', color: 0xf8fafc, r: 24, alt: 10.5, spd: 0.72 },
      { name: '柳梢翠鸟', color: 0x2ec4b6, r: 19, alt: 8.5, spd: 0.88 },
      { name: '荷塘金莺', color: 0xfbbf24, r: 30, alt: 12.0, spd: 0.64 },
      { name: '明湖白鹭', color: 0xf1f5f9, r: 26, alt: 9.5, spd: -0.78 },
      { name: '湖心红嘴鸥', color: 0xffe4e6, r: 34, alt: 11.2, spd: 0.58 },
      { name: '柳梢翠鸟', color: 0x38bdf8, r: 22, alt: 8.0, spd: -0.84 },
    ];
    birdSpecs.forEach((b, i) => {
      const { root, wingL, wingR } = buildBirdTargetMesh(b.color);
      this.scene.add(root);
      this.wildlife.push({
        kind: 'bird',
        name: b.name,
        root,
        wingL,
        wingR,
        center: new THREE.Vector3(centerX + (i % 3 - 1) * 18, 0, centerZ - 18),
        radius: b.r,
        speed: b.spd,
        phase: i * 1.05,
        altitude: b.alt,
        alive: true,
        respawnTimer: 0,
      });
    });

    // 6 条湖面大锦鲤（靠近湖岸水域，适合抓鱼）
    const fishColors = [0xff595e, 0xff9f1c, 0xffca3a, 0xff595e, 0xf97316, 0xfbbf24];
    for (let i = 0; i < 6; i++) {
      const { root, tail } = buildFishTargetMesh(fishColors[i]);
      this.scene.add(root);
      this.wildlife.push({
        kind: 'fish',
        name: i % 2 === 0 ? '赤金大锦鲤' : '明湖红鲤',
        root,
        tail,
        center: new THREE.Vector3(centerX + (i - 2.5) * 20, 0, centerZ - 72 - (i % 2) * 24),
        radius: 10 + (i % 3) * 4,
        speed: (i % 2 === 0 ? 1 : -1) * (0.55 + (i % 3) * 0.14),
        phase: i * 1.3,
        altitude: 0.45,
        alive: true,
        respawnTimer: 0,
      });
    }
  }

  private spawnBot(id: string, name: string, team: TeamId, x: number, z: number, phase: number) {
    const y = Math.max(1.2, sampleTerrain(x, z));
    const { root, hpBarFill } = buildBotMesh(team);
    root.position.set(x, y, z);
    this.scene.add(root);
    this.bots.push({
      id,
      name,
      team,
      root,
      hpBarFill,
      pos: new THREE.Vector3(x, y, z),
      homePos: new THREE.Vector3(x, y, z),
      yaw: 0,
      hp: 100,
      maxHp: 100,
      alive: true,
      respawnTimer: 0,
      fireCooldown: 1.4 + Math.random() * 1.4,
      patrolPhase: phase,
    });
  }

  private clearBots() {
    for (const b of this.bots) {
      this.scene.remove(b.root);
    }
    this.bots = [];
  }

  firePlayer(playerPos: THREE.Vector3, yaw: number, pitch = 0.06): boolean {
    if (this.weaponId === null || this.cooldown > 0) return false;
    const weapon = WEAPON_MAP[this.weaponId];
    this.cooldown = weapon.cooldownSec;

    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch) + (weapon.gravity > 0 ? 0.24 : 0.04),
      Math.cos(yaw) * Math.cos(pitch),
    ).normalize();

    const origin = new THREE.Vector3(
      playerPos.x + Math.sin(yaw) * 1.4,
      playerPos.y + 1.45,
      playerPos.z + Math.cos(yaw) * 1.4,
    );
    this.spawnProjectile(origin, dir, weapon, this.playerTeam, true);
    this.bgm.playWeaponFire(weapon.id);
    return true;
  }

  private spawnProjectile(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    weapon: WeaponConfig,
    ownerTeam: TeamId,
    fromPlayer: boolean,
  ) {
    const geo =
      weapon.id === 'quehua_bow'
        ? new THREE.BoxGeometry(0.14, 0.14, 1.35)
        : new THREE.SphereGeometry(weapon.projectileRadius, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: weapon.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(dir));
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      vel: dir.clone().multiplyScalar(weapon.projectileSpeed),
      origin: origin.clone(),
      weapon,
      ownerTeam,
      fromPlayer,
      life: 3.2,
    });
  }

  private spawnSplash(pos: THREE.Vector3, color: number, radius: number) {
    const geo = new THREE.RingGeometry(0.4, Math.max(1.2, radius * 0.55), 18);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.25, pos.z);
    this.scene.add(mesh);
    this.splashes.push({ mesh, age: 0, maxAge: 0.42, maxRadius: Math.max(1.6, radius) });
  }

  private emitFeed(text: string, team: TeamId) {
    this.onKillFeed?.({
      id: this.feedSeq++,
      text,
      team,
      timestamp: Date.now(),
    });
  }

  getCooldownRatio(): number {
    if (this.weaponId === null) return 0;
    const cd = WEAPON_MAP[this.weaponId].cooldownSec;
    return cd > 0 ? Math.max(0, Math.min(1, this.cooldown / cd)) : 0;
  }

  getMinimapTargets(): MinimapTargetDot[] {
    return this.bots.map((b) => ({
      x: b.pos.x,
      z: b.pos.z,
      team: b.team,
      alive: b.alive,
    }));
  }

  update(dt: number, elapsed: number, playerPos: THREE.Vector3, camera: THREE.Camera) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);

    if ((this.mode === 'practice_solo' || this.mode === 'practice_team') && this.scoreboard.timeRemainingSec > 0) {
      this.scoreboard.timeRemainingSec = Math.max(0, this.scoreboard.timeRemainingSec - dt);
    }

    // 0. 更新湖畔飞鸟与大锦鲤动画
    for (const w of this.wildlife) {
      if (!w.alive) {
        w.respawnTimer -= dt;
        if (w.respawnTimer <= 0) {
          w.alive = true;
          w.root.visible = true;
        }
        continue;
      }
      const a = elapsed * w.speed + w.phase;
      const nx = w.center.x + Math.cos(a) * w.radius;
      const nz = w.center.z + Math.sin(a) * w.radius;
      const ny = w.kind === 'bird' ? w.altitude + Math.sin(elapsed * 2.4 + w.phase) * 1.4 : w.altitude + Math.sin(elapsed * 3 + w.phase) * 0.14;
      const dx = -Math.sin(a) * w.speed;
      const dz = Math.cos(a) * w.speed;
      w.root.position.set(nx, ny, nz);
      w.root.rotation.y = Math.atan2(dx, dz);
      if (w.wingL && w.wingR) {
        const flap = Math.sin(elapsed * 12 + w.phase) * 0.55;
        w.wingL.rotation.z = flap;
        w.wingR.rotation.z = -flap;
      }
      if (w.tail) {
        w.tail.rotation.y = Math.sin(elapsed * 9 + w.phase) * 0.42;
      }
    }

    // 1. 更新 AI Bot 巡逻、重生与交火
    let aliveCount = 0;
    for (const bot of this.bots) {
      if (!bot.alive) {
        bot.respawnTimer -= dt;
        if (bot.respawnTimer <= 0) {
          bot.alive = true;
          bot.hp = bot.maxHp;
          bot.pos.copy(bot.homePos);
          bot.root.visible = true;
          bot.hpBarFill.scale.x = 1;
        }
        continue;
      }
      aliveCount++;
      const t = elapsed * 0.75 + bot.patrolPhase;
      const targetX = bot.homePos.x + Math.sin(t) * 8.5;
      const targetZ = bot.homePos.z + Math.cos(t * 0.8) * 6.5;
      const dx = targetX - bot.pos.x;
      const dz = targetZ - bot.pos.z;
      bot.pos.x += dx * Math.min(1, dt * 1.6);
      bot.pos.z += dz * Math.min(1, dt * 1.6);
      bot.pos.y = Math.max(1.2, sampleTerrain(bot.pos.x, bot.pos.z));
      bot.yaw = Math.atan2(dx, dz);
      bot.root.position.copy(bot.pos);
      bot.root.rotation.y = bot.yaw;
      bot.hpBarFill.lookAt(camera.position);

      if (this.mode === 'practice_team') {
        bot.fireCooldown -= dt;
        if (bot.fireCooldown <= 0) {
          bot.fireCooldown = 1.6 + Math.random() * 1.4;
          const enemy = this.bots.find((other) => other.alive && other.team !== bot.team);
          if (enemy && enemy.pos.distanceTo(bot.pos) < 85) {
            const aim = enemy.pos.clone().sub(bot.pos);
            aim.y += 1.0;
            this.spawnProjectile(
              bot.pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
              aim.normalize(),
              WEAPON_MAP.spring_blaster,
              bot.team,
              false,
            );
          }
        }
      }
    }
    this.scoreboard.activeTargets = aliveCount;

    // 2. 更新弹道与命中判定（含飞鸟与锦鲤捕获）
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vel.y -= p.weapon.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.lookAt(p.mesh.position.clone().add(p.vel));

      const groundY = Math.max(0.4, sampleTerrain(p.mesh.position.x, p.mesh.position.z));
      let hit = false;

      // 命中飞鸟 / 锦鲤检测
      if (p.fromPlayer) {
        for (const w of this.wildlife) {
          if (!w.alive) continue;
          const hitRadius = (w.kind === 'bird' ? 2.4 : 2.6) + p.weapon.projectileRadius;
          if (p.mesh.position.distanceTo(w.root.position) < hitRadius) {
            this.catchWildlife(w, p.weapon);
            hit = true;
            break;
          }
        }
      }

      // 命中 Bot 检测
      if (!hit) {
        for (const bot of this.bots) {
          if (!bot.alive) continue;
          if (p.ownerTeam !== 'none' && bot.team === p.ownerTeam) continue;
          const dist = p.mesh.position.distanceTo(new THREE.Vector3(bot.pos.x, bot.pos.y + 1.3, bot.pos.z));
          if (dist < 1.85 + p.weapon.projectileRadius) {
            this.applyDamageToBot(bot, p.weapon.damage, p.fromPlayer, p.ownerTeam, p.vel);
            hit = true;
            break;
          }
        }
      }

      if (!hit && (p.mesh.position.y <= groundY || p.mesh.position.distanceTo(p.origin) > p.weapon.maxRange || p.life <= 0)) {
        hit = true;
      }

      if (hit) {
        if (p.weapon.splashRadius > 0) {
          this.spawnSplash(p.mesh.position, p.weapon.color, p.weapon.splashRadius);
          // 荷花水炮落水溅射也可一次性抓鱼！
          if (p.fromPlayer) {
            for (const w of this.wildlife) {
              if (!w.alive) continue;
              if (p.mesh.position.distanceTo(w.root.position) <= p.weapon.splashRadius) {
                this.catchWildlife(w, p.weapon);
              }
            }
          }
          for (const bot of this.bots) {
            if (!bot.alive) continue;
            if (p.ownerTeam !== 'none' && bot.team === p.ownerTeam) continue;
            const d = p.mesh.position.distanceTo(bot.pos);
            if (d <= p.weapon.splashRadius) {
              const falloff = 1 - (d / p.weapon.splashRadius) * 0.55;
              this.applyDamageToBot(bot, Math.round(p.weapon.damage * falloff), p.fromPlayer, p.ownerTeam, p.vel);
            }
          }
        } else {
          this.spawnSplash(p.mesh.position, p.weapon.color, 1.8);
        }
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // 3. 更新水花扩散环
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.age += dt;
      const ratio = s.age / s.maxAge;
      if (ratio >= 1) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        this.splashes.splice(i, 1);
      } else {
        const scale = 0.4 + ratio * (s.maxRadius * 0.35);
        s.mesh.scale.setScalar(scale);
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.78 * (1 - ratio);
      }
    }

    if (this.playerHp < this.playerMaxHp) {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + dt * 4);
    }
    void playerPos;
  }

  private catchWildlife(w: WildlifeTarget, weapon: WeaponConfig) {
    if (!w.alive) return;
    w.alive = false;
    w.respawnTimer = 5.0;
    w.root.visible = false;
    this.spawnSplash(w.root.position, w.kind === 'bird' ? 0xfde047 : 0x38bdf8, 3.2);
    this.bgm.playHit(true);
    if (w.kind === 'bird') {
      this.scoreboard.birdsCaught++;
      this.emitFeed(`团团 用 ${weapon.name} 惊起一只「${w.name}」+1`, 'none');
    } else {
      this.scoreboard.fishCaught++;
      this.emitFeed(`团团 用 ${weapon.name} 捕获一条「${w.name}」+1`, 'none');
    }
  }

  private applyDamageToBot(bot: PracticeBot, dmg: number, fromPlayer: boolean, ownerTeam: TeamId, vel: THREE.Vector3) {
    if (!bot.alive) return;
    bot.hp = Math.max(0, bot.hp - dmg);
    bot.hpBarFill.scale.x = Math.max(0.01, bot.hp / bot.maxHp);

    const push = new THREE.Vector3(vel.x, 0, vel.z).normalize().multiplyScalar(1.2);
    bot.pos.add(push);

    if (fromPlayer) {
      this.scoreboard.playerHits++;
    }

    if (bot.hp <= 0) {
      bot.alive = false;
      bot.respawnTimer = 4.5;
      bot.root.visible = false;
      if (fromPlayer) {
        this.scoreboard.playerKills++;
        this.bgm.playHit(true);
        this.emitFeed(`团团 击败了 ${bot.name}`, ownerTeam);
      }
      if (ownerTeam === 'red') this.scoreboard.redScore++;
      if (ownerTeam === 'blue') this.scoreboard.blueScore++;
    } else if (fromPlayer) {
      this.bgm.playHit(false);
    }
  }
}
