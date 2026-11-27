// 大明湖全域补完建筑群（100% 真实 OSM GPS 坐标）：
// 1. 西北角：大明湖游乐园（旋转发光体素大摩天轮！）+ 大明湖海底世界
// 2. 北岸：网红「湖畔雨荷」巨型古风花灯 + 明湖楼 + 明湖宝鼎
// 3. 南岸 & 东岸：明湖居（老残游记古戏楼）+ 枕湖楼 + 雨荷厅 + 平远楼 + 博艺堂 + 贺胜斋 + 烟雨堂
// 4. 西南角：奎虚书藏（山东图书馆旧址）+ 晏公庙
// 5. 环湖 & 湖心十大名亭（天心水面亭、环波亭、浩然亭、九曲亭、百花亭、月下亭、水香亭、一竿亭、玉涵亭、悠然亭）
import * as THREE from 'three';
import { Vox } from './voxel/vox.js';
import { buildSnowCap, createSignboard } from './collider.js';

const C = {
  STONE: 0xd8d2c5,
  STONE_D: 0xb5aea0,
  MARBLE: 0xedeae2,
  BRICK: 0x6e737b,
  RED: 0xa82a24,
  RED_D: 0x7e1d19,
  WOOD: 0x6e472b,
  ROOF: 0x3b444d,
  ROOF_GREEN: 0x2f6b55,
  GOLD: 0xf0c24b,
  WALL_W: 0xebe5d8,
  BLUE: 0x2574a9,
  BLUE_L: 0x4fc3f7,
  BRONZE: 0x4b5c49,
  PINK: 0xff8fab,
  PINK_L: 0xffc2d1,
  SKIN: 0xffdfc4,
  HAIR: 0x221d24,
  LOTUS_G: 0x389e48,
  LANTERN: 0xff5a2b,
  GLOW_WARM: 0xffc952,
};

function placeVox(v, g, solidMat, glowMat, x, y, z, collider, snowMeshes, minSnowY = 5, rotY = 0) {
  const foot = [];
  v.each((vx, vy, vz) => { if (vy === 0) foot.push([vx, vz]); });
  for (const [fx, fz] of foot) v.set(fx, -1, fz, C.STONE_D).set(fx, -2, fz, C.STONE_D);

  const grp = new THREE.Group();
  grp.add(v.mesh(solidMat, 0.03));
  if (g && g.m.size > 0) grp.add(g.mesh(glowMat, 0.01));
  const snow = buildSnowCap(v, minSnowY);
  grp.add(snow);
  snowMeshes.push(snow);
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;
  collider.registerVox(v, x, y, z, rotY);
  return grp;
}

// 1. 大明湖游乐园 · 旋转体素大摩天轮 (-757, 2, -241)
function buildFerrisWheel(solidMat, collider, snowMeshes) {
  const baseV = new Vox();
  // A 字形高大钢架底座（高 19 格）
  baseV.box(-10, 0, -4, 10, 1, 4, C.STONE);
  for (let i = 0; i <= 18; i++) {
    const spread = Math.round(9 - i * 0.45);
    baseV.box(-spread, i + 1, -2, -spread, i + 1, -2, C.MARBLE);
    baseV.box(spread, i + 1, -2, spread, i + 1, -2, C.MARBLE);
    baseV.box(-spread, i + 1, 2, -spread, i + 1, 2, C.MARBLE);
    baseV.box(spread, i + 1, 2, spread, i + 1, 2, C.MARBLE);
  }
  baseV.box(-1, 19, -3, 1, 20, 3, C.GOLD);

  const wheelGrp = new THREE.Group();
  const baseGrp = placeVox(baseV, null, solidMat, null, -757, 2, -241, collider, snowMeshes, 18);
  wheelGrp.add(baseGrp);

  // 动态旋转大轮盘（连续双环结构 + 12 根细钢索辐条 + 12 个全通透全景观景座舱！）
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(-757, 21.5, -241);
  const R = 14;

  const steelMat = new THREE.MeshStandardMaterial({ color: 0xedf2f7, roughness: 0.35, metalness: 0.45 });
  const wheelGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffb3d1,
    emissive: new THREE.Color(0xff75a0),
    emissiveIntensity: 0.5,
    roughness: 0.3,
  });

  // 双层连续大轮圈 + 中央发光霓虹灯环（彻底告别断开悬浮方块！）
  const rimF = new THREE.Mesh(new THREE.TorusGeometry(R, 0.28, 8, 48), steelMat);
  rimF.position.z = 1.25;
  const rimB = new THREE.Mesh(new THREE.TorusGeometry(R, 0.28, 8, 48), steelMat);
  rimB.position.z = -1.25;
  const rimNeon = new THREE.Mesh(new THREE.TorusGeometry(R - 0.55, 0.16, 8, 48), wheelGlowMat);
  wheelPivot.add(rimF, rimB, rimNeon);

  // 12 根连贯辐条
  const spokeGeo = new THREE.CylinderGeometry(0.11, 0.11, R * 2, 6);
  for (let k = 0; k < 6; k++) {
    const sp = new THREE.Mesh(spokeGeo, steelMat);
    sp.rotation.z = (k / 6) * Math.PI;
    wheelPivot.add(sp);
  }

  // 12 个四面通透全景观景吊篮（彩底 + 四角细柱 + 彩顶，团团坐进去清清楚楚看得见！）
  const cabinColors = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x8b5cf6, 0xff924c];
  const cabins = [];
  const floorGeo = new THREE.BoxGeometry(2.3, 0.26, 2.3);
  const roofGeo = new THREE.BoxGeometry(2.4, 0.22, 2.4);
  const railGeo = new THREE.BoxGeometry(2.2, 0.55, 0.12);
  const postGeo = new THREE.BoxGeometry(0.14, 2.2, 0.14);

  for (let k = 0; k < 12; k++) {
    const rad = (k / 12) * Math.PI * 2;
    const col = cabinColors[k % cabinColors.length];
    const cMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.18, roughness: 0.4 });
    const cg = new THREE.Group();
    const fl = new THREE.Mesh(floorGeo, cMat); fl.position.y = -1.05;
    const rf = new THREE.Mesh(roofGeo, cMat); rf.position.y = 1.15;
    const rF = new THREE.Mesh(railGeo, cMat); rF.position.set(0, -0.68, 1.08);
    const rB = new THREE.Mesh(railGeo, cMat); rB.position.set(0, -0.68, -1.08);
    cg.add(fl, rf, rF, rB);
    for (const [px, pz] of [[-1.05, -1.05], [1.05, -1.05], [-1.05, 1.05], [1.05, 1.05]]) {
      const p = new THREE.Mesh(postGeo, steelMat);
      p.position.set(px, 0.05, pz);
      cg.add(p);
    }
    cg.position.set(Math.cos(rad) * R, Math.sin(rad) * R, 0);
    wheelPivot.add(cg);
    cabins.push(cg);
  }
  wheelGrp.add(wheelPivot);

  const _tmpV = new THREE.Vector3();
  return {
    group: wheelGrp,
    basePos: new THREE.Vector3(-757, 3, -241),
    getNearestCabinIndex() {
      let best = 0, bestY = Infinity;
      for (let i = 0; i < cabins.length; i++) {
        cabins[i].getWorldPosition(_tmpV);
        if (_tmpV.y < bestY) { bestY = _tmpV.y; best = i; }
      }
      return best;
    },
    getCabinWorldPos(idx, outVec) {
      const c = cabins[idx % cabins.length];
      c.getWorldPosition(outVec);
      outVec.y -= 0.92; // 团团稳稳坐在全景吊篮底板上，四面通透可见！
      return outVec;
    },
    update(t, nightFactor) {
      const ang = t * 0.16;
      wheelPivot.rotation.z = ang;
      for (const c of cabins) c.rotation.z = -ang; // 始终保持吊篮水平竖直！
      wheelGlowMat.emissiveIntensity = 0.28 + nightFactor * 1.85;
    },
  };
}

// 2. 大明湖海底世界 (-675, 2, -285，按 OSM 37×34m 真实体量升级)
function buildOceanWorld(solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), g = new Vox();
  v.box(-17, 0, -14, 17, 1, 14, C.STONE);
  v.box(-15, 2, -12, 15, 8, 12, C.WALL_W);
  // 蓝色波浪形屋顶
  for (let x = -16; x <= 16; x++) {
    const wy = 9 + Math.round(Math.sin(x * 0.42) * 2);
    v.box(x, 8, -13, x, wy, 13, (x & 1) ? C.BLUE : C.BLUE_L);
  }
  g.box(-12, 4, 13, 12, 5, 13, C.BLUE_L);
  const grp = placeVox(v, g, solidMat, glowMat, -675, 2, -285, collider, snowMeshes, 8);
  const sign = createSignboard({ title: '海底世界', width: 6.2, height: 2.2, bgColor: '#0e3a5c', textColor: '#a8e6ff' });
  sign.position.set(0, 8.2, 13.2);
  grp.add(sign);
  return grp;
}

// 2B. 大明湖游乐园 · 旋转木马 (-778, 2, -280，丰富西北游乐园真实天际线)
function buildCarousel(solidMat, collider, snowMeshes) {
  const baseV = new Vox();
  for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
    if (Math.hypot(x, z) <= 8.2) baseV.box(x, 0, z, x, 1, z, ((x + z) & 1) ? C.MARBLE : C.STONE);
  }
  baseV.box(-1, 2, -1, 1, 8, 1, C.GOLD);
  const root = new THREE.Group();
  root.add(placeVox(baseV, null, solidMat, null, -778, 2, -280, collider, snowMeshes, 8));

  const spinGrp = new THREE.Group();
  spinGrp.position.set(-778, 4.0, -280);
  const canopyV = new Vox();
  const cGlow = new Vox();
  for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) {
    const r = Math.hypot(x, z);
    if (r <= 8.2) {
      const ang = Math.atan2(z, x);
      const stripe = Math.floor((ang + Math.PI) / (Math.PI / 6)) % 2 === 0;
      const cy = Math.round(7 + (1 - r / 8.5) * 4);
      canopyV.set(x, cy, z, stripe ? C.PINK : C.MARBLE);
      if (r >= 7.2) cGlow.set(x, 6, z, C.GLOW_WARM);
    }
  }
  canopyV.box(0, 11, 0, 0, 12, 0, C.GOLD);
  // 8 匹环绕彩色旋转木马
  const horseCols = [0xff595e, 0xffca3a, 0x8ac926, 0x4fc3f7, 0xff8fab, 0xc084fc, 0xff924c, 0xffffff];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const hx = Math.round(Math.cos(a) * 5.5);
    const hz = Math.round(Math.sin(a) * 5.5);
    const hy = (k % 2 === 0) ? 2 : 3;
    canopyV.box(hx, 0, hz, hx, 6, hz, C.GOLD);
    canopyV.box(hx - 1, hy, hz, hx + 1, hy + 1, hz, horseCols[k]);
  }
  const cGlowMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: new THREE.Color(0xffc952), emissiveIntensity: 0.45 });
  spinGrp.add(canopyV.mesh(solidMat, 0.02), cGlow.mesh(cGlowMat, 0.01));
  root.add(spinGrp);
  return {
    group: root,
    update(t, nightFactor) {
      spinGrp.rotation.y = t * 0.45;
      cGlowMat.emissiveIntensity = 0.25 + nightFactor * 1.65;
    },
  };
}

// 3. 北岸精雕「夏雨荷像 · 湖畔雨荷」主题网红打卡广场 (32, 2, -339)
function buildHupanYuhe(solidMat, collider, snowMeshes) {
  const v = new Vox(), g = new Vox();
  // 14×14 汉白玉雕栏荷花景观池与打卡台
  v.box(-8, 0, -8, 8, 1, 8, C.MARBLE);
  v.box(-7, 1, -7, 7, 1, 7, 0x2c8fb5); // 碧蓝景观水池
  for (let i = -8; i <= 8; i += 2) {
    v.set(i, 2, -8, C.MARBLE);
    if (Math.abs(i) > 2) v.set(i, 2, 8, C.MARBLE);
    v.set(-8, 2, i, C.MARBLE).set(8, 2, i, C.MARBLE);
  }
  // 池中发光粉荷与翠绿荷叶
  for (const [lx, lz] of [[-5, -5], [5, -5], [-5, 5], [5, 5], [-6, 0], [6, 0]]) {
    v.box(lx - 1, 2, lz, lx + 1, 2, lz, C.LOTUS_G);
    g.set(lx, 3, lz, C.PINK);
  }
  // 中心八角莲花高台
  v.box(-4, 1, -4, 4, 2, 4, C.MARBLE);
  // 粉白古装裙摆与飘逸水袖（y = 3..9）
  for (let y = 3; y <= 9; y++) {
    const r = Math.max(1.6, 4.4 - (y - 3) * 0.42);
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
      if (Math.hypot(x, z) <= r) {
        const col = ((x + y) & 1) ? C.PINK : C.PINK_L;
        v.set(x, y, z, col);
        if (Math.hypot(x, z) >= r - 1.1) g.set(x, y, z, col);
      }
    }
  }
  // 飘逸古风袖摆
  v.box(-4, 6, 0, -3, 8, 1, C.PINK_L).box(3, 6, 0, 4, 8, 1, C.PINK_L);
  // 温婉圆脸、眉眼腮红与步摇金簪高髻（y = 10..15）
  v.box(-2, 10, -2, 2, 13, 2, C.SKIN);
  g.box(-1, 11, 2, 1, 12, 2, C.SKIN);
  v.set(-1, 12, 2, C.HAIR).set(1, 12, 2, C.HAIR); // 眉眼
  v.set(-2, 11, 2, C.PINK).set(2, 11, 2, C.PINK); // 腮红
  v.box(-2, 13, -2, 2, 14, 1, C.HAIR);
  v.box(-3, 11, -2, -3, 13, 0, C.HAIR).box(3, 11, -2, 3, 13, 0, C.HAIR);
  v.box(-1, 15, -1, 1, 15, 1, C.HAIR);
  g.set(0, 16, 0, C.GOLD).set(-2, 14, 1, C.PINK).set(2, 14, 1, C.PINK);
  // 双手捧一朵发光粉色莲花灯
  g.box(-1, 7, 3, 1, 8, 4, C.PINK);

  const yuheGlowMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color(0xff99bb),
    emissiveIntensity: 0.45,
  });
  const grp = placeVox(v, g, solidMat, yuheGlowMat, 32, 2, -339, collider, snowMeshes, 14);
  const sign = createSignboard({ title: '湖畔雨荷', width: 4.6, height: 1.7, bgColor: '#4a192c' });
  sign.position.set(0, 2.8, 8.6);
  grp.add(sign);
  return { group: grp, glowMat: yuheGlowMat };
}

// 4. 明湖宝鼎 (-58, 6, -368) —— 矗立于北渚台三层汉白玉石坛中央！
function buildMinghuDing(solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), g = new Vox();
  v.box(-5, 0, -5, 5, 1, 5, C.MARBLE);
  // 青铜三足巨鼎
  for (const [px, pz] of [[-2, -2], [2, -2], [0, 2]]) v.box(px, 2, pz, px, 4, pz, C.BRONZE);
  v.box(-3, 4, -3, 3, 7, 3, C.BRONZE);
  v.box(-2, 8, -2, 2, 8, 2, C.GOLD);
  v.box(-4, 7, 0, -4, 9, 0, C.BRONZE).box(4, 7, 0, 4, 9, 0, C.BRONZE); // 双鼎耳
  g.set(0, 8, 0, C.GLOW_WARM);
  return placeVox(v, g, solidMat, glowMat, -58, 6, -368, collider, snowMeshes, 7);
}

// 5. 通用古风名楼工厂（支持按 OSM 真实轮廓长宽 rx/rz 比例 + 外廊柱/二层回廊栏杆/花窗差异化生成）
function buildClassicHall(name, x, z, rotY, twoStory, solidMat, glowMat, collider, snowMeshes, rxOverride, rzOverride) {
  const v = new Vox(), g = new Vox();
  const rx = rxOverride ?? (twoStory ? 10 : 8);
  const rz = rzOverride ?? (twoStory ? 6 : 5);
  v.box(-rx - 2, 0, -rz - 2, rx + 2, 1, rz + 2, C.STONE);
  // 退缩 2 格的实心墙身（外圈留出真实檐廊柱！）
  const wx = Math.max(3, rx - 2);
  const wz = Math.max(3, rz - 2);
  v.box(-wx, 2, -wz, wx, 7, wz, (bx, by, bz) => {
    const onWall = Math.abs(bx) === wx || Math.abs(bz) === wz;
    if (!onWall) return C.WALL_W;
    if (by >= 3 && by <= 5 && ((bx + bz) % 3 === 0)) return C.WOOD;
    return (Math.abs(bx) === wx && Math.abs(bz) === wz) ? C.RED : C.WALL_W;
  });
  // 外圈朱红廊柱
  for (let bx = -rx; bx <= rx; bx += 4) {
    v.box(bx, 2, -rz, bx, 7, -rz, C.RED).box(bx, 2, rz, bx, 7, rz, C.RED);
  }
  for (let bz = -rz; bz <= rz; bz += 4) {
    v.box(-rx, 2, bz, -rx, 7, bz, C.RED).box(rx, 2, bz, rx, 7, bz, C.RED);
  }
  v.box(-rx - 2, 8, -rz - 2, rx + 2, 8, rz + 2, C.ROOF);
  g.set(-rx - 1, 7, rz + 1, C.LANTERN).set(rx + 1, 7, rz + 1, C.LANTERN);
  if (rx >= 14) g.set(-5, 7, rz + 1, C.LANTERN).set(5, 7, rz + 1, C.LANTERN);

  let signY = 7.4;
  if (twoStory) {
    const ux = Math.max(3, rx - 3);
    const uz = Math.max(3, rz - 2);
    // 二层外廊木护栏
    for (let bx = -rx; bx <= rx; bx += 2) v.set(bx, 9, -rz, C.RED_D).set(bx, 9, rz, C.RED_D);
    for (let bz = -rz; bz <= rz; bz += 2) v.set(-rx, 9, bz, C.RED_D).set(rx, 9, bz, C.RED_D);
    v.box(-ux, 9, -uz, ux, 13, uz, (bx, by, bz) => (Math.abs(bx) === ux || Math.abs(bz) === uz) ? C.RED_D : C.WALL_W);
    const steps = Math.min(5, Math.max(3, Math.min(ux, uz)));
    for (let s = 0; s < steps; s++) v.box(-ux - 1 + s, 14 + s, -uz - 1 + s, ux + 1 - s, 14 + s, uz + 1 - s, C.ROOF);
    const ridgeX = Math.max(1, ux - steps);
    v.box(-ridgeX, 14 + steps, 0, ridgeX, 14 + steps, 0, C.GOLD);
    signY = 7.4;
  } else {
    const steps = Math.min(4, Math.max(2, Math.min(rx, rz)));
    for (let s = 0; s < steps; s++) v.box(-rx - 1 + s, 9 + s, -rz - 1 + s, rx + 1 - s, 9 + s, rz + 1 - s, C.ROOF);
    const ridgeX = Math.max(1, rx - steps);
    v.box(-ridgeX, 9 + steps, 0, ridgeX, 9 + steps, 0, C.GOLD);
  }

  const grp = placeVox(v, g, solidMat, glowMat, x, 2, z, collider, snowMeshes, 8, rotY);
  const sign = createSignboard({ title: name, width: 4.8, height: 1.9 });
  sign.position.set(0, signY, rz + 1.35);
  grp.add(sign);
  return grp;
}

// 6. 环湖 & 湖心名亭工厂（4 种差异化古亭形制：八角重檐 / 临水歇山亭榭 / 六角曲亭 / 精巧四角攒尖亭）
function buildScenicPavilion(name, x, z, style, solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), g = new Vox();
  let signY = 6.8, signZ = 4.4;

  if (style === 'octagon') {
    // 八角重檐亭（天心水面亭、环波亭）
    const inOct = (px, pz, R) => Math.max(Math.abs(px), Math.abs(pz)) <= R && (Math.abs(px) + Math.abs(pz)) <= Math.round(R * 1.414);
    for (let px = -5; px <= 5; px++) for (let pz = -5; pz <= 5; pz++) {
      if (inOct(px, pz, 5)) v.box(px, 0, pz, px, 1, pz, C.MARBLE);
    }
    for (const [px, pz] of [[4, 1], [1, 4], [-1, 4], [-4, 1], [-4, -1], [-1, -4], [1, -4], [4, -1]]) {
      v.box(px, 2, pz, px, 6, pz, C.RED);
    }
    v.box(-1, 2, -1, 1, 2, 1, C.STONE);
    v.set(0, 2, 3, C.MARBLE).set(0, 2, -3, C.MARBLE).set(3, 2, 0, C.MARBLE).set(-3, 2, 0, C.MARBLE);
    for (let s = 0; s < 5; s++) {
      const R = 5 - s;
      for (let px = -R; px <= R; px++) for (let pz = -R; pz <= R; pz++) {
        if (inOct(px, pz, R)) v.set(px, 7 + s, pz, s === 0 ? C.ROOF_GREEN : C.ROOF);
      }
    }
    v.box(0, 12, 0, 0, 13, 0, C.GOLD);
    g.set(-4, 6, 4, C.LANTERN).set(4, 6, 4, C.LANTERN);
    signY = 7.0; signZ = 4.6;
  } else if (style === 'water_xie') {
    // 临水歇山亭榭（带美人靠低栏：水香亭、浩然亭、一竿亭、沧浪亭）
    v.box(-5, 0, -4, 5, 1, 4, C.STONE);
    for (const [px, pz] of [[-4, -3], [4, -3], [-4, 3], [4, 3], [0, -3], [0, 3]]) v.box(px, 2, pz, px, 6, pz, C.RED);
    // 美人靠木栏杆（正前留出入口）
    for (let px = -4; px <= 4; px++) {
      v.set(px, 2, -3, C.WOOD);
      if (Math.abs(px) >= 2) v.set(px, 2, 3, C.WOOD);
    }
    for (let pz = -3; pz <= 3; pz++) v.set(-4, 2, pz, C.WOOD).set(4, 2, pz, C.WOOD);
    v.box(-1, 2, -1, 1, 2, 1, C.MARBLE);
    for (let s = 0; s < 4; s++) v.box(-6 + s, 7 + s, -5 + s, 6 - s, 7 + s, 5 - s, s === 0 ? C.ROOF_GREEN : C.ROOF);
    v.box(-3, 11, 0, 3, 11, 0, C.GOLD);
    g.set(-5, 6, 4, C.LANTERN).set(5, 6, 4, C.LANTERN);
    signY = 6.8; signZ = 3.8;
  } else if (style === 'hex_curve') {
    // 六角亲水亭（九曲亭、月下亭）
    for (let px = -4; px <= 4; px++) for (let pz = -4; pz <= 4; pz++) {
      if (Math.abs(px) * 0.85 + Math.abs(pz) <= 5.2) v.box(px, 0, pz, px, 1, pz, C.MARBLE);
    }
    for (const [px, pz] of [[4, 0], [-4, 0], [2, 3], [-2, 3], [2, -3], [-2, -3]]) v.box(px, 2, pz, px, 6, pz, C.RED);
    v.set(0, 2, 0, C.STONE).set(0, 2, 2, C.MARBLE).set(0, 2, -2, C.MARBLE);
    for (let s = 0; s < 5; s++) {
      const r = 5 - s;
      for (let px = -r; px <= r; px++) for (let pz = -r; pz <= r; pz++) {
        if (Math.abs(px) * 0.85 + Math.abs(pz) <= r * 1.25) v.set(px, 7 + s, pz, s === 0 ? C.ROOF_GREEN : C.ROOF);
      }
    }
    v.set(0, 12, 0, C.GOLD).set(0, 13, 0, C.GOLD);
    g.set(-3, 6, 3, C.LANTERN).set(3, 6, 3, C.LANTERN);
    signY = 6.8; signZ = 4.2;
  } else {
    // 精巧四角攒尖亭（真实尺度 7×7m：百花亭、玉涵亭、悠然亭）
    v.box(-4, 0, -4, 4, 1, 4, C.MARBLE);
    for (const [px, pz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) v.box(px, 2, pz, px, 6, pz, C.RED);
    v.box(-1, 2, -1, 1, 2, 1, C.STONE);
    v.set(0, 2, 2, C.MARBLE).set(0, 2, -2, C.MARBLE).set(2, 2, 0, C.MARBLE).set(-2, 2, 0, C.MARBLE);
    for (let s = 0; s < 5; s++) {
      const r = 5 - s;
      v.box(-r, 7 + s, -r, r, 7 + s, r, s === 0 ? C.ROOF_GREEN : C.ROOF);
    }
    v.set(-5, 8, -5, C.GOLD).set(5, 8, -5, C.GOLD).set(-5, 8, 5, C.GOLD).set(5, 8, 5, C.GOLD);
    v.box(0, 12, 0, 0, 13, 0, C.GOLD);
    g.set(-4, 6, 4, C.LANTERN).set(4, 6, 4, C.LANTERN);
    signY = 6.8; signZ = 4.2;
  }

  const grp = placeVox(v, g, solidMat, glowMat, x, 2, z, collider, snowMeshes, 7);
  collider.addSeat({
    id: `seat_pav_${name}`,
    type: 'stool',
    label: `🍵 按 E 键在「${name}」亭内石凳坐下赏景`,
    x,
    y: 4.85,
    z: z + 2.2,
    yaw: 0,
    interactRadius: 5.5,
  });
  const sign = createSignboard({ title: name, width: 3.6, height: 1.4 });
  sign.position.set(0, signY, signZ);
  grp.add(sign);
  return grp;
}

// 7. OSM 真实景名与湖心岛石碑标识（补齐曾堤、秋柳园、明瑟园、明湖新景与三大湖心岛标识）
function buildOsmScenicSteles(solidMat, collider, snowMeshes) {
  const grp = new THREE.Group();
  const steles = [
    ['曾堤',     395, -338, '北岸长堤'],
    ['曾堤萦水', 421, -236, '明湖新景'],
    ['秋柳园',   148,   25, '渔洋诗园'],
    ['秋柳含烟', 183,   28, '明湖新景'],
    ['明瑟园',    95, -380, '北岸名园'],
    ['竹港清风', 575, -283, '明湖新景'],
    ['鸟啼绿荫', 737, -153, '明湖新景'],
    ['稼轩悠韵',-517,  179, '明湖新景'],
    ['超然致远', 541,  -78, '明湖新景'],
    ['汇泉岛',   236, -115, '湖心古岛'],
    ['翠柳屏岛',-391,   69, '湖心古岛'],
    ['生态岛',   373, -275, '湖心古岛'],
    ['北洋洲',  -177, -230, '湖心古岛'],
    ['小离岛',  -132,  160, '湖心古岛'],
  ];
  for (const [title, x, z, subtitle] of steles) {
    const v = new Vox();
    v.box(-1, 0, -1, 1, 0, 1, C.STONE_D);
    v.box(-1, 1, 0, 1, 4, 0, C.STONE);
    v.box(-1, 5, 0, 1, 5, 0, C.ROOF);
    const sg = placeVox(v, null, solidMat, null, x, 2, z, collider, snowMeshes, 5);
    const board = createSignboard({ title, subtitle, width: 3.4, height: 1.4, bgColor: '#2c2520' });
    board.position.set(0, 3.3, 0.72);
    sg.add(board);
    grp.add(sg);
  }
  return grp;
}

// 8. 钟楼台基遗址 (165, 212) 与 花笑廊 (398, -10) —— OSM 真实坐标特色遗址与花架长廊
function buildOsmSpecialSites(solidMat, glowMat, collider, snowMeshes) {
  const grp = new THREE.Group();

  // 8A) 钟楼台基遗址（OSM 23×23m 夯土青砖古台基 + 汉白玉保护围栏 + 遗址石碑）
  {
    const v = new Vox();
    v.box(-11, 0, -11, 11, 2, 11, (x, y, z) => ((x + y + z) & 1) ? C.BRICK : C.STONE_D);
    v.box(-9, 3, -9, 9, 4, 9, (x, y, z) => ((x + z) & 1) ? C.STONE : C.STONE_D);
    for (let i = -11; i <= 11; i += 2) {
      v.set(i, 3, -11, C.MARBLE).set(i, 3, 11, C.MARBLE);
      v.set(-11, 3, i, C.MARBLE).set(11, 3, i, C.MARBLE);
    }
    // 台基中央古碑
    v.box(-1, 5, -1, 1, 8, 0, C.STONE);
    const bg = placeVox(v, null, solidMat, null, 165, 2, 212, collider, snowMeshes, 4);
    const sign = createSignboard({ title: '钟楼台基遗址', width: 5.0, height: 1.8, bgColor: '#302b26' });
    sign.position.set(0, 6.8, -1.2);
    sign.rotation.y = Math.PI;
    bg.add(sign);
    grp.add(bg);
  }

  // 8B) 花笑廊（OSM (398, -10) 临水花架长廊，紫藤翠叶与暖灯笼）
  {
    const v = new Vox(), g = new Vox();
    v.box(-14, 0, -3, 14, 0, 3, C.STONE);
    for (let x = -14; x <= 14; x += 4) {
      v.box(x, 1, -3, x, 5, -3, C.RED).box(x, 1, 3, x, 5, 3, C.RED);
      v.box(x, 6, -4, x, 6, 4, C.WOOD);
      if (x % 8 === 0) g.set(x, 5, 0, C.LANTERN);
    }
    for (let x = -15; x <= 15; x++) {
      v.set(x, 6, -3, C.WOOD).set(x, 6, 0, C.WOOD).set(x, 6, 3, C.WOOD);
      // 廊顶翠叶与粉花点缀
      if ((x & 1) === 0) {
        v.set(x, 7, -2, C.LOTUS_G).set(x, 7, 2, C.LOTUS_G);
        if (x % 4 === 0) v.set(x, 7, 0, C.PINK);
      }
    }
    const fg = placeVox(v, g, solidMat, glowMat, 398, 2, -10, collider, snowMeshes, 6);
    const sign = createSignboard({ title: '花笑廊', width: 3.8, height: 1.5 });
    sign.position.set(0, 6.2, 3.8);
    fg.add(sign);
    grp.add(fg);
  }

  // 8C) 济南天然奇石馆（OSM (43, -376) 大型中式展馆，位于明湖秀观演台正后方，填补原 >42m 阈值遗漏！）
  {
    const v = new Vox(), g = new Vox();
    // 72×34m 气派阶梯石台基 + 中央主展厅 + 东西双展翼
    v.box(-35, 0, -16, 35, 1, 16, C.STONE);
    // 中央两层主馆
    v.box(-14, 2, -13, 14, 9, 13, (x, y, z) => (Math.abs(x) === 14 || Math.abs(z) === 13) ? C.BRICK : C.WALL_W);
    v.box(-16, 10, -15, 16, 10, 15, C.ROOF);
    v.box(-10, 11, -9, 10, 15, 9, C.WALL_W);
    for (let s = 0; s < 4; s++) v.box(-12 + s, 16 + s, -11 + s, 12 - s, 16 + s, 11 - s, C.ROOF);
    v.box(-6, 20, 0, 6, 20, 0, C.GOLD);
    // 东西两翼展厅（退进形成前庭院）
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -33 : 15, x1 = sx < 0 ? -15 : 33;
      v.box(x0, 2, -12, x1, 7, 10, (x, y, z) => (x === x0 || x === x1 || Math.abs(z) === 10 || z === -12) ? C.BRICK : C.WALL_W);
      for (let s = 0; s < 3; s++) v.box(x0 - 1 + s, 8 + s, -13 + s, x1 + 1 - s, 8 + s, 11 - s, C.ROOF);
      g.set(sx * 24, 7, 11, C.LANTERN);
    }
    // 馆前太湖奇石景观石雕
    v.box(-22, 2, 13, -20, 5, 14, C.STONE_D).box(20, 2, 13, 22, 5, 14, C.STONE_D);
    g.set(-14, 8, 14, C.LANTERN).set(14, 8, 14, C.LANTERN);

    const qg = placeVox(v, g, solidMat, glowMat, 43, 2, -376, collider, snowMeshes, 8);
    const qSign = createSignboard({ title: '济南天然奇石馆', width: 7.4, height: 2.3, bgColor: '#1f2937' });
    qSign.position.set(0, 9.2, 14.2);
    qg.add(qSign);
    grp.add(qg);
  }

  // 8D) 秋柳诗社（OSM (145, 23) 渔洋诗园主体临水诗社建筑群，补齐 53×38m 遗漏大建筑！）
  {
    const v = new Vox(), g = new Vox();
    v.box(-17, 0, -12, 17, 1, 12, C.STONE);
    // 临水主诗厅
    v.box(-12, 2, -8, 12, 7, 6, (x, y, z) => (Math.abs(x) === 12 || Math.abs(z) === 6 || z === -8) ? C.RED : C.WALL_W);
    for (let s = 0; s < 4; s++) v.box(-14 + s, 8 + s, -10 + s, 14 - s, 8 + s, 8 - s, s === 0 ? C.ROOF_GREEN : C.ROOF);
    v.box(-6, 12, -1, 6, 12, -1, C.GOLD);
    // 两侧临水游廊挑台
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -16 : 13, x1 = sx < 0 ? -13 : 16;
      for (const pz of [-6, 0, 6]) v.box(x0, 2, pz, x0, 6, pz, C.RED).box(x1, 2, pz, x1, 6, pz, C.RED);
      v.box(x0 - 1, 7, -7, x1 + 1, 7, 7, C.ROOF);
    }
    g.set(-11, 7, -9, C.LANTERN).set(11, 7, -9, C.LANTERN);

    const qsg = placeVox(v, g, solidMat, glowMat, 145, 2, 23, collider, snowMeshes, 7);
    const qsSign = createSignboard({ title: '秋柳诗社', subtitle: '王士禛渔洋诗韵', width: 5.4, height: 2.0 });
    qsSign.position.set(0, 7.6, -8.8);
    qsSign.rotation.y = Math.PI;
    qsg.add(qsSign);
    grp.add(qsg);
  }

  // 8E) 水街（OSM (337, 111) 七桥风月滨水古风商街群，3 栋错落临水灰瓦骑楼！）
  {
    const v = new Vox(), g = new Vox();
    const shops = [[-14, -4, 7, 6], [0, 2, 7, 7], [14, -3, 7, 6]];
    for (const [sx, sz, rx, rz] of shops) {
      v.box(sx - rx - 1, 0, sz - rz - 1, sx + rx + 1, 1, sz + rz + 1, C.STONE);
      v.box(sx - rx, 2, sz - rz, sx + rx, 7, sz + rz, (x, y, z) => (Math.abs(x - sx) === rx || Math.abs(z - sz) === rz) ? C.BRICK : C.WALL_W);
      for (let s = 0; s < 4; s++) v.box(sx - rx - 1 + s, 8 + s, sz - rz - 1 + s, sx + rx + 1 - s, 8 + s, sz + rz + 1 - s, C.ROOF);
      g.set(sx - rx + 1, 6, sz - rz - 1, C.LANTERN).set(sx + rx - 1, 6, sz - rz - 1, C.LANTERN);
    }
    const sjg = placeVox(v, g, solidMat, glowMat, 337, 2, 111, collider, snowMeshes, 7);
    const sjSign = createSignboard({ title: '明湖水街', width: 4.8, height: 1.8, bgColor: '#3a1410' });
    sjSign.position.set(0, 7.6, -5.8);
    sjSign.rotation.y = Math.PI;
    sjg.add(sjSign);
    grp.add(sjg);
  }

  // 8F) 佛山倒影观景台（铁公祠前临水 (-520, -262)，明湖八景之一）
  {
    const v = new Vox(), g = new Vox();
    v.box(-7, 0, -4, 7, 0, 4, (x, y, z) => ((x + z) & 1) ? C.STONE : C.STONE_D);
    for (let x = -7; x <= 7; x += 2) v.set(x, 1, 4, C.MARBLE);
    v.box(4, 1, -3, 6, 4, -3, C.STONE);
    g.set(-7, 2, 4, C.LANTERN).set(7, 2, 4, C.LANTERN);
    const fg = placeVox(v, g, solidMat, glowMat, -520, 2, -262, collider, snowMeshes, 4);
    const fSign = createSignboard({ title: '佛山倒影', subtitle: '明湖八景 · 最佳观景点', width: 4.4, height: 1.6, bgColor: '#1f2937' });
    fSign.position.set(5, 3.4, -2.2);
    fg.add(fSign);
    grp.add(fg);
  }

  // 8G) 天香园（西北岸 (-571, -345)，牡丹与花架园林骨架）
  {
    const v = new Vox(), g = new Vox();
    v.box(-10, 0, -8, 10, 0, 8, (x, y, z) => (Math.abs(x) <= 2 || Math.abs(z) <= 2) ? C.STONE : C.STONE_D);
    for (const [fx, fz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) {
      v.box(fx - 2, 1, fz - 2, fx + 2, 1, fz + 2, C.MARBLE);
      v.box(fx - 1, 2, fz - 1, fx + 1, 2, fz + 1, (x, y, z) => ((x + z) & 1) ? C.PINK : C.LOTUS_G);
    }
    for (const px of [-4, 4]) {
      v.box(px, 1, -7, px, 5, -7, C.RED);
      v.box(px, 1, 7, px, 5, 7, C.RED);
    }
    v.box(-5, 6, -8, 5, 6, -6, C.WOOD).box(-5, 6, 6, 5, 6, 8, C.WOOD);
    g.set(0, 5, -7, C.LANTERN).set(0, 5, 7, C.LANTERN);
    const tg = placeVox(v, g, solidMat, glowMat, -571, 2, -345, collider, snowMeshes, 5);
    const tSign = createSignboard({ title: '天香园', subtitle: '西北牡丹名园', width: 4.0, height: 1.5, bgColor: '#3a1410' });
    tSign.position.set(0, 5.4, 7.6);
    tg.add(tSign);
    grp.add(tg);
  }

  // 8H) 北水门已与 buildHuibolou(384, -380) 合并为一体城楼券洞，此处不再重复建模避免挡路

  // 8I) 明瑟园（北岸 (91, -380)，粉墙假山小亭园林骨架）
  {
    const v = new Vox(), g = new Vox();
    v.box(-10, 0, -8, 10, 0, 8, C.STONE);
    // 园墙与南向月洞门入口
    v.box(-10, 1, -8, 10, 4, -8, C.WALL_W);
    v.box(-10, 1, -8, -10, 4, 8, C.WALL_W);
    v.box(10, 1, -8, 10, 4, 8, C.WALL_W);
    v.box(-10, 1, 8, -3, 4, 8, C.WALL_W);
    v.box(3, 1, 8, 10, 4, 8, C.WALL_W);
    v.box(-10, 5, -8, 10, 5, -8, C.ROOF);
    // 院内太湖石假山与四角小亭
    v.box(-7, 1, -5, -4, 4, -2, C.STONE_D).box(-6, 5, -4, -5, 6, -3, C.STONE);
    for (const [px, pz] of [[2, -4], [7, -4], [2, 1], [7, 1]]) v.box(px, 1, pz, px, 5, pz, C.RED);
    v.box(1, 6, -5, 8, 6, 2, C.ROOF).box(3, 7, -3, 6, 7, 0, C.ROOF);
    g.set(4, 5, -1, C.LANTERN);
    const mg = placeVox(v, g, solidMat, glowMat, 91, 2, -380, collider, snowMeshes, 5);
    const mSign = createSignboard({ title: '明瑟园', width: 3.6, height: 1.4, bgColor: '#162d54' });
    mSign.position.set(0, 4.6, 8.6);
    mg.add(mSign);
    grp.add(mg);
  }

  // 8J) 自然广场（北岸 (225, -354)，石砌圆心广场与坐凳）
  {
    const v = new Vox(), g = new Vox();
    v.box(-9, 0, -7, 9, 0, 7, (x, y, z) => ((x + z) & 1) ? C.STONE : C.MARBLE);
    for (const [sx, sz] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) {
      v.box(sx - 1, 1, sz, sx + 1, 1, sz, C.WOOD);
      v.box(sx, 1, sz + (sz < 0 ? -1 : 1), sx, 4, sz + (sz < 0 ? -1 : 1), C.STONE_D);
      g.set(sx, 5, sz + (sz < 0 ? -1 : 1), C.LANTERN);
    }
    const zg = placeVox(v, g, solidMat, glowMat, 225, 2, -354, collider, snowMeshes, 4);
    grp.add(zg);
  }

  return grp;
}

export function buildFullLakeBuildings(scene, solidMat, collider, snowMeshes) {
  const glowMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color(0xff9933),
    emissiveIntensity: 0.3,
  });

  // 1. 西北角欢乐天际线（旋转大摩天轮 + 旋转木马 + 海底世界）
  const ferris = buildFerrisWheel(solidMat, collider, snowMeshes);
  scene.add(ferris.group);
  const carousel = buildCarousel(solidMat, collider, snowMeshes);
  scene.add(carousel.group);
  scene.add(buildOceanWorld(solidMat, glowMat, collider, snowMeshes));

  // 2. 北岸网红「湖畔雨荷」+ 明湖宝鼎
  const yuhe = buildHupanYuhe(solidMat, collider, snowMeshes);
  scene.add(yuhe.group);
  scene.add(buildMinghuDing(solidMat, glowMat, collider, snowMeshes));

  // 3. 全园名楼与文化古建（按真实 OSM 坐标、1:1 逼近轮廓比例与朝向）
  const halls = [
    ['明湖居',   152,  155, Math.PI,      true,  18, 16],
    ['枕湖楼',  -105,  228, Math.PI,      true,  22, 17],
    ['明湖楼',  -116, -355, 0,            true,  24, 14],
    ['平远楼',   480, -323, 0,            true,  28, 17],
    ['雨荷厅',   336, -292, 0,            false,  6,  5],
    ['博艺堂',   541, -112, -Math.PI / 2, false, 11, 11],
    ['贺胜斋',   539,  -31, 0,            false, 11,  6],
    ['烟雨堂',   560,  107, Math.PI,      false, 16, 16],
    ['晏公庙',  -572,  197, Math.PI,      false, 10,  5],
    ['柳茗居',   306,   23, Math.PI,      true,  18, 14],
    ['朗园',     458,   94, -Math.PI / 2, false,  9, 11],
    ['司家院',    88,  198, Math.PI,      false, 12, 13],
    ['二郎庙',   327,   76, 0,            false,  5,  5],
    ['江西会馆',  73,  285, Math.PI,      false, 10,  8],
    ['思敏楼',    88,  216, Math.PI,      true,  11,  8],
    ['玉斌府',   535,  110, Math.PI,      false, 10,  9],
  ];
  for (const [name, x, z, rotY, two, rx, rz] of halls) {
    scene.add(buildClassicHall(name, x, z, rotY, two, solidMat, glowMat, collider, snowMeshes, rx, rz));
  }

  // 4. 湖心 & 环湖 15 座名亭（按真实形制差异化构建 + 补齐 OSM 沧浪亭、苍碧亭、灰山亭、闹春亭、问山亭）
  const pavilions = [
    ['天心水面亭',  117,  -15, 'octagon'],
    ['环波亭',     -240,  -60, 'octagon'],
    ['浩然亭',     -318,  146, 'water_xie'],
    ['九曲亭',     -522,   52, 'hex_curve'],
    ['百花亭',      399,  144, 'square'],
    ['月下亭',      130, -337, 'hex_curve'],
    ['水香亭',      311,  -38, 'water_xie'],
    ['一竿亭',      516, -203, 'water_xie'],
    ['玉涵亭',     -619,  142, 'square'],
    ['悠然亭',      364,  147, 'square'],
    ['沧浪亭',     -502, -277, 'water_xie'],
    ['苍碧亭',     -344,  232, 'hex_curve'],
    ['灰山亭',      428,  137, 'square'],
    ['闹春亭',     -637,  171, 'square'],
    ['问山亭',      -59,  344, 'water_xie'],
  ];
  for (const [name, x, z, style] of pavilions) {
    scene.add(buildScenicPavilion(name, x, z, style, solidMat, glowMat, collider, snowMeshes));
  }

  // 5. OSM 真实景名与湖心岛标识碑 + 钟楼台基遗址与花笑廊
  scene.add(buildOsmScenicSteles(solidMat, collider, snowMeshes));
  scene.add(buildOsmSpecialSites(solidMat, glowMat, collider, snowMeshes));

  return {
    ferris,
    update(t, nightFactor) {
      ferris.update(t, nightFactor);
      carousel.update(t, nightFactor);
      glowMat.emissiveIntensity = 0.25 + nightFactor * 1.6;
      yuhe.glowMat.emissiveIntensity = 0.35 + nightFactor * 1.75;
    },
  };
}
