// Phase 2 大明湖全景点建筑扩展库（2.0 升级：全建筑 3D 立体碰撞 + 屋顶冬季积雪层 + 高清中文牌匾/名联）
import * as THREE from 'three';
import { Vox, charMaterial, hash } from './voxel/vox.js';
import { bird } from './voxel/cast.js';
import { buildSnowCap, createSignboard } from './collider.js';

const C = {
  BRICK: 0x6e737b,
  BRICK_D: 0x545961,
  STONE: 0xd8d2c5,
  STONE_D: 0xb5aea0,
  MARBLE: 0xedeae2,
  RED: 0xa82a24,
  RED_D: 0x7e1d19,
  WOOD: 0x6e472b,
  ROOF: 0x3b444d,
  ROOF_GREEN: 0x2f6b55,
  GOLD: 0xf0c24b,
  WALL_W: 0xebe5d8,
  ROCK: 0x82878c,
  BRONZE: 0x4b5c49,
  LANTERN: 0xff5a2b,
  GLOW_WARM: 0xffc952,
  BAMBOO: 0x4ca64c,
};

function makeGlowMat() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color(0xff9933),
    emissiveIntensity: 0.3,
  });
}

// 传统中式围合院墙生成器（粉墙黛瓦 + 青石方砖院地 + 宽敞朱红垂花院门 + 门前灯笼，团团可自由进出院子！）
function addCourtyard(v, g, x0, z0, x1, z1, gateSide = 'south') {
  // 院内青石方砖地面
  v.box(x0, 0, z0, x1, 0, z1, (x, y, z) => ((x + z) & 1) ? C.STONE : C.STONE_D);
  const cx = Math.round((x0 + x1) / 2);
  const cz = Math.round((z0 + z1) / 2);

  // 四周粉墙黛瓦院墙（y = 1..4，顶覆黛青瓦 y = 5）
  for (let x = x0; x <= x1; x++) {
    const openN = gateSide === 'north' && Math.abs(x - cx) <= 2;
    const openS = gateSide === 'south' && Math.abs(x - cx) <= 2;
    if (!openN) { v.box(x, 1, z0, x, 4, z0, C.WALL_W); v.set(x, 5, z0, C.ROOF); }
    if (!openS) { v.box(x, 1, z1, x, 4, z1, C.WALL_W); v.set(x, 5, z1, C.ROOF); }
  }
  for (let z = z0; z <= z1; z++) {
    const openW = gateSide === 'west' && Math.abs(z - cz) <= 2;
    const openE = gateSide === 'east' && Math.abs(z - cz) <= 2;
    if (!openW) { v.box(x0, 1, z, x0, 4, z, C.WALL_W); v.set(x0, 5, z, C.ROOF); }
    if (!openE) { v.box(x1, 1, z, x1, 4, z, C.WALL_W); v.set(x1, 5, z, C.ROOF); }
  }

  // 院门朱红门框 + 飞檐门楼 + 一对红灯笼
  if (gateSide === 'north' || gateSide === 'south') {
    const gz = gateSide === 'north' ? z0 : z1;
    const out = gateSide === 'north' ? -1 : 1;
    v.box(cx - 3, 1, gz, cx - 3, 5, gz, C.RED).box(cx + 3, 1, gz, cx + 3, 5, gz, C.RED);
    v.box(cx - 3, 5, gz, cx + 3, 5, gz, C.RED_D);
    v.box(cx - 4, 6, gz - 1, cx + 4, 6, gz + 1, C.ROOF);
    v.box(cx - 3, 7, gz, cx + 3, 7, gz, C.GOLD);
    g.set(cx - 3, 5, gz + out, C.LANTERN).set(cx + 3, 5, gz + out, C.LANTERN);
  } else {
    const gx = gateSide === 'west' ? x0 : x1;
    const out = gateSide === 'west' ? -1 : 1;
    v.box(gx, 1, cz - 3, gx, 5, cz - 3, C.RED).box(gx, 1, cz + 3, gx, 5, cz + 3, C.RED);
    v.box(gx, 5, cz - 3, gx, 5, cz + 3, C.RED_D);
    v.box(gx - 1, 6, cz - 4, gx + 1, 6, cz + 4, C.ROOF);
    v.box(gx, 7, cz - 3, gx, 7, cz + 3, C.GOLD);
    g.set(gx + out, 5, cz - 3, C.LANTERN).set(gx + out, 5, cz + 3, C.LANTERN);
  }
}

function finalizeBuilding(v, g, solidMat, glowMat, x, y, z, collider, snowMeshes, minSnowY = 5) {
  // 自动在 y=0 处向下延伸 2 格石砌防悬空基座，确保临水建筑任何角度绝不露底缝
  const foot = [];
  v.each((vx, vy, vz) => { if (vy === 0) foot.push([vx, vz]); });
  for (const [fx, fz] of foot) {
    v.set(fx, -1, fz, C.STONE_D).set(fx, -2, fz, C.STONE_D);
  }
  const grp = new THREE.Group();
  grp.add(v.mesh(solidMat, 0.03), g.mesh(glowMat, 0.01));
  const snow = buildSnowCap(v, minSnowY);
  grp.add(snow);
  snowMeshes.push(snow);
  grp.position.set(x, y, z);
  collider.registerVox(v, x, y, z);
  return grp;
}

// 1. 北极阁（按 OSM 真实 17m 东西 × 30m 南北比例 + 7m 青砖高台 + 朝南可攀登石阶！）
function buildBeijige(solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), g = new Vox();
  // 青灰条石高台（横向砌缝肌理，避免生硬棋盘格）
  v.box(-9, 0, -14, 9, 7, 14, (x, y, z) => (y % 2 === 0 && ((x + z) & 3) === 0) ? C.BRICK_D : C.BRICK);
  for (let x = -9; x <= 9; x += 2) {
    v.set(x, 8, -14, C.MARBLE);
    if (Math.abs(x) > 3) v.set(x, 8, 14, C.MARBLE);
  }
  for (let z = -14; z <= 14; z += 2) { v.set(-9, 8, z, C.MARBLE).set(9, 8, z, C.MARBLE); }
  // 朝南（+Z）可攀登长石阶（每格上升 1，并按实拍 01_beijige_gate_stairs 还原中间双条青石滑梯与阶顶石狮！）
  for (let i = 0; i < 8; i++) {
    v.box(-4, 0, 15 + i, 4, 7 - i, 15 + i, (x) => (Math.abs(x) === 2) ? C.MARBLE : C.STONE);
  }
  v.box(-5, 7, 14, -5, 9, 14, C.MARBLE).box(5, 7, 14, 5, 9, 14, C.MARBLE); // 阶顶左右汉白玉石狮
  // 主殿（坐北朝南，南北进深舒展）
  v.box(-7, 8, -10, 7, 14, 6, (x, y, z) => (Math.abs(x) === 7 || Math.abs(z) === 6 || z === -10) ? C.RED : C.WALL_W);
  v.box(-2, 8, 6, 2, 12, 6, C.WOOD);
  for (let step = 0; step < 5; step++) {
    const rx = 9 - step, rz = 10 - step;
    v.box(-rx, 15 + step, -2 - rz, rx, 15 + step, -2 + rz, step === 0 ? C.ROOF_GREEN : C.ROOF);
  }
  v.box(-3, 20, -2, 3, 20, -2, C.GOLD);
  g.set(-8, 14, 7, C.LANTERN).set(8, 14, 7, C.LANTERN);

  // 高台南侧左右钟楼与鼓楼双小亭
  for (const sx of [-7, 7]) {
    for (const [px, pz] of [[sx - 1, 9], [sx + 1, 9], [sx - 1, 13], [sx + 1, 13]]) {
      v.box(px, 8, pz, px, 12, pz, C.RED);
    }
    v.box(sx - 2, 13, 8, sx + 2, 13, 14, C.ROOF_GREEN);
    v.box(sx - 1, 14, 9, sx + 1, 14, 13, C.ROOF);
    v.set(sx, 15, 11, C.GOLD);
  }

  const grp = finalizeBuilding(v, g, solidMat, glowMat, 161, 2, -355, collider, snowMeshes, 7);
  const sign = createSignboard({ title: '北极阁', width: 5.0, height: 1.9 });
  sign.position.set(0, 14.2, 6.8);
  grp.add(sign);
  return grp;
}

// 2. 铁公祠 & 小沧浪水榭（按 OSM 111×50m 园林格局扩容：正殿 + 得月亭 + 湖山一览楼配殿 + 临水小沧浪 + 荷风对联！）
function buildTiegongci(solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), g = new Vox();
  // 扩展东西院落（贴合真实铁公祠狭长临湖园林格局）
  addCourtyard(v, g, -32, -13, 24, 8, 'south');
  // 铁公祠正殿
  v.box(-10, 0, -9, 10, 1, 4, C.STONE);
  v.box(-8, 2, -7, 8, 7, 2, (x, y, z) => (Math.abs(x) === 8 || Math.abs(z) === 2) ? C.RED : C.WALL_W);
  for (let s = 0; s < 5; s++) v.box(-10 + s, 8 + s, -9 + s, 10 - s, 8 + s, 4 - s, C.ROOF);
  v.box(-5, 13, -2, 5, 13, -2, C.GOLD);
  // 西侧「得月亭」赏荷配殿与连接曲廊
  v.box(-28, 0, -8, -16, 1, 3, C.STONE);
  for (const [px, pz] of [[-27, -7], [-17, -7], [-27, 2], [-17, 2], [-22, -7], [-22, 2]]) v.box(px, 2, pz, px, 6, pz, C.RED);
  for (let s = 0; s < 4; s++) v.box(-29 + s, 7 + s, -9 + s, -15 - s, 7 + s, 4 - s, C.ROOF_GREEN);
  // 东侧配殿（湖山一览阁意象）
  v.box(14, 0, -9, 22, 1, 2, C.STONE);
  v.box(15, 2, -8, 21, 6, 1, (x, y, z) => (x === 15 || x === 21 || z === 1) ? C.RED : C.WALL_W);
  for (let s = 0; s < 4; s++) v.box(13 + s, 7 + s, -10 + s, 23 - s, 7 + s, 3 - s, C.ROOF);
  // 院内翠竹与东侧连廊（直通临水小沧浪）
  for (const [bx, bz] of [[-30, 5], [-29, 5], [12, -10], [13, -10], [21, 5]]) v.box(bx, 1, bz, bx, 6, bz, C.BAMBOO);
  for (let z = 3; z <= 10; z++) {
    v.box(10, 0, z, 12, 0, z, C.STONE);
    if (z % 3 === 0) v.box(10, 1, z, 10, 5, z, C.RED).box(12, 1, z, 12, 5, z, C.RED);
    v.box(9, 6, z, 13, 6, z, C.ROOF);
  }

  // 临水小沧浪水榭（带美人靠、东西双翼临水灰瓦红柱长廊与四面观荷挑台，按实拍 04_xiaocanglang_lotus_hall）
  v.box(-6, 0, 8, 6, 1, 18, C.MARBLE);
  for (const [px, pz] of [[-5, 9], [5, 9], [-5, 17], [5, 17], [0, 9], [0, 17]]) v.box(px, 2, pz, px, 6, pz, C.RED);
  for (let x = -5; x <= 5; x++) if (Math.abs(x) >= 2) v.set(x, 2, 17, C.WOOD);
  for (let s = 0; s < 4; s++) v.box(-7 + s, 7 + s, 7 + s, 7 - s, 7 + s, 19 - s, C.ROOF);
  v.box(-3, 11, 13, 3, 11, 13, C.GOLD);
  // 东西两侧临水赏荷通透长廊
  for (const [x0, x1] of [[-18, -7], [7, 18]]) {
    v.box(x0, 0, 12, x1, 1, 15, C.STONE);
    for (let x = x0; x <= x1; x++) {
      v.set(x, 2, 15, C.MARBLE);
      if ((x - x0) % 4 === 0) v.box(x, 2, 12, x, 5, 12, C.RED).box(x, 2, 15, x, 5, 15, C.RED);
    }
    v.box(x0 - 1, 6, 11, x1 + 1, 6, 16, C.ROOF);
    v.box(x0, 7, 13, x1, 7, 14, C.ROOF);
  }
  g.set(-6, 6, 18, C.LANTERN).set(6, 6, 18, C.LANTERN).set(-22, 6, 3, C.LANTERN).set(18, 6, 2, C.LANTERN);

  const grp = finalizeBuilding(v, g, solidMat, glowMat, -529, 2, -291, collider, snowMeshes, 6);
  const sign = createSignboard({ title: '铁公祠', width: 4.8, height: 1.9 });
  sign.position.set(0, 7.2, 2.8);
  const sign2 = createSignboard({ title: '小沧浪', width: 4.0, height: 1.6 });
  sign2.position.set(0, 6.8, 18.6);
  const cL = createSignboard({ title: '四面荷花三面柳', width: 1.0, height: 4.6, vertical: true });
  cL.position.set(-5.6, 4.5, 17.6);
  const cR = createSignboard({ title: '一城山色半城湖', width: 1.0, height: 4.6, vertical: true });
  cR.position.set(5.6, 4.5, 17.6);
  grp.add(sign, sign2, cL, cR);
  return grp;
}

// 3. 稼轩祠（按 OSM 45×51m 格局扩容为标准三合院：正殿 + 东西厢房 + 垂花门 + 翠竹）
function buildJiaxuan(solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), g = new Vox();
  addCourtyard(v, g, -20, -20, 20, 16, 'north');
  // 正殿（坐南朝北）
  v.box(-13, 0, 2, 13, 1, 13, C.STONE);
  v.box(-11, 2, 4, 11, 8, 11, (x, y, z) => (Math.abs(x) === 11 || z === 4) ? C.RED : C.WALL_W);
  for (let s = 0; s < 5; s++) v.box(-13 + s, 9 + s, 2 + s, 13 - s, 9 + s, 13 - s, C.ROOF);
  v.box(-6, 14, 7, 6, 14, 7, C.GOLD);
  // 东西配殿厢房
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -18 : 13, x1 = sx < 0 ? -13 : 18;
    v.box(x0, 0, -11, x1, 1, 2, C.STONE);
    v.box(x0 + 1, 2, -10, x1 - 1, 6, 1, C.WALL_W);
    for (let s = 0; s < 3; s++) v.box(x0 + s, 7 + s, -11 + s, x1 - s, 7 + s, 2 - s, C.ROOF);
  }
  g.set(-10, 8, 3, C.LANTERN).set(10, 8, 3, C.LANTERN);
  // 进门院内孤峰太湖石假山（置于中庭深处且高度克制，透过大门框景不遮挡门额匾！）
  v.box(-2, 0, -8, 2, 1, -6, C.STONE_D);
  v.box(-1, 2, -7, 1, 3, -7, C.STONE).set(0, 4, -7, C.STONE);
  for (const bx of [-15, -14, 14, 15]) v.box(bx, 1, -14, bx, 6 + (bx & 1), -14, C.BAMBOO);

  const grp = finalizeBuilding(v, g, solidMat, glowMat, -525, 2, 106, collider, snowMeshes, 7);
  // 按实拍 01_jiaxuanci_gate：主匾「辛稼轩纪念祠」高悬于北大门门额上方，院内正殿另悬「稼轩祠」
  const gateSign = createSignboard({ title: '辛稼轩纪念祠', width: 6.8, height: 1.9, bgColor: '#1b1a18' });
  gateSign.position.set(0, 6.4, -21.2);
  gateSign.rotation.y = Math.PI;
  const sign = createSignboard({ title: '稼轩祠', width: 4.8, height: 1.8, bgColor: '#1b1a18' });
  sign.position.set(0, 8.2, 3.2);
  sign.rotation.y = Math.PI;
  const cL = createSignboard({ title: '铁板铜琶继东坡高唱大江东去', width: 0.95, height: 5.4, vertical: true, bgColor: '#3a1410' });
  cL.position.set(-5.2, 5.2, 3.2); cL.rotation.y = Math.PI;
  const cR = createSignboard({ title: '美芹悲黍冀南宋莫随鸿雁南飞', width: 0.95, height: 5.4, vertical: true, bgColor: '#3a1410' });
  cR.position.set(5.2, 5.2, 3.2); cR.rotation.y = Math.PI;
  grp.add(gateSign, sign, cL, cR);
  return grp;
}

// 4. 南丰祠 (317, -316，按 OSM 44×40m 格局扩容带东西配殿) & 独立藕神祠 (370, -342)
function buildNanfengci(solidMat, glowMat, collider, snowMeshes) {
  const pair = new THREE.Group();

  // 4A) 南丰祠（曾巩祠）
  {
    const v = new Vox(), g = new Vox();
    addCourtyard(v, g, -19, -16, 19, 15, 'south');
    v.box(-12, 0, -11, 12, 1, 2, C.STONE);
    v.box(-10, 2, -9, 10, 7, 0, (x, y, z) => (Math.abs(x) === 10 || z === 0) ? C.RED : C.WALL_W);
    for (let s = 0; s < 4; s++) v.box(-12 + s, 8 + s, -11 + s, 12 - s, 8 + s, 2 - s, C.ROOF);
    // 东西厢房
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -17 : 12, x1 = sx < 0 ? -12 : 17;
      v.box(x0, 0, -4, x1, 1, 9, C.STONE);
      v.box(x0 + 1, 2, -3, x1 - 1, 5, 8, C.WALL_W);
      for (let s = 0; s < 3; s++) v.box(x0 + s, 6 + s, -4 + s, x1 - s, 6 + s, 9 - s, C.ROOF);
    }
    g.set(-10, 7, 1, C.LANTERN).set(10, 7, 1, C.LANTERN);

    const grp = finalizeBuilding(v, g, solidMat, glowMat, 317, 2, -316, collider, snowMeshes, 6);
    const sign1 = createSignboard({ title: '南丰祠', width: 4.5, height: 1.8 });
    sign1.position.set(0, 7.2, 0.8);
    grp.add(sign1);
    pair.add(grp);
  }

  // 4B) 藕神祠（李清照纪念祠，真实 OSM 坐标 (370, -342)，约 13×7m 独立精巧祠堂）
  {
    const v = new Vox(), g = new Vox();
    v.box(-7, 0, -4, 7, 1, 4, C.MARBLE);
    v.box(-6, 2, -3, 6, 6, 3, C.WALL_W);
    for (const [px, pz] of [[-6, 3], [6, 3], [-6, -3], [6, -3], [0, 3]]) v.box(px, 2, pz, px, 6, pz, C.RED);
    for (let s = 0; s < 4; s++) v.box(-7 + s, 7 + s, -4 + s, 7 - s, 7 + s, 4 - s, C.ROOF_GREEN);
    g.set(-6, 6, 4, C.LANTERN).set(6, 6, 4, C.LANTERN);

    const grp = finalizeBuilding(v, g, solidMat, glowMat, 370, 2, -342, collider, snowMeshes, 6);
    const sign2 = createSignboard({ title: '藕神祠', subtitle: '李清照', width: 4.2, height: 1.8 });
    sign2.position.set(0, 6.6, 3.8);
    grp.add(sign2);
    pair.add(grp);
  }

  return pair;
}

// 5. 汇波楼（还原真实「汇波水门」拱券出水口 + 东西双侧石闸驳岸 + 东侧登城石阶！）
function buildHuibolou(solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), g = new Vox();
  // 青石城墙条石砌筑（自然水平石缝，去除刺眼棋盘格）
  v.box(-15, 0, -8, 15, 8, 8, (x, y, z) => (y % 2 === 0 && ((x + z) & 3) === 0) ? C.BRICK_D : C.STONE_D);
  // 中央半圆石砌券洞水门（按实拍 04_huibolou_beishuimen_tower）
  for (let x = -3; x <= 3; x++) {
    const ax = Math.abs(x);
    const archTop = ax === 3 ? 3 : (ax === 2 ? 5 : 6);
    for (let y = 0; y <= archTop; y++) {
      for (let z = -8; z <= 8; z++) v.del(x, y, z);
    }
    // 券洞外缘石拱券装饰
    v.set(x, archTop + 1, 8, C.STONE).set(x, archTop + 1, -8, C.STONE);
  }
  // 水门两侧青石闸墩与顶部铁栅闸门意象
  for (const sx of [-4, 4]) v.box(sx, -2, -9, sx, 4, 9, C.STONE_D);
  for (let x = -3; x <= 3; x += 2) v.set(x, 4, 0, C.BRONZE);
  v.box(-3, 5, 0, 3, 5, 0, C.BRONZE);
  // 东侧登城石阶（从地面直接爬到城墙顶！）
  for (let i = 0; i < 9; i++) {
    v.box(16 + i, 0, -2, 16 + i, 8 - i, 2, C.STONE);
  }
  for (let x = -15; x <= 15; x += 2) { v.set(x, 9, -8, C.BRICK).set(x, 9, 8, C.BRICK); }
  // 汇波楼按实拍 04_huibolou_beishuimen_tower：朱红回廊 + 翠绿琉璃瓦重檐歇山顶！
  v.box(-10, 9, -5, 10, 14, 5, C.RED);
  v.box(-12, 15, -7, 12, 15, 7, C.ROOF_GREEN);
  v.box(-8, 16, -4, 8, 20, 4, C.RED_D);
  for (let s = 0; s < 4; s++) v.box(-10 + s, 21 + s, -6 + s, 10 - s, 21 + s, 6 - s, C.ROOF_GREEN);
  v.box(-5, 25, 0, 5, 25, 0, C.GOLD);
  g.set(-11, 14, 6, C.LANTERN).set(11, 14, 6, C.LANTERN);

  // 注意：水门洞区域 (x=-3..3) 不填充底部垫石，保持水流直通护城河！
  const foot = [];
  v.each((vx, vy, vz) => { if (vy === 0 && Math.abs(vx) > 3) foot.push([vx, vz]); });
  for (const [fx, fz] of foot) v.set(fx, -1, fz, C.STONE_D).set(fx, -2, fz, C.STONE_D);
  const grp = new THREE.Group();
  grp.add(v.mesh(solidMat, 0.03), g.mesh(glowMat, 0.01));
  const snow = buildSnowCap(v, 9);
  grp.add(snow);
  snowMeshes.push(snow);
  grp.position.set(384, 2, -380);
  collider.registerVox(v, 384, 2, -380);

  const sign = createSignboard({ title: '汇波楼', width: 5.4, height: 2.0, bgColor: '#1b1a18' });
  sign.position.set(0, 14.5, 6.2);
  const waterGateSign = createSignboard({ title: '北水门', width: 4.2, height: 1.5, bgColor: '#4a4e54', textColor: '#e9e4d8', seal: '' });
  waterGateSign.position.set(0, 7.6, 8.6);
  grp.add(sign, waterGateSign);
  return grp;
}

// 6. 明昌钟亭（按真实 OSM 坐标 (355, -331) 归位东北岸南丰祠与藕神祠间，16×17m 真实尺度！南岸 (59, 206) 留明昌晨钟古碑记）
function buildMingchangBell(solidMat, glowMat, collider, snowMeshes) {
  const pair = new THREE.Group();
  {
    const v = new Vox(), g = new Vox();
    v.box(-7, 0, -7, 7, 1, 7, C.STONE);
    // 保留正南中开间畅通（不立正中遮挡柱），方便游客步入钟亭且「明昌钟亭」牌匾完全无遮挡！
    for (const [px, pz] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, -7], [-7, 0], [7, 0], [-3, 7], [3, 7]]) v.box(px, 2, pz, px, 8, pz, C.RED);
    // 金代明昌古铁钟
    v.box(-2, 3, -2, 2, 6, 2, C.BRONZE);
    v.box(-1, 7, -1, 1, 7, 1, C.GOLD);
    // 重檐攒尖顶
    for (let s = 0; s < 6; s++) v.box(-8 + s, 9 + s, -8 + s, 8 - s, 9 + s, 8 - s, s === 0 ? C.ROOF_GREEN : C.ROOF);
    v.box(0, 15, 0, 0, 16, 0, C.GOLD);
    g.set(-7, 8, 7, C.LANTERN).set(7, 8, 7, C.LANTERN);

    const grp = finalizeBuilding(v, g, solidMat, glowMat, 355, 2, -331, collider, snowMeshes, 8);
    const sign = createSignboard({ title: '明昌钟亭', subtitle: '金代古铁钟', width: 4.8, height: 1.8 });
    sign.position.set(0, 8.8, 8.2);
    grp.add(sign);
    pair.add(grp);
  }
  // 南岸 (59, 206) 保留「明昌晨钟」历史景石碑
  {
    const v = new Vox();
    v.box(-2, 0, -1, 2, 0, 1, C.STONE_D);
    v.box(-1, 1, 0, 1, 4, 0, C.STONE);
    v.box(-1, 5, 0, 1, 5, 0, C.ROOF);
    const st = finalizeBuilding(v, new Vox(), solidMat, glowMat, 59, 2, 206, collider, snowMeshes, 5);
    const sb = createSignboard({ title: '明昌晨钟', subtitle: '南岸古景碑', width: 3.6, height: 1.4, bgColor: '#2c2520' });
    sb.position.set(0, 3.3, 0.72);
    st.add(sb);
    pair.add(st);
  }
  return pair;
}

// 7. 遐园（“济南第一庭院”：按 OSM 126×123m 真实园区全尺度粉墙黛瓦围合 + 折线围合东西长廊 + 园内两层「奎虚书藏」+ 太湖石假山！）
function buildXiayuan(solidMat, glowMat, collider, snowMeshes) {
  const root = new THREE.Group();

  // 辅助函数：沿任意世界坐标折线连续搭建带朱红廊柱、美人靠、卷棚黛瓦长顶的围合游廊
  const buildPolylineCorridor = (pts, signCfg = null, openGapZ = null) => {
    const v = new Vox(), g = new Vox();
    const ox = Math.round(pts[0][0]), oz = Math.round(pts[0][1]);
    let stepAcc = 0;
    for (let s = 0; s < pts.length - 1; s++) {
      const [x0, z0] = pts[s], [x1, z1] = pts[s + 1];
      const len = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0)));
      const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
      const nx = -dz, nz = dx; // 垂直于廊道方向的法向量
      for (let i = 0; i <= len; i++) {
        const wAbsX = Math.round(x0 + dx * i);
        const wAbsZ = Math.round(z0 + dz * i);
        const wx = wAbsX - ox;
        const wz = wAbsZ - oz;
        const inGap = openGapZ && wAbsZ >= openGapZ[0] && wAbsZ <= openGapZ[1];
        // 宽 3m 青石廊道地面 + 5m 宽卷棚黛瓦顶
        for (let w = -1; w <= 1; w++) {
          const rx = Math.round(wx + nx * w), rz = Math.round(wz + nz * w);
          v.set(rx, 0, rz, C.STONE);
          v.set(rx, 6, rz, C.ROOF);
          v.set(rx, 7, rz, C.ROOF);
        }
        for (const w of [-2, 2]) {
          const rx = Math.round(wx + nx * w), rz = Math.round(wz + nz * w);
          v.set(rx, 6, rz, C.ROOF);
          if (!inGap) {
            if (stepAcc % 4 === 0) {
              v.box(rx, 1, rz, rx, 5, rz, C.RED); // 朱红廊柱
            } else {
              v.set(rx, 1, rz, C.WOOD); // 临池美人靠
            }
          }
        }
        v.set(wx, 8, wz, C.STONE_D); // 屋脊
        if (stepAcc % 9 === 0) g.set(wx, 5, wz, C.LANTERN);
        stepAcc++;
      }
    }
    const cg = finalizeBuilding(v, g, solidMat, glowMat, ox, 2, oz, collider, snowMeshes, 6);
    if (signCfg) {
      const sb = createSignboard({ title: signCfg.title, width: 3.6, height: 1.35 });
      sb.position.set(signCfg.x - ox, 5.7, signCfg.z - oz);
      sb.rotation.y = signCfg.rotY;
      cg.add(sb);
    }
    root.add(cg);
  };

  // 7A) 全尺度粉墙黛瓦园区大围墙（X=[-426,-310], Z=[149,258]：按实景开设东正门，东北角留开阔临湖敞口给浩然亭 (-318,146)，绝不遮挡浩然亭与环湖车道！）
  {
    const v = new Vox(), g = new Vox();
    const ox = -368, oz = 198;
    const x0 = -58, x1 = 58, z0 = -49, z1 = 60;
    // 北墙（正中留通湖口，东北角 x > 36 即世界 x > -332 留开阔临湖敞口衔接浩然亭）与南墙（留月洞门）
    for (let x = x0; x <= x1; x++) {
      if (Math.abs(x) > 3 && x <= 36) {
        v.box(x, 0, z0, x, 0, z0, C.STONE_D).box(x, 1, z0, x, 4, z0, C.WALL_W).set(x, 5, z0, C.ROOF);
      }
      if (Math.abs(x) > 3) {
        v.box(x, 0, z1, x, 0, z1, C.STONE_D).box(x, 1, z1, x, 4, z1, C.WALL_W).set(x, 5, z1, C.ROOF);
      }
    }
    // 西墙与东墙（东墙 z=-6 处即世界 z=192 开设宽敞「遐园」正东大门迎客；东北角 z < -36 留给浩然亭开阔湖景）
    for (let z = z0; z <= z1; z++) {
      const isWin = Math.abs(z) % 10 >= 4 && Math.abs(z) % 10 <= 6;
      const isEastGate = Math.abs(z + 6) <= 3;
      // 西墙
      v.set(x0, 0, z, C.STONE_D);
      for (let y = 1; y <= 4; y++) {
        if (isWin && y === 2 && (z & 1)) continue;
        v.set(x0, y, z, C.WALL_W);
      }
      v.set(x0, 5, z, C.ROOF);
      // 东墙（东正门与东北角浩然亭敞口留空）
      if (!isEastGate && z >= -36) {
        v.set(x1, 0, z, C.STONE_D);
        for (let y = 1; y <= 4; y++) {
          if (isWin && y === 2 && (z & 1)) continue;
          v.set(x1, y, z, C.WALL_W);
        }
        v.set(x1, 5, z, C.ROOF);
      }
    }
    // 东侧「遐园」正大门楼（面向正东迎南门游客，罗正钧手书「遐园」意象！）
    const egZ = -6;
    v.box(x1 - 1, 0, egZ - 5, x1 + 1, 6, egZ - 4, C.RED).box(x1 - 1, 0, egZ + 4, x1 + 1, 6, egZ + 5, C.RED);
    v.box(x1 - 2, 7, egZ - 7, x1 + 2, 7, egZ + 7, C.ROOF);
    v.box(x1 - 1, 8, egZ - 5, x1 + 1, 8, egZ + 5, C.ROOF);
    v.box(x1, 9, egZ - 3, x1, 9, egZ + 3, C.GOLD);
    g.set(x1 + 2, 5, egZ - 5, C.LANTERN).set(x1 + 2, 5, egZ + 5, C.LANTERN);

    const wallGrp = finalizeBuilding(v, g, solidMat, glowMat, ox, 2, oz, collider, snowMeshes, 5);
    const eastGateSign = createSignboard({ title: '遐园', subtitle: '济南第一庭院', width: 5.2, height: 2.0 });
    eastGateSign.position.set(x1 + 2.45, 6.2, egZ);
    eastGateSign.rotation.y = Math.PI / 2;
    wallGrp.add(eastGateSign);
    root.add(wallGrp);
  }

  // 7B) 遐园园内核心：太湖石假山叠翠 + 临池「遐园水榭」（江南园林框景）
  {
    const v = new Vox(), g = new Vox();
    // 西侧太湖石假山叠翠
    for (let x = -22; x <= -8; x++) {
      for (let z = -10; z <= 8; z++) {
        const h = Math.max(0, Math.round(8 - Math.hypot(x + 15, z + 1) * 0.72 + hash(x, z, 11) * 2.6));
        if (h > 0) v.box(x, 1, z, x, h, z, C.ROCK);
      }
    }
    // 东侧江南园林「遐园水榭」（约 18×12m 歇山敞轩）
    v.box(0, 0, -6, 18, 1, 6, C.STONE);
    for (const [px, pz] of [[1, -5], [9, -5], [17, -5], [1, 5], [9, 5], [17, 5]]) v.box(px, 2, pz, px, 6, pz, C.RED);
    v.box(2, 2, -5, 16, 2, -5, C.WOOD);
    for (let s = 0; s < 4; s++) v.box(-1 + s, 7 + s, -7 + s, 19 - s, 7 + s, 7 - s, s === 0 ? C.ROOF_GREEN : C.ROOF);
    v.box(5, 11, 0, 13, 11, 0, C.GOLD);
    g.set(1, 6, -6, C.LANTERN).set(17, 6, -6, C.LANTERN);
    for (const [bx, bz] of [[-24, -10], [-23, -10], [20, -8], [21, -8], [-24, 8], [20, 8]]) {
      v.box(bx, 1, bz, bx, 7, bz, C.BAMBOO);
    }

    const grp = finalizeBuilding(v, g, solidMat, glowMat, -366, 2, 182, collider, snowMeshes, 5);
    const xieSign = createSignboard({ title: '遐园水榭', width: 4.4, height: 1.6 });
    xieSign.position.set(9, 6.8, -6.4);
    xieSign.rotation.y = Math.PI;
    grp.add(xieSign);
    root.add(grp);
  }

  // 7B-2) 奎虚书藏（山东图书馆旧址）：按真实 OSM 坐标 (-454, 176) 与 29.7×47.1m 真实体量归位遐园西侧独立院落！
  {
    const v = new Vox(), g = new Vox();
    v.box(-14, 0, -21, 14, 1, 21, C.STONE);
    // 一层藏书大厅（民国传统大屋顶书楼）
    v.box(-12, 2, -18, 12, 7, 18, (x, y, z) => (Math.abs(x) === 12 || Math.abs(z) === 18) ? C.RED : C.WALL_W);
    v.box(-14, 8, -20, 14, 8, 20, C.ROOF);
    // 二层回廊与主体楼身
    v.box(-10, 9, -15, 10, 14, 15, (x, y, z) => (Math.abs(x) === 10 || Math.abs(z) === 15) ? C.RED_D : C.WALL_W);
    for (let s = 0; s < 5; s++) v.box(-12 + s, 15 + s, -17 + s, 12 - s, 15 + s, 17 - s, C.ROOF);
    v.box(0, 20, -10, 0, 20, 10, C.GOLD);
    g.set(13, 7, -8, C.LANTERN).set(13, 7, 8, C.LANTERN).set(-13, 7, -8, C.LANTERN).set(-13, 7, 8, C.LANTERN);

    const kGrp = finalizeBuilding(v, g, solidMat, glowMat, -454, 2, 176, collider, snowMeshes, 7);
    const kuixuSign = createSignboard({ title: '奎虚书藏', subtitle: '山东图书馆旧址', width: 6.2, height: 2.2 });
    kuixuSign.position.set(13.2, 8.2, 0);
    kuixuSign.rotation.y = Math.PI / 2;
    kGrp.add(kuixuSign);
    root.add(kGrp);
  }

  // 7C) 严格按 OSM 真实折线围合的「东长廊」（北端直连浩然亭 (-318,146)，东门 z=189..195 留无障碍穿行口）、「西长廊」与南侧联廊
  buildPolylineCorridor([
    [-318, 151], [-318, 173], [-316, 222], [-322, 224], [-323, 240], [-316, 252],
  ], { title: '东长廊', x: -319.3, z: 192, rotY: -Math.PI / 2 }, [189, 195]);
  buildPolylineCorridor([
    [-422, 168], [-420, 181], [-398, 181], [-398, 240], [-378, 240],
  ], { title: '西长廊', x: -395.7, z: 206, rotY: Math.PI / 2 });
  // 南侧联廊衔接东西长廊，形成完整合围游廊（中间避开苍碧亭与内池）
  buildPolylineCorridor([
    [-378, 248], [-324, 248],
  ], null);

  return root;
}

// 8. 东扩新区六大地标（超然楼以东一直到黑虎泉北路东门！）
function buildEastExpansion(solidMat, glowMat, collider, snowMeshes) {
  const all = new THREE.Group();

  // A) 鹊华烟雨石牌坊 (612, 2, 94)
  {
    const v = new Vox(), g = new Vox();
    for (const px of [-6, -2, 2, 6]) {
      v.box(px, 0, -1, px, 10, 1, C.MARBLE);
      v.set(px, 11, 0, C.STONE);
    }
    v.box(-7, 7, -1, 7, 8, 1, C.MARBLE);
    v.box(-4, 11, -2, 4, 11, 2, C.ROOF);
    v.box(-2, 12, -1, 2, 12, 1, C.GOLD);
    g.set(-6, 7, 2, C.LANTERN).set(6, 7, 2, C.LANTERN);
    const grp = finalizeBuilding(v, g, solidMat, glowMat, 612, 2, 94, collider, snowMeshes, 7);
    const signS = createSignboard({ title: '鹊华烟雨', width: 5.2, height: 2.0, bgColor: '#23303d' });
    signS.position.set(0, 9.8, 1.65);
    const signN = createSignboard({ title: '鹊华烟雨', width: 5.2, height: 2.0, bgColor: '#23303d' });
    signN.position.set(0, 9.8, -1.65);
    signN.rotation.y = Math.PI;
    grp.add(signS, signN);
    all.add(grp);
  }

  // B) 司家码头牌楼 (2, 2, 152)
  {
    const v = new Vox(), g = new Vox();
    for (const px of [-5, 5]) v.box(px, 0, -1, px, 8, 1, C.RED);
    v.box(-7, 8, -2, 7, 8, 2, C.ROOF);
    v.box(-5, 9, -1, 5, 9, 1, C.ROOF);
    v.box(-3, 10, 0, 3, 10, 0, C.GOLD);
    g.set(-5, 7, -2, C.LANTERN).set(5, 7, -2, C.LANTERN);
    const grp = finalizeBuilding(v, g, solidMat, glowMat, 2, 2, 152, collider, snowMeshes, 6);
    const sign = createSignboard({ title: '司家码头', width: 5.2, height: 2.0 });
    sign.position.set(0, 7.6, -1.6);
    sign.rotation.y = Math.PI;
    grp.add(sign);
    all.add(grp);
  }

  // C) 水云居滨水大庭院 (766, 2, -155，按 OSM 58×63m 格局扩容：主水榭 + 南北配轩)
  {
    const v = new Vox(), g = new Vox();
    addCourtyard(v, g, -20, -21, 20, 21, 'west');
    v.box(-13, 1, -10, 13, 1, 10, C.MARBLE);
    for (const [px, pz] of [[-11, -8], [11, -8], [-11, 8], [11, 8], [0, -8], [0, 8]]) v.box(px, 2, pz, px, 7, pz, C.RED);
    for (let s = 0; s < 5; s++) v.box(-14 + s, 8 + s, -11 + s, 14 - s, 8 + s, 11 - s, C.ROOF_GREEN);
    v.box(-5, 13, 0, 5, 13, 0, C.GOLD);
    // 南北两翼茶轩
    for (const sz of [-1, 1]) {
      const z0 = sz < 0 ? -19 : 13, z1 = sz < 0 ? -13 : 19;
      v.box(-10, 1, z0, 10, 1, z1, C.STONE);
      v.box(-8, 2, z0 + 1, 8, 6, z1 - 1, C.WALL_W);
      for (let s = 0; s < 3; s++) v.box(-10 + s, 7 + s, z0 + s, 10 - s, 7 + s, z1 - s, C.ROOF);
    }
    g.set(-12, 7, -8, C.LANTERN).set(12, 7, -8, C.LANTERN).set(-12, 7, 8, C.LANTERN).set(12, 7, 8, C.LANTERN);
    const grp = finalizeBuilding(v, g, solidMat, glowMat, 766, 2, -155, collider, snowMeshes, 6);
    const sign = createSignboard({ title: '水云居', width: 4.8, height: 1.9 });
    sign.position.set(-11.6, 7.2, 0);
    sign.rotation.y = -Math.PI / 2;
    grp.add(sign);
    all.add(grp);
  }

  // D) 老舍纪念馆（真实四合院围合庭院！） (235, 2, 142)
  {
    const v = new Vox(), g = new Vox();
    addCourtyard(v, g, -15, -12, 15, 11, 'north');
    v.box(-11, 0, -6, 11, 1, 7, C.STONE);
    v.box(-9, 2, -4, 9, 7, 5, (x, y, z) => (Math.abs(x) === 9 || z === -4) ? C.BRICK : C.WALL_W);
    for (let s = 0; s < 4; s++) v.box(-11 + s, 8 + s, -6 + s, 11 - s, 8 + s, 7 - s, C.ROOF);
    g.set(-8, 7, -5, C.LANTERN).set(8, 7, -5, C.LANTERN);
    const grp = finalizeBuilding(v, g, solidMat, glowMat, 235, 2, 142, collider, snowMeshes, 6);
    const sign = createSignboard({ title: '老舍纪念馆', width: 6.2, height: 2.1 });
    sign.position.set(0, 7.6, -4.8);
    sign.rotation.y = Math.PI;
    grp.add(sign);
    all.add(grp);
  }

  // E) 秋柳人家（江南诗意小院） (274, 2, 18)
  {
    const v = new Vox(), g = new Vox();
    addCourtyard(v, g, -12, -10, 12, 9, 'north');
    v.box(-8, 0, -6, 8, 1, 6, C.STONE);
    v.box(-6, 2, -4, 6, 7, 4, (x, y, z) => (Math.abs(x) === 6 || z === -4) ? C.WOOD : C.WALL_W);
    for (let s = 0; s < 4; s++) v.box(-8 + s, 8 + s, -6 + s, 8 - s, 8 + s, 6 - s, C.ROOF);
    g.set(-6, 7, -5, C.LANTERN).set(6, 7, -5, C.LANTERN);
    const grp = finalizeBuilding(v, g, solidMat, glowMat, 274, 2, 18, collider, snowMeshes, 6);
    const sign = createSignboard({ title: '秋柳人家', width: 5.0, height: 1.9 });
    sign.position.set(0, 7.4, -4.8);
    sign.rotation.y = Math.PI;
    grp.add(sign);
    all.add(grp);
  }

  // F) 鹊华居滨水园林院落 (680, 2, 92，按 OSM 59×43m 格局扩容：两层主楼 + 南北翼廊)
  {
    const v = new Vox(), g = new Vox();
    addCourtyard(v, g, -20, -17, 20, 17, 'west');
    v.box(-12, 1, -11, 12, 1, 11, C.STONE);
    v.box(-10, 2, -9, 10, 7, 9, (x, y, z) => (Math.abs(x) === 10 || Math.abs(z) === 9) ? C.RED : C.WALL_W);
    v.box(-12, 8, -11, 12, 8, 11, C.ROOF);
    v.box(-8, 9, -7, 8, 13, 7, C.WALL_W);
    for (let s = 0; s < 4; s++) v.box(-10 + s, 14 + s, -9 + s, 10 - s, 14 + s, 9 - s, C.ROOF);
    v.box(-4, 18, 0, 4, 18, 0, C.GOLD);
    g.set(-11, 7, -9, C.LANTERN).set(-11, 7, 9, C.LANTERN);
    const grp = finalizeBuilding(v, g, solidMat, glowMat, 680, 2, 92, collider, snowMeshes, 7);
    const sign = createSignboard({ title: '鹊华居', width: 4.8, height: 1.9 });
    sign.position.set(-10.8, 7.6, 0);
    sign.rotation.y = -Math.PI / 2;
    grp.add(sign);
    all.add(grp);
  }

  return all;
}

// 9. 天空盘旋小鸟群
function buildBirds(scene) {
  const bMat = charMaterial(0.2);
  const birdGeo = bird('fly').geometry(0.02);
  const birds = [];
  const birdConfigs = [
    { cx: 0, cz: 0, r: 95, y: 26, spd: 0.25, ph: 0 },
    { cx: 40, cz: -20, r: 120, y: 32, spd: 0.22, ph: 1.7 },
    { cx: 640, cz: 60, r: 75, y: 36, spd: 0.28, ph: 3.1 },
    { cx: 680, cz: 40, r: 60, y: 42, spd: -0.24, ph: 4.5 },
    { cx: -350, cz: -120, r: 110, y: 28, spd: 0.21, ph: 2.2 },
    { cx: 220, cz: 100, r: 130, y: 30, spd: -0.19, ph: 5.0 },
  ];
  for (const cfg of birdConfigs) {
    const m = new THREE.Mesh(birdGeo, bMat);
    m.scale.setScalar(0.14);
    scene.add(m);
    birds.push({ mesh: m, ...cfg });
  }
  return (t) => {
    for (const b of birds) {
      const a = t * b.spd + b.ph;
      const x = b.cx + Math.cos(a) * b.r;
      const z = b.cz + Math.sin(a) * b.r;
      const nx = b.cx + Math.cos(a + Math.sign(b.spd) * 0.05) * b.r;
      const nz = b.cz + Math.sin(a + Math.sign(b.spd) * 0.05) * b.r;
      b.mesh.position.set(x, b.y + Math.sin(t * 2.5 + b.ph) * 2.2, z);
      b.mesh.rotation.y = Math.atan2(nx - x, nz - z);
    }
  };
}

export function buildExtraLandmarks(scene, solidMat, collider, snowMeshes) {
  const glowMat = makeGlowMat();
  scene.add(
    buildBeijige(solidMat, glowMat, collider, snowMeshes),
    buildTiegongci(solidMat, glowMat, collider, snowMeshes),
    buildJiaxuan(solidMat, glowMat, collider, snowMeshes),
    buildNanfengci(solidMat, glowMat, collider, snowMeshes),
    buildHuibolou(solidMat, glowMat, collider, snowMeshes),
    buildMingchangBell(solidMat, glowMat, collider, snowMeshes),
    buildXiayuan(solidMat, glowMat, collider, snowMeshes),
    buildEastExpansion(solidMat, glowMat, collider, snowMeshes),
  );
  const updateBirds = buildBirds(scene);
  return {
    update(t, nightFactor) {
      glowMat.emissiveIntensity = 0.25 + nightFactor * 1.55;
      updateBirds(t);
    },
  };
}
