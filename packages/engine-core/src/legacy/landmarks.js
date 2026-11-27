// 大明湖核心体素地标建筑库（4.0 精修版）：
// 1. 超然楼 2.0：东西双面宏伟汉白玉御道石阶 + 实心雕花楼体 + 7层宽敞室外环绕观景走廊 + 斗拱吻兽
// 2. 历下亭 2.0：舒展八角重檐翘角 + 金葫芦宝顶 + 亭内石桌茶具 + 杜甫名联
// 3. 大明湖正南门七楼大牌坊（面向正南迎客！正反双面蓝底金字「大明湖」+ 迎客亭房 + 石狮花坛）
// 4. 北门 / 东门 / 老东门 + 真实 OSM 跨水桥梁 + 巡航画舫
import * as THREE from 'three';
import { Vox } from './voxel/vox.js';
import {
  BRIDGES, CRUISE_MAIN_PATH, CRUISE_EAST_PATH, buildCatmullSpline, getWaterSignedDist, getWaterPushDir,
} from './map_data.js';
import { buildSnowCap, createSignboard } from './collider.js';
import { buildGates } from './gates.js';

const C = {
  STONE: 0xd8d2c5,
  STONE_D: 0xb5aea0,
  MARBLE: 0xedeae2,
  DANBI: 0xe6d5a8, // 御道中轴丹陛石雕
  BRICK: 0x6e737b,
  BRICK_D: 0x545961,
  RED: 0xa82a24,
  RED_D: 0x7e1d19,
  WOOD: 0x6e472b,
  WOOD_L: 0x91623d,
  WOOD_D: 0x4a2f1c,
  ROOF: 0x3b444d,
  ROOF_COPPER: 0x6b563c,
  ROOF_GOLD: 0xd9a738,
  GOLD: 0xf0c24b,
  WIN_DARK: 0x26201c,
  GLOW_WARM: 0xffc952,
  GLOW_GOLD: 0xffaa2b,
  LANTERN: 0xff4b2b,
  FLOWER: 0xff7aa2,
  LEAF: 0x3f8f3a,
};

// ====== 1. 超然楼 2.0（精修外立面 + 东西双面御道阶梯 + 7 层室外可玩观景走廊）======
function buildChaoranPavilion(solidMat, collider, snowMeshes) {
  const v = new Vox();
  const glow = new Vox();

  // 1) 双层汉白玉须弥座台基（按 OSM 真实 43.8m 东西 × 31.6m 南北比例：y = 0..7）
  v.box(-22, 0, -16, 22, 3, 16, (x, y, z) => ((x + z) & 1) ? C.STONE : C.STONE_D);
  v.box(-19, 4, -14, 19, 7, 14, C.MARBLE);
  // 下层与上层台基汉白玉望柱栏杆（东西阶梯口留空畅通）
  for (let x = -22; x <= 22; x += 2) {
    v.set(x, 4, -16, C.MARBLE).set(x, 4, 16, C.MARBLE);
    if (Math.abs(x) <= 19) v.set(x, 8, -14, C.MARBLE).set(x, 8, 14, C.MARBLE);
  }
  for (let z = -16; z <= 16; z += 2) {
    if (Math.abs(z) > 6) {
      v.set(-22, 4, z, C.MARBLE).set(22, 4, z, C.MARBLE);
    }
    if (Math.abs(z) <= 14 && Math.abs(z) > 5) {
      v.set(-19, 8, z, C.MARBLE).set(19, 8, z, C.MARBLE);
    }
  }

  // 东西双面宏伟汉白玉御道大石阶（西面朝大明湖，东面朝鹊华路与小东湖，带中轴丹陛石雕与扶手！）
  for (let i = 0; i < 8; i++) {
    const wx = -29 + i; // 西侧阶梯
    const ex = 29 - i;  // 东侧阶梯
    for (const sx of [wx, ex]) {
      v.box(sx, 0, -5, sx, i, 5, (x, y, z) => (y === i && Math.abs(z) <= 1) ? C.DANBI : C.MARBLE);
      v.set(sx, i + 1, -5, C.MARBLE).set(sx, i + 1, 5, C.MARBLE); // 阶梯汉白玉扶手
    }
  }

  // 2) 七层精修楼身（东西长、南北窄，贴合 OSM 真实长轴比例）：实心雕花核心 + 室外环绕观景走廊 + 斗拱飞檐
  const floors = [
    { y0: 8,  h: 6, rx: 16, rz: 12, eave: 4 },
    { y0: 14, h: 6, rx: 14, rz: 10, eave: 4 },
    { y0: 20, h: 5, rx: 13, rz: 9,  eave: 3 },
    { y0: 25, h: 5, rx: 11, rz: 8,  eave: 3 },
    { y0: 30, h: 5, rx: 10, rz: 7,  eave: 3 },
    { y0: 35, h: 5, rx: 9,  rz: 6,  eave: 3 },
    { y0: 40, h: 5, rx: 8,  rz: 6,  eave: 3 },
  ];

  for (let fi = 0; fi < floors.length; fi++) {
    const f = floors[fi];
    const yTop = f.y0 + f.h - 1;
    const crx = f.rx - 3; // 核心墙体向内缩 3 格 -> 留出宽 2.5~3 格的超大室外环绕观景走廊！
    const crz = f.rz - 3;

    // 整层观景走廊木地板
    v.box(-f.rx, f.y0, -f.rz, f.rx, f.y0, f.rz, (x, y, z) => ((x + z) & 1) ? C.WOOD : C.WOOD_L);

    // 实心雕花楼体核心（外立面带朱红立柱、深木雕花格栅窗棂、金饰门楣）
    v.box(-crx, f.y0 + 1, -crz, crx, yTop, crz, (x, y, z) => {
      const onWall = Math.abs(x) === crx || Math.abs(z) === crz;
      if (!onWall) return C.WOOD_D;
      if (y === yTop) return C.GOLD; // 额枋彩绘金边
      if (y > f.y0 + 1 && y < yTop && (((x + z) % 2) === 0)) return C.WIN_DARK;
      return C.RED;
    });

    // 外圈朱红廊柱 + 镂空安全护栏 + 层间斗拱（团团可在每层走廊 360° 自由漫步看风景！）
    for (let x = -f.rx; x <= f.rx; x++) {
      if ((x & 1) === 0 || Math.abs(x) === f.rx) {
        v.set(x, f.y0 + 1, -f.rz, C.RED_D);
        v.set(x, f.y0 + 1, f.rz, C.RED_D);
      }
      if (Math.abs(x) % 3 === 0 || Math.abs(x) === f.rx) {
        v.box(x, f.y0 + 1, -f.rz, x, yTop, -f.rz, C.RED);
        v.box(x, f.y0 + 1, f.rz, x, yTop, f.rz, C.RED);
        // 斗拱托檐
        v.set(x, yTop, -f.rz - 1, C.GOLD).set(x, yTop, f.rz + 1, C.GOLD);
      }
    }
    for (let z = -f.rz; z <= f.rz; z++) {
      // 1 层东西双面石阶入口不放护栏，畅通无阻走上走廊
      const isGate = fi === 0 && Math.abs(z) <= 5;
      if (!isGate && ((z & 1) === 0 || Math.abs(z) === f.rz)) {
        v.set(-f.rx, f.y0 + 1, z, C.RED_D);
        v.set(f.rx, f.y0 + 1, z, C.RED_D);
      }
      if (Math.abs(z) % 3 === 0 || Math.abs(z) === f.rz) {
        if (!(fi === 0 && Math.abs(z) <= 3)) {
          v.box(-f.rx, f.y0 + 1, z, -f.rx, yTop, z, C.RED);
          v.box(f.rx, f.y0 + 1, z, f.rx, yTop, z, C.RED);
          v.set(-f.rx - 1, yTop, z, C.GOLD).set(f.rx + 1, yTop, z, C.GOLD);
        }
      }
    }

    // 窗户暖光灯带 + 四角宫灯
    for (let x = -crx + 1; x <= crx - 1; x += 2) {
      glow.box(x, f.y0 + 2, -crz, x, yTop - 1, -crz, C.GLOW_WARM);
      glow.box(x, f.y0 + 2, crz, x, yTop - 1, crz, C.GLOW_WARM);
    }
    for (let z = -crz + 1; z <= crz - 1; z += 2) {
      glow.box(-crx, f.y0 + 2, z, -crx, yTop - 1, z, C.GLOW_WARM);
      glow.box(crx, f.y0 + 2, z, crx, yTop - 1, z, C.GLOW_WARM);
    }
    if (fi % 2 === 0) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        glow.set(sx * (f.rx + 1), yTop - 1, sz * (f.rz + 1), C.LANTERN);
      }
    }

    // 舒展重檐歇山飞檐屋顶（四角双重上翘 + 金色垂脊）
    const erx = f.rx + f.eave;
    const erz = f.rz + f.eave;
    for (let step = 0; step < 2; step++) {
      const rx = erx - step * 2;
      const rz = erz - step * 2;
      const ry = yTop + step;
      for (let x = -rx; x <= rx; x++) {
        for (let z = -rz; z <= rz; z++) {
          if (Math.abs(x) < rx - 2 && Math.abs(z) < rz - 2 && step === 0) continue;
          const isCorner = Math.abs(x) >= rx - 1 && Math.abs(z) >= rz - 1;
          const isTip = Math.abs(x) === rx && Math.abs(z) === rz;
          const dy = isTip ? 2 : (isCorner ? 1 : 0);
          v.set(x, ry + dy, z, isCorner ? C.ROOF_GOLD : C.ROOF_COPPER);
          if (step === 0 && (Math.abs(x) === rx || Math.abs(z) === rz)) {
            glow.set(x, ry + dy - 1, z, C.GLOW_GOLD);
            if (isTip) glow.set(x, ry + dy + 1, z, C.GLOW_WARM);
          }
        }
      }
    }
  }

  // 3) 顶层东西向大歇山屋顶 + 金色吻兽正脊 + 宝顶（团团可飞落站稳！）
  for (let step = 0; step < 6; step++) {
    const rx = 10 - step;
    const rz = 8 - step;
    if (rx < 2 || rz < 1) break;
    v.box(-rx, 46 + step, -rz, rx, 46 + step, rz, step === 5 ? C.ROOF_GOLD : C.ROOF_COPPER);
    glow.set(-rx, 46 + step, -rz, C.GLOW_GOLD).set(rx, 46 + step, -rz, C.GLOW_GOLD);
    glow.set(-rx, 46 + step, rz, C.GLOW_GOLD).set(rx, 46 + step, rz, C.GLOW_GOLD);
  }
  v.box(-5, 51, -1, 5, 51, 1, C.GOLD);
  v.set(-5, 52, 0, C.GOLD).set(5, 52, 0, C.GOLD); // 正脊东西两端金色鸱吻吻兽
  v.box(-1, 52, 0, 1, 54, 0, C.GOLD);
  glow.box(-4, 52, 0, 4, 53, 0, C.GLOW_WARM);
  glow.set(0, 55, 0, C.GLOW_WARM);

  // 东西双面二层正檐下实木牌匾托枋（让「超然楼」巨匾严丝合缝贴附在楼体正立面，绝不悬空、不被檐口遮挡！）
  v.box(-18, 17, -4, -17, 19, 4, C.RED_D);
  v.box(17, 17, -4, 18, 19, 4, C.RED_D);

  const group = new THREE.Group();
  group.add(v.mesh(solidMat, 0.025));

  const glowMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.4,
    metalness: 0.1,
    emissive: new THREE.Color(0xffb433),
    emissiveIntensity: 0.05,
  });
  const glowMesh = glow.mesh(glowMat, 0.01);
  glowMesh.castShadow = false;
  group.add(glowMesh);

  // 东西双面御赐蓝底鎏金书法巨匾「超然楼」（紧贴二层正檐托枋，昼夜清晰醒目！）
  const signW = createSignboard({ title: '超然楼', width: 9.2, height: 3.1, bgColor: '#14264a', seal: '' });
  signW.material.emissiveIntensity = 0.42;
  signW.position.set(-18.16, 18.5, 0.5);
  signW.rotation.y = -Math.PI / 2;
  const signE = createSignboard({ title: '超然楼', width: 9.2, height: 3.1, bgColor: '#14264a', seal: '' });
  signE.material.emissiveIntensity = 0.42;
  signE.position.set(19.16, 18.5, 0.5);
  signE.rotation.y = Math.PI / 2;
  group.add(signW, signE);

  const snowMesh = buildSnowCap(v, 4);
  group.add(snowMesh);
  snowMeshes.push(snowMesh);

  const light = new THREE.PointLight(0xffb84d, 0, 140, 1.4);
  light.position.set(-22, 24, 0);
  group.add(light);

  group.position.set(503, 3, -70);
  collider.registerVox(v, 503, 3, -70);
  return { group, glowMat, light };
}

// ====== 2. 历下亭 3.0（正八角重檐翘角真实尺度 + 金葫芦宝顶 + 亭内石桌茶具 + 杜甫名联）======
function buildLixiaPavilion(solidMat, collider, snowMeshes) {
  const v = new Vox();
  const glow = new Vox();
  const inOct = (x, z, R) => Math.max(Math.abs(x), Math.abs(z)) <= R && (Math.abs(x) + Math.abs(z)) <= Math.round(R * 1.414);

  // 正八角汉白玉须弥座台基（真实比例约 17m 径）
  for (let x = -8; x <= 8; x++) {
    for (let z = -8; z <= 8; z++) {
      if (inOct(x, z, 8)) v.box(x, 0, z, x, 1, z, C.MARBLE);
    }
  }
  // 四向亲水阶梯
  v.box(-2, 0, -9, 2, 0, -9, C.STONE);
  v.box(-2, 0, 9, 2, 0, 9, C.STONE);
  v.box(-9, 0, -2, -9, 0, 2, C.STONE);
  v.box(9, 0, -2, 9, 0, 2, C.STONE);

  // 正八角八根朱红亭柱 + 雀替彩绘
  const pillars = [[5, 2], [2, 5], [-2, 5], [-5, 2], [-5, -2], [-2, -5], [2, -5], [5, -2]];
  for (const [px, pz] of pillars) {
    v.box(px, 2, pz, px, 7, pz, C.RED);
    v.set(px, 6, pz + Math.sign(pz), C.GOLD);
  }
  // 亭中石桌、茶壶与四方石凳
  v.box(-1, 2, -1, 1, 3, 1, C.MARBLE);
  v.set(0, 4, 0, C.ROOF_COPPER);
  v.set(3, 2, 0, C.STONE).set(-3, 2, 0, C.STONE).set(0, 2, 3, C.STONE).set(0, 2, -3, C.STONE);

  // 下层正八角重檐（八角飞檐翘角）
  for (let step = 0; step < 3; step++) {
    const R = 8 - step;
    const M = Math.round(R * 1.414);
    for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
      if (Math.abs(x) + Math.abs(z) <= M) {
        const isTip = step === 0 && (Math.abs(x) + Math.abs(z) === M) && (Math.abs(x) === R || Math.abs(z) === R);
        v.set(x, 7 + step + (isTip ? 1 : 0), z, isTip ? C.ROOF_GOLD : C.ROOF);
      }
    }
  }
  for (const [px, pz] of pillars) {
    glow.set(Math.sign(px) * (Math.abs(px) + 1), 6, Math.sign(pz) * (Math.abs(pz) + 1), C.LANTERN);
  }

  // 上层正八角亭身 + 攒尖金葫芦宝顶（总高约 17m，比例挺拔自然）
  for (let step = 0; step < 6; step++) {
    const R = 5 - step;
    if (R < 0) break;
    const M = Math.round(R * 1.414);
    for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
      if (Math.abs(x) + Math.abs(z) <= M) v.set(x, 10 + step, z, step < 2 ? C.RED_D : C.ROOF);
    }
  }
  v.box(0, 16, 0, 0, 18, 0, C.GOLD);
  glow.set(0, 18, 0, C.GLOW_WARM);

  // 御碑亭（北侧）
  v.box(-4, 0, -21, 4, 1, -13, C.STONE);
  for (const [px, pz] of [[-3, -20], [3, -20], [-3, -14], [3, -14]]) v.box(px, 2, pz, px, 6, pz, C.RED);
  v.box(-1, 2, -17, 1, 5, -17, C.STONE_D);
  v.box(-5, 7, -22, 5, 7, -12, C.ROOF);
  v.box(-3, 8, -20, 3, 8, -14, C.ROOF);
  v.box(-1, 9, -18, 1, 9, -16, C.GOLD);

  // 名士轩院落（历下亭东侧配殿，青石台基 + 朱红门窗 + 歇山灰瓦顶 + 暖光宫灯！）
  v.box(12, 0, -7, 21, 1, 7, C.STONE);
  v.box(13, 2, -6, 20, 6, 6, (x, y, z) => (x === 13 || x === 20 || Math.abs(z) === 6) ? C.RED : C.MARBLE);
  for (let s = 0; s < 4; s++) v.box(11 + s, 7 + s, -8 + s, 22 - s, 7 + s, 8 - s, C.ROOF);
  v.box(15, 11, -3, 18, 11, 3, C.GOLD);
  glow.set(12, 6, -5, C.LANTERN).set(12, 6, 5, C.LANTERN);

  const group = new THREE.Group();
  group.add(v.mesh(solidMat, 0.03));

  const glowMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color(0xff9933),
    emissiveIntensity: 0.4,
  });
  group.add(glow.mesh(glowMat, 0.01));

  // 高清「历下亭」牌匾、杜甫名联与东侧「名士轩」牌匾
  const sign = createSignboard({ title: '历下亭', width: 4.8, height: 1.9 });
  sign.position.set(0.5, 7.2, 6.18);
  const coupletL = createSignboard({ title: '海右此亭古', width: 0.95, height: 4.2, vertical: true });
  coupletL.position.set(-1.6, 4.6, 6.16);
  const coupletR = createSignboard({ title: '济南名士多', width: 0.95, height: 4.2, vertical: true });
  coupletR.position.set(2.6, 4.6, 6.16);
  const mingshiSign = createSignboard({ title: '名士轩', width: 4.0, height: 1.6 });
  mingshiSign.position.set(12.2, 6.6, 0);
  mingshiSign.rotation.y = -Math.PI / 2;
  group.add(sign, coupletL, coupletR, mingshiSign);

  const snowMesh = buildSnowCap(v, 5);
  group.add(snowMesh);
  snowMeshes.push(snowMesh);

  group.position.set(0, 3, 0);
  collider.registerVox(v, 0, 3, 0);
  collider.addSeat({
    id: 'seat_lixia_pavilion',
    type: 'stool',
    label: '🍵 按 E 键在「历下亭」古石凳坐下品茗观湖',
    x: 0,
    y: 5.05,
    z: 3.0,
    yaw: 0,
    interactRadius: 5.8,
  });
  return { group, glowMat };
}

// ====== 3. 全部入口大门楼（已迁至数据驱动模块 js/gates.js，单点真值源）======
function buildAllGates(solidMat, collider, snowMeshes) {
  return buildGates(solidMat, collider, snowMeshes);
}

// ====== 4. 全部真实 OSM 园内桥梁（按 6 种大明湖真实桥型差异化建模：多孔石拱桥 / 平直石板桥 / 朱红木曲桥 / 遐园廊桥 / 双桥 / 单孔石拱桥）======
function buildBridges(solidMat, collider, snowMeshes) {
  const group = new THREE.Group();
  for (const b of BRIDGES) {
    const dx = b.x2 - b.x1, dz = b.z2 - b.z1;
    const len = Math.ceil(Math.hypot(dx, dz));
    const angle = Math.atan2(dz, dx);
    const v = new Vox();
    const style = b.style || 'arch';
    // 保证每座跨水桥至少 5m 宽（halfW >= 2），护栏外移至 ±halfW，留出至少 3m 净宽供行人顺畅通行！
    const halfW = Math.max(2, Math.floor(b.width / 2));
    const railOnly = new Vox();

    // 多孔石桥孔数（鹊华桥真实五孔，其他长桥 3 孔，中桥 2 孔）
    const numArches = style === 'multi_arch' ? (b.name === '鹊华桥' ? 5 : (len >= 34 ? 3 : 2)) : 1;

    for (let i = 0; i <= len; i++) {
      const t = i / (len || 1);
      const y = Math.round(2 + Math.sin(t * Math.PI) * b.arch);

      if (style === 'corridor') {
        // 遐园东/西长廊跨水廊桥（朱红廊柱 + 灰瓦廊顶 + 美人靠矮栏）
        v.box(i, y, -halfW, i, y, halfW, (x) => (x & 1) ? C.STONE : C.STONE_D);
        v.box(i, y - 1, -halfW, i, y - 1, halfW, C.STONE_D);
        v.set(i, y + 1, -halfW, C.RED_D).set(i, y + 1, halfW, C.RED_D);
        railOnly.set(i, y + 1, -halfW, 1).set(i, y + 1, halfW, 1);
        if (i % 4 === 0 || i === len) {
          v.box(i, y + 1, -halfW, i, y + 4, -halfW, C.RED);
          v.box(i, y + 1, halfW, i, y + 4, halfW, C.RED);
        }
        // 灰瓦双坡廊顶
        v.box(i, y + 5, -halfW - 1, i, y + 5, halfW + 1, C.ROOF);
        v.box(i, y + 6, -halfW + 1, i, y + 6, halfW - 1, C.ROOF);
      } else if (style === 'twin_arch') {
        // 西区双桥（紧凑型青石单孔拱桥 + 汉白玉望柱栏板）
        v.box(i, y, -halfW, i, y, halfW, (x) => (x & 1) ? C.STONE : C.STONE_D);
        v.box(i, y - 1, -halfW, i, y - 1, halfW, C.STONE_D);
        v.set(i, y + 1, -halfW, C.MARBLE).set(i, y + 1, halfW, C.MARBLE);
        railOnly.set(i, y + 1, -halfW, 1).set(i, y + 1, halfW, 1);
        if (i % 3 === 0) {
          v.set(i, y + 2, -halfW, C.MARBLE).set(i, y + 2, halfW, C.MARBLE);
          railOnly.set(i, y + 2, -halfW, 1).set(i, y + 2, halfW, 1);
        }
      } else if (style === 'zigzag_wood') {
        // 朱红原木护栏亲水曲桥（九曲亭连桥）
        v.box(i, y, -halfW, i, y, halfW, (x) => (x & 1) ? C.WOOD : C.WOOD_L);
        v.box(i, y - 1, -halfW, i, y - 1, halfW, C.WOOD_D);
        v.set(i, y + 1, -halfW, C.RED).set(i, y + 1, halfW, C.RED);
        railOnly.set(i, y + 1, -halfW, 1).set(i, y + 1, halfW, 1);
        if (i % 4 === 0) {
          v.set(i, y + 2, -halfW, C.GOLD).set(i, y + 2, halfW, C.GOLD);
          railOnly.set(i, y + 2, -halfW, 1).set(i, y + 2, halfW, 1);
          if (i > 1 && i < len - 1) {
            v.box(i, -2, -halfW, i, y - 2, -halfW, C.WOOD_D);
            v.box(i, -2, halfW, i, y - 2, halfW, C.WOOD_D);
          }
        }
      } else if (style === 'flat_slab') {
        // 低矮平直青石板桥（北石板桥、曾堤、湖居桥、鹊华路、汇波水门桥）
        v.box(i, y, -halfW, i, y, halfW, (x) => (x & 1) ? C.STONE : C.STONE_D);
        v.box(i, y - 1, -halfW, i, y - 1, halfW, C.STONE_D);
        // 低矮青石路缘石（每 5 格立一矮石墩）
        if (i % 5 === 0) {
          v.set(i, y + 1, -halfW, C.STONE).set(i, y + 1, halfW, C.STONE);
          railOnly.set(i, y + 1, -halfW, 1).set(i, y + 1, halfW, 1);
        }
        if (i > 3 && i < len - 3 && i % 10 === 0) {
          v.box(i - 1, -3, -halfW, i + 1, y - 2, halfW, C.STONE_D);
          railOnly.box(i - 1, -1, -halfW, i + 1, y - 1, halfW, 1);
        }
      } else if (style === 'multi_arch') {
        // 宏伟多孔石拱桥（鹊华五孔桥、南丰桥、齐鲁桥、百花桥、玉带桥、芙蓉桥）
        v.box(i, y, -halfW, i, y, halfW, (x) => (x & 1) ? C.STONE : C.STONE_D);
        // 计算多孔连续拱券下缘，形成真实多孔石拱剪影！
        const archPhase = (t * numArches) % 1;
        const archCut = Math.round(Math.sin(archPhase * Math.PI) * Math.min(3.0, Math.max(1.5, y - 0.5)));
        const soffitY = Math.max(0, y - 1 - Math.max(0, 2 - archCut));
        v.box(i, soffitY, -halfW, i, y - 1, halfW, C.STONE_D);
        // 汉白玉雕花栏板与望柱石狮意象
        v.set(i, y + 1, -halfW, C.MARBLE).set(i, y + 1, halfW, C.MARBLE);
        railOnly.set(i, y + 1, -halfW, 1).set(i, y + 1, halfW, 1);
        if (i % 4 === 0) {
          v.set(i, y + 2, -halfW, C.MARBLE).set(i, y + 2, halfW, C.MARBLE);
          if (i % 8 === 0) v.set(i, y + 3, -halfW, C.GOLD).set(i, y + 3, halfW, C.GOLD);
          railOnly.set(i, y + 2, -halfW, 1).set(i, y + 2, halfW, 1);
        }
        // 在每两孔交界处立宽厚青石桥墩直抵水底
        const pierDist = Math.abs(archPhase - Math.round(archPhase));
        if (i > 2 && i < len - 2 && pierDist < (0.85 * numArches / Math.max(1, len))) {
          v.box(i, -3, -halfW, i, y - 2, halfW, C.STONE_D);
          railOnly.box(i, -1, -halfW, i, y - 1, halfW, 1);
        }
      } else {
        // 经典园内单孔石拱桥
        v.box(i, y, -halfW, i, y, halfW, (x) => (x & 1) ? C.STONE : C.STONE_D);
        v.box(i, y - 1, -halfW, i, y - 1, halfW, C.STONE_D);
        v.set(i, y + 1, -halfW, C.MARBLE).set(i, y + 1, halfW, C.MARBLE);
        railOnly.set(i, y + 1, -halfW, 1).set(i, y + 1, halfW, 1);
        if (i % 6 === 0) {
          v.set(i, y + 2, -halfW, C.MARBLE).set(i, y + 2, halfW, C.MARBLE);
          railOnly.set(i, y + 2, -halfW, 1).set(i, y + 2, halfW, 1);
        }
        if (i > 4 && i < len - 4 && i % 16 === 0) {
          v.box(i - 1, -3, -halfW, i + 1, y - 2, halfW, C.STONE_D);
          railOnly.box(i - 1, -1, -halfW, i + 1, y - 1, halfW, 1);
        }
      }
    }
    const bg = new THREE.Group();
    bg.add(v.mesh(solidMat, 0.025));
    const snow = buildSnowCap(v, 2);
    bg.add(snow);
    snowMeshes.push(snow);
    bg.position.set(b.x1, 0, b.z1);
    bg.rotation.y = -angle;
    if (collider) collider.registerVox(railOnly, b.x1, 0, b.z1, -angle);
    group.add(bg);
  }
  return group;
}

// ====== 5. 精雕 3D 双层古风「明湖画舫 / 鹊华画舫」大游船（可登船乘坐环游大明湖，100% 纯开阔深水航线！）======
function buildCruiseBoat(solidMat, boatTitle = '明湖画舫', scale = 0.85) {
  const v = new Vox(), glow = new Vox();
  // 1) 宽阔船体（长 24 格 x∈[-11,12]，宽 9 格 z∈[-4,4]）
  v.box(-10, 0, -4, 10, 1, 4, C.WOOD_D);
  v.box(-11, 1, -3, 11, 2, 3, C.WOOD);
  // 尖翘船头 + 金色昂扬龙头雕饰
  v.box(11, 1, -2, 12, 2, 2, C.WOOD);
  v.box(12, 2, -1, 13, 3, 1, C.RED);
  v.box(13, 3, 0, 14, 5, 0, C.GOLD); // 金龙头
  v.set(14, 5, -1, C.GOLD).set(14, 5, 1, C.GOLD);
  // 船尾翘尾 + 船舵
  v.box(-12, 1, -2, -11, 2, 2, C.WOOD_D);
  v.box(-12, 3, -1, -12, 4, 1, C.RED);

  // 2) 一层甲板木地板 + 四周朱红雕花护栏 + 舱内木座椅
  v.box(-10, 2, -4, 10, 2, 4, C.WOOD_L);
  for (let x = -10; x <= 10; x++) {
    if ((x & 1) === 0) v.set(x, 3, -4, C.RED).set(x, 3, 4, C.RED);
  }
  for (const x of [-6, -2, 2, 6]) {
    v.box(x, 3, -3, x, 6, -3, C.RED);
    v.box(x, 3, 3, x, 6, 3, C.RED);
    v.set(x, 6, -4, C.GOLD).set(x, 6, 4, C.GOLD); // 斗拱
    // 两侧挂暖红宫灯
    glow.set(x, 5, -4, C.LANTERN).set(x, 5, 4, C.LANTERN);
  }
  // 一层船舱内木长凳
  v.box(-5, 3, -2, 5, 3, -2, C.WOOD).box(-5, 3, 2, 5, 3, 2, C.WOOD);

  // 3) 二层重檐飞檐观景甲板（带露天护栏 + 雕花宝顶阁楼，团团可登船站在船头/二层赏景！）
  v.box(-8, 7, -4, 8, 7, 4, C.ROOF);
  v.box(-6, 8, -3, 6, 8, 3, C.WOOD_L); // 二层观景台地板
  for (let x = -6; x <= 6; x += 2) v.set(x, 9, -3, C.RED_D).set(x, 9, 3, C.RED_D);
  for (const x of [-4, 0, 4]) {
    v.box(x, 9, -2, x, 11, -2, C.RED);
    v.box(x, 9, 2, x, 11, 2, C.RED);
  }
  // 顶部重檐歇山飞檐屋顶 + 金脊
  v.box(-6, 12, -3, 6, 12, 3, C.ROOF);
  v.box(-5, 13, -2, 5, 13, 2, C.ROOF);
  v.box(-3, 14, -1, 3, 14, 1, C.ROOF_COPPER);
  v.box(-2, 15, 0, 2, 15, 0, C.GOLD);
  v.set(-6, 13, -3, C.ROOF_GOLD).set(6, 13, -3, C.ROOF_GOLD).set(-6, 13, 3, C.ROOF_GOLD).set(6, 13, 3, C.ROOF_GOLD);

  // 船头与二层灯笼
  glow.set(11, 4, -2, C.LANTERN).set(11, 4, 2, C.LANTERN);
  glow.set(-6, 11, -3, C.GLOW_WARM).set(6, 11, -3, C.GLOW_WARM);
  glow.set(-6, 11, 3, C.GLOW_WARM).set(6, 11, 3, C.GLOW_WARM);

  const group = new THREE.Group();
  const bodyMesh = v.mesh(solidMat, 0.025);
  bodyMesh.scale.setScalar(scale);
  bodyMesh.position.set(0, -0.3, 0);
  group.add(bodyMesh);

  const glowMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color(0xff7733),
    emissiveIntensity: 1.2,
  });
  const glowMesh = glow.mesh(glowMat, 0.01);
  glowMesh.scale.setScalar(scale);
  glowMesh.position.set(0, -0.3, 0);
  group.add(glowMesh);

  // 船头 2K 牌匾
  const sign = createSignboard({ title: boatTitle, width: 3.4 * (scale / 0.85), height: 1.2 * (scale / 0.85), bgColor: '#3a1410' });
  sign.position.set(5.4 * (scale / 0.85), 5.6 * (scale / 0.85), 0);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);

  const deckAnchor = new THREE.Object3D();
  deckAnchor.position.set(6.8 * (scale / 0.85), 2.35 * (scale / 0.85), 0);
  group.add(deckAnchor);

  const state = {
    name: boatTitle,
    group,
    glowMat,
    x: 60,
    z: -120,
    yaw: 0,
    speed: 6.2,
    getDeckWorldPos(outVec) {
      deckAnchor.getWorldPosition(outVec);
      return outVec;
    },
  };
  return state;
}

export function buildAllLandmarks(scene, solidMat, collider, snowMeshes) {
  const chaoran = buildChaoranPavilion(solidMat, collider, snowMeshes);
  scene.add(chaoran.group);

  const lixia = buildLixiaPavilion(solidMat, collider, snowMeshes);
  scene.add(lixia.group);

  const gates = buildAllGates(solidMat, collider, snowMeshes);
  scene.add(gates.group);

  const bridges = buildBridges(solidMat, collider, snowMeshes);
  scene.add(bridges);

  const mainSpline = buildCatmullSpline(CRUISE_MAIN_PATH, 560);
  const eastSpline = buildCatmullSpline(CRUISE_EAST_PATH, 280);

  const cruise = buildCruiseBoat(solidMat, '明湖画舫', 0.85);
  scene.add(cruise.group);

  const eastCruise = buildCruiseBoat(solidMat, '鹊华画舫', 0.68);
  eastCruise.speed = 5.0;
  scene.add(eastCruise.group);

  const updateSingleCruise = (boat, spline, dist, t, minClearance) => {
    const s = spline.sample(dist);
    let cx = s.x, cz = s.z;
    // 双重水深保险：若水岸有符号距离低于阈值，自动沿深水梯度推离，100% 物理级杜绝触岸！
    const wd = getWaterSignedDist(cx, cz);
    if (wd < minClearance) {
      const push = getWaterPushDir(cx, cz);
      cx += push.x * (minClearance - wd);
      cz += push.z * (minClearance - wd);
    }
    boat.x = cx;
    boat.z = cz;
    boat.yaw = s.yaw;
    boat.group.position.set(cx, 0.05 + Math.sin(t * 2.1) * 0.07, cz);
    boat.group.rotation.set(Math.sin(t * 1.6) * 0.015, s.yaw, Math.cos(t * 1.9) * 0.018);
  };

  const update = (t, nightFactor) => {
    updateSingleCruise(cruise, mainSpline, t * cruise.speed, t, 14.0);
    updateSingleCruise(eastCruise, eastSpline, t * eastCruise.speed, t, 9.5);

    const lan = 0.25 + nightFactor * 1.6;
    lixia.glowMat.emissiveIntensity = lan;
    gates.glowMat.emissiveIntensity = lan;
    cruise.glowMat.emissiveIntensity = lan * 1.1;
    eastCruise.glowMat.emissiveIntensity = lan * 1.1;
  };

  return { chaoran, lixia, gates, cruise, eastCruise, cruises: [cruise, eastCruise], update };
}
