// 主角团团 3.0 控制器：
// - 开体素直升机（G / 双击空格）：真实加速度最高 65 m/s、机身俯仰倾斜、高速旋翼与尾桨
// - 空中跳伞（高空按 G / 双击空格）：头顶打开彩色体素降落伞，WASD 自由调整降落方位，落地自动收伞
// - 开体素敞篷小跑车（R 键）：真实加速度最高 48 m/s、转轮/刹车红尾灯/夜景前照灯/尾气尘土
// - 全局 3D 体素碰撞（可爬超然楼、飞落任意建筑屋顶）+ 下水自动游泳 + 划船（E）+ 观光车（F）
import * as THREE from 'three';
import { Vox, Bits, charMaterial } from './voxel/vox.js';
import { tuan } from './voxel/cast.js';
import {
  sampleTerrain, getBridgeHeight, getWaterSignedDist, getWaterPushDir, DOCKS, WORLD,
} from './map_data.js';

// 1. 参考海报同款精致双层色 3D 小木船（薄荷青绿下船体 + 奶白船舷包边 + 暖原木内舱坐板 + 双木桨！）
function buildRowboat(solidMat) {
  const v = new Vox();
  const HULL_MINT = 0x4da89b, HULL_WHITE = 0xf4f1ea, WOOD = 0xa86b38, WOOD_D = 0x7c4a24, GOLD = 0xe9b949;
  for (let z = -4; z <= 4; z++) {
    const az = Math.abs(z);
    const hw = az === 4 ? 0 : (az === 3 ? 1 : 2);
    for (let x = -hw; x <= hw; x++) {
      v.set(x, 0, z, HULL_MINT); // 青绿吃水船底
      if (Math.abs(x) === hw || az >= 3) {
        v.set(x, 1, z, HULL_MINT);
        v.set(x, 2, z, HULL_WHITE); // 奶白立体船舷边
      } else {
        v.set(x, 1, z, ((x + z) & 1) ? WOOD : WOOD_D); // 暖原木内舱甲板
      }
    }
  }
  v.box(-1, 1, -2, 1, 1, -2, WOOD).box(-1, 1, 1, 1, 1, 1, WOOD); // 前后原木坐板
  v.set(0, 3, 4, GOLD).set(0, 3, -4, GOLD); // 船首船尾小铜饰

  const group = new THREE.Group();
  const boatMesh = v.mesh(solidMat, 0.02);
  boatMesh.scale.setScalar(0.52);
  boatMesh.position.set(-0.26, -0.18, -0.26);
  group.add(boatMesh);

  const makeOar = (side) => {
    const og = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.11, 2.0),
      new THREE.MeshStandardMaterial({ color: 0xb87a42, roughness: 0.8 }),
    );
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.08, 0.72),
      new THREE.MeshStandardMaterial({ color: 0xe09f50, roughness: 0.75 }),
    );
    blade.position.set(0, -0.05, -1.1);
    og.add(shaft, blade);
    og.position.set(side * 1.28, 0.68, 0.15);
    og.rotation.z = -side * 0.28;
    return og;
  };
  const oarL = makeOar(-1);
  const oarR = makeOar(1);
  group.add(oarL, oarR);
  return { group, oarL, oarR };
}

// 2. 体素迷你直升机（红白机身 + 透明座舱 + 高速主旋翼与尾桨 + 红绿航行灯）
function buildHelicopter(solidMat) {
  const v = new Vox();
  const RED = 0xe63946, WHITE = 0xf8f9fa, DARK = 0x2b2d42, GLASS = 0x8ecae6, GOLD = 0xffd166;
  // 起落滑橇
  v.box(-3, 0, -3, -3, 0, 3, DARK);
  v.box(3, 0, -3, 3, 0, 3, DARK);
  v.box(-2, 1, -2, -2, 1, -2, DARK).box(2, 1, -2, 2, 1, -2, DARK);
  v.box(-2, 1, 2, -2, 1, 2, DARK).box(2, 1, 2, 2, 1, 2, DARK);
  // 机身底盘与驾驶舱
  v.box(-2, 2, -3, 2, 2, 4, RED);
  v.box(-2, 3, -3, 2, 4, -2, WHITE);
  v.box(-2, 3, 3, 2, 4, 4, GLASS); // 挡风玻璃
  v.box(-2, 5, -2, 2, 5, 3, RED);  // 机顶
  // 细长尾梁与垂直尾翼
  v.box(0, 3, -9, 0, 4, -4, WHITE);
  v.box(0, 5, -9, 0, 7, -8, RED);
  v.set(0, 6, 0, GOLD); // 主旋翼轴

  const group = new THREE.Group();
  const body = v.mesh(solidMat, 0.02);
  body.scale.setScalar(0.5);
  group.add(body);

  // 顶部高速主旋翼
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.4 });
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 3.35, 0);
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.08, 0.28), rotorMat);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 5.6), rotorMat);
  mainRotor.add(b1, b2);
  group.add(mainRotor);

  // 尾部旋翼
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.35, 0.16), rotorMat);
  tailRotor.position.set(0.32, 2.8, -4.4);
  group.add(tailRotor);

  // 左右红绿航行灯
  const navL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
  navL.position.set(-1.35, 1.5, 1.0);
  const navR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  navR.position.set(1.35, 1.5, 1.0);
  group.add(navL, navR);

  group.visible = false;
  return { group, mainRotor, tailRotor };
}

// 3. 彩色体素降落伞（弧形红黄蓝伞面 + 4 根伞绳）
function buildParachute(solidMat) {
  const v = new Vox();
  const COLORS = [0xff4d6d, 0xffd166, 0x38bdf8, 0xff4d6d, 0xffd166];
  for (let x = -5; x <= 5; x++) {
    for (let z = -3; z <= 3; z++) {
      const arch = Math.round(2.6 - (x * x) * 0.085 - (z * z) * 0.06);
      if (arch >= 0) {
        const stripe = COLORS[Math.min(4, Math.floor((x + 5) / 2.2))];
        v.set(x, arch, z, stripe);
      }
    }
  }
  const group = new THREE.Group();
  const canopy = v.mesh(solidMat, 0.015);
  canopy.scale.setScalar(0.45);
  canopy.position.set(0, 3.2, 0);
  group.add(canopy);

  // 4 根伞绳连接伞面四角与团团双肩
  const ropeMat = new THREE.MeshBasicMaterial({ color: 0xfff8e7 });
  const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.5, 4);
  for (const [rx, rz] of [[-1.6, -0.8], [1.6, -0.8], [-1.6, 0.8], [1.6, 0.8]]) {
    const r = new THREE.Mesh(ropeGeo, ropeMat);
    r.position.set(rx * 0.5, 2.25, rz * 0.5);
    r.rotation.z = rx * 0.35;
    r.rotation.x = -rz * 0.28;
    group.add(r);
  }
  group.visible = false;
  return group;
}

// 4. 体素敞篷小跑车（精修正圆轮胎 + 亮银轮毂 + 低趴车身对齐 + 双大灯与刹车红尾灯）
function buildSportsCar(solidMat) {
  const v = new Vox();
  const RED = 0xe63946, WHITE = 0xf8f9fa, DARK = 0x22262e, GLASS = 0x90e0ef, SEAT = 0x5c3d2e;
  // 跑车低趴车身（对齐到轮轴中心，绝不歪轮悬空）
  v.box(-2, 1, -4, 2, 1, 4, RED);
  v.box(-2, 2, 2, 2, 2, 4, RED);
  v.box(-1, 2, 2, 1, 2, 4, WHITE);
  v.box(-2, 2, -4, 2, 2, -2, RED);
  v.box(-2, 3, -4, 2, 3, -4, DARK); // 尾翼
  v.box(-2, 2, -1, -2, 2, 1, RED).box(2, 2, -1, 2, 2, 1, RED);
  v.box(-1, 2, -1, 1, 2, 0, SEAT);
  v.box(-2, 3, 2, 2, 3, 2, GLASS);

  const group = new THREE.Group();
  const body = v.mesh(solidMat, 0.02);
  const sc = 0.52;
  body.scale.setScalar(sc);
  // Vox 网格每格占 [x, x+1]，[-2..2] 的几何中心在 +0.5，需平移 -0.5*sc 才能与车轮左右/前后 100% 居中对齐！
  body.position.set(-0.5 * sc, -0.08, -0.5 * sc);
  group.add(body);

  // 4 个正圆圆柱轮胎 + 亮银色轮毂盖（左右绝对对称、贴合车身两侧）
  const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 14);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.37, 8);
  rimGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xdce3ec, roughness: 0.3, metalness: 0.6 });
  const wheels = [];
  for (const [wx, wz] of [[-1.32, 1.38], [1.32, 1.38], [-1.32, -1.38], [1.32, -1.38]]) {
    const wg = new THREE.Group();
    wg.add(new THREE.Mesh(tireGeo, tireMat), new THREE.Mesh(rimGeo, rimMat));
    wg.position.set(wx, 0.42, wz);
    group.add(wg);
    wheels.push(wg);
  }

  // 前照大灯 + 夜景照明光束（严格左右对称贴合车头）
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff5b8 });
  const hL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.12), headMat);
  hL.position.set(-0.78, 0.92, 2.36);
  const hR = hL.clone();
  hR.position.x = 0.78;
  const headLight = new THREE.PointLight(0xfff0b0, 0, 28, 1.4);
  headLight.position.set(0, 1.3, 4.5);

  // 红色刹车尾灯（严格左右对称贴合车尾）
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x660000 });
  const tL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.12), tailMat);
  tL.position.set(-0.78, 0.92, -2.36);
  const tR = tL.clone();
  tR.position.x = 0.78;

  group.add(hL, hR, tL, tR, headLight);
  group.visible = false;
  return { group, wheels, tailMat, headLight };
}

export class TuanPlayer {
  constructor(scene, solidMat, collider) {
    this.scene = scene;
    this.collider = collider;
    this.root = new THREE.Group();
    scene.add(this.root);

    const cMat = charMaterial(0.24);
    this.tuanMesh = tuan('happy').mesh(cMat, 0.02);
    this.tuanMesh.scale.setScalar(0.115);
    this.tuanMesh.position.y = 0.12;
    this.root.add(this.tuanMesh);

    this.boat = buildRowboat(solidMat);
    this.boat.group.visible = false;
    this.root.add(this.boat.group);

    this.heli = buildHelicopter(solidMat);
    this.root.add(this.heli.group);

    this.parachute = buildParachute(solidMat);
    this.root.add(this.parachute);

    this.car = buildSportsCar(solidMat);
    this.root.add(this.car.group);

    this.fxBits = new Bits(110);
    scene.add(this.fxBits.mesh);
    this.fxList = [];

    // 默认出生在大明湖正南门牌坊正前方迎客广场（完整收入整个黄色琉璃瓦七楼大牌坊与蓝天！）
    this.pos = new THREE.Vector3(-217, 2, 298);
    this.yaw = Math.PI;
    this.velX = 0;
    this.velY = 0;
    this.velZ = 0;
    this.onGround = true;

    // 载具与动作状态
    this.inBoat = false;
    this.swimming = false;
    this.inHeli = false;
    this.parachuting = false;
    this.inCar = false;
    this.ridingBus = null;
    this.ferrisRef = null;
    this.ridingFerrisCabin = -1; // >=0 表示正在乘坐大摩天轮观景座舱！
    this.cruiseRef = null;
    this.cruisesRef = [];
    this.ridingCruise = null;    // 非空表示正在乘坐某艘双层画舫（明湖画舫 / 鹊华画舫）！
    this.sittingSeat = null;     // 非空表示正坐在 3D 荷花花心 / 王莲 / 湖畔木长椅 / 石凳 / 名亭里！
    this.sitGraceTimer = 0;      // 刚坐下 0.35s 防误触起身保护
    this.smoothCamDist = 15;     // 相机防穿墙平滑距离
    this.lastOarSplash = 0;

    this.speed = 0;      // 当前水平速率 (m/s)
    this.carSpeed = 0;   // 跑车有向速率
    this.heliPitch = 0;
    this.heliRoll = 0;
    this.walkPhase = 0;

    // 多级跳（三段跳）& 水中跃出保护
    this.jumpCount = 0;
    this.waterJumpCooldown = 0;

    // QQ飞车手游风格驾驶状态（漂移集气 + 小喷 + 氮气加速）
    this.nitro = 75;          // 0 ~ 100
    this.nitroTimer = 0;      // 氮气爆发剩余时间
    this.miniBoostTimer = 0;  // 漂移松手小喷剩余时间
    this.drifting = false;
    this.driftTime = 0;
    this.driftSlip = 0;       // 车身甩尾视觉偏航角

    // 相机在团团正南 (+Z) 后方，完整收入正南门大牌坊与大明湖全景
    this.camYaw = 0;
    this.camPitch = 0.14;
    this.camDist = 15;
    this.manualLookCooldown = 0; // 玩家主动拖动镜头后暂缓跑车自动回正，绝不抢镜头！

    this._syncTransform(0, 0);
  }

  get flying() { return this.inHeli || this.parachuting; }

  getStatusText() {
    if (this.ridingCruise) return `🛥️ ${this.ridingCruise.name || '明湖画舫'}游湖中`;
    if (this.ridingFerrisCabin >= 0) return '🎡 乘坐大摩天轮';
    if (this.ridingBus) return '🚌 观光车环游中';
    if (this.sittingSeat) return this.sittingSeat.type === 'lotus' ? '🌸 坐 3D 荷花赏景中' : '🍵 湖畔闲坐赏景中';
    if (this.inHeli) return '🚁 驾驶直升机';
    if (this.parachuting) return '🪂 降落伞滑翔中';
    if (this.inCar) return '🏎️ 敞篷跑车狂飙';
    if (this.inBoat) return '🛶 泛舟划桨中';
    if (this.swimming) return '🏊 湖中畅游中';
    return '🐾 漫步中';
  }

  _clearVehicles() {
    this.inBoat = false; this.boat.group.visible = false;
    this.inHeli = false; this.heli.group.visible = false;
    this.parachuting = false; this.parachute.visible = false;
    this.inCar = false; this.car.group.visible = false;
    this.ridingBus = null;
    this.ridingFerrisCabin = -1;
    this.ridingCruise = null;
    this.sittingSeat = null;
    this.carSpeed = 0;
  }

  // 切换直升机 / 空中开降落伞
  toggleHelicopter() {
    if (this.inHeli) {
      this.inHeli = false;
      this.heli.group.visible = false;
      // 高度超过 5.5 米跳机 -> 自动张开降落伞缓缓飘落！
      if (this.pos.y > 5.5) {
        this.parachuting = true;
        this.parachute.visible = true;
        this.velY = -4.0;
      }
      return false;
    }
    if (this.parachuting) {
      // 跳伞途中按 G 可以重新召唤直升机接住团团！
      this.parachuting = false;
      this.parachute.visible = false;
      this.inHeli = true;
      this.heli.group.visible = true;
      this.velY = 2.0;
      return true;
    }
    this._clearVehicles();
    this.swimming = false;
    this.inHeli = true;
    this.heli.group.visible = true;
    this.velY = 5.0;
    this.pos.y += 0.6;
    return true;
  }

  // 统一跳跃入口（PC Space 与手机跳跃键共用：支持水中秒跃出岸 + 陆地/空中三段跳！）
  triggerJump() {
    if (this.sittingSeat) {
      this.sittingSeat = null;
      this.velY = 8.8;
      this.onGround = false;
      this.jumpCount = 1;
      return;
    }
    if (this.inHeli || this.parachuting || this.inCar || this.inBoat || this.ridingBus) return;
    if (this.swimming) {
      // 彻底修复水中跳不出来：直接抬出水面 + 强跃水初速度 + 0.38s 出水保护！
      this.swimming = false;
      this.pos.y = Math.max(this.pos.y, 0.38);
      this.velY = 10.8;
      this.onGround = false;
      this.jumpCount = 1;
      this.waterJumpCooldown = 0.38;
      for (let i = 0; i < 8; i++) this._spawnFx(this.pos.x, 0.2, this.pos.z, 0xe8f9ff, 2.4, 0.28);
      return;
    }
    if (this.jumpCount < 3) {
      this.velY = this.jumpCount === 0 ? 9.5 : (this.jumpCount === 1 ? 9.0 : 8.6);
      this.onGround = false;
      this.jumpCount++;
      // 二段跳 / 三段跳：脚下绽放可爱白色体素云环！
      if (this.jumpCount >= 2) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this._spawnFx(this.pos.x + Math.cos(a) * 0.7, this.pos.y + 0.1, this.pos.z + Math.sin(a) * 0.7, 0xffffff, 0.8, 0.26);
        }
      }
    }
  }

  // 一键复位跑车（和平精英/刺激战场防卡死脱困）
  resetCarPosition() {
    if (!this.inCar) return;
    this.carSpeed = 0;
    this.velY = 0;
    // 在周边 12m 内寻找无碰撞平整路面
    for (let r = 2; r <= 12; r += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const nx = this.pos.x + Math.cos(a) * r;
        const nz = this.pos.z + Math.sin(a) * r;
        const t = sampleTerrain(nx, nz);
        if (!t.isWater && !this.collider.collidesBox(nx, t.height + 0.1, nz, 0.8, 1.3)) {
          this.pos.set(nx, t.height, nz);
          return;
        }
      }
    }
    this.pos.y += 2;
  }

  // 切换敞篷小跑车（R 键）
  toggleCar() {
    if (this.inCar) {
      this.inCar = false;
      this.car.group.visible = false;
      this.car.group.rotation.set(0, 0, 0);
      this.carSpeed = 0;
      this.drifting = false;
      return false;
    }
    if (this.swimming || this.parachuting || this.inHeli) return false;
    this._clearVehicles();
    this.inCar = true;
    this.car.group.visible = true;
    this.carSpeed = 0; // 刺激战场手感：上车静止，按住前进才出发，稳稳可控！
    return true;
  }

  teleport(x, z, yaw = 0, forceY = null) {
    this._clearVehicles();
    const t = sampleTerrain(x, z);
    const ground = forceY !== null ? forceY : this.collider.findGroundBelow(x, z, 65);
    const y = (t.isWater && ground < 0) ? -0.35 : Math.max(ground, t.height);
    this.swimming = t.isWater && ground < 0;
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.camYaw = yaw + Math.PI;
    this.velX = this.velY = this.velZ = 0;
  }

  _findNearbyCruise() {
    const list = this.cruisesRef.length > 0 ? this.cruisesRef : (this.cruiseRef ? [this.cruiseRef] : []);
    for (const c of list) {
      if (Math.hypot(this.pos.x - c.x, this.pos.z - c.z) < 24) return c;
    }
    return null;
  }

  getActionHint() {
    if (this.sittingSeat) {
      return { type: 'seat_exit', canAct: true, label: '✨ 正在惬意赏景（可按 P 拍明信片）· 按 E 或 跳跃键 起身' };
    }
    if (this.ridingCruise) return { type: 'cruise_exit', canAct: true, label: `正在乘坐双层「${this.ridingCruise.name || '明湖画舫'}」！按 E 键下船` };
    if (this.ridingFerrisCabin >= 0) return { type: 'ferris_exit', canAct: true, label: '正在乘坐大摩天轮观景！按 E 键下摩天轮' };
    if (this.ridingBus) return { type: 'bus', canAct: true, label: '按 F 键下观光车 · B 键切车速' };
    if (this.inHeli) return { type: 'heli', canAct: false, label: 'WASD 加速巡航 · Space 爬升 · C 下降 · G/双击空格 跳伞降落' };
    if (this.parachuting) return { type: 'para', canAct: false, label: '🪂 降落伞滑翔中！用 WASD 调整降落方位，稳稳降落' };
    if (this.inCar) return { type: 'car', canAct: false, label: 'W 前进 · S 刹车/倒车 · A/D 转向 · Shift 加速 · Space 手刹 · X 复位 · R 下车' };

    // 靠近巡航中的双层大画舫（主湖明湖画舫 / 小东湖鹊华画舫）-> 可登船游湖！
    const nearCruise = this._findNearbyCruise();
    if (nearCruise) {
      return { type: 'cruise_enter', canAct: true, cruise: nearCruise, label: `按 E 键登上双层「${nearCruise.name}」大游船！` };
    }

    // 靠近 3D 盛放荷花宝座 / 湖畔茶凳 / 木长椅 / 汉白玉石凳 / 名亭石座 -> 一键坐下赏景！
    if (!this.inBoat && this.collider) {
      const seat = this.collider.findNearbySeat(this.pos.x, this.pos.y, this.pos.z, 4.6);
      if (seat) {
        return { type: 'seat_enter', canAct: true, seat, label: seat.label };
      }
    }

    // 靠近西北角大摩天轮底座 -> 可乘坐大摩天轮！
    if (this.ferrisRef && Math.hypot(this.pos.x - (-757), this.pos.z - (-241)) < 24 && !this.inBoat) {
      return { type: 'ferris_enter', canAct: true, label: '按 E 键乘坐大明湖旋转摩天轮！' };
    }

    const dChaoran = Math.hypot(this.pos.x - 488, this.pos.z + 70);
    if (dChaoran < 22 && !this.inBoat) {
      if (this.pos.y >= 8 && this.pos.y <= 15) return { type: 'elevator_up', canAct: true, label: '按 E 键乘超然楼室外电梯直达 7 楼观景走廊' };
      if (this.pos.y >= 40) return { type: 'elevator_down', canAct: true, label: '按 E 键乘室外电梯返回 1 楼台基走廊' };
    }

    if (this.inBoat) {
      for (const [dx, dz] of [[5, 0], [-5, 0], [0, 5], [0, -5]]) {
        if (!sampleTerrain(this.pos.x + dx, this.pos.z + dz).isWater) return { type: 'boat', canAct: true, label: '按 E 键靠岸下船' };
      }
      if (this.collider) {
        const lotusSeat = this.collider.findNearbySeat(this.pos.x, this.pos.y, this.pos.z, 5.2);
        if (lotusSeat && lotusSeat.type === 'lotus') {
          return { type: 'seat_enter', canAct: true, seat: lotusSeat, label: lotusSeat.label };
        }
      }
      return { type: 'boat', canAct: true, label: '按 E 键离船下水游泳' };
    }

    if (this.swimming) return { type: 'boat', canAct: true, label: '按 E 键召唤小木船 · 空格跃上荷叶/上岸 · G 召直升机' };

    for (const dk of DOCKS) {
      if (Math.hypot(this.pos.x - dk.x, this.pos.z - dk.z) < 12) {
        return { type: 'boat', canAct: true, label: `按 E 键在「${dk.name}」登船泛舟（或跳上旁侧 3D 荷叶！）`, dock: dk };
      }
    }
    for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
      if (sampleTerrain(this.pos.x + dx, this.pos.z + dz).isWater) {
        return { type: 'boat', canAct: true, label: '按 E 键下水划船（直接走进水里自动游泳）' };
      }
    }
    return { type: null, canAct: false, label: '' };
  }

  triggerEAction() {
    const hint = this.getActionHint();
    if (!hint.canAct) return false;
    if (hint.type === 'seat_enter' && hint.seat) {
      this._clearVehicles();
      this.swimming = false;
      this.sittingSeat = hint.seat;
      this.sitGraceTimer = 0.35;
      this.pos.set(hint.seat.x, hint.seat.y, hint.seat.z);
      this.yaw = hint.seat.yaw ?? this.yaw;
      this.velX = this.velY = this.velZ = 0;
      for (let i = 0; i < 8; i++) {
        this._spawnFx(this.pos.x, this.pos.y + 0.4, this.pos.z, hint.seat.type === 'lotus' ? 0xffb8d2 : 0xffe8a3, 1.4, 0.22);
      }
      return true;
    }
    if (hint.type === 'seat_exit') {
      const wasLotus = this.sittingSeat?.type === 'lotus';
      this.sittingSeat = null;
      this.velY = wasLotus ? 6.5 : 4.2;
      this.onGround = false;
      return true;
    }
    if (hint.type === 'cruise_enter' && hint.cruise) {
      this._clearVehicles();
      this.swimming = false;
      this.ridingCruise = hint.cruise;
      return true;
    }
    if (hint.type === 'cruise_exit') {
      this.ridingCruise = null;
      // 若靠近岸边则直接稳稳跳上岸，否则跳入清波畅游
      for (let r = 3; r <= 12; r += 3) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          const nx = this.pos.x + Math.cos(a) * r, nz = this.pos.z + Math.sin(a) * r;
          const t = sampleTerrain(nx, nz);
          if (!t.isWater) { this.pos.set(nx, t.height, nz); this.swimming = false; return true; }
        }
      }
      this.swimming = true;
      this.pos.y = -0.35;
      return true;
    }
    if (hint.type === 'ferris_enter' && this.ferrisRef) {
      this._clearVehicles();
      this.ridingFerrisCabin = this.ferrisRef.getNearestCabinIndex();
      this.camYaw = 0.55;
      this.camPitch = 0.18;
      return true;
    }
    if (hint.type === 'ferris_exit') {
      this.ridingFerrisCabin = -1;
      this.pos.set(-738, 2.5, -241);
      this.velY = 0;
      return true;
    }
    if (hint.type === 'elevator_up') { this.pos.set(497, 44.2, -70); this.velY = 0; return true; }
    if (hint.type === 'elevator_down') { this.pos.set(489, 12.2, -70); this.velY = 0; return true; }
    if (hint.type === 'boat') return this.toggleBoat(hint);
    return false;
  }

  toggleBoat(hintOverride = null) {
    if (this.ridingBus) return false;
    const hint = hintOverride || this.getActionHint();
    if (this.inBoat) {
      this.inBoat = false;
      this.boat.group.visible = false;
      for (let r = 2; r <= 7; r += 2) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          const nx = this.pos.x + Math.cos(a) * r, nz = this.pos.z + Math.sin(a) * r;
          const t = sampleTerrain(nx, nz);
          if (!t.isWater) { this.pos.set(nx, t.height, nz); this.swimming = false; return true; }
        }
      }
      this.swimming = true;
      this.pos.y = -0.35;
      return true;
    } else {
      this._clearVehicles();
      if (this.swimming) {
        this.swimming = false;
        this.inBoat = true;
        this.boat.group.visible = true;
        this.pos.y = 0.08;
        return true;
      }
      if (hint.dock) {
        this.pos.set(hint.dock.boatX, 0.1, hint.dock.boatZ);
      } else {
        let placed = false;
        for (let r = 3; r <= 11 && !placed; r += 2) {
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            const nx = this.pos.x + Math.cos(a) * r, nz = this.pos.z + Math.sin(a) * r;
            if (getWaterSignedDist(nx, nz) >= 1.8) { this.pos.set(nx, 0.1, nz); placed = true; break; }
          }
        }
        if (!placed) return false;
      }
      this.inBoat = true;
      this.boat.group.visible = true;
      this.velY = 0;
      return true;
    }
  }

  _spawnFx(x, y, z, color, vy = 1.6, size = 0.28) {
    if (this.fxList.length > 100) return;
    this.fxList.push({
      x: x + (Math.random() - 0.5) * 0.7, y, z: z + (Math.random() - 0.5) * 0.7,
      vx: (Math.random() - 0.5) * 1.4, vy: vy + Math.random() * 1.1, vz: (Math.random() - 0.5) * 1.4,
      color, size, age: 0, life: 0.55,
    });
  }

  update(dt, keys, t, camera, nightFactor = 0, joy = null) {
    // 0. 正在乘坐双层大画舫（明湖画舫 / 鹊华画舫）游湖！
    if (this.ridingCruise) {
      this.ridingCruise.getDeckWorldPos(this.pos);
      this.yaw = this.ridingCruise.yaw + Math.PI / 2;
      this.speed = this.ridingCruise.speed || 6;
      this._syncTransform(t, dt, nightFactor);
      this._updateFx(dt);
      return;
    }

    // 0.2 正在坐在 3D 荷花花心 / 湖畔长椅 / 石凳 / 名亭里惬意赏景！
    if (this.sittingSeat) {
      this.sitGraceTimer = Math.max(0, this.sitGraceTimer - dt);
      this.pos.set(this.sittingSeat.x, this.sittingSeat.y, this.sittingSeat.z);
      this.speed = 0;
      if (this.sittingSeat.type === 'lotus' && Math.random() < 0.18) {
        this._spawnFx(this.pos.x + (Math.random() - 0.5) * 1.2, this.pos.y + 0.5, this.pos.z + (Math.random() - 0.5) * 1.2, 0xfff1a8, 0.75, 0.16);
      }
      if (this.sitGraceTimer <= 0) {
        const wantLeave = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] ||
          keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'] ||
          (joy && (Math.abs(joy.joyX) > 0.35 || Math.abs(joy.joyY) > 0.35));
        if (wantLeave) {
          this.sittingSeat = null;
          this.velY = 4.2;
          this.onGround = false;
        }
      }
      this._syncTransform(t, dt, nightFactor);
      this._updateFx(dt);
      return;
    }

    // 0.5 正在乘坐大摩天轮观景座舱！
    if (this.ridingFerrisCabin >= 0 && this.ferrisRef) {
      this.ferrisRef.getCabinWorldPos(this.ridingFerrisCabin, this.pos);
      this.speed = 0;
      this._syncTransform(t, dt, nightFactor);
      this._updateFx(dt);
      return;
    }

    // 1. 观光车环游
    if (this.ridingBus) {
      const seat = this.ridingBus.getSeatPose();
      this.pos.copy(seat.pos);
      this.yaw = seat.yaw;
      this.speed = this.ridingBus.currentSpeed;
      this._syncTransform(t, dt, nightFactor);
      this._updateFx(dt);
      return;
    }

    let fwd = 0, right = 0;
    if (keys['KeyW'] || keys['ArrowUp']) fwd += 1;
    if (keys['KeyS'] || keys['ArrowDown']) fwd -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) right += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) right -= 1;
    // 叠加手机横屏虚拟摇杆输入（支持 360° 模拟量控制）
    if (joy) {
      if (Math.abs(joy.joyY) > 0.05) fwd += joy.joyY;
      if (Math.abs(joy.joyX) > 0.05) right += joy.joyX;
    }

    const fxCam = -Math.sin(this.camYaw), fzCam = -Math.cos(this.camYaw);
    const rxCam = Math.cos(this.camYaw), rzCam = -Math.sin(this.camYaw);

    // 2. 直升机模式（修复阻力平衡公式！真实推背加速，最高 75 m/s ≈ 270 km/h，远快于跑车！）
    if (this.inHeli) {
      const ACCEL = 58, MAX_SPD = 75, DRAG = 0.65;
      const len = Math.hypot(fwd, right);
      let ax = 0, az = 0;
      if (len > 0.01) {
        const nf = fwd / len, nr = right / len;
        ax = (fxCam * nf + rxCam * nr) * ACCEL;
        az = (fzCam * nf + rzCam * nr) * ACCEL;
      }
      this.velX += (ax - this.velX * DRAG) * dt;
      this.velZ += (az - this.velZ * DRAG) * dt;
      const hSpd = Math.hypot(this.velX, this.velZ);
      if (hSpd > MAX_SPD) {
        this.velX = (this.velX / hSpd) * MAX_SPD;
        this.velZ = (this.velZ / hSpd) * MAX_SPD;
      }
      this.speed = Math.hypot(this.velX, this.velZ);

      // 朝向平滑跟随飞行速度方向
      if (this.speed > 1.5) {
        const targetYaw = Math.atan2(this.velX, this.velZ);
        let diff = targetYaw - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.yaw += diff * Math.min(1, dt * 6);
        this.heliRoll = THREE.MathUtils.lerp(this.heliRoll, THREE.MathUtils.clamp(-diff * 0.5, -0.35, 0.35), dt * 6);
      } else {
        this.heliRoll = THREE.MathUtils.lerp(this.heliRoll, 0, dt * 5);
      }
      this.heliPitch = THREE.MathUtils.lerp(this.heliPitch, Math.min(0.36, this.speed * 0.006), dt * 5);

      let targetVy = 0;
      if (keys['Space']) targetVy = 30;
      else if (keys['KeyC'] || keys['ControlLeft']) targetVy = -26;
      this.velY = THREE.MathUtils.lerp(this.velY, targetVy, dt * 6);

      const nx = THREE.MathUtils.clamp(this.pos.x + this.velX * dt, WORLD.MIN_X + 10, WORLD.MAX_X - 10);
      const nz = THREE.MathUtils.clamp(this.pos.z + this.velZ * dt, WORLD.MIN_Z + 10, WORLD.MAX_Z - 10);
      const ny = THREE.MathUtils.clamp(this.pos.y + this.velY * dt, 0.6, 160);

      if (!this.collider.collidesBox(nx, this.pos.y, this.pos.z, 1.0, 2.2)) this.pos.x = nx; else this.velX *= -0.2;
      if (!this.collider.collidesBox(this.pos.x, this.pos.y, nz, 1.0, 2.2)) this.pos.z = nz; else this.velZ *= -0.2;
      if (!this.collider.collidesBox(this.pos.x, ny, this.pos.z, 1.0, 2.2)) {
        this.pos.y = ny;
      } else if (this.velY < 0) {
        // 向下降落触及屋顶或地面 -> 稳稳收起直升机落地！
        this.inHeli = false;
        this.heli.group.visible = false;
        this.velX = this.velY = this.velZ = 0;
      }
    }

    // 3. 降落伞滑翔模式（可控方位精准降落！）
    else if (this.parachuting) {
      const GLIDE_SPD = 14;
      const len = Math.hypot(fwd, right);
      let tx = 0, tz = 0;
      if (len > 0.01) {
        const nf = fwd / len, nr = right / len;
        tx = (fxCam * nf + rxCam * nr) * GLIDE_SPD;
        tz = (fzCam * nf + rzCam * nr) * GLIDE_SPD;
        const targetYaw = Math.atan2(tx, tz);
        let diff = targetYaw - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.yaw += diff * Math.min(1, dt * 6);
      }
      this.velX = THREE.MathUtils.lerp(this.velX, tx, dt * 4);
      this.velZ = THREE.MathUtils.lerp(this.velZ, tz, dt * 4);
      this.velY = -5.5; // 稳定缓降速率
      this.speed = Math.hypot(this.velX, this.velZ);

      const nx = THREE.MathUtils.clamp(this.pos.x + this.velX * dt, WORLD.MIN_X + 10, WORLD.MAX_X - 10);
      const nz = THREE.MathUtils.clamp(this.pos.z + this.velZ * dt, WORLD.MIN_Z + 10, WORLD.MAX_Z - 10);
      const ny = this.pos.y + this.velY * dt;

      if (!this.collider.collidesBox(nx, this.pos.y, this.pos.z, 0.4, 1.4)) this.pos.x = nx;
      if (!this.collider.collidesBox(this.pos.x, this.pos.y, nz, 0.4, 1.4)) this.pos.z = nz;

      // 落地到屋顶/地面，或者飘落入湖面 -> 自动收伞！
      const terr = sampleTerrain(this.pos.x, this.pos.z);
      if (this.collider.collidesBox(this.pos.x, ny, this.pos.z, 0.4, 1.4)) {
        this.parachuting = false;
        this.parachute.visible = false;
        this.pos.y = Math.floor(this.pos.y + 0.05);
        while (this.collider.collidesBox(this.pos.x, this.pos.y, this.pos.z, 0.4, 1.4)) this.pos.y += 0.2;
        this.velX = this.velY = this.velZ = 0;
        this.onGround = true;
      } else if (terr.isWater && ny <= 0.1) {
        this.parachuting = false;
        this.parachute.visible = false;
        this.swimming = true;
        this.pos.y = -0.35;
        this.velX = this.velY = this.velZ = 0;
      } else {
        this.pos.y = ny;
      }
    }

    // 4. 《刺激战场 / 和平精英》经典载具驾驶物理：
    // 手动油门（前进 72km/h、按住加速 118km/h、松开滑行、后退顺畅倒车、X/Z 分轴滑动绝不卡死！）
    else if (this.inCar) {
      const gas = keys['KeyW'] || keys['ArrowUp'] || keys['CarGas'];
      const rev = keys['KeyS'] || keys['ArrowDown'] || keys['CarBrake'];
      const steerL = keys['KeyA'] || keys['ArrowLeft'] || keys['CarLeft'];
      const steerR = keys['KeyD'] || keys['ArrowRight'] || keys['CarRight'];
      const boost = keys['ShiftLeft'] || keys['ShiftRight'] || keys['CarBoost'];
      const handbrake = keys['Space'] || keys['CarDrift'];
      const steer = (steerR ? 1 : 0) - (steerL ? 1 : 0);

      const boosting = !!(boost && (gas || this.carSpeed > 2));
      const maxFwd = boost ? 34 : 22; // 正常 ~80km/h 舒适逛园，按住 Shift/加速持续保持 ~122km/h 畅快驰骋不掉速！
      const maxRev = -11;
      const braking = (rev && this.carSpeed > 0.5) || handbrake;
      this.car.tailMat.color.setHex(braking ? 0xff1111 : 0x660000);
      this.nitroTimer = boosting ? 0.2 : 0;

      if (handbrake && this.carSpeed > 2) {
        this.carSpeed = Math.max(0, this.carSpeed - 28 * dt);
      } else if (gas || boost) {
        const accel = boost ? 24 : 15;
        if (this.carSpeed < maxFwd) this.carSpeed = Math.min(maxFwd, this.carSpeed + accel * dt);
        else this.carSpeed = THREE.MathUtils.lerp(this.carSpeed, maxFwd, dt * 3);
      } else if (rev) {
        // 先刹车至 0，再丝滑挂倒档倒退！
        const decel = this.carSpeed > 0 ? 30 : 12;
        this.carSpeed = Math.max(maxRev, this.carSpeed - decel * dt);
      } else {
        // 松开油门自然滑行减速至平稳停下
        this.carSpeed *= Math.max(0, 1 - 1.6 * dt);
        if (Math.abs(this.carSpeed) < 0.25) this.carSpeed = 0;
      }

      // 仪表盘底部涡轮推进条：随加速与实时车速动态响应，不限制持续加速
      const targetBar = boost ? Math.min(100, 35 + (Math.abs(this.carSpeed) / 34) * 65) : Math.min(72, (Math.abs(this.carSpeed) / 22) * 72);
      this.nitro = THREE.MathUtils.lerp(this.nitro, targetBar, Math.min(1, dt * 6));

      // 转向（支持低速灵活倒车入库与高速稳定转向）
      this.drifting = !!(handbrake && steer !== 0 && this.carSpeed > 8);
      const turnRate = this.drifting ? 2.6 : (2.15 - Math.min(0.75, Math.abs(this.carSpeed) * 0.02));
      const steerFactor = Math.min(1, Math.abs(this.carSpeed) / 2.2);
      if (steer !== 0 && steerFactor > 0.05) {
        this.yaw -= steer * turnRate * steerFactor * dt * (this.carSpeed >= 0 ? 1 : -1);
      }
      this.driftSlip = THREE.MathUtils.lerp(this.driftSlip, this.drifting ? -steer * 0.28 : 0, Math.min(1, dt * 10));
      this.car.group.rotation.y = this.driftSlip;

      const stepX = Math.sin(this.yaw) * this.carSpeed * dt;
      const stepZ = Math.cos(this.yaw) * this.carSpeed * dt;
      const nx = THREE.MathUtils.clamp(this.pos.x + stepX, WORLD.MIN_X + 10, WORLD.MAX_X - 10);
      const nz = THREE.MathUtils.clamp(this.pos.z + stepZ, WORLD.MIN_Z + 10, WORLD.MAX_Z - 10);

      // 1) 优先拱桥平滑弧面追踪
      const nextBH = getBridgeHeight(nx, nz);
      let moved = false;
      if (nextBH !== null && Math.abs(nextBH - this.pos.y) <= 2.6) {
        if (!this.collider.collidesBox(nx, nextBH + 0.25, nz, 0.7, 1.3)) {
          this.pos.x = nx;
          this.pos.z = nz;
          this.pos.y = THREE.MathUtils.lerp(this.pos.y, nextBH, Math.min(1, dt * 18));
          this.velY = 0;
          moved = true;
        }
      }

      // 2) X/Z 分轴独立滑动碰撞 + 卡边倒车脱困（彻底告别卡住不能倒退！）
      if (!moved) {
        const currentlyStuck = this.collider.collidesBox(this.pos.x, this.pos.y, this.pos.z, 0.72, 1.3);
        const tryAxis = (tx, tz) => {
          // 如果当前已轻微蹭进树干/墙边，允许倒车或拉远脱困！
          if (currentlyStuck && this.carSpeed < 0) {
            this.pos.x = tx; this.pos.z = tz; return true;
          }
          if (!this.collider.collidesBox(tx, this.pos.y, tz, 0.72, 1.3)) {
            this.pos.x = tx; this.pos.z = tz; return true;
          }
          if (!this.collider.collidesBox(tx, this.pos.y + 1.15, tz, 0.72, 1.3)) {
            this.pos.x = tx; this.pos.z = tz; this.pos.y += 1.15; return true;
          }
          return false;
        };
        const okX = Math.abs(stepX) > 1e-5 ? tryAxis(nx, this.pos.z) : true;
        const okZ = Math.abs(stepZ) > 1e-5 ? tryAxis(this.pos.x, nz) : true;
        if (!okX && !okZ) {
          if (Math.abs(this.carSpeed) > 6) {
            for (let k = 0; k < 4; k++) this._spawnFx(nx, this.pos.y + 1.3, nz, 0x5cb342, 2.2, 0.24);
          }
          this.carSpeed = 0; // 撞停而不是往墙里弹卡死，随时一按后退即可丝滑倒出！
        }

        const curBH = getBridgeHeight(this.pos.x, this.pos.z);
        if (curBH !== null && Math.abs(curBH - this.pos.y) <= 1.2) {
          this.pos.y = curBH;
          this.velY = 0;
        } else if (this.collider.hasGroundSupport(this.pos.x, this.pos.y, this.pos.z, 0.72) && this.velY <= 0) {
          this.velY = 0;
        } else {
          this.velY -= 24 * dt;
          const ny = this.pos.y + this.velY * dt;
          if (this.collider.collidesBox(this.pos.x, ny, this.pos.z, 0.72, 1.3)) {
            this.pos.y = Math.floor(ny) + 1;
            while (this.collider.collidesBox(this.pos.x, this.pos.y, this.pos.z, 0.72, 1.3)) this.pos.y += 1;
            this.velY = 0;
          } else {
            this.pos.y = ny;
          }
        }
      }

      // 上下桥坡度真实车身俯仰角
      const frontX = this.pos.x + Math.sin(this.yaw) * 1.8, frontZ = this.pos.z + Math.cos(this.yaw) * 1.8;
      const backX = this.pos.x - Math.sin(this.yaw) * 1.8, backZ = this.pos.z - Math.cos(this.yaw) * 1.8;
      const hF = getBridgeHeight(frontX, frontZ) ?? sampleTerrain(frontX, frontZ).height;
      const hB = getBridgeHeight(backX, backZ) ?? sampleTerrain(backX, backZ).height;
      const targetCarPitch = (hF > 0 && hB > 0) ? THREE.MathUtils.clamp(-Math.atan2(hF - hB, 3.6), -0.35, 0.35) : 0;
      this.car.group.rotation.x = THREE.MathUtils.lerp(this.car.group.rotation.x, targetCarPitch, Math.min(1, dt * 10));

      const terr = sampleTerrain(this.pos.x, this.pos.z);
      const onBridge = getBridgeHeight(this.pos.x, this.pos.z) !== null && this.pos.y > 1.2;
      if (terr.isWater && !onBridge && this.pos.y < 0.2) {
        this.inCar = false;
        this.car.group.visible = false;
        this.car.group.rotation.set(0, 0, 0);
        this.carSpeed = 0;
        this.swimming = true;
        this.pos.y = -0.35;
      }

      this.speed = Math.abs(this.carSpeed);
      const bx = this.pos.x - Math.sin(this.yaw) * 2.2, bz = this.pos.z - Math.cos(this.yaw) * 2.2;
      if (boost && gas) {
        this._spawnFx(bx, this.pos.y + 0.45, bz, Math.random() < 0.5 ? 0x38bdf8 : 0xffe066, 0.5, 0.38);
      } else if (this.drifting) {
        this._spawnFx(bx, this.pos.y + 0.2, bz, 0xf1f5f9, 1.0, 0.34);
      } else if (this.speed > 10 && Math.random() < 0.35) {
        this._spawnFx(bx, this.pos.y + 0.25, bz, 0xd9d2c5, 0.8, 0.24);
      }

      // 刺激战场沉浸车尾跟随（手动拖动看风景时暂停 1.6s，绝不抢镜头）
      if (this.manualLookCooldown > 0) {
        this.manualLookCooldown = Math.max(0, this.manualLookCooldown - dt);
      } else if (this.speed > 2) {
        const followYaw = this.carSpeed >= 0 ? (this.yaw + Math.PI) : this.yaw;
        let camDiff = followYaw - this.camYaw;
        while (camDiff > Math.PI) camDiff -= Math.PI * 2;
        while (camDiff < -Math.PI) camDiff += Math.PI * 2;
        this.camYaw += camDiff * Math.min(1, dt * 2.4);
      }
    }

    // 5. 划船模式（升级 5 点船体包络防搁浅防穿模 + 木桨入水激起晶莹白浪花！）
    else if (this.inBoat) {
      const len = Math.hypot(fwd, right);
      const boatSpd = (keys['ShiftLeft'] || keys['ShiftRight']) ? 24 : 14;
      // 校验整艘小木船（中心 + 船首/船尾/左右舷 5 点包络）均在离岸 >= 1.35m 的水域且不碰撞码头/桥墩/演艺船/木牌桩！
      const boatHullClear = (bx, bz, byaw) => {
        if (getWaterSignedDist(bx, bz) < 1.35) return false;
        const fx = Math.sin(byaw), fz = Math.cos(byaw);
        const rx = Math.cos(byaw), rz = -Math.sin(byaw);
        const hullPts = [
          [bx + fx * 1.65, bz + fz * 1.65],
          [bx - fx * 1.65, bz - fz * 1.65],
          [bx + rx * 0.95, bz + rz * 0.95],
          [bx - rx * 0.95, bz - rz * 0.95],
        ];
        for (const [hx, hz] of hullPts) {
          if (getWaterSignedDist(hx, hz) < 0.75) return false;
          // 跳过荷叶平台，仅阻挡桥墩/码头/大船/水中木牌桩
          for (let bi = 0; bi < this.collider.boxes.length; bi++) {
            const box = this.collider.boxes[bi];
            if (hx >= box.minX && hx <= box.maxX && hz >= box.minZ && hz <= box.maxZ && box.maxY > 0.4) return false;
          }
        }
        return true;
      };

      if (len > 0.01) {
        const nf = fwd / len, nr = right / len;
        const mx = fxCam * nf + rxCam * nr, mz = fzCam * nf + rzCam * nr;
        const targetYaw = Math.atan2(mx, mz);
        let diff = targetYaw - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.yaw += diff * Math.min(1, dt * 10);
        const nx = THREE.MathUtils.clamp(this.pos.x + mx * boatSpd * dt, WORLD.MIN_X + 10, WORLD.MAX_X - 10);
        const nz = THREE.MathUtils.clamp(this.pos.z + mz * boatSpd * dt, WORLD.MIN_Z + 10, WORLD.MAX_Z - 10);
        if (boatHullClear(nx, nz, this.yaw)) {
          this.pos.x = nx; this.pos.z = nz;
        } else {
          if (boatHullClear(nx, this.pos.z, this.yaw)) this.pos.x = nx;
          if (boatHullClear(this.pos.x, nz, this.yaw)) this.pos.z = nz;
        }
        this.speed = THREE.MathUtils.lerp(this.speed, boatSpd, dt * 8);
        this.walkPhase += dt * 6.5;

        // 复刻参考海报：两侧木桨划水处溅起纯白晶莹浪花粒子！
        if (t - this.lastOarSplash > 0.16) {
          this.lastOarSplash = t;
          const rx = Math.cos(this.yaw) * 1.45, rz = -Math.sin(this.yaw) * 1.45;
          this._spawnFx(this.pos.x + rx, 0.14, this.pos.z + rz, 0xf2fbff, 1.8, 0.24);
          this._spawnFx(this.pos.x - rx, 0.14, this.pos.z - rz, 0xf2fbff, 1.8, 0.24);
        }
      } else {
        this.speed = THREE.MathUtils.lerp(this.speed, 0, dt * 8);
      }
      // 若意外处于浅滩边缘，温和推回安全水深
      const curWd = getWaterSignedDist(this.pos.x, this.pos.z);
      if (curWd < 1.2) {
        const push = getWaterPushDir(this.pos.x, this.pos.z);
        this.pos.x += push.x * (1.25 - curWd);
        this.pos.z += push.z * (1.25 - curWd);
      }
      this.pos.y = 0.08 + Math.sin(t * 2.8) * 0.06;
    }

    // 6. 陆地步行 / 爬楼 / 下水自动游泳
    else {
      const shift = keys['ShiftLeft'] || keys['ShiftRight'];
      const walkSpd = this.swimming ? (shift ? 11 : 7) : (shift ? 15 : 9.5);
      const len = Math.hypot(fwd, right);
      let mx = 0, mz = 0;
      if (len > 0.01) {
        const nf = fwd / len, nr = right / len;
        mx = fxCam * nf + rxCam * nr;
        mz = fzCam * nf + rzCam * nr;
        const targetYaw = Math.atan2(mx, mz);
        let diff = targetYaw - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.yaw += diff * Math.min(1, dt * 11);
        this.speed = THREE.MathUtils.lerp(this.speed, walkSpd, dt * 8);
        this.walkPhase += dt * (shift ? 15 : 11);
      } else {
        this.speed = THREE.MathUtils.lerp(this.speed, 0, dt * 8);
      }

      const tryHorizontal = (dx, dz) => {
        const tx = THREE.MathUtils.clamp(this.pos.x + dx, WORLD.MIN_X + 10, WORLD.MAX_X - 10);
        const tz = THREE.MathUtils.clamp(this.pos.z + dz, WORLD.MIN_Z + 10, WORLD.MAX_Z - 10);
        if (!this.collider.collidesBox(tx, this.pos.y, tz, 0.38, 1.4)) {
          this.pos.x = tx; this.pos.z = tz; return true;
        }
        if (this.onGround || this.swimming) {
          for (const lift of [0.55, 1.15]) {
            if (!this.collider.collidesBox(tx, this.pos.y + lift, tz, 0.38, 1.4)) {
              this.pos.x = tx; this.pos.z = tz; this.pos.y += lift; return true;
            }
          }
        }
        return false;
      };
      if (Math.abs(mx * walkSpd * dt) > 1e-5) tryHorizontal(mx * walkSpd * dt, 0);
      if (Math.abs(mz * walkSpd * dt) > 1e-5) tryHorizontal(0, mz * walkSpd * dt);

      if (this.waterJumpCooldown > 0) this.waterJumpCooldown = Math.max(0, this.waterJumpCooldown - dt);
      const terr = sampleTerrain(this.pos.x, this.pos.z);
      // 检查脚下是否有 3D 荷叶支撑平台（若有荷叶支撑，团团稳稳站在荷叶上轻功踏荷，绝不掉进水里！）
      const onLotusPad = this.collider.getLotusPadAt(this.pos.x, this.pos.z, 0.22);
      const padSupport = onLotusPad && this.pos.y >= onLotusPad.topY - 0.55 && this.velY <= 0.5;
      const inWaterZone = !padSupport && this.waterJumpCooldown <= 0 && terr.isWater && this.pos.y < 0.22 && !this.collider.collidesBox(this.pos.x, this.pos.y - 0.3, this.pos.z, 0.38, 0.2);
      if (padSupport) {
        const targetPadY = onLotusPad.topY - (onLotusPad.sink || 0);
        if (!this.onGround && this.velY < -3) {
          for (let i = 0; i < 6; i++) this._spawnFx(this.pos.x, 0.22, this.pos.z, 0xe8fbff, 1.8, 0.22);
        }
        this.pos.y = targetPadY;
        this.velY = 0;
        this.swimming = false;
        this.onGround = true;
        this.jumpCount = 0;
      } else if (inWaterZone) {
        this.swimming = true;
        this.onGround = false;
        this.jumpCount = 0;
        const targetY = -0.35 + Math.sin(t * 3.5) * 0.08;
        this.pos.y = THREE.MathUtils.lerp(this.pos.y, targetY, Math.min(1, dt * 8));
        this.velY = 0;
        if (len > 0.01 && Math.random() < 0.45) this._spawnFx(this.pos.x, 0.15, this.pos.z, 0xe8f9ff, 1.5, 0.24);
      } else {
        this.swimming = false;
        const grounded = this.collider.hasGroundSupport(this.pos.x, this.pos.y, this.pos.z, 0.38);
        if (grounded && this.velY <= 0) {
          this.velY = 0;
          this.onGround = true;
          this.jumpCount = 0;
        } else {
          this.velY -= 24 * dt;
          const nextY = this.pos.y + this.velY * dt;
          if (this.velY <= 0) {
            if (this.collider.collidesBox(this.pos.x, nextY, this.pos.z, 0.38, 1.4)) {
              this.pos.y = Math.floor(nextY) + 1;
              while (this.collider.collidesBox(this.pos.x, this.pos.y, this.pos.z, 0.38, 1.4)) this.pos.y += 1;
              this.velY = 0;
              this.onGround = true;
              this.jumpCount = 0;
            } else {
              this.pos.y = nextY;
              this.onGround = false;
            }
          } else {
            if (this.collider.collidesBox(this.pos.x, nextY, this.pos.z, 0.38, 1.4)) this.velY = 0;
            else this.pos.y = nextY;
          }
        }
      }
    }

    // 高速驾驶/飞行时动态拉大 FOV 增强极致速度感！
    if (camera) {
      const targetFov = 56 + Math.min(18, this.speed * 0.28);
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dt * 5);
        camera.updateProjectionMatrix();
      }
    }

    this._syncTransform(t, dt, nightFactor);
    this._updateFx(dt);
  }

  _updateFx(dt) {
    this.fxBits.begin();
    for (let i = this.fxList.length - 1; i >= 0; i--) {
      const f = this.fxList[i];
      f.age += dt;
      if (f.age >= f.life) { this.fxList.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vy -= 5.5 * dt;
      this.fxBits.add(f.x, f.y, f.z, f.size * (1 - f.age / f.life), f.color, 1.0, f.age * 4);
    }
    this.fxBits.end();
  }

  _syncTransform(t, dt, nightFactor = 0) {
    this.root.position.copy(this.pos);
    this.root.rotation.set(0, this.yaw, 0);
    this.tuanMesh.rotation.set(0, 0, 0);
    this.tuanMesh.scale.setScalar(0.115);

    if (this.sittingSeat) {
      // 萌系闲坐姿态：圆滚滚团子微压扁坐稳、身体惬意微仰、脑袋悠闲左右看湖景！
      this.tuanMesh.position.y = 0.04 + Math.sin(t * 2.2) * 0.025;
      this.tuanMesh.scale.set(0.124, 0.102, 0.124);
      this.tuanMesh.rotation.x = -0.14;
      this.tuanMesh.rotation.y = Math.sin(t * 1.15) * 0.26;
      this.tuanMesh.rotation.z = Math.sin(t * 1.8) * 0.06;
    } else if (this.inHeli) {
      this.tuanMesh.position.y = 1.15;
      this.heli.group.rotation.x = this.heliPitch;
      this.heli.group.rotation.z = this.heliRoll;
      this.heli.mainRotor.rotation.y = t * 34;
      this.heli.tailRotor.rotation.x = t * 40;
    } else if (this.parachuting) {
      this.tuanMesh.position.y = 0.15;
      this.tuanMesh.rotation.z = Math.sin(t * 3.2) * 0.12;
      this.parachute.rotation.z = Math.sin(t * 3.2) * 0.1;
    } else if (this.inCar) {
      this.tuanMesh.position.y = 0.95;
      this.car.headLight.intensity = nightFactor > 0.2 ? 32 : 0;
      for (const w of this.car.wheels) w.rotation.x += this.carSpeed * dt * 1.8;
    } else if (this.inBoat) {
      this.tuanMesh.position.y = 0.45;
      this.tuanMesh.rotation.z = Math.sin(t * 2.1) * 0.04;
      const swing = Math.sin(this.walkPhase) * Math.min(1, this.speed / 8) * 0.55;
      this.boat.oarL.rotation.y = -0.35 + swing;
      this.boat.oarR.rotation.y = 0.35 - swing;
    } else if (this.swimming) {
      this.tuanMesh.position.y = -0.25;
      this.tuanMesh.rotation.x = 0.32;
      this.tuanMesh.rotation.z = Math.sin(t * 7) * 0.14;
    } else if (this.ridingBus) {
      this.tuanMesh.position.y = 0.15;
    } else {
      const hop = Math.abs(Math.sin(this.walkPhase)) * Math.min(1, this.speed / 6) * 0.3;
      this.tuanMesh.position.y = 0.12 + hop;
      this.tuanMesh.rotation.z = Math.sin(this.walkPhase) * Math.min(1, this.speed / 6) * 0.08;
    }
  }

  updateCamera(camera) {
    const extraDist = this.inHeli ? 6 : (this.inCar ? 2.5 : 0);
    const desiredDist = this.camDist + extraDist;
    const targetY = this.pos.y + 1.8;
    const dirX = Math.sin(this.camYaw) * Math.cos(this.camPitch);
    const dirY = (0.6 + Math.sin(this.camPitch) * desiredDist) / desiredDist;
    const dirZ = Math.cos(this.camYaw) * Math.cos(this.camPitch);
    const dirLen = Math.hypot(dirX, dirY, dirZ) || 1;
    const nx = dirX / dirLen, ny = dirY / dirLen, nz = dirZ / dirLen;

    // 第三人称 Spring-Arm 防穿墙射线：遇到景墙、院墙、屋檐或古城墙平滑前推镜头，离开后柔和恢复！
    let safeDist = desiredDist;
    if (this.collider && !this.inHeli) {
      safeDist = this.collider.castCameraDistance(this.pos.x, targetY, this.pos.z, nx, ny, nz, desiredDist, 2.3);
    }
    const lerpRate = safeDist < this.smoothCamDist ? 0.42 : 0.14;
    this.smoothCamDist = THREE.MathUtils.lerp(this.smoothCamDist, safeDist, lerpRate);

    const cx = this.pos.x + nx * this.smoothCamDist;
    const cy = targetY + ny * this.smoothCamDist;
    const cz = this.pos.z + nz * this.smoothCamDist;
    camera.position.set(cx, Math.max(1.15, cy), cz);
    camera.lookAt(this.pos.x, targetY, this.pos.z);
  }
}
