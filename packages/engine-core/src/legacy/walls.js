// 大明湖 5.0 空间围合、墙垣遮挡与湖畔烟火景观系统：
// 1. 「一城山色半城湖」远景立体青翠群山（南望千佛山连绵峰峦、东北鹊山与华山单椒孤峰，360°消除世界平直边缘）
// 2. 景区外围「粉墙黛瓦 · 什锦漏窗」围合景墙（自动避开大门、道路与水面）
// 3. 北岸「汇波楼—北极阁—东门」明代历城古城墙延伸段（带雉堞垛口、拱券城门与登城石阶）
// 4. 古典园林雕花影壁（照壁）、月洞门花墙与临水汉白玉望柱护栏
// 5. 参考海报同款：湖畔繁花叠石茶寮果铺（竹筐鲜果莲蓬+挑檐暖灯笼+垂岸花藤+可坐茶凳）与水中双木桩导览牌
// 6. OSM 真实周边古建院落立体化（自动避让核心地标与环湖车道，补齐古街青砖灰瓦遮挡层次）
import * as THREE from 'three';
import { Vox, Builder, hash, linc } from './voxel/vox.js';
import {
  WORLD, TERRAIN, sampleTerrain, BUILDING_POLYS, BRIDGES, DOCKS, LANDMARKS, RING_ROAD, distToSegment,
} from './map_data.js';
import { buildSnowCap, createSignboard } from './collider.js';
import { GATES } from './gates.js';

const C = {
  STONE: 0xd8d2c5,
  STONE_D: 0x9e988c,
  PLINTH: 0x7d838d,
  MARBLE: 0xf0ede6,
  WALL_W: 0xf3ede2,
  WALL_SHADE: 0xe4dccf,
  BRICK: 0x6b717b,
  BRICK_D: 0x535862,
  ROOF: 0x38424d,
  ROOF_L: 0x485461,
  RED: 0xa82a24,
  RED_D: 0x7d1e1a,
  WOOD: 0x7c4f2e,
  WOOD_L: 0xa66e42,
  WOOD_D: 0x54341d,
  GOLD: 0xf0c24b,
  AWH_RED: 0xd9483b,
  AWH_CREAM: 0xfff5e4,
  VINE_G: 0x3da34d,
  VINE_L: 0x57bf62,
  FLOWER_P: 0xff6b9d,
  FLOWER_M: 0xe04882,
  FLOWER_Y: 0xffd166,
  LANTERN: 0xff6b2b,
  GLOW_WARM: 0xffcf6e,
};

// 检测某点是否靠近环湖主车行道 RING_ROAD
function nearRingRoad(x, z, pad = 9.0) {
  for (let i = 0; i < RING_ROAD.length; i++) {
    const a = RING_ROAD[i];
    const b = RING_ROAD[(i + 1) % RING_ROAD.length];
    if (distToSegment(x, z, a[0], a[1], b[0], b[1]).dist <= pad) return true;
  }
  return false;
}

// 检测某点是否靠近任何桥梁两端
function nearAnyBridge(x, z, pad = 7.5) {
  for (let i = 0; i < BRIDGES.length; i++) {
    const b = BRIDGES[i];
    if (distToSegment(x, z, b.x1, b.z1, b.x2, b.z2).dist <= b.width * 0.5 + pad) return true;
  }
  return false;
}

// 检测某点是否靠近任何游船码头
function nearAnyDock(x, z, pad = 11.0) {
  for (let i = 0; i < DOCKS.length; i++) {
    if (Math.hypot(x - DOCKS[i].x, z - DOCKS[i].z) <= pad) return true;
  }
  return false;
}

// 1. 「一城山色半城湖」远景立体青翠群山（南侧千佛山群峰 + 东北华山孤峰与鹊山 + 东西远岚）
function buildDistantMountains(solidMat) {
  const b = new Builder();
  const emptySolid = () => false;

  // 高性能远山山体块绘制（按 6m 宏体素格叠筑，视觉厚重且顶点极省）
  const addMacroColumn = (wx, wz, step, topH, colTop, colSide) => {
    const cT = linc(colTop);
    const cS = linc(colSide);
    const x0 = wx, x1 = wx + step;
    const z0 = wz, z1 = wz + step;
    const y0 = -2, y1 = topH;
    // 顶面
    const p = b.n;
    b.pos.push(x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0);
    b.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    b.col.push(cT[0], cT[1], cT[2], cT[0], cT[1], cT[2], cT[0], cT[1], cT[2], cT[0], cT[1], cT[2]);
    b.idx.push(p, p + 1, p + 2, p, p + 2, p + 3);
    b.n += 4;
    // 四侧面
    const pushQuad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, shade) => {
      const q = b.n;
      const r = cS[0] * shade, g = cS[1] * shade, bl = cS[2] * shade;
      b.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      b.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
      b.col.push(r, g, bl, r, g, bl, r, g, bl, r, g, bl);
      b.idx.push(q, q + 1, q + 2, q, q + 2, q + 3);
      b.n += 4;
    };
    pushQuad(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, 0, 0, -1, 0.92); // 北坡面湖受光
    pushQuad(x1, y0, z1, x0, y0, z1, x0, y1, z1, x1, y1, z1, 0, 0, 1, 0.78);
    pushQuad(x0, y0, z1, x0, y0, z0, x0, y1, z0, x0, y1, z1, -1, 0, 0, 0.85);
    pushQuad(x1, y0, z0, x1, y0, z1, x1, y1, z1, x1, y1, z0, 1, 0, 0, 0.96);
  };

  const peaks = [
    // 南侧远景连绵群山：千佛山、佛慧山、英雄山、燕子山（退远至 1.15~1.26 km 外，避免紧贴南墙！）
    { cx: -860, cz: 1180, rx: 280, rz: 140, h: 165, cone: 1.35 },
    { cx: -420, cz: 1160, rx: 260, rz: 135, h: 195, cone: 1.35 },
    { cx: -40,  cz: 1200, rx: 320, rz: 160, h: 235, cone: 1.30 }, // 千佛山主峰（正对历下亭南望轴线）
    { cx: 380,  cz: 1170, rx: 270, rz: 140, h: 190, cone: 1.35 },
    { cx: 820,  cz: 1210, rx: 290, rz: 145, h: 175, cone: 1.35 },
    // 东北与西北名山：华不注山（真实方位 ~35° 东北偏北单椒秀泽孤峰！）与鹊山（西北偏北）
    { cx: 740,  cz: -1080, rx: 165, rz: 155, h: 215, cone: 1.85 }, // 华山尖峰
    { cx: -340, cz: -1120, rx: 260, rz: 130, h: 148, cone: 1.35 }, // 鹊山横亘
    // 东西远景浅青岚山
    { cx: -1480, cz: 0,   rx: 150, rz: 480, h: 125, cone: 1.40 },
    { cx: 1520,  cz: 0,   rx: 155, rz: 480, h: 135, cone: 1.40 },
  ];

  const STEP = 24;
  // 空气透视青蓝远山色板（配 fog:false，跨全湖清晰可见「一城山色半城湖」）
  const TOP_PAL = [0x6e9eb0, 0x6292a6, 0x7aa9b8, 0x58869a];
  const SIDE_PAL = [0x527d91, 0x4b7488, 0x5c889c];

  for (const pk of peaks) {
    for (let z = pk.cz - pk.rz; z <= pk.cz + pk.rz; z += STEP) {
      for (let x = pk.cx - pk.rx; x <= pk.cx + pk.rx; x += STEP) {
        const nx = (x - pk.cx) / pk.rx;
        const nz = (z - pk.cz) / pk.rz;
        const r2 = nx * nx + nz * nz;
        if (r2 >= 1.0) continue;
        const ridge = 0.82 + 0.24 * Math.sin(x * 0.014 + z * 0.011) + 0.14 * hash(x, z, 3);
        const h = Math.round(pk.h * Math.pow(1 - r2, pk.cone || 1.35) * ridge);
        if (h < 10) continue;
        const tHex = h > pk.h * 0.65 ? TOP_PAL[2] : TOP_PAL[Math.floor(hash(x, z, 5) * TOP_PAL.length)];
        const sHex = SIDE_PAL[Math.floor(hash(x, z, 7) * SIDE_PAL.length)];
        addMacroColumn(x, z, STEP, h, tHex, sHex);
      }
    }
  }

  const geo = b.geometry();
  const mtMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mtMat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

// 2. 景区外围「粉墙黛瓦 · 什锦漏窗」围合景墙 + 北岸明代历城古城墙延伸段
function buildPerimeterAndCityWalls(solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox();
  const glow = new Vox();

  // 检查某世界点是否允许砌外围景墙（全部大门留口从 js/gates.js 自动派生，改一处全场生效！）
  const gateOpenings = [
    ...GATES.map((g) => [g.x, g.z, g.openingRadius || 20]),
    [384, -380, 20], // 汇波楼本体（单独衔接）
  ];
  const canPlaceWall = (wx, wz) => {
    for (const [gx, gz, gr] of gateOpenings) {
      if (Math.hypot(wx - gx, wz - gz) < gr) return false;
    }
    const t = sampleTerrain(wx, wz);
    if (t.isWater || t.type === TERRAIN.ROAD) return false;
    if (nearRingRoad(wx, wz, 7.2)) return false;
    return true;
  };

  // 绘制一段粉墙黛瓦漏窗景墙（局部合并到大型分块 Vox 中避免过多 DrawCall）
  const wallGroups = new THREE.Group();
  const makeGardenWallRun = (x0, z0, x1, z1) => {
    const wv = new Vox();
    const isX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const len = Math.round(isX ? Math.abs(x1 - x0) : Math.abs(z1 - z0));
    const sx = Math.sign(x1 - x0), sz = Math.sign(z1 - z0);
    let runStart = null;

    for (let i = 0; i <= len; i++) {
      const wx = Math.round(x0 + (isX ? sx * i : 0));
      const wz = Math.round(z0 + (isX ? 0 : sz * i));
      const ok = i < len && canPlaceWall(wx, wz);
      if (ok) {
        if (runStart === null) runStart = i;
        const baseH = sampleTerrain(wx, wz).height;
        const lx = wx - x0, lz = wz - z0;
        const isPillar = i % 10 === 0;
        const inWindow = !isPillar && (i % 10 >= 4 && i % 10 <= 6);
        // 青石墙基
        wv.set(lx, baseH, lz, C.PLINTH);
        // 粉墙主体 + 什锦镂空花窗
        for (let dy = 1; dy <= 3; dy++) {
          if (inWindow && dy === 2 && (i % 2 === 1)) continue; // 冰裂纹镂空窗格透景！
          const col = isPillar ? C.BRICK : (inWindow && (dy === 1 || dy === 3) ? C.BRICK_D : C.WALL_W);
          wv.set(lx, baseH + dy, lz, col);
        }
        // 黛瓦压顶（柱头微翘 1 格）
        wv.set(lx, baseH + 4, lz, C.ROOF);
        if (isPillar) wv.set(lx, baseH + 5, lz, C.ROOF_L);
      } else if (runStart !== null) {
        // 提交这一连续段的高速 AABB 碰撞盒
        const iEnd = i - 1;
        const ax = x0 + (isX ? sx * runStart : 0), az = z0 + (isX ? 0 : sz * runStart);
        const bx = x0 + (isX ? sx * iEnd : 0), bz = z0 + (isX ? 0 : sz * iEnd);
        collider.addBoxVolume(
          Math.min(ax, bx) - 0.3, 1.5, Math.min(az, bz) - 0.3,
          Math.max(ax, bx) + 1.3, 6.8, Math.max(az, bz) + 1.3,
        );
        runStart = null;
      }
    }
    if (wv.m.size > 0) {
      const g = new THREE.Group();
      g.add(wv.mesh(solidMat, 0.02));
      const snow = buildSnowCap(wv, 5);
      g.add(snow);
      snowMeshes.push(snow);
      g.position.set(x0, 0, z0);
      wallGroups.add(g);
    }
  };

  // 开放式街景石墩绿篱边界工厂（还原 2017 年免费开放后的大明湖通透街景：低矮汉白玉石墩 + 翠绿灌木篱，告别生硬封闭高墙！）
  const makeOpenStreetEdge = (x0, z0, x1, z1) => {
    const wv = new Vox();
    const isX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const len = Math.round(isX ? Math.abs(x1 - x0) : Math.abs(z1 - z0));
    const sx = Math.sign(x1 - x0), sz = Math.sign(z1 - z0);
    for (let i = 0; i <= len; i++) {
      const wx = Math.round(x0 + (isX ? sx * i : 0));
      const wz = Math.round(z0 + (isX ? 0 : sz * i));
      if (!canPlaceWall(wx, wz)) continue;
      const baseH = sampleTerrain(wx, wz).height;
      const lx = wx - x0, lz = wz - z0;
      if (i % 12 === 0) {
        // 汉白玉雕花石墩界柱
        wv.set(lx, baseH, lz, C.STONE_D).set(lx, baseH + 1, lz, C.MARBLE);
      } else if (i % 12 >= 3 && i % 12 <= 9) {
        // 低矮修剪翠绿绿篱，视觉完全通透无阻挡！
        wv.set(lx, baseH, lz, (i & 1) ? C.VINE_G : C.VINE_L);
      }
    }
    if (wv.m.size > 0) {
      const g = new THREE.Group();
      g.add(wv.mesh(solidMat, 0.02));
      g.position.set(x0, 0, z0);
      wallGroups.add(g);
    }
  };

  // 真实免费开放式边界：南岸大明湖路/百花洲与东岸黑虎泉北路采用通透开放绿篱石墩；西岸与北岸西段保留园林漏窗景墙
  makeOpenStreetEdge(-840, 296, 650, 296);   // 南岸大明湖路/百花洲侧开放式街景边界
  makeGardenWallRun(-856, -290, -856, 294);  // 西岸园林漏窗围墙
  makeGardenWallRun(-760, -421, 195, -421);  // 北岸西中段园林景墙（东接北极阁后明代古城墙）
  makeOpenStreetEdge(535, -380, 888, -380);  // 东北段开放绿道边界
  makeOpenStreetEdge(890, -378, 890, 240);   // 东岸黑虎泉北路侧开放式街景边界

  // 北岸「明代历城古城墙」延伸段（北极阁北 x=205 -> 汇波楼 x=384 -> 东门西 x=492，z=-380）
  // 真实垛口雉堞、5m宽青砖城台马道、通行拱券城门洞、登城慢坡石阶！
  const cw = new Vox();
  const cwGlow = new Vox();
  const cwZ = -380;
  for (let wx = 208; wx <= 490; wx++) {
    // 避开汇波楼本体 (368..400)
    if (wx >= 368 && wx <= 400) continue;
    const t = sampleTerrain(wx, cwZ);
    if (t.isWater) continue;
    const isArchGate = Math.abs(wx - 272) <= 3 || Math.abs(wx - 442) <= 3 || nearRingRoad(wx, cwZ, 5.5);
    const lx = wx - 350;
    for (let dz = -2; dz <= 2; dz++) {
      for (let y = 0; y <= 7; y++) {
        if (isArchGate && y <= 4) continue; // 宽敞拱券城门洞供行人与车辆穿行！
        if (isArchGate && y === 5 && Math.abs(wx - 272) <= 2) continue;
        cw.set(lx, y, dz, ((wx + y + dz) & 1) ? C.BRICK : C.BRICK_D);
      }
      // 城顶青砖马道
      cw.set(lx, 8, dz, C.STONE_D);
    }
    // 南北两侧雉堞垛口（每 3 格留一箭垛豁口）
    if (wx % 3 !== 0) {
      cw.set(lx, 9, -2, C.BRICK).set(lx, 9, 2, C.BRICK);
    }
    if (wx % 18 === 0) {
      cwGlow.set(lx, 8, 3, C.LANTERN).set(lx, 8, -3, C.LANTERN);
    }
  }
  // 西端 (wx=200..207) 增设可步行攀登的登城石阶
  for (let s = 0; s < 8; s++) {
    const lx = (200 + s) - 350;
    cw.box(lx, 0, -1, lx, s + 1, 1, C.STONE);
  }
  const cwGrp = new THREE.Group();
  cwGrp.add(cw.mesh(solidMat, 0.025), cwGlow.mesh(glowMat, 0.01));
  const cwSnow = buildSnowCap(cw, 7);
  cwGrp.add(cwSnow);
  snowMeshes.push(cwSnow);
  cwGrp.position.set(350, 2, cwZ);
  collider.registerVox(cw, 350, 2, cwZ);
  wallGroups.add(cwGrp);

  return wallGroups;
}

// 3. 古典园林障景：雕花影壁（照壁）+ 月洞门花墙 + 临水汉白玉雕栏
function buildGardenScreensAndBalustrades(solidMat, glowMat, collider, snowMeshes) {
  const group = new THREE.Group();

  // A) 传统雕花照壁/影壁工厂（「一步一景、欲扬先抑」古典园林遮挡美学）
  const makeScreenWall = (x, z, rotY, title, subtitle) => {
    if (sampleTerrain(x, z).isWater || nearRingRoad(x, z, 8)) return;
    const v = new Vox(), g = new Vox();
    // 须弥座石基
    v.box(-6, 0, -1, 6, 1, 1, C.MARBLE);
    // 粉白影壁心 + 青砖雕花边框
    v.box(-5, 2, 0, 5, 6, 0, (bx, by) => (Math.abs(bx) === 5 || by === 6) ? C.BRICK : C.WALL_W);
    // 八字侧翼斜墙
    v.box(-7, 0, 1, -6, 5, 1, C.WALL_W).set(-7, 6, 1, C.ROOF).set(-6, 6, 1, C.ROOF);
    v.box(6, 0, 1, 7, 5, 1, C.WALL_W).set(6, 6, 1, C.ROOF).set(7, 6, 1, C.ROOF);
    // 庑殿黛瓦壁顶 + 金色脊兽
    v.box(-6, 7, -1, 6, 7, 1, C.ROOF);
    v.box(-5, 8, 0, 5, 8, 0, C.GOLD);
    g.set(-6, 6, 1, C.LANTERN).set(6, 6, 1, C.LANTERN);

    const grp = new THREE.Group();
    grp.add(v.mesh(solidMat, 0.025), g.mesh(glowMat, 0.01));
    const plaqueF = createSignboard({
      title, subtitle, width: 6.2, height: 2.3, bgColor: '#2d3748', borderColor: '#d9b359', textColor: '#fff2cc',
    });
    plaqueF.position.set(0.5, 4.5, 1.16);
    const plaqueB = createSignboard({
      title: '湖山入画', width: 6.2, height: 2.3, bgColor: '#2d3748', borderColor: '#d9b359', textColor: '#fff2cc',
    });
    plaqueB.position.set(0.5, 4.5, -0.16);
    plaqueB.rotation.y = Math.PI;
    grp.add(plaqueF, plaqueB);

    const snow = buildSnowCap(v, 5);
    grp.add(snow);
    snowMeshes.push(snow);
    grp.position.set(x, 2, z);
    grp.rotation.y = rotY;
    collider.registerVox(v, x, 2, z, rotY);
    group.add(grp);
  };

  makeScreenWall(-242, 244, 0.25, '四面荷花', '泉城明珠 · 大明湖');   // 南门迎宾广场西侧障景照壁
  makeScreenWall(592, 86, -0.4, '鹊华烟雨', '七桥风月 · 小东湖');  // 鹊华广场汉白玉照壁

  // B) 粉墙黛瓦「月洞门」景观游廊墙（团团可从圆洞门自由穿行框景！）
  const makeMoonGateWall = (x, z, rotY) => {
    if (sampleTerrain(x, z).isWater || nearRingRoad(x, z, 8)) return;
    const v = new Vox();
    for (let bx = -9; bx <= 9; bx++) {
      v.set(bx, 0, 0, C.PLINTH);
      for (let by = 1; by <= 5; by++) {
        // 半径 2.6 格的圆润中式月亮门洞（中心 (0, 2.5)）
        const d = Math.hypot(bx, by - 2.4);
        if (d < 2.5) continue;
        const isRing = d < 3.35;
        const isWin = Math.abs(bx) >= 5 && Math.abs(bx) <= 7 && by >= 2 && by <= 3 && ((bx + by) & 1);
        if (isWin) continue;
        v.set(bx, by, 0, isRing ? C.BRICK_D : C.WALL_W);
      }
      v.set(bx, 6, 0, C.ROOF);
    }
    const grp = new THREE.Group();
    grp.add(v.mesh(solidMat, 0.025));
    const snow = buildSnowCap(v, 5);
    grp.add(snow);
    snowMeshes.push(snow);
    grp.position.set(x, 2, z);
    grp.rotation.y = rotY;
    collider.registerVox(v, x, 2, z, rotY);
    group.add(grp);
  };

  makeMoonGateWall(-344, 178, 0.35);  // 遐园东侧月洞门花墙
  makeMoonGateWall(256, 32, -0.5);    // 秋柳园西侧月洞门花墙
  makeMoonGateWall(212, 148, 0.15);   // 老舍纪念馆西侧月洞门

  // C) 重点亲水广场「汉白玉雕花望柱护栏」（自动沿真实 STONE_BANK 边缘生成，留出全部码头与桥梁通道！）
  const railV = new Vox();
  const railZones = [
    { x0: -265, z0: 155, x1: -175, z1: 245 }, // 南门长堤与迎客亲水岸线
    { x0: -45,  z0: 132, x1: 55,   z1: 175 }, // 司家码头亲水石岸
    { x0: 448,  z0: -115, x1: 486, z1: -25 }, // 超然楼西侧观湖大平台岸线
    { x0: 118,  z0: -348, x1: 205, z1: -282 },// 北极阁南侧亲水石台
  ];
  for (const rz of railZones) {
    for (let wz = rz.z0; wz <= rz.z1; wz += 2) {
      for (let wx = rz.x0; wx <= rz.x1; wx += 2) {
        const t = sampleTerrain(wx, wz);
        if (t.isWater || t.type !== TERRAIN.STONE_BANK) continue;
        // 仅在紧贴水面（四邻至少一格为水）处立汉白玉望柱与栏板
        const adjWater =
          sampleTerrain(wx + 2, wz).isWater || sampleTerrain(wx - 2, wz).isWater ||
          sampleTerrain(wx, wz + 2).isWater || sampleTerrain(wx, wz - 2).isWater;
        if (!adjWater) continue;
        if (nearAnyDock(wx, wz, 10) || nearAnyBridge(wx, wz, 6) || nearRingRoad(wx, wz, 6.5)) continue;
        const h = t.height;
        railV.set(wx, h, wz, C.MARBLE);
        if (((wx + wz) % 4) === 0) railV.set(wx, h + 1, wz, C.STONE); // 莲花头望柱
      }
    }
  }
  if (railV.m.size > 0) {
    const rm = railV.mesh(solidMat, 0.015);
    group.add(rm);
  }

  return group;
}

// 4. 参考海报灵魂还原：「湖畔繁花叠石茶寮果铺」+「水中双木桩原木导览牌」
function buildLakesideTeaStallsAndWaterSigns(solidMat, glowMat, collider, snowMeshes) {
  const group = new THREE.Group();
  const waterPosts = []; // 导出入水木桩坐标供水面 Shader 绘纯白同心涟漪圈！

  // A) 湖畔繁花叠石茶寮/莲蓬鲜果小铺（1:1 致敬参考图左岸：红白条纹布棚 + 满筐红果金橘绿莲蓬 + 垂岸粉紫花藤 + 麻绳木桩栈台 + 可坐茶凳！）
  const teaStalls = [
    { id: 'stall_south', x: -202, z: 184, rotY: -Math.PI / 2, name: '荷香茶寮' },
    { id: 'stall_sijia', x: 24,   z: 150, rotY: Math.PI,      name: '泉水大碗茶' },
    { id: 'stall_chaoran', x: 468, z: -48, rotY: -Math.PI / 2, name: '明湖莲蓬铺' },
    { id: 'stall_tiegong', x: -498, z: -272, rotY: 0.4,       name: '沧浪茶肆' },
  ];

  teaStalls.forEach((st, idx) => {
    const v = new Vox(), g = new Vox();
    // 1) 临水高低错落青灰叠石基座 + 原木栈台地板
    for (let x = -5; x <= 5; x++) {
      for (let z = -4; z <= 4; z++) {
        v.box(x, -2, z, x, -1, z, ((x + z) & 1) ? C.STONE_D : C.PLINTH);
        v.set(x, 0, z, ((x + z) % 3 === 0) ? C.WOOD : C.WOOD_L);
      }
    }
    // 台缘错落叠石与垂挂入水侧的粉紫三角梅花藤（海报左岸点睛细节！）
    for (const [rx, rz] of [[-5, 4], [-4, 4], [4, 4], [5, 4], [-5, 2], [-5, 3]]) {
      v.box(rx, -2, rz + 1, rx, 0, rz + 1, C.PLINTH);
      v.set(rx, 1, rz, C.VINE_G).set(rx, 0, rz + 1, C.VINE_L).set(rx, -1, rz + 1, C.FLOWER_P);
      v.set(rx, 1, rz + 1, (rx & 1) ? C.FLOWER_P : C.FLOWER_M);
    }
    // 栈台边缘圆木短桩 + 垂坠麻绳护栏（正面留入口）
    for (const px of [-5, -2, 2, 5]) {
      v.box(px, 1, 4, px, 2, 4, C.WOOD_D);
      v.set(px, 2, 4, C.GOLD);
    }
    v.box(-4, 1, 4, -3, 1, 4, 0xc99e67).box(3, 1, 4, 4, 1, 4, 0xc99e67); // 麻绳横链

    // 2) 四根原木立柱 + 红白相间斜坡遮阳布棚 + 檐下暖黄纸灯笼
    for (const [px, pz] of [[-4, -3], [4, -3], [-4, 2], [4, 2]]) {
      v.box(px, 1, pz, px, 5, pz, C.WOOD_D);
    }
    for (let x = -5; x <= 5; x++) {
      const stripe = Math.floor((x + 5) / 2) % 2 === 0 ? C.AWH_RED : C.AWH_CREAM;
      for (let z = -4; z <= 3; z++) {
        const ay = 6 - Math.floor((z + 4) * 0.28);
        v.set(x, ay, z, stripe);
      }
    }
    // 棚架横梁上攀爬的翠绿花藤与粉花簇
    for (let x = -5; x <= 5; x += 2) {
      v.set(x, 6, -3, C.VINE_G).set(x - 1, 5, 2, C.FLOWER_P);
    }
    // 挑檐下两盏暖光圆灯笼
    g.set(-3, 4, 2, C.GLOW_WARM).set(3, 4, 2, C.GLOW_WARM);

    // 3) 木柜台 + 3 只满载红苹果、金蜜橘、翠绿莲蓬的 3D 竹编果筐！
    v.box(-3, 1, -2, 3, 2, -1, C.WOOD);
    const fruits = [
      { cx: -2, col1: 0xe63946, col2: 0xff595e }, // 红苹果筐
      { cx: 0,  col1: 0xff9f1c, col2: 0xffbf69 }, // 金砂糖橘筐
      { cx: 2,  col1: 0x52b788, col2: 0x74c69d }, // 新鲜翠绿莲蓬筐
    ];
    for (const fr of fruits) {
      v.box(fr.cx - 1, 2, -2, fr.cx, 2, -1, 0xc69253);
      v.set(fr.cx - 1, 3, -2, fr.col1).set(fr.cx, 3, -2, fr.col2);
      v.set(fr.cx - 1, 3, -1, fr.col2).set(fr.cx, 3, -1, fr.col1);
    }
    // 摊前一对可坐圆木小茶凳！
    v.set(-2, 1, 2, C.WOOD_L).set(2, 1, 2, C.WOOD_L);

    const grp = new THREE.Group();
    grp.add(v.mesh(solidMat, 0.025), g.mesh(glowMat, 0.01));
    const sign = createSignboard({ title: st.name, width: 3.6, height: 1.25, bgColor: '#4a2511' });
    sign.position.set(0.5, 5.2, 2.8);
    grp.add(sign);

    const snow = buildSnowCap(v, 5);
    grp.add(snow);
    snowMeshes.push(snow);
    const baseH = Math.max(2, sampleTerrain(st.x, st.z).height);
    grp.position.set(st.x, baseH, st.z);
    grp.rotation.y = st.rotY;
    // 仅注册茶摊后半部柜台碰撞，留出前排茶凳供团团走近坐下！
    collider.addBoxVolume(st.x - 3.6, baseH, st.z - 3.6, st.x + 3.6, baseH + 5.5, st.z + 3.6);
    // 注册茶铺前排可坐观湖木茶凳！
    const cos = Math.cos(st.rotY), sin = Math.sin(st.rotY);
    const sx = st.x + sin * 2.8, sz = st.z + cos * 2.8;
    collider.addSeat({
      id: `tea_seat_${idx}`,
      type: 'bench',
      label: `🍵 按 E 键在「${st.name}」湖畔茶座坐下歇脚赏湖`,
      x: sx,
      y: baseH + 0.95,
      z: sz,
      yaw: st.rotY,
      interactRadius: 5.2,
    });
    group.add(grp);
  });

  // B) 参考海报同款：「水中双木桩原木导览牌」（立于近岸浅水中，桩底带纯白同心水波圈！）
  const waterSigns = [
    { x: -206, z: 146, rotY: 0,           title: '历下亭渡', sub: '北望湖心古亭' },
    { x: 16,   z: 122, rotY: Math.PI,     title: '司家古渡', sub: '泛舟赏荷水道' },
    { x: 444,  z: -56, rotY: -Math.PI / 2, title: '超然画舫', sub: '江北第一楼' },
    { x: 724,  z: -102, rotY: -Math.PI / 2, title: '小东湖渡', sub: '鹊华烟雨' },
    { x: -472, z: -236, rotY: 0.4,        title: '沧浪荷香', sub: '四面荷花三面柳' },
    { x: -48,  z: 24,  rotY: -Math.PI / 2, title: '历下名亭', sub: '济南名士多' },
  ];

  for (const ws of waterSigns) {
    if (!sampleTerrain(ws.x, ws.z).isWater) continue;
    const g = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(0.22, 0.24, 4.4, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x7c4f2b, roughness: 0.85 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd4a359, roughness: 0.75 });
    const ropeGeo = new THREE.TorusGeometry(0.26, 0.06, 6, 12);
    ropeGeo.rotateX(Math.PI / 2);

    for (const lx of [-1.45, 1.45]) {
      const p = new THREE.Mesh(postGeo, postMat);
      p.position.set(lx, 0.6, 0);
      p.castShadow = true;
      g.add(p);
      // 桩身麻绳缠绕圈（1:1 复刻参考海报木桩质感！）
      for (const ry of [0.45, 1.35]) {
        const rp = new THREE.Mesh(ropeGeo, ropeMat);
        rp.position.set(lx, ry, 0);
        g.add(rp);
      }
      // 记录世界空间入水木桩坐标，传给水面 Shader 渲染纯白同心涟漪圈！
      const wx = ws.x + Math.cos(ws.rotY) * lx;
      const wz = ws.z - Math.sin(ws.rotY) * lx;
      waterPosts.push(new THREE.Vector2(wx, wz));
    }

    // 暖木原木色双面立体木牌（正反均可清晰阅读！）
    const boardF = createSignboard({
      title: ws.title, subtitle: ws.sub, width: 4.4, height: 1.85,
      bgColor: '#e9c48c', borderColor: '#8c5828', textColor: '#3d2210', seal: '',
    });
    boardF.material.emissiveIntensity = 0.08;
    boardF.position.set(0, 2.35, 0.16);
    const boardB = createSignboard({
      title: ws.title, subtitle: ws.sub, width: 4.4, height: 1.85,
      bgColor: '#e9c48c', borderColor: '#8c5828', textColor: '#3d2210', seal: '',
    });
    boardB.material.emissiveIntensity = 0.08;
    boardB.position.set(0, 2.35, -0.16);
    boardB.rotation.y = Math.PI;
    g.add(boardF, boardB);

    g.position.set(ws.x, 0, ws.z);
    g.rotation.y = ws.rotY;
    collider.addBoxVolume(ws.x - 1.8, -1.5, ws.z - 1.8, ws.x + 1.8, 3.4, ws.z + 1.8);
    group.add(g);
  }

  return { group, waterPosts };
}

// 辅助函数：将多组 BufferGeometry（含 position/normal/color/index）合并为单个高性能 DrawCall
function mergeIndexedGeos(geos) {
  if (!geos || geos.length === 0) return null;
  let totalVerts = 0, totalIdx = 0;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(totalVerts * 3);
  const nor = new Float32Array(totalVerts * 3);
  const col = new Float32Array(totalVerts * 3);
  const idx = new Uint32Array(totalIdx);
  let vOff = 0, iOff = 0;
  for (const g of geos) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const c = g.attributes.color.array;
    pos.set(p, vOff * 3);
    nor.set(n, vOff * 3);
    col.set(c, vOff * 3);
    if (g.index) {
      const ia = g.index.array;
      for (let k = 0; k < ia.length; k++) idx[iOff + k] = ia[k] + vOff;
      iOff += ia.length;
    } else {
      const cnt = g.attributes.position.count;
      for (let k = 0; k < cnt; k++) idx[iOff + k] = vOff + k;
      iOff += cnt;
    }
    vOff += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// 5. OSM 真实古建院落立体化（读取 BUILDING_POLYS，全量几何合批至 3 DrawCall，消除原 ~190 DrawCall 浪费！）
function buildOsmCourtyardBuildings(solidMat, glowMat, collider, snowMeshes) {
  const group = new THREE.Group();
  if (!BUILDING_POLYS || BUILDING_POLYS.length === 0) return group;

  // 已精建核心建筑保护区列表（避免与手雕古建重叠，含本次 1:1 归位与补建的大型真实地标！）
  const protectedSpots = [
    ...LANDMARKS.map((lm) => [lm.x, lm.z, lm.id === 'chaoran' ? 42 : 28]),
    [75, -322, 32],   // 明湖秀看台
    [43, -376, 44],   // 济南天然奇石馆（新增）
    [145, 23, 28],    // 秋柳诗社（新增）
    [337, 111, 28],   // 水街（新增）
    [88, 198, 22],    // 司家院（新增）
    [327, 76, 14],    // 二郎庙（新增）
    [-454, 176, 32],  // 奎虚书藏（真实归位）
    [355, -331, 18],  // 明昌钟亭（真实归位）
    [-778, -280, 18], // 游乐园旋转木马（新增）
    [-675, -285, 28], // 海底世界
    [-58, -368, 16],  // 明湖宝鼎
    [680, 92, 32],    // 鹊华居（扩容）
    [766, -155, 32],  // 水云居（扩容）
    [-105, 228, 28],  // 枕湖楼（扩容）
    [-116, -355, 28], // 明湖楼（扩容）
    [480, -323, 32],  // 平远楼（扩容）
    [336, -292, 18],  // 雨荷厅
    [541, -112, 18],  // 博艺堂
    [539, -31, 18],   // 贺胜斋
    [560, 107, 24],   // 烟雨堂
    [370, -342, 16],  // 藕神祠
    [-369, 205, 62],  // 遐园全尺度大围合园区
    [165, 212, 18],   // 钟楼台基遗址
    [306, 23, 24],    // 柳茗居
    [458, 94, 16],    // 朗园
    [398, -10, 18],   // 花笑廊
    [-572, 197, 18],  // 晏公庙
    [-772, 174, 26],  // 藕香榭+曲桥
    [-845, 108, 18],  // 龙泉池
    [-792, -62, 16],  // 鸳鸯亭
    [-772, -48, 18],  // 湖西码头
    [-605, 118, 18],  // 王尽美旧居
    [-418, 108, 14],  // 扇面亭
    [-58, -338, 18],  // 曾巩画壁
    [161, -395, 22],  // 济南战役临时指挥部旧址
    [326, -296, 18],  // 南丰戏楼
    [582, -348, 22],  // 闻韶驿
    ...GATES.map((g) => [g.x, g.z, g.openingRadius || 20]),
  ];

  const solidGeos = [];
  const glowGeos = [];
  const snowGeos = [];
  let count = 0;

  for (let i = 0; i < BUILDING_POLYS.length; i++) {
    const poly = BUILDING_POLYS[i];
    if (!poly || poly.length < 3) continue;

    // 计算真实最小外接旋转矩形（OBB），保留建筑原本朝向与长宽比
    let bestArea = Infinity, cx = 0, cz = 0, w = 0, d = 0, bestRad = 0;
    for (let deg = 0; deg < 90; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      const cs = Math.cos(rad), sn = Math.sin(rad);
      let lx0 = Infinity, lx1 = -Infinity, lz0 = Infinity, lz1 = -Infinity;
      for (const [px, pz] of poly) {
        const lx = px * cs + pz * sn;
        const lz = -px * sn + pz * cs;
        if (lx < lx0) lx0 = lx;
        if (lx > lx1) lx1 = lx;
        if (lz < lz0) lz0 = lz;
        if (lz > lz1) lz1 = lz;
      }
      const bw = lx1 - lx0, bd = lz1 - lz0;
      if (bw * bd < bestArea) {
        bestArea = bw * bd;
        w = bw; d = bd; bestRad = rad;
        const mLx = (lx0 + lx1) * 0.5, mLz = (lz0 + lz1) * 0.5;
        cx = mLx * cs - mLz * sn;
        cz = mLx * sn + mLz * cs;
      }
    }
    if (w < 6 || d < 6 || w > 60 || d > 60) continue;
    cx = Math.round(cx);
    cz = Math.round(cz);
    const rotY = -bestRad;

    // 避开已精建地标、环湖车道、桥梁及水面
    let skip = false;
    for (const [px, pz, pr] of protectedSpots) {
      if (Math.hypot(cx - px, cz - pz) < pr + Math.max(w, d) * 0.4) { skip = true; break; }
    }
    if (skip) continue;
    if (nearRingRoad(cx, cz, Math.max(w, d) * 0.5 + 6.5)) continue;
    if (nearAnyBridge(cx, cz, Math.max(w, d) * 0.5 + 5.0)) continue;

    const rx = Math.min(18, Math.max(3, Math.round(w * 0.48)));
    const rz = Math.min(18, Math.max(3, Math.round(d * 0.48)));
    const cs = Math.cos(-rotY), sn = Math.sin(-rotY);
    const testPts = [
      [cx, cz],
      [cx - rx * cs + rz * sn, cz - rx * sn - rz * cs],
      [cx + rx * cs + rz * sn, cz + rx * sn - rz * cs],
      [cx - rx * cs - rz * sn, cz - rx * sn + rz * cs],
      [cx + rx * cs - rz * sn, cz + rx * sn + rz * cs],
    ];
    for (const [tx, tz] of testPts) {
      const tt = sampleTerrain(tx, tz);
      if (tt.isWater || tt.type === TERRAIN.ROAD) { skip = true; break; }
    }
    if (skip) continue;

    const baseY = sampleTerrain(cx, cz).height;
    const wallH = 4 + (i % 3); // 4~6m 错落济南老街青砖灰瓦院屋
    const isWhite = (i % 2) === 0;
    const v = new Vox(), g = new Vox();

    // 石砌台基 + 粉墙/青砖墙身 + 暖光花格窗
    v.box(-rx, 0, -rz, rx, 0, rz, C.PLINTH);
    for (let y = 1; y <= wallH; y++) {
      for (let x = -rx; x <= rx; x++) {
        for (let z = -rz; z <= rz; z++) {
          if (Math.abs(x) !== rx && Math.abs(z) !== rz) continue;
          const corner = Math.abs(x) === rx && Math.abs(z) === rz;
          const win = !corner && y >= 2 && y <= 3 && ((x + z) % 3 === 0);
          if (win) {
            v.set(x, y, z, C.WOOD_D);
            g.set(x, y, z, C.GLOW_WARM);
          } else {
            v.set(x, y, z, corner ? C.BRICK_D : (isWhite ? C.WALL_W : C.BRICK));
          }
        }
      }
    }
    // 传统两坡硬山灰瓦顶
    const ridgeAlongX = rx >= rz;
    const span = ridgeAlongX ? rz : rx;
    const steps = Math.min(4, Math.max(2, Math.ceil(span * 0.65)));
    for (let s = 0; s <= steps; s++) {
      const shrink = Math.floor((s / Math.max(1, steps)) * span);
      const ex = ridgeAlongX ? (rx + 1) : Math.max(0, rx + 1 - shrink);
      const ez = ridgeAlongX ? Math.max(0, rz + 1 - shrink) : (rz + 1);
      v.box(-ex, wallH + 1 + s, -ez, ex, wallH + 1 + s, ez, (s === steps) ? C.BRICK_D : C.ROOF);
    }

    const sGeo = v.geometry(0.025);
    if (rotY !== 0) sGeo.rotateY(rotY);
    sGeo.translate(cx, baseY, cz);
    solidGeos.push(sGeo);

    if (g.m.size > 0) {
      const gGeo = g.geometry(0.01);
      if (rotY !== 0) gGeo.rotateY(rotY);
      gGeo.translate(cx, baseY, cz);
      glowGeos.push(gGeo);
    }

    const snowV = new Vox();
    v.each((vx, vy, vz) => {
      if (vy >= wallH && !v.has(vx, vy + 1, vz)) {
        snowV.set(vx, vy + 1, vz, hash(vx, vz, vy) < 0.5 ? 0xf5faff : 0xe6f1fc);
      }
    });
    if (snowV.m.size > 0) {
      const snGeo = snowV.geometry(0.015);
      if (rotY !== 0) snGeo.rotateY(rotY);
      snGeo.translate(cx, baseY, cz);
      snowGeos.push(snGeo);
    }

    collider.registerVox(v, cx, baseY, cz, rotY);
    count++;
    if (count >= 64) break;
  }

  const mergedSolid = mergeIndexedGeos(solidGeos);
  if (mergedSolid) {
    const m = new THREE.Mesh(mergedSolid, solidMat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  const mergedGlow = mergeIndexedGeos(glowGeos);
  if (mergedGlow) {
    const gm = new THREE.Mesh(mergedGlow, glowMat);
    gm.castShadow = false;
    group.add(gm);
  }
  const mergedSnow = mergeIndexedGeos(snowGeos);
  if (mergedSnow) {
    const sm = new THREE.Mesh(mergedSnow, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 }));
    sm.castShadow = false;
    sm.receiveShadow = true;
    sm.visible = false;
    group.add(sm);
    snowMeshes.push(sm);
  }

  return group;
}

export function buildLakeWallsAndScenery(scene, solidMat, collider, snowMeshes) {
  const glowMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color(0xffa838),
    emissiveIntensity: 0.3,
    roughness: 0.45,
  });

  const mountains = buildDistantMountains(solidMat);
  scene.add(mountains);

  const walls = buildPerimeterAndCityWalls(solidMat, glowMat, collider, snowMeshes);
  scene.add(walls);

  const screens = buildGardenScreensAndBalustrades(solidMat, glowMat, collider, snowMeshes);
  scene.add(screens);

  const { group: stallsAndSigns, waterPosts } = buildLakesideTeaStallsAndWaterSigns(solidMat, glowMat, collider, snowMeshes);
  scene.add(stallsAndSigns);

  const courtyards = buildOsmCourtyardBuildings(solidMat, glowMat, collider, snowMeshes);
  scene.add(courtyards);

  return {
    waterPosts,
    update(_t, nightFactor) {
      glowMat.emissiveIntensity = 0.2 + nightFactor * 1.65;
    },
  };
}
