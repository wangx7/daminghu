// 大明湖入口大门体系（数据驱动单一真值源）
// 修改 GATES 坐标后，围墙留口(walls.js)、传送点(map_data.js)、小地图门标(hud.js)与3D模型全部自动联动，避免返工！
import * as THREE from 'three';
import { Vox } from './voxel/vox.js';
import { buildSnowCap, createSignboard } from './collider.js';

const C = {
  STONE: 0xd8d2c5,
  STONE_D: 0xb5aea0,
  MARBLE: 0xedeae2,
  BRICK: 0x6e737b,
  BRICK_D: 0x545961,
  WALL_W: 0xebe6db,
  RED: 0xa82a24,
  RED_D: 0x7e1d19,
  WOOD: 0x6e472b,
  ROOF: 0x3b444d,
  ROOF_GREEN: 0x267355,
  ROOF_GREEN_D: 0x1c5942,
  GLAZE_Y: 0xe8b931,
  GLAZE_YD: 0xc9961d,
  CYAN: 0x2b6b78,
  GOLD: 0xf0c24b,
  GLOW_WARM: 0xffc952,
  LANTERN: 0xff4b2b,
  FLOWER: 0xff7aa2,
  LEAF: 0x3f8f3a,
};

// 全部入口大门配置（与 truth/registry.json 同步）
export const GATES = [
  {
    id: 'southgate',
    name: '大明湖南门',
    tag: '百花洲入口',
    x: -217,
    z: 278,
    rotY: 0,
    spawnX: -217,
    spawnZ: 294,
    spawnYaw: Math.PI,
    openingRadius: 24,
    style: 'paifang_7',
    sign: '大明湖',
    backSign: '湖光山色',
    poem: '大明湖经典南入口，黄色琉璃瓦七楼大牌坊，南临百花洲与曲水亭街，北望湖心历下亭。',
    status: 'built',
  },
  {
    id: 'northgate',
    name: '大明湖北门',
    tag: '明湖北路',
    x: -60,
    z: -421,
    rotY: 0,
    spawnX: -60,
    spawnZ: -395,
    spawnYaw: 0,
    openingRadius: 20,
    style: 'gatehouse_3',
    sign: '大明湖',
    backSign: '北门',
    poem: '大明湖北岸主入口，外接北门护城河桥与明湖北路，内邻明湖楼与明湖宝鼎。',
    status: 'verified',
  },
  {
    id: 'eastgate',
    name: '大明湖东门',
    tag: '鹊华路北广场',
    x: 513,
    z: -380,
    rotY: 0,
    spawnX: 525,
    spawnZ: -362,
    spawnYaw: 0,
    openingRadius: 20,
    style: 'gatehouse_5',
    sign: '大明湖',
    backSign: '鹊华烟雨',
    poem: '大明湖东北侧主入口，紧邻大明湖火车站与鹊华路北广场，沿鹊华路向南直抵超然楼。',
    status: 'verified',
  },
  {
    id: 'southeastgate',
    name: '大明湖东南门',
    tag: '鹊华广场南口',
    x: 612,
    z: 145,
    rotY: 0,
    spawnX: 612,
    spawnZ: 126,
    spawnYaw: Math.PI,
    openingRadius: 18,
    style: 'paifang_3',
    sign: '大明湖',
    backSign: '超然致远',
    poem: '大明湖东南侧入口，毗邻鹊华广场与按察司街北口，直通超然楼与小东湖。',
    status: 'built',
  },
  {
    id: 'oldeastgate',
    name: '老东门',
    tag: '东护城河口',
    x: 863,
    z: 158,
    rotY: Math.PI / 2,
    spawnX: 842,
    spawnZ: 158,
    spawnYaw: -Math.PI / 2,
    openingRadius: 20,
    style: 'citygate',
    sign: '老东门',
    backSign: '大明湖',
    poem: '济南老东门历史意象城门楼，东临护城河与老东门码头，西通小东湖景区。',
    status: 'built',
  },
  {
    id: 'southwestgate',
    name: '大明湖西南门',
    tag: '趵突泉北路口',
    x: -858,
    z: 212,
    rotY: -0.35,
    spawnX: -867,
    spawnZ: 238,
    spawnYaw: Math.PI - 0.35,
    openingRadius: 30,
    style: 'swgate_complex',
    sign: '大明湖',
    backSign: '藕香荷韵',
    poem: '大明湖西南角主入口，翠绿琉璃瓦重檐歇山二层门楼配两翼连廊与开阔广场，正对趵突泉北路。',
    status: 'built',
  },
  {
    id: 'westgate',
    name: '大明湖西门',
    tag: '明湖西路',
    x: -855,
    z: 20,
    rotY: -Math.PI / 2,
    spawnX: -834,
    spawnZ: 20,
    spawnYaw: Math.PI / 2,
    openingRadius: 16,
    style: 'garden_gate',
    sign: '大明湖',
    backSign: '明湖西韵',
    poem: '大明湖西岸园林入口，紧邻明湖西路与龙泉池、湖西码头。',
    status: 'built',
  },
];

// 1) 正南门黄色琉璃瓦五间六柱七楼大牌坊（按实拍 01/02_southgate_paifang 1:1 精修）
function buildPaifang7(gate, solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), glow = new Vox();
  // 六根朱红主柱 + 汉白玉抱鼓石座 + 前后红色戗柱斜撑
  for (const cx of [-16, -10, -4, 4, 10, 16]) {
    v.box(cx - 1, 0, -2, cx + 1, 2, 2, C.MARBLE);
    v.set(cx, 3, -2, C.MARBLE).set(cx, 3, 2, C.MARBLE);
    const h = Math.abs(cx) === 4 ? 14 : (Math.abs(cx) === 10 ? 11 : 9);
    v.box(cx, 3, 0, cx, h, 0, C.RED);
    // 前后红色斜撑戗柱意象
    v.box(cx, 3, 2, cx, 4, 2, C.RED).box(cx, 5, 1, cx, Math.min(8, h - 2), 1, C.RED);
    v.box(cx, 3, -2, cx, 4, -2, C.RED).box(cx, 5, -1, cx, Math.min(8, h - 2), -1, C.RED);
    v.set(cx, h + 1, 0, C.GOLD);
  }
  // 额枋与绿彩斗拱
  v.box(-16, 7, 0, 16, 8, 0, C.RED_D);
  v.box(-16, 8, -1, 16, 8, 1, (x) => (x & 1) ? C.ROOF_GREEN : C.CYAN);
  v.box(-10, 9, 0, 10, 10, 0, C.RED_D);
  v.box(-10, 10, -1, 10, 10, 1, (x) => (x & 1) ? C.ROOF_GREEN : C.CYAN);
  v.box(-4, 11, 0, 4, 12, 0, C.RED_D);
  v.box(-4, 13, -1, 4, 13, 1, (x) => (x & 1) ? C.ROOF_GREEN : C.GOLD);
  // 中央主楼黄琉璃瓦顶
  v.box(-6, 14, -3, 6, 14, 3, C.GLAZE_Y);
  v.box(-5, 15, -2, 5, 15, 2, C.GLAZE_YD);
  v.box(-4, 16, 0, 4, 16, 0, C.GOLD);
  v.set(-6, 15, -3, C.GOLD).set(6, 15, -3, C.GOLD).set(-6, 15, 3, C.GOLD).set(6, 15, 3, C.GOLD);
  // 东西次间与梢间黄琉璃瓦四楼
  for (const s of [-1, 1]) {
    const x0 = s === -1 ? -11 : 5;
    const x1 = s === -1 ? -5 : 11;
    v.box(x0, 11, -2, x1, 11, 2, C.GLAZE_Y);
    v.box(x0 + 1, 12, -1, x1 - 1, 12, 1, C.GLAZE_YD);
    v.box(x0 + 2, 13, 0, x1 - 2, 13, 0, C.GOLD);
    const ox0 = s === -1 ? -17 : 12;
    const ox1 = s === -1 ? -12 : 17;
    v.box(ox0, 9, -2, ox1, 9, 2, C.GLAZE_Y);
    v.box(ox0 + 1, 10, -1, ox1 - 1, 10, 1, C.GLAZE_YD);
    v.box(ox0 + 2, 11, 0, ox1 - 2, 11, 0, C.GOLD);
  }
  // 牌坊前台阶与青石铺地
  v.box(-18, 0, -4, 18, 0, 4, C.STONE);
  // 西侧清代《大明湖》古石碑（青石碑身 + 墨绿大字，按实拍 02_southgate_stele_paifang）
  v.box(-20, 0, 4, -18, 1, 6, C.STONE_D);
  v.box(-19, 2, 5, -19, 6, 5, C.MARBLE);
  v.set(-19, 7, 5, C.STONE);
  glow.set(-7, 9, 1, C.LANTERN).set(7, 9, 1, C.LANTERN);
  glow.set(-7, 9, -1, C.LANTERN).set(7, 9, -1, C.LANTERN);

  const g = new THREE.Group();
  g.add(v.mesh(solidMat, 0.03), glow.mesh(glowMat, 0.01));
  // 实景南门牌坊为红底金字「大明湖」，柱上无对联
  const signSouth = createSignboard({ title: gate.sign, width: 7.4, height: 2.5, bgColor: '#8f1d18', textColor: '#f5d26b', seal: '' });
  signSouth.position.set(0.5, 12.2, 1.35);
  const signNorth = createSignboard({ title: gate.backSign || gate.sign, width: 7.4, height: 2.5, bgColor: '#8f1d18', textColor: '#f5d26b', seal: '' });
  signNorth.position.set(0.5, 12.2, -1.35);
  signNorth.rotation.y = Math.PI;
  const steleSign = createSignboard({ title: '大明湖', width: 1.15, height: 3.6, vertical: true, bgColor: '#d4cfc2', borderColor: '#8f8a7d', textColor: '#165b36', seal: '' });
  steleSign.position.set(-19, 4.4, 6.2);
  g.add(signSouth, signNorth, steleSign);

  const snow = buildSnowCap(v, 3);
  g.add(snow);
  snowMeshes.push(snow);
  g.position.set(gate.x, 2, gate.z);
  g.rotation.y = gate.rotY;
  collider.registerVox(v, gate.x, 2, gate.z, gate.rotY);
  return g;
}

// 2) 三间四柱灰瓦牌坊（东南门 / 西南门）
function buildPaifang3(gate, solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), glow = new Vox();
  for (const cx of [-8, -3, 3, 8]) {
    v.box(cx - 1, 0, -1, cx + 1, 1, 1, C.MARBLE);
    const h = Math.abs(cx) === 3 ? 11 : 8;
    v.box(cx, 2, 0, cx, h, 0, C.RED);
  }
  v.box(-8, 7, 0, 8, 8, 0, C.RED_D);
  v.box(-3, 9, 0, 3, 10, 0, C.RED_D);
  v.box(-5, 11, -2, 5, 11, 2, C.ROOF);
  v.box(-4, 12, -1, 4, 12, 1, C.ROOF);
  v.box(-3, 13, 0, 3, 13, 0, C.GOLD);
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -9 : 4;
    const x1 = s < 0 ? -4 : 9;
    v.box(x0, 9, -2, x1, 9, 2, C.ROOF);
    v.box(x0 + 1, 10, -1, x1 - 1, 10, 1, C.ROOF);
    v.box(s * 10 - 1, 0, 3, s * 10 + 1, 1, 5, C.MARBLE);
    v.set(s * 10, 2, 4, C.FLOWER);
    glow.set(s * 5, 7, 1, C.LANTERN).set(s * 5, 7, -1, C.LANTERN);
  }
  const g = new THREE.Group();
  g.add(v.mesh(solidMat, 0.03), glow.mesh(glowMat, 0.01));
  const signF = createSignboard({ title: gate.sign, width: 5.6, height: 2.0, bgColor: '#162d54', seal: '' });
  signF.position.set(0, 9.8, 1.0);
  const signB = createSignboard({ title: gate.backSign || gate.sign, width: 5.6, height: 2.0, bgColor: '#162d54', seal: '' });
  signB.position.set(0, 9.8, -1.0);
  signB.rotation.y = Math.PI;
  g.add(signF, signB);

  const snow = buildSnowCap(v, 5);
  g.add(snow);
  snowMeshes.push(snow);
  g.position.set(gate.x, 2, gate.z);
  g.rotation.y = gate.rotY;
  collider.registerVox(v, gate.x, 2, gate.z, gate.rotY);
  return g;
}

// 3) 三开间 / 五开间古风大门楼（北门 / 东门，带两侧门房、前广场花坛与石灯）
function buildGateHouse(gate, solidMat, glowMat, collider, snowMeshes, wide = false) {
  const v = new Vox(), glow = new Vox();
  const half = wide ? 13 : 10;
  const openW = wide ? 5 : 4;
  // 两侧青砖白墙门房
  v.box(-half, 0, -3, -openW - 1, 6, 3, (x, y, z) => (y <= 1 || Math.abs(z) === 3 && (x === -half || x === -openW - 1)) ? C.BRICK : C.WALL_W);
  v.box(openW + 1, 0, -3, half, 6, 3, (x, y, z) => (y <= 1 || Math.abs(z) === 3 && (x === half || x === openW + 1)) ? C.BRICK : C.WALL_W);
  // 门洞朱红立柱
  for (const px of [-openW, openW]) v.box(px, 0, -3, px, 7, 3, C.RED);
  // 重檐歇山灰瓦大顶
  v.box(-half - 2, 7, -5, half + 2, 7, 5, C.ROOF);
  v.box(-half, 8, -4, half, 8, 4, C.ROOF);
  v.box(-half + 3, 9, -2, half - 3, 9, 2, C.ROOF);
  v.box(-half + 5, 10, 0, half - 5, 10, 0, C.GOLD);
  if (wide) {
    // 五开间东门加中楼歇山挑高
    v.box(-openW - 1, 10, -2, openW + 1, 11, 2, C.RED_D);
    v.box(-openW - 2, 12, -3, openW + 2, 12, 3, C.ROOF);
    v.box(-openW, 13, -1, openW, 13, 1, C.ROOF);
    v.box(-openW + 1, 14, 0, openW - 1, 14, 0, C.GOLD);
  }
  // 门前石狮/石灯柱与花坛
  for (const s of [-1, 1]) {
    v.box(s * (openW + 3), 0, -6, s * (openW + 3), 3, -6, C.STONE);
    glow.set(s * (openW + 3), 4, -6, C.GLOW_WARM);
    v.box(s * (openW + 5) - 1, 0, 5, s * (openW + 5) + 1, 1, 7, C.MARBLE);
    v.set(s * (openW + 5), 2, 6, C.LEAF);
    glow.set(s * openW, 6, 4, C.LANTERN).set(s * openW, 6, -4, C.LANTERN);
  }

  const g = new THREE.Group();
  g.add(v.mesh(solidMat, 0.03), glow.mesh(glowMat, 0.01));
  const signY = wide ? 10.6 : 6.8;
  const signF = createSignboard({ title: gate.sign, width: 7.2, height: 2.6, bgColor: '#162d54' });
  signF.position.set(0, signY, 3.6);
  const signB = createSignboard({ title: gate.backSign || gate.sign, width: 7.2, height: 2.6, bgColor: '#162d54' });
  signB.position.set(0, signY, -3.6);
  signB.rotation.y = Math.PI;
  g.add(signF, signB);

  const snow = buildSnowCap(v, 5);
  g.add(snow);
  snowMeshes.push(snow);
  g.position.set(gate.x, 2, gate.z);
  g.rotation.y = gate.rotY;
  collider.registerVox(v, gate.x, 2, gate.z, gate.rotY);
  return g;
}

// 4) 青砖城台重檐城门楼（老东门）
function buildCityGate(gate, solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), glow = new Vox();
  // 青砖城台（中间留 7m 宽拱形门洞通行）
  v.box(-12, 0, -4, -4, 6, 4, (x, y, z) => ((x + y + z) & 1) ? C.BRICK : C.BRICK_D);
  v.box(4, 0, -4, 12, 6, 4, (x, y, z) => ((x + y + z) & 1) ? C.BRICK : C.BRICK_D);
  v.box(-4, 5, -4, 4, 6, 4, C.BRICK_D);
  // 城垛女墙
  for (let x = -12; x <= 12; x += 2) {
    v.set(x, 7, -4, C.BRICK).set(x, 7, 4, C.BRICK);
  }
  // 城楼主体
  v.box(-8, 7, -3, 8, 11, 3, (x, y, z) => (Math.abs(x) === 8 || Math.abs(z) === 3) ? C.RED : C.WALL_W);
  v.box(-10, 12, -5, 10, 12, 5, C.ROOF);
  v.box(-8, 13, -3, 8, 13, 3, C.ROOF);
  v.box(-6, 14, -1, 6, 14, 1, C.ROOF);
  v.box(-4, 15, 0, 4, 15, 0, C.GOLD);
  glow.set(-4, 6, 5, C.LANTERN).set(4, 6, 5, C.LANTERN);
  glow.set(-4, 6, -5, C.LANTERN).set(4, 6, -5, C.LANTERN);

  const g = new THREE.Group();
  g.add(v.mesh(solidMat, 0.03), glow.mesh(glowMat, 0.01));
  const signF = createSignboard({ title: gate.sign, width: 6.4, height: 2.3, bgColor: '#2c2018' });
  signF.position.set(0, 9.6, 3.6);
  const signB = createSignboard({ title: gate.backSign || gate.sign, width: 6.4, height: 2.3, bgColor: '#2c2018' });
  signB.position.set(0, 9.6, -3.6);
  signB.rotation.y = Math.PI;
  g.add(signF, signB);

  const snow = buildSnowCap(v, 7);
  g.add(snow);
  snowMeshes.push(snow);
  g.position.set(gate.x, 2, gate.z);
  g.rotation.y = gate.rotY;
  collider.registerVox(v, gate.x, 2, gate.z, gate.rotY);
  return g;
}

// 5) 粉墙黛瓦园林门（西门）
function buildGardenGate(gate, solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), glow = new Vox();
  v.box(-9, 0, -1, -4, 5, 1, (x, y) => y === 0 ? C.STONE_D : C.WALL_W);
  v.box(4, 0, -1, 9, 5, 1, (x, y) => y === 0 ? C.STONE_D : C.WALL_W);
  v.box(-9, 6, -2, -4, 6, 2, C.ROOF);
  v.box(4, 6, -2, 9, 6, 2, C.ROOF);
  // 中央门楼
  v.box(-4, 0, -2, -4, 7, 2, C.RED);
  v.box(4, 0, -2, 4, 7, 2, C.RED);
  v.box(-4, 6, -2, 4, 7, 2, C.RED_D);
  v.box(-6, 8, -3, 6, 8, 3, C.ROOF);
  v.box(-5, 9, -2, 5, 9, 2, C.ROOF);
  v.box(-3, 10, 0, 3, 10, 0, C.GOLD);
  glow.set(-4, 5, 3, C.LANTERN).set(4, 5, 3, C.LANTERN);
  glow.set(-4, 5, -3, C.LANTERN).set(4, 5, -3, C.LANTERN);

  const g = new THREE.Group();
  g.add(v.mesh(solidMat, 0.03), glow.mesh(glowMat, 0.01));
  const signF = createSignboard({ title: gate.sign, width: 5.2, height: 1.9, bgColor: '#162d54' });
  signF.position.set(0, 6.8, 2.5);
  const signB = createSignboard({ title: gate.backSign || gate.sign, width: 5.2, height: 1.9, bgColor: '#162d54' });
  signB.position.set(0, 6.8, -2.5);
  signB.rotation.y = Math.PI;
  g.add(signF, signB);

  const snow = buildSnowCap(v, 5);
  g.add(snow);
  snowMeshes.push(snow);
  g.position.set(gate.x, 2, gate.z);
  g.rotation.y = gate.rotY;
  collider.registerVox(v, gate.x, 2, gate.z, gate.rotY);
  return g;
}

// 6) 西南门实景翠绿琉璃瓦重檐歇山门楼群（按 swgate_aerial_oblique / swgate_aerial_top 1:1 精修）
function buildSwGateComplex(gate, solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), glow = new Vox();
  // 门前宽阔转角石砖广场铺装与内庭铺装（按航拍 swgate_aerial_oblique 扩大前广场）
  v.box(-22, 0, -10, 22, 0, 22, (x, y, z) => ((x + z) & 1) ? C.STONE : C.STONE_D);
  // 中央主门楼：一楼宽阔朱红通廊（x ∈ [-8, 8] 留空畅通）
  for (const px of [-9, -5, 5, 9]) {
    v.box(px, 1, -3, px, 6, -3, C.RED);
    v.box(px, 1, 3, px, 6, 3, C.RED);
  }
  // 一楼前挑檐（翠绿琉璃瓦单坡屋檐）
  v.box(-11, 7, -5, 11, 7, 5, C.ROOF_GREEN);
  v.box(-10, 8, -4, 10, 8, 4, C.ROOF_GREEN_D);
  // 二楼红柱白墙明阁主体
  v.box(-9, 8, -3, 9, 12, 3, (x, y, z) => {
    if (Math.abs(x) === 9 || (Math.abs(z) === 3 && x % 3 === 0)) return C.RED;
    return C.WALL_W;
  });
  // 二楼翠绿琉璃瓦重檐歇山大顶 + 金色正脊翘角
  v.box(-12, 13, -5, 12, 13, 5, C.ROOF_GREEN);
  v.box(-10, 14, -4, 10, 14, 4, C.ROOF_GREEN_D);
  v.box(-8, 15, -2, 8, 15, 2, C.ROOF_GREEN);
  v.box(-6, 16, 0, 6, 16, 0, C.GOLD);
  v.set(-12, 14, -5, C.GOLD).set(12, 14, -5, C.GOLD).set(-12, 14, 5, C.GOLD).set(12, 14, 5, C.GOLD);

  // 左右两翼对称翠绿瓦配殿/游客中心与半围合连廊（与航拍俯视图完全一致）
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -18 : 10;
    const x1 = s < 0 ? -10 : 18;
    v.box(x0, 1, -5, x1, 6, 4, (x, y, z) => (x === x0 || x === x1 || Math.abs(z) === 5 || z === 4) ? C.RED : C.WALL_W);
    v.box(x0 - 1, 7, -6, x1 + 1, 7, 5, C.ROOF_GREEN);
    v.box(x0, 8, -4, x1, 8, 3, C.ROOF_GREEN_D);
    v.box(x0 + 1, 9, -1, x1 - 1, 9, 0, C.GOLD);
    // 门前花坛与暖光石灯柱
    v.box(s * 12 - 2, 1, 8, s * 12 + 2, 1, 11, C.MARBLE);
    v.box(s * 12 - 1, 2, 9, s * 12 + 1, 2, 10, (x) => (x & 1) ? C.FLOWER : C.LEAF);
    v.box(s * 8, 1, 10, s * 8, 4, 10, C.STONE);
    glow.set(s * 8, 5, 10, C.GLOW_WARM);
    glow.set(s * 5, 6, 4, C.LANTERN).set(s * 5, 6, -4, C.LANTERN);
  }

  const g = new THREE.Group();
  g.add(v.mesh(solidMat, 0.03), glow.mesh(glowMat, 0.01));
  const signF = createSignboard({ title: gate.sign, subtitle: '西南门', width: 7.4, height: 2.6, bgColor: '#162d54' });
  signF.position.set(0, 10.4, 5.2);
  const signB = createSignboard({ title: gate.backSign || gate.sign, width: 7.0, height: 2.4, bgColor: '#162d54' });
  signB.position.set(0, 10.4, -5.2);
  signB.rotation.y = Math.PI;
  g.add(signF, signB);

  const snow = buildSnowCap(v, 7);
  g.add(snow);
  snowMeshes.push(snow);
  g.position.set(gate.x, 2, gate.z);
  g.rotation.y = gate.rotY;
  collider.registerVox(v, gate.x, 2, gate.z, gate.rotY);
  return g;
}

export function buildGates(solidMat, collider, snowMeshes) {
  const group = new THREE.Group();
  const glowMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color(0xffb433),
    emissiveIntensity: 0.4,
  });

  for (const gate of GATES) {
    let mesh;
    if (gate.style === 'paifang_7') mesh = buildPaifang7(gate, solidMat, glowMat, collider, snowMeshes);
    else if (gate.style === 'swgate_complex') mesh = buildSwGateComplex(gate, solidMat, glowMat, collider, snowMeshes);
    else if (gate.style === 'paifang_3') mesh = buildPaifang3(gate, solidMat, glowMat, collider, snowMeshes);
    else if (gate.style === 'gatehouse_5') mesh = buildGateHouse(gate, solidMat, glowMat, collider, snowMeshes, true);
    else if (gate.style === 'citygate') mesh = buildCityGate(gate, solidMat, glowMat, collider, snowMeshes);
    else if (gate.style === 'garden_gate') mesh = buildGardenGate(gate, solidMat, glowMat, collider, snowMeshes);
    else mesh = buildGateHouse(gate, solidMat, glowMat, collider, snowMeshes, false);
    group.add(mesh);
  }
  return { group, glowMat };
}
