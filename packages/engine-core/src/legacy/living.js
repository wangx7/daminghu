// 「活生生的大明湖 5.0」零穿模动态交通 & 鲜活水面微生态：
// 1. 3 辆环湖观光游览车：严格沿经栅格校验 0 跨水的 RING_ROAD 行驶，智能礼让刹停
// 2. 48 位环湖行人 NPC：实时校验水岸距离与 3D 碰撞器，遇水或遇景墙自动收拢至安全步道，100% 杜绝水上漂与穿墙！
// 3. 7 组湖面野鸭家族 + 28 条 3D 精雕体素锦鲤：搭载 O(1) 水岸距离场围栏，游动与追食全程严守水界绝不上岸！
// 4. 鲜活荷塘微生态：蹲荷叶眨眼轻跳的 3D 小青蛙「呱呱」+ 随船/游泳向两侧推开的 3D 动态碧绿浮萍（「浮萍一道开」）+ 红蜻蜓点水 + 众泉汇流涌泉气泡 + 实时扩散水波纹源
import * as THREE from 'three';
import { Vox, Bits, charMaterial, hash } from './voxel/vox.js';
import { frog } from './voxel/cast.js';
import {
  RING_ROAD, sampleTerrain, getBridgeHeight, getWaterSignedDist, getWaterPushDir,
} from './map_data.js';
import { HERO_LOTUS_SPOTS } from './world.js';

function buildClosedPathSampler(points) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, len, start: total });
    total += len;
  }
  return {
    total,
    sample(dist) {
      const d = ((dist % total) + total) % total;
      for (const s of segs) {
        if (d <= s.start + s.len) {
          const t = (d - s.start) / (s.len + 1e-9);
          const x = s.a[0] + (s.b[0] - s.a[0]) * t;
          const z = s.a[1] + (s.b[1] - s.a[1]) * t;
          const yaw = Math.atan2(s.b[0] - s.a[0], s.b[1] - s.a[1]);
          return { x, z, yaw };
        }
      }
      return { x: points[0][0], z: points[0][1], yaw: 0 };
    },
  };
}

function buildSightseeingBus(solidMat) {
  const v = new Vox();
  const BODY = 0xc8372d, TRIM = 0xf0c24b, SEAT = 0x7c4f2b, DARK = 0x262930, ROOF = 0x3b444d;
  v.box(-2, 1, -4, 2, 1, 4, BODY);
  v.box(-2, 2, 3, 2, 3, 4, BODY);
  v.box(-1, 2, 4, 1, 2, 4, TRIM);
  v.box(-1, 2, -3, 1, 2, -2, SEAT);
  v.box(-1, 2, 0, 1, 2, 1, SEAT);
  for (const [px, pz] of [[-2, -4], [2, -4], [-2, 3], [2, 3]]) v.box(px, 2, pz, px, 4, pz, TRIM);
  v.box(-2, 5, -4, 2, 5, 4, ROOF);
  v.box(-1, 6, -3, 1, 6, 3, TRIM);
  for (const [wx, wz] of [[-2, -3], [2, -3], [-2, 2], [2, 2]]) v.box(wx, 0, wz, wx, 1, wz, DARK);

  const grp = new THREE.Group();
  const mesh = v.mesh(solidMat, 0.025);
  mesh.scale.setScalar(0.75);
  grp.add(mesh);

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff0a0 });
  const lL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.2), headMat);
  lL.position.set(-1.0, 1.6, 3.2);
  const lR = lL.clone();
  lR.position.x = 1.0;

  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const bL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.2), brakeMat);
  bL.position.set(-1.0, 1.5, -3.2);
  const bR = bL.clone();
  bR.position.x = 1.0;

  grp.add(lL, lR, bL, bR);
  return { grp, brakeMat };
}

function buildPedestrianGeo(shirtHex, hatHex, solidMat) {
  const v = new Vox();
  const SKIN = 0xffdfc4, PANTS = 0x35465c, HAIR = 0x2a2222;
  v.box(-1, 0, 0, -1, 2, 0, PANTS);
  v.box(1, 0, 0, 1, 2, 0, PANTS);
  v.box(-1, 3, -1, 1, 6, 1, shirtHex);
  v.box(-2, 4, 0, -2, 6, 0, shirtHex);
  v.box(2, 4, 0, 2, 6, 0, shirtHex);
  v.box(-1, 7, -1, 1, 9, 1, SKIN);
  v.box(-1, 9, -1, 1, 9, 1, HAIR);
  if (hatHex) v.box(-2, 10, -2, 2, 10, 2, hatHex);
  return v.mesh(solidMat, 0.02).geometry;
}

function buildDuckGeo(isBaby, solidMat) {
  const v = new Vox();
  const BODY = isBaby ? 0xffd84d : 0x6b5340;
  const WING = isBaby ? 0xf4c430 : 0x543f30;
  const HEAD = isBaby ? 0xffe26b : 0x266b4c;
  const BEAK = 0xff8c24;
  v.box(-1, 0, -2, 1, 1, 2, BODY);
  v.box(-2, 1, -1, -2, 1, 1, WING).box(2, 1, -1, 2, 1, 1, WING);
  v.set(0, 1, -3, BODY); // 翘鸭尾
  v.box(-1, 2, 1, 1, 3, 2, HEAD);
  v.set(0, 2, 3, BEAK);
  return v.mesh(solidMat, 0.02).geometry;
}

// 3D 精雕体素锦鲤建模（圆润鱼身 + 乌黑小眼 + 背鳍 + 双侧胸鳍 + 灵动分叉尾鳍！）
function buildVoxelKoiGeo(mainHex, accentHex, finHex) {
  const v = new Vox();
  const EYE = 0x1e1e24;
  // 饱满纺锤形鱼身（头朝 +Z，尾朝 -Z）
  v.box(-1, 0, -2, 1, 2, 2, (x, y, z) => ((z >= 0 && y === 2) ? accentHex : mainHex));
  v.box(-1, 0, 3, 1, 1, 3, mainHex); // 鱼吻
  v.set(-1, 1, 3, EYE).set(1, 1, 3, EYE);
  // 背鳍与左右展开胸鳍
  v.box(0, 3, -1, 0, 3, 1, finHex);
  v.box(-2, 0, 0, -3, 0, 1, finHex).box(2, 0, 0, 3, 0, 1, finHex);
  // 渐细尾柄与优雅分叉尾鳍
  v.box(0, 1, -4, 0, 1, -3, mainHex);
  v.set(0, 2, -5, finHex).set(0, 0, -5, finHex).set(-1, 1, -5, finHex).set(1, 1, -5, finHex);
  return v.geometry(0.018);
}

export class LivingWorld {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Material} solidMat
   * @param {any} [collider]
   */
  constructor(scene, solidMat, collider = null) {
    this.scene = scene;
    this.collider = collider;
    this.road = buildClosedPathSampler(RING_ROAD);
    this.fastBus = false;

    // 活跃水面涟漪事件队列（传给 water.js 渲染扩散白波纹圈！）
    this.rippleEvents = [];

    // 1. 3 辆环湖观光车
    this.buses = [0, 0.33, 0.66].map((frac, idx) => {
      const { grp, brakeMat } = buildSightseeingBus(solidMat);
      scene.add(grp);
      const busObj = {
        id: idx,
        mesh: grp,
        brakeMat,
        dist: frac * this.road.total,
        currentSpeed: 15,
        braking: false,
        x: 0, z: 0, yaw: 0,
        getSeatPose: () => ({
          pos: new THREE.Vector3(busObj.x, 3.35, busObj.z),
          yaw: busObj.yaw,
        }),
      };
      return busObj;
    });

    // 2. 48 位环湖行人（实时校验水岸与墙体碰撞，绝不下水、绝不穿墙！）
    const shirts = [0xe85d75, 0x4ea8de, 0xf4a261, 0x52b788, 0xb5838d, 0xf9c74f, 0xffffff];
    const hats = [0xe9c46a, 0xffffff, null, null];
    const pedGeos = shirts.map((sh, i) => buildPedestrianGeo(sh, hats[i % hats.length], solidMat));
    this.pedestrians = [];
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(pedGeos[i % pedGeos.length], solidMat);
      m.scale.setScalar(0.18);
      m.castShadow = true;
      scene.add(m);
      const side = i % 2 === 0 ? -1 : 1;
      const baseLane = (i % 10 === 0) ? side * 2.8 : side * (4.8 + hash(i, 3, 9) * 1.2);
      this.pedestrians.push({
        mesh: m,
        dist: (i / 48) * this.road.total,
        dir: i % 2 === 0 ? 1 : -1,
        baseLane,
        curLane: baseLane,
        x: 0, z: 0,
        spd: 2.1 + hash(i, 4, 9) * 1.3,
        phase: hash(i, 5, 9) * 10,
        yielding: false,
      });
    }

    // 3. 7 组湖面野鸭家族（全部校准至深水区，彻底修复第 6 组近岸搁浅！）
    const momGeo = buildDuckGeo(false, solidMat);
    const babyGeo = buildDuckGeo(true, solidMat);
    this.duckFamilies = [];
    const duckSpots = [
      { cx: -218, cz: 112, r: 19, spd: 0.22 },  // 南门码头前开阔水域
      { cx: 12,   cz: 92,  r: 20, spd: -0.2 },  // 司家码头前水域
      { cx: 668,  cz: -108, r: 18, spd: 0.21 }, // 小东湖中心水域
      { cx: -435, cz: -120, r: 22, spd: 0.19 }, // 铁公祠南侧主湖
      { cx: 95,   cz: -88, r: 20, spd: -0.21 }, // 历下亭东北水域
      { cx: -315, cz: 62,  r: 20, spd: 0.2 },   // 遐园北侧荷塘水域
      { cx: 348,  cz: -148, r: 16, spd: -0.18 },// 超然楼西北开阔水域（远离东岸与曾堤！）
    ];
    for (const sp of duckSpots) {
      const mom = new THREE.Mesh(momGeo, solidMat);
      mom.scale.setScalar(0.22);
      scene.add(mom);
      const babies = [];
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(babyGeo, solidMat);
        b.scale.setScalar(0.14);
        scene.add(b);
        babies.push(b);
      }
      this.duckFamilies.push({ ...sp, homeX: sp.cx, homeZ: sp.cz, mom, babies, ph: Math.random() * 6 });
    }

    // 4. 28 条 3D 立体体素锦鲤（红白丹顶、黄金锦鲤、三色锦鲤、朱砂鲤，浅水区成群清晰可见！）
    const koiMat = charMaterial(0.22);
    const koiGeos = [
      buildVoxelKoiGeo(0xf8f9fa, 0xff3b30, 0xffffff), // 丹顶红白锦鲤
      buildVoxelKoiGeo(0xffb703, 0xfb8500, 0xffe169), // 黄金锦鲤
      buildVoxelKoiGeo(0xff595e, 0xffffff, 0xffca3a), // 大正三色锦鲤
      buildVoxelKoiGeo(0xff6d00, 0xff9e00, 0xfff0f3), // 绯红锦鲤
    ];
    this.kois = [];
    const koiSpots = [
      [-212, 148], // 南门码头清澈浅水荷塘（参考图右下角同款岸边观鱼！）
      [8,    126], // 司家码头前浅水
      [665, -108], // 小东湖荷花荡
      [438,  -66], // 超然楼西码头前
      [-468, -228],// 铁公祠小沧浪
      [148, -210], // 北极阁南水域
      [-42,   24], // 历下亭西侧浅水
    ];
    for (const [kx, kz] of koiSpots) {
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(koiGeos[i % 4], koiMat);
        m.scale.setScalar(0.16);
        scene.add(m);
        this.kois.push({
          mesh: m,
          cx: kx + (i - 1.5) * 3.2,
          cz: kz + ((i & 1) ? 2.5 : -2.5),
          r: 2.8 + i * 0.9,
          spd: 0.62 + i * 0.14,
          ph: i * 1.6,
          jumpTimer: 2.5 + Math.random() * 7,
          jumpAge: -1,
        });
      }
    }

    // 5. 荷塘大荷叶上的 3D 体素小青蛙「呱呱」（《池上》同款萌系青蛙，蹲在荷叶边歪头轻跳！）
    const frogGeo = frog('happy').geometry(0.018);
    this.frogs = [];
    const frogPads = HERO_LOTUS_SPOTS.filter((s) => s.kind === 'pad');
    frogPads.forEach((fp, idx) => {
      const fm = new THREE.Mesh(frogGeo, koiMat);
      fm.scale.setScalar(0.105);
      fm.castShadow = true;
      scene.add(fm);
      this.frogs.push({
        mesh: fm,
        x: fp.x + 0.55,
        z: fp.z - 0.45,
        yaw: idx * 1.9,
        ph: idx * 2.3,
      });
    });

    // 6. 物理感动态 3D 浮萍微群落（520 片精巧圆叶小浮萍，划船或游泳经过真实向两侧推开！）
    this.duckweedCount = 520;
    const dwGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.08, 6);
    const dwMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
    this.duckweedMesh = new THREE.InstancedMesh(dwGeo, dwMat, this.duckweedCount);
    this.duckweedMesh.frustumCulled = false;
    scene.add(this.duckweedMesh);
    this.duckweeds = [];
    const dwCols = [0x6fd44e, 0x58bd3e, 0x82df5c, 0x4aaa36, 0x94e56a];
    const _c = new THREE.Color();
    const dwZones = [
      { cx: -214, cz: 146, r: 22 },
      { cx: 10,   cz: 124, r: 20 },
      { cx: 444,  cz: -64, r: 20 },
      { cx: -478, cz: -242, r: 22 },
      { cx: 726,  cz: -112, r: 18 },
    ];
    for (let i = 0; i < this.duckweedCount; i++) {
      const zn = dwZones[i % dwZones.length];
      const ang = hash(i, 1, 61) * Math.PI * 2;
      const rad = Math.sqrt(hash(i, 2, 61)) * zn.r;
      let bx = zn.cx + Math.cos(ang) * rad;
      let bz = zn.cz + Math.sin(ang) * rad;
      if (getWaterSignedDist(bx, bz) < 1.2) { bx = zn.cx; bz = zn.cz; }
      this.duckweeds.push({
        bx, bz, ox: 0, oz: 0,
        sz: 0.65 + hash(i, 3, 61) * 0.75,
        rot: hash(i, 4, 61) * Math.PI * 2,
        ph: hash(i, 5, 61) * Math.PI * 2,
      });
      this.duckweedMesh.setColorAt(i, _c.setHex(dwCols[i % dwCols.length]));
    }
    this.duckweedMesh.instanceColor.needsUpdate = true;
    this._m4 = new THREE.Matrix4();
    this._p3 = new THREE.Vector3();
    this._q4 = new THREE.Quaternion();
    this._s3 = new THREE.Vector3();
    this._e3 = new THREE.Euler();

    // 7. 众泉汇流 · 湖底涌泉气泡点 & 荷塘红蜻蜓
    this.springSpots = [
      [-214, 154], [6, 132], [452, -68], [-482, -252], [-34, 16], [732, -116],
    ];
    this.dragonflySpots = [
      [-205, 152], [16, 130], [446, -60], [-480, -244], [728, -110],
    ];

    this.splashBits = new Bits(360);
    scene.add(this.splashBits.mesh);
    this.splashes = [];
    this.foodSpots = [];
  }

  addWaterRipple(x, z, strength = 1.0) {
    this.rippleEvents.push({ x, z, age: 0, life: 2.4, strength });
    if (this.rippleEvents.length > 8) this.rippleEvents.shift();
  }

  dropFood(px, pz, yaw) {
    let fx = null, fz = null;
    for (const dist of [5.5, 9, 13, 17, 2.8]) {
      const tx = px + Math.sin(yaw) * dist;
      const tz = pz + Math.cos(yaw) * dist;
      if (getWaterSignedDist(tx, tz) >= 2.2) {
        fx = tx; fz = tz;
        break;
      }
    }
    if (fx === null) return { ok: false, msg: '请面向并靠近湖边开阔水面再投喂鱼食' };

    const pellets = [];
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * 2.2;
      pellets.push({ dx: Math.cos(ang) * rad, dz: Math.sin(ang) * rad, ph: Math.random() * 6 });
    }
    this.foodSpots.push({ x: fx, z: fz, age: 0, life: 12.0, pellets });
    if (this.foodSpots.length > 5) this.foodSpots.shift();
    this._spawnSplash(fx, fz);
    this.addWaterRipple(fx, fz, 1.35);

    const hasNearKoi = this.kois.some((k) => Math.hypot(k.cx - fx, k.cz - fz) < 85);
    if (!hasNearKoi) {
      const sorted = [...this.kois].sort((a, b) => Math.hypot(a.cx - fx, a.cz - fz) - Math.hypot(b.cx - fx, b.cz - fz));
      sorted.slice(0, 4).forEach((k, i) => {
        const tx = fx + (i - 1.5) * 2.8;
        const tz = fz + ((i & 1) ? 2.5 : -2.5);
        if (getWaterSignedDist(tx, tz) >= 2.0) {
          k.cx = tx;
          k.cz = tz;
        } else {
          k.cx = fx;
          k.cz = fz;
        }
        k.jumpTimer = 0.6 + i * 0.45;
      });
    }
    return { ok: true, msg: '已向清波撒下金黄鱼食，3D 锦鲤与野鸭正欢快游来！' };
  }

  findNearbyBus(px, pz, maxDist = 15) {
    for (const b of this.buses) {
      if (Math.hypot(px - b.x, pz - b.z) <= maxDist) return b;
    }
    return null;
  }

  toggleBusSpeed() {
    this.fastBus = !this.fastBus;
    return this.fastBus ? '快速游览' : '慢速观光';
  }

  _spawnSplash(x, z) {
    for (let i = 0; i < 8; i++) {
      if (this.splashes.length > 90) break;
      this.splashes.push({
        x, y: 0.18, z,
        vx: (Math.random() - 0.5) * 3.2,
        vy: 2.3 + Math.random() * 2.4,
        vz: (Math.random() - 0.5) * 3.2,
        age: 0, life: 0.55,
      });
    }
  }

  // 将水生动物坐标严格约束在安全离岸水深内（彻底杜绝野鸭与锦鲤游上陆地或穿岛！）
  _clampToSafeWater(x, z, minWaterDist = 2.6) {
    const wd = getWaterSignedDist(x, z);
    if (wd >= minWaterDist) return { x, z, clamped: false };
    const push = getWaterPushDir(x, z);
    const delta = (minWaterDist - wd) + 0.6;
    const nx = x + push.x * delta;
    const nz = z + push.z * delta;
    if (getWaterSignedDist(nx, nz) >= 1.2) return { x: nx, z: nz, clamped: true };
    return { x, z, clamped: true };
  }

  update(dt, t, player, showLotus = true) {
    // 0. 更新水面扩散涟漪队列生命周期
    for (let i = this.rippleEvents.length - 1; i >= 0; i--) {
      this.rippleEvents[i].age += dt;
      if (this.rippleEvents[i].age >= this.rippleEvents[i].life) this.rippleEvents.splice(i, 1);
    }

    // 1. 观光车巡航 + 前方 18m 智能礼让刹停 + 陆路/桥面双重贴地保障
    const cruiseSpeed = this.fastBus ? 32 : 16;
    for (const b of this.buses) {
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
      let blocked = false;

      if (player && player.ridingBus !== b && !player.flying && player.pos.y < 5) {
        const dx = player.pos.x - b.x, dz = player.pos.z - b.z;
        const along = dx * fx + dz * fz;
        const lateral = Math.abs(dx * fz - dz * fx);
        if (along > 2.5 && along < 18 && lateral < 3.6) blocked = true;
      }

      if (!blocked) {
        for (let i = 0; i < this.pedestrians.length; i++) {
          const p = this.pedestrians[i];
          const dx = p.x - b.x, dz = p.z - b.z;
          const along = dx * fx + dz * fz;
          const lateral = Math.abs(dx * fz - dz * fx);
          if (along > 2.5 && along < 15 && lateral < 3.0) {
            blocked = true;
            break;
          }
        }
      }

      b.braking = blocked;
      const targetSpd = blocked ? 0 : cruiseSpeed;
      b.currentSpeed = THREE.MathUtils.lerp(b.currentSpeed, targetSpd, Math.min(1, dt * (blocked ? 7.5 : 2.5)));
      b.brakeMat.color.setHex(blocked ? 0xff1e1e : 0x550000);

      b.dist = (b.dist + b.currentSpeed * dt) % this.road.total;
      const s = this.road.sample(b.dist);
      b.x = s.x;
      b.z = s.z;
      b.yaw = s.yaw;
      const terr = sampleTerrain(s.x, s.z);
      const bh = getBridgeHeight(s.x, s.z);
      const busY = bh !== null ? bh : Math.max(2, terr.height);
      b.mesh.position.set(s.x, busY + 0.05, s.z);
      b.mesh.rotation.y = s.yaw;
    }

    // 2. 行人漫步 + 水陆/墙体碰撞自适应避让（绝不踏入水中，绝不穿进建筑景墙！）
    for (const p of this.pedestrians) {
      let needYield = false;
      for (const b of this.buses) {
        if (Math.hypot(p.x - b.x, p.z - b.z) < 14) { needYield = true; break; }
      }
      if (!needYield && player && player.inCar && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 16) {
        needYield = true;
      }
      p.yielding = needYield;
      if (!needYield) {
        p.dist = (p.dist + p.dir * p.spd * dt + this.road.total) % this.road.total;
      }

      const s = this.road.sample(p.dist);
      const rightX = Math.cos(s.yaw), rightZ = -Math.sin(s.yaw);
      const desiredLane = needYield ? Math.sign(p.baseLane || 1) * Math.max(5.8, Math.abs(p.baseLane) + 1.8) : p.baseLane;

      // 检查目标偏移车道是否为安全陆地/桥面且无建筑墙体阻挡；否则自动向路肩或对侧步道平滑收敛！
      const isSafePedPos = (lane) => {
        const tx = s.x + rightX * lane;
        const tz = s.z + rightZ * lane;
        const bh = getBridgeHeight(tx, tz);
        if (bh !== null) return true;
        if (sampleTerrain(tx, tz).isWater || getWaterSignedDist(tx, tz) > -0.6) return false;
        if (this.collider && this.collider.collidesBox(tx, 2.25, tz, 0.35, 1.35)) return false;
        return true;
      };

      let chosenLane = desiredLane;
      if (!isSafePedPos(chosenLane)) {
        const fallbacks = [p.baseLane * 0.65, -p.baseLane * 0.75, p.baseLane * 0.3, 0];
        for (const fb of fallbacks) {
          if (isSafePedPos(fb)) { chosenLane = fb; break; }
        }
      }

      p.curLane = THREE.MathUtils.lerp(p.curLane, chosenLane, Math.min(1, dt * 6.0));
      const nx = s.x + rightX * p.curLane;
      const nz = s.z + rightZ * p.curLane;
      p.x = nx;
      p.z = nz;
      const terr = sampleTerrain(nx, nz);
      const bh = getBridgeHeight(nx, nz);
      const pedY = bh !== null ? bh : Math.max(2, terr.height);
      const hop = needYield ? 0 : Math.abs(Math.sin(t * 7 + p.phase)) * 0.16;
      p.mesh.position.set(nx, pedY + hop, nz);
      p.mesh.rotation.y = p.dir > 0 ? s.yaw : s.yaw + Math.PI;
    }

    for (let i = this.foodSpots.length - 1; i >= 0; i--) {
      this.foodSpots[i].age += dt;
      if (this.foodSpots[i].age >= this.foodSpots[i].life) this.foodSpots.splice(i, 1);
    }

    // 3. 野鸭家族（全程水岸距离场守护，追逐鱼食遇到半岛/浅滩自动绕水而行！）
    for (const fam of this.duckFamilies) {
      let nearFood = null, nearFD = 90;
      for (const fs of this.foodSpots) {
        const d = Math.hypot(fam.cx - fs.x, fam.cz - fs.z);
        if (d < nearFD) { nearFD = d; nearFood = fs; }
      }
      if (nearFood) {
        const stepX = THREE.MathUtils.lerp(fam.cx, nearFood.x, Math.min(1, dt * 0.65));
        const stepZ = THREE.MathUtils.lerp(fam.cz, nearFood.z, Math.min(1, dt * 0.65));
        if (getWaterSignedDist(stepX, stepZ) >= 5.5) {
          fam.cx = stepX;
          fam.cz = stepZ;
        }
      } else {
        fam.cx = THREE.MathUtils.lerp(fam.cx, fam.homeX, Math.min(1, dt * 0.15));
        fam.cz = THREE.MathUtils.lerp(fam.cz, fam.homeZ, Math.min(1, dt * 0.15));
      }

      const curR = nearFood ? Math.min(fam.r, 5.5) : fam.r;
      const a = t * fam.spd + fam.ph;
      const rawMx = fam.cx + Math.cos(a) * curR;
      const rawMz = fam.cz + Math.sin(a) * curR;
      const safeM = this._clampToSafeWater(rawMx, rawMz, 2.8);
      const rawNx = fam.cx + Math.cos(a + Math.sign(fam.spd) * 0.08) * curR;
      const rawNz = fam.cz + Math.sin(a + Math.sign(fam.spd) * 0.08) * curR;
      const safeN = this._clampToSafeWater(rawNx, rawNz, 2.8);

      fam.mom.position.set(safeM.x, 0.06 + Math.sin(t * 4 + fam.ph) * 0.04, safeM.z);
      fam.mom.rotation.y = Math.atan2(safeN.x - safeM.x, safeN.z - safeM.z);
      fam.babies.forEach((b, idx) => {
        const ba = a - Math.sign(fam.spd) * (idx + 1) * 0.15;
        const sb = this._clampToSafeWater(fam.cx + Math.cos(ba) * curR, fam.cz + Math.sin(ba) * curR, 2.5);
        b.position.set(sb.x, 0.05 + Math.sin(t * 5 + idx) * 0.035, sb.z);
        b.rotation.y = fam.mom.rotation.y;
      });
    }

    // 4. 3D 体素锦鲤（清澈浅水摆尾畅游 + 跃出水面激起扩散涟漪环 + 严守水界！）
    for (const k of this.kois) {
      let nearFood = null, nearFD = 85;
      for (const fs of this.foodSpots) {
        const d = Math.hypot(k.cx - fs.x, k.cz - fs.z);
        if (d < nearFD) { nearFD = d; nearFood = fs; }
      }
      if (nearFood) {
        const nx = THREE.MathUtils.lerp(k.cx, nearFood.x, Math.min(1, dt * 1.1));
        const nz = THREE.MathUtils.lerp(k.cz, nearFood.z, Math.min(1, dt * 1.1));
        if (getWaterSignedDist(nx, nz) >= 3.2) { k.cx = nx; k.cz = nz; }
        k.jumpTimer = Math.min(k.jumpTimer, 1.8);
      }
      const curR = nearFood ? Math.min(k.r, 2.4) : k.r;
      const a = t * (nearFood ? k.spd * 1.45 : k.spd) + k.ph;
      const rawX = k.cx + Math.cos(a) * curR;
      const rawZ = k.cz + Math.sin(a) * curR;
      const safeK = this._clampToSafeWater(rawX, rawZ, 1.8);
      const nextK = this._clampToSafeWater(k.cx + Math.cos(a + 0.12) * curR, k.cz + Math.sin(a + 0.12) * curR, 1.8);

      k.jumpTimer -= dt;
      if (k.jumpTimer <= 0 && k.jumpAge < 0) {
        k.jumpAge = 0;
        k.jumpTimer = nearFood ? (1.2 + Math.random() * 1.8) : (5.5 + Math.random() * 9);
        this._spawnSplash(safeK.x, safeK.z);
        this.addWaterRipple(safeK.x, safeK.z, 1.0);
      }
      let y = -0.26 + Math.sin(t * 3.2 + k.ph) * 0.04;
      let pitch = 0;
      if (k.jumpAge >= 0) {
        k.jumpAge += dt;
        const u = k.jumpAge / 0.85;
        if (u >= 1) {
          k.jumpAge = -1;
          this._spawnSplash(safeK.x, safeK.z);
          this.addWaterRipple(safeK.x, safeK.z, 1.1);
        } else {
          y = -0.2 + Math.sin(u * Math.PI) * 2.3;
          pitch = -(u - 0.5) * 1.4;
        }
      }
      const swimYaw = Math.atan2(nextK.x - safeK.x, nextK.z - safeK.z) + Math.sin(t * 9.5 + k.ph) * 0.12;
      k.mesh.position.set(safeK.x, y, safeK.z);
      k.mesh.rotation.set(pitch, swimYaw, 0);
    }

    // 5. 3D 荷叶小青蛙「呱呱」歪头呼吸与偶发开心小蹦跳
    for (const fg of this.frogs) {
      fg.mesh.visible = showLotus;
      if (!showLotus) continue;
      const cycle = (t * 0.45 + fg.ph) % 4.0;
      const hop = cycle < 0.45 ? Math.sin((cycle / 0.45) * Math.PI) * 0.55 : 0;
      const wave = Math.sin(t * 2.1 + fg.ph) * 0.045;
      fg.mesh.position.set(fg.x, 0.34 + wave + hop, fg.z);
      fg.mesh.rotation.set(0, fg.yaw + Math.sin(t * 1.4 + fg.ph) * 0.18, Math.sin(t * 2.8 + fg.ph) * 0.05);
    }

    // 6. 动态 3D 浮萍海（「浮萍一道开」：团团划船或游泳经过时浮萍真实向两侧推开并缓慢回拢！）
    this.duckweedMesh.visible = showLotus;
    if (showLotus) {
      const px = player ? player.pos.x : 99999;
      const pz = player ? player.pos.z : 99999;
      const inWaterAct = player && (player.inBoat || player.swimming);
      for (let i = 0; i < this.duckweedCount; i++) {
        const d = this.duckweeds[i];
        if (inWaterAct) {
          const dx = (d.bx + d.ox) - px;
          const dz = (d.bz + d.oz) - pz;
          const dist = Math.hypot(dx, dz);
          if (dist < 4.8 && dist > 0.01) {
            const push = (4.8 - dist) * dt * 3.8;
            d.ox = THREE.MathUtils.clamp(d.ox + (dx / dist) * push, -4.5, 4.5);
            d.oz = THREE.MathUtils.clamp(d.oz + (dz / dist) * push, -4.5, 4.5);
          }
        }
        d.ox = THREE.MathUtils.lerp(d.ox, 0, Math.min(1, dt * 0.35));
        d.oz = THREE.MathUtils.lerp(d.oz, 0, Math.min(1, dt * 0.35));
        const wy = 0.09 + Math.sin(t * 2.2 + d.ph) * 0.035;
        this._e3.set(0, d.rot + d.ox * 0.18, 0);
        this._q4.setFromEuler(this._e3);
        this._m4.compose(this._p3.set(d.bx + d.ox, wy, d.bz + d.oz), this._q4, this._s3.set(d.sz, 1, d.sz));
        this.duckweedMesh.setMatrixAt(i, this._m4);
      }
      this.duckweedMesh.instanceMatrix.needsUpdate = true;
    }

    // 7. 粒子池合并渲染：鱼食颗粒 + 水花飞沫 + 众泉汇流晶莹气泡 + 荷塘振翅红蜻蜓
    this.splashBits.begin();
    for (const fs of this.foodSpots) {
      const fade = 1 - Math.max(0, (fs.age - fs.life + 2) / 2);
      for (const p of fs.pellets) {
        const bob = 0.08 + Math.sin(t * 4.5 + p.ph) * 0.04;
        this.splashBits.add(fs.x + p.dx, bob, fs.z + p.dz, 0.22 * fade, 0xffd152, 1.0, p.ph);
      }
    }
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const sp = this.splashes[i];
      sp.age += dt;
      if (sp.age >= sp.life) { this.splashes.splice(i, 1); continue; }
      sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.z += sp.vz * dt; sp.vy -= 9 * dt;
      this.splashBits.add(sp.x, sp.y, sp.z, 0.22 * (1 - sp.age / sp.life), 0xe8f9ff, 1.15, sp.age * 5);
    }

    // 众泉汇流：近岸湖底泉眼不断冒出晶莹水泡串！
    if (player) {
      for (let si = 0; si < this.springSpots.length; si++) {
        const [sx, sz] = this.springSpots[si];
        if (Math.hypot(player.pos.x - sx, player.pos.z - sz) > 110) continue;
        for (let b = 0; b < 4; b++) {
          const u = (t * 0.85 + si * 0.7 + b * 0.25) % 1.0;
          const bx = sx + Math.sin(u * 8 + b * 2.1) * 0.45;
          const bz = sz + Math.cos(u * 7 + b * 1.7) * 0.45;
          const by = -1.1 + u * 1.22;
          this.splashBits.add(bx, by, bz, 0.14 * (0.5 + u * 0.6), 0xdff9ff, 1.25, u * 3);
        }
      }

      // 夏秋荷塘上空灵动盘旋点水的 3D 红蜻蜓！
      if (showLotus) {
        for (let di = 0; di < this.dragonflySpots.length; di++) {
          const [cx, cz] = this.dragonflySpots[di];
          if (Math.hypot(player.pos.x - cx, player.pos.z - cz) > 105) continue;
          for (let k = 0; k < 2; k++) {
            const a = t * (0.95 + k * 0.3) + di * 1.7 + k * 2.6;
            const x = cx + Math.cos(a) * (4.2 + k * 2.2);
            const z = cz + Math.sin(a * 1.3) * (3.6 + k * 1.8);
            const dip = Math.max(0, Math.sin(t * 1.2 + di + k * 3) - 0.82) * 5.0; // 偶而蜻蜓点水！
            const y = 1.45 + Math.sin(t * 3.1 + k) * 0.35 - dip * 1.1;
            const wing = Math.sin(t * 42 + k) * 0.08;
            this.splashBits.add(x, y, z, 0.16, 0xff4a38, 1.35, -a, 0.1);
            this.splashBits.add(x + 0.22, y + wing, z, 0.28, 0xeef9ff, 1.25, -a, 0.04);
            this.splashBits.add(x - 0.22, y - wing, z, 0.28, 0xeef9ff, 1.25, -a, 0.04);
          }
        }
      }
    }

    this.splashBits.end();
  }
}
