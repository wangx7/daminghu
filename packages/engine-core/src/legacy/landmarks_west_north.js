// 大明湖西区 & 北区 1:1 导览图真实设施补全模块
// 依据：大明湖现场官方导览牌 (01_gateboard_east) + 高德底图 (09_amap_base)
// 西区：藕香榭、龙泉池(+跨渠石桥)、鸳鸯亭、湖西码头、王尽美旧居、扇面亭、铁公祠对联石壁与园门、遐园碑廊石壁
// 北区：北渚台(明湖宝鼎石坛)、曾巩画壁、济南战役临时指挥部旧址、南丰戏楼、闻韶驿
import * as THREE from 'three';
import { Vox } from './voxel/vox.js';
import { buildSnowCap, createSignboard } from './collider.js';

const C = {
  STONE: 0xd8d2c5,
  STONE_D: 0x9e988c,
  MARBLE: 0xedeae2,
  BRICK: 0x6e737b,
  BRICK_D: 0x545961,
  WALL_W: 0xebe6db,
  RED: 0xa82a24,
  RED_D: 0x7e1d19,
  WOOD: 0x6e472b,
  WOOD_L: 0x91623d,
  ROOF: 0x3b444d,
  ROOF_GREEN: 0x2e6b52,
  GOLD: 0xf0c24b,
  LANTERN: 0xff4b2b,
  WATER: 0x2ca9c9,
  WATER_L: 0x67d8ef,
  LEAF: 0x3f8f3a,
  PINK: 0xff82a9,
  ROCK: 0x7a766d,
  ROCK_D: 0x5c5850,
};

function place(v, g, solidMat, glowMat, x, y, z, collider, snowMeshes, minSnowY = 5, rotY = 0) {
  const grp = new THREE.Group();
  grp.add(v.mesh(solidMat, 0.025));
  if (g) grp.add(g.mesh(glowMat, 0.01));
  const snow = buildSnowCap(v, minSnowY);
  grp.add(snow);
  snowMeshes.push(snow);
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;
  collider.registerVox(v, x, y, z, rotY);
  return grp;
}

// 1. 西区 · 藕香榭 (-772, 174)：按 swgate_aerial_top 1:1 精修（翠绿琉璃瓦重檐水榭 + Z字曲桥连岸 + 侧畔木码头 + 荷塘木桩围堰）
function buildOuxiangXie(solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), g = new Vox();
  // 临水石基挑台（船舫主体）
  v.box(-8, 0, -5, 8, 1, 5, (x, y, z) => ((x + z) & 1) ? C.STONE : C.STONE_D);
  for (let x = -8; x <= 8; x += 2) {
    v.set(x, 2, -5, C.RED_D).set(x, 2, 5, C.RED_D);
  }
  // 舫厅朱红立柱与花格木窗
  for (const px of [-7, -2, 2, 7]) {
    v.box(px, 2, -4, px, 6, -4, C.RED).box(px, 2, 4, px, 6, 4, C.RED);
  }
  v.box(-7, 2, -3, -7, 6, 3, C.WOOD).box(7, 2, -3, 7, 6, 3, C.WOOD);
  // 翠绿琉璃瓦重檐歇山顶（与实景航拍一致！）
  for (let s = 0; s < 3; s++) {
    v.box(-9 + s, 7 + s, -6 + s, 9 - s, 7 + s, 6 - s, C.ROOF_GREEN);
  }
  v.box(-5, 10, 0, 5, 10, 0, C.GOLD);
  g.set(-7, 6, -5, C.LANTERN).set(7, 6, -5, C.LANTERN);
  g.set(-7, 6, 5, C.LANTERN).set(7, 6, 5, C.LANTERN);

  // Z字形（zig-zag）汉白玉石栏曲桥：从西岸 (-822, 178) 完整接岸并宽敞折入水榭 (-780, 171)，3m 净宽且转角不封堵！
  const bridgeSegs = [
    [-50, 4, -22, 4],
    [-22, 4, -22, -2],
    [-22, -2, -8, -2],
  ];
  // 先铺全段桥面与水下木桩（宽 5 格：净通道 3 格 + 两侧石栏各 1 格）
  const deckSet = new Set();
  for (const [x0, z0, x1, z1] of bridgeSegs) {
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    const za = Math.min(z0, z1), zb = Math.max(z0, z1);
    v.box(xa - 2, 0, za - 2, xb + 2, 0, zb + 2, C.STONE);
    for (let x = xa - 1; x <= xb + 1; x++) {
      for (let z = za - 1; z <= zb + 1; z++) {
        deckSet.add(`${x},${z}`);
      }
    }
    if (za === zb) {
      for (let x = xa; x <= xb; x += 5) {
        v.box(x, -2, za - 2, x, -1, za - 2, C.WOOD).box(x, -2, za + 2, x, -1, za + 2, C.WOOD);
      }
    } else {
      for (let z = za; z <= zb; z += 4) {
        v.box(xa - 2, -2, z, xa - 2, -1, z, C.WOOD).box(xa + 2, -2, z, xa + 2, -1, z, C.WOOD);
      }
    }
  }
  // 只在桥面最外缘且不属于净通道/出入口的位置放石栏（转角与岸口/榭口完全畅通！）
  for (const [x0, z0, x1, z1] of bridgeSegs) {
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
    const za = Math.min(z0, z1), zb = Math.max(z0, z1);
    if (za === zb) {
      for (let x = xa - 2; x <= xb + 2; x++) {
        if (x <= -49 || x >= -9) continue; // 西岸入口与水榭入口不设栏
        if (!deckSet.has(`${x},${za - 2}`)) v.set(x, 1, za - 2, C.MARBLE);
        if (!deckSet.has(`${x},${za + 2}`)) v.set(x, 1, za + 2, C.MARBLE);
      }
    } else {
      for (let z = za - 2; z <= zb + 2; z++) {
        if (!deckSet.has(`${xa - 2},${z}`)) v.set(xa - 2, 1, z, C.MARBLE);
        if (!deckSet.has(`${xa + 2},${z}`)) v.set(xa + 2, 1, z, C.MARBLE);
      }
    }
  }
  // 水榭北侧亲水小木码头 + 荷塘木桩围堰
  v.box(-4, 0, -9, 1, 0, -6, C.WOOD_L);
  for (let x = 9; x <= 28; x += 2) {
    v.box(x, -1, 0, x, 1, 0, C.WOOD);
  }

  const grp = place(v, g, solidMat, glowMat, -772, 2, 174, collider, snowMeshes, 7, 0);
  const s1 = createSignboard({ title: '藕香榭', width: 4.4, height: 1.6, bgColor: '#162d54' });
  s1.position.set(0, 6.8, -5.2);
  s1.rotation.y = Math.PI;
  const s2 = createSignboard({ title: '涵清', width: 3.4, height: 1.4, bgColor: '#3a1410' });
  s2.position.set(0, 6.8, 5.2);
  grp.add(s1, s2);
  return grp;
}

// 2. 西区 · 龙泉池 (-795, 108) + 跨渠小石桥 (-795, 38)
function buildLongquanPool(solidMat, glowMat, collider, snowMeshes) {
  const root = new THREE.Group();
  // A) 龙泉池（太湖石叠石涌泉水池）
  {
    const v = new Vox(), g = new Vox();
    v.box(-7, 0, -6, 7, 0, 6, C.STONE_D);
    v.box(-6, 0, -5, 6, 0, 5, (x, y, z) => ((x + z) & 1) ? C.WATER : C.WATER_L);
    // 池周自然驳岸叠石
    for (let x = -7; x <= 7; x++) {
      v.set(x, 1, -6, (x & 1) ? C.ROCK : C.STONE).set(x, 1, 6, (x & 1) ? C.ROCK : C.STONE);
    }
    for (let z = -6; z <= 6; z++) {
      v.set(-7, 1, z, C.ROCK_D).set(7, 1, z, C.ROCK);
    }
    // 西侧引水叠石假山（泉水从叠石间涌出）
    v.box(-6, 1, -3, -3, 4, 2, (x, y, z) => ((x + y + z) & 1) ? C.ROCK : C.ROCK_D);
    v.box(-5, 5, -2, -4, 6, 1, C.ROCK);
    v.box(-3, 1, -1, -2, 2, 0, C.WATER_L);
    // 池畔石碑与石灯
    v.box(5, 1, 4, 6, 4, 5, C.STONE);
    g.set(6, 5, 5, C.LANTERN);
    const pg = place(v, g, solidMat, glowMat, -845, 2, 108, collider, snowMeshes, 4);
    const sign = createSignboard({ title: '龙泉池', subtitle: '引五龙潭清泉入湖', width: 4.0, height: 1.5, bgColor: '#1f3644' });
    sign.position.set(5.5, 3.2, 5.6);
    pg.add(sign);
    root.add(pg);
  }

  // B) 龙泉池北侧引水支渠单孔石拱桥 (-842, 38)
  {
    const v = new Vox();
    for (let z = -6; z <= 6; z++) {
      const t = (z + 6) / 12;
      const y = Math.round(Math.sin(t * Math.PI) * 1.6);
      v.box(-2, y, z, 2, y, z, (x) => (x & 1) ? C.STONE : C.STONE_D);
      v.set(-2, y + 1, z, C.MARBLE).set(2, y + 1, z, C.MARBLE);
      if (z % 4 === 0) v.set(-2, y + 2, z, C.MARBLE).set(2, y + 2, z, C.MARBLE);
    }
    root.add(place(v, null, solidMat, null, -842, 2, 38, collider, snowMeshes, 3));
  }
  return root;
}

// 3. 西区 · 鸳鸯亭 (-792, -62) + 湖西码头 (-772, -48)
function buildYuanyangAndHuxiDock(solidMat, glowMat, collider, snowMeshes) {
  const root = new THREE.Group();
  // A) 鸳鸯亭（标志性双体连檐凉亭）
  {
    const v = new Vox(), g = new Vox();
    v.box(-7, 0, -4, 7, 1, 4, C.STONE);
    // 左右两座相连亭身
    for (const cx of [-3, 3]) {
      for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
        v.box(cx + dx, 2, dz, cx + dx, 6, dz, C.RED);
      }
      v.box(cx - 3, 7, -3, cx + 3, 7, 3, C.ROOF);
      v.box(cx - 2, 8, -2, cx + 2, 8, 2, C.ROOF);
      v.box(cx - 1, 9, -1, cx + 1, 9, 1, C.ROOF);
      v.set(cx, 10, 0, C.GOLD);
      g.set(cx, 6, 0, C.LANTERN);
    }
    // 勾连脊瓦
    v.box(-2, 7, -2, 2, 7, 2, C.ROOF_GREEN);
    const yg = place(v, g, solidMat, glowMat, -792, 2, -62, collider, snowMeshes, 7, Math.PI / 2);
    const sign = createSignboard({ title: '鸳鸯亭', width: 3.6, height: 1.4, bgColor: '#3a1410' });
    sign.position.set(0, 6.8, 3.6);
    yg.add(sign);
    root.add(yg);
  }

  // B) 湖西码头 (-772, -48)
  {
    const v = new Vox(), g = new Vox();
    v.box(-4, 0, -7, 8, 0, 7, (x, y, z) => ((x + z) & 1) ? C.STONE : C.STONE_D);
    for (let z = -7; z <= 7; z += 3) {
      v.box(8, -2, z, 8, 2, z, C.WOOD);
    }
    v.box(-3, 1, -6, -3, 5, -6, C.RED).box(-3, 1, 6, -3, 5, 6, C.RED);
    v.box(-4, 6, -7, -2, 6, 7, C.ROOF);
    g.set(-3, 5, -5, C.LANTERN).set(-3, 5, 5, C.LANTERN);
    const dg = place(v, g, solidMat, glowMat, -772, 2, -48, collider, snowMeshes, 6);
    const sign = createSignboard({ title: '湖西码头', subtitle: '大明湖西岸游船', width: 4.4, height: 1.6, bgColor: '#162d54' });
    sign.position.set(-1.6, 5.2, 0);
    sign.rotation.y = Math.PI / 2;
    dg.add(sign);
    root.add(dg);
  }
  return root;
}

// 4. 西区 · 扇面亭 (-418, 108)（扇形平面特色古亭，紧邻玉带桥与扇面泉）
function buildShanmianPavilion(solidMat, glowMat, collider, snowMeshes) {
  const v = new Vox(), g = new Vox();
  // 扇形石台与扇形屋顶
  for (let z = -4; z <= 4; z++) {
    const halfX = Math.round(3 + (z + 4) * 0.55);
    v.box(-halfX, 0, z, halfX, 1, z, C.STONE);
    v.box(-halfX - 1, 7, z, halfX + 1, 7, z, C.ROOF);
    if (z >= -3 && z <= 3) v.box(-halfX, 8, z, halfX, 8, z, C.ROOF);
  }
  for (const [px, pz] of [[-3, -3], [3, -3], [-6, 3], [0, 3], [6, 3]]) {
    v.box(px, 2, pz, px, 6, pz, C.RED);
  }
  g.set(0, 6, 0, C.LANTERN);
  const grp = place(v, g, solidMat, glowMat, -418, 2, 108, collider, snowMeshes, 7, 0.15);
  const sign = createSignboard({ title: '扇面亭', width: 3.6, height: 1.4, bgColor: '#162d54' });
  sign.position.set(0, 6.8, -4.4);
  sign.rotation.y = Math.PI;
  grp.add(sign);
  return grp;
}

// 5. 西区 · 铁公祠对联石壁 & 园门 (-518, -280) + 遐园碑廊石壁 (-408, 192)
function buildWestRockWalls(solidMat, glowMat, collider, snowMeshes) {
  const root = new THREE.Group();

  // A) 铁公祠小沧浪月洞门长廊与对联石壁 (-518, -280)（按实拍 06_moongate_couplet 1:1 精修！）
  {
    const v = new Vox(), g = new Vox();
    // 灰瓦红柱白墙月洞门长廊（中央留圆拱月洞门通行，两侧嵌壁对联）
    v.box(-8, 0, -2, 8, 0, 2, C.STONE_D);
    v.box(-8, 1, 0, 8, 6, 0, (x, y) => y <= 2 ? C.BRICK : C.WALL_W);
    // 掏出中央圆拱月洞门 (半径 ~2.5 格)
    for (let x = -2; x <= 2; x++) {
      const maxY = Math.abs(x) === 2 ? 4 : 5;
      for (let y = 1; y <= maxY; y++) v.del(x, y, 0);
    }
    // 廊前朱红立柱与灰瓦双坡廊顶
    for (const px of [-7, -3, 3, 7]) {
      v.box(px, 1, 2, px, 6, 2, C.RED).box(px, 1, -2, px, 6, -2, C.RED);
    }
    v.box(-9, 7, -3, 9, 7, 3, C.ROOF);
    v.box(-8, 8, -1, 8, 8, 1, C.ROOF);
    g.set(0, 6, 1, C.LANTERN).set(-6, 6, 1, C.LANTERN).set(6, 6, 1, C.LANTERN);

    const wg = place(v, g, solidMat, glowMat, -498, 2, -278, collider, snowMeshes, 7, -0.25);
    const title = createSignboard({ title: '小沧浪', subtitle: '月洞门长廊', width: 3.6, height: 1.3, bgColor: '#2c2520' });
    title.position.set(0, 6.4, 2.5);
    const cL = createSignboard({ title: '四面荷花三面柳', width: 0.9, height: 4.4, vertical: true, bgColor: '#3a1410', textColor: '#f4ebd0' });
    cL.position.set(-4.8, 3.8, 0.72);
    const cR = createSignboard({ title: '一城山色半城湖', width: 0.9, height: 4.4, vertical: true, bgColor: '#3a1410', textColor: '#f4ebd0' });
    cR.position.set(4.8, 3.8, 0.72);
    wg.add(title, cL, cR);
    root.add(wg);
  }

  // B) 遐园碑廊石壁 (-408, 192)（嵌壁历代名家碑刻长壁）
  {
    const v = new Vox(), g = new Vox();
    v.box(-1, 0, -12, 1, 1, 12, C.STONE_D);
    v.box(0, 2, -12, 0, 6, 12, (x, y, z) => (z % 4 === 0) ? C.WALL_W : C.ROCK_D);
    v.box(-2, 7, -13, 2, 7, 13, C.ROOF);
    for (let z = -10; z <= 10; z += 5) {
      v.box(2, 1, z, 2, 6, z, C.RED);
      if (z % 10 === 0) g.set(1, 6, z, C.LANTERN);
    }
    const bg = place(v, g, solidMat, glowMat, -408, 2, 192, collider, snowMeshes, 7);
    const sign = createSignboard({ title: '遐园碑廊', subtitle: '历代名士石刻', width: 4.2, height: 1.5, bgColor: '#2b2b2b' });
    sign.position.set(1.1, 5.4, 0);
    sign.rotation.y = Math.PI / 2;
    bg.add(sign);
    root.add(bg);
  }
  return root;
}

// 6. 西区 · 王尽美旧居 (-605, 118) + 西南门游客中心 (-795, 225)
function buildWestHistoricBuildings(solidMat, glowMat, collider, snowMeshes) {
  const root = new THREE.Group();
  const buildCourtyardHall = (name, subtitle, x, z, rx, rz, rotY) => {
    const v = new Vox(), g = new Vox();
    v.box(-rx - 1, 0, -rz - 1, rx + 1, 1, rz + 1, C.STONE);
    v.box(-rx, 2, -rz, rx, 7, rz, (px, py, pz) => (Math.abs(px) === rx || Math.abs(pz) === rz) ? C.BRICK : C.WALL_W);
    for (let s = 0; s < 3; s++) v.box(-rx - 1 + s, 8 + s, -rz - 1 + s, rx + 1 - s, 8 + s, rz + 1 - s, C.ROOF);
    v.box(-rx + 3, 11, 0, rx - 3, 11, 0, C.GOLD);
    g.set(-rx + 1, 6, rz + 1, C.LANTERN).set(rx - 1, 6, rz + 1, C.LANTERN);
    const grp = place(v, g, solidMat, glowMat, x, 2, z, collider, snowMeshes, 8, rotY);
    const sign = createSignboard({ title: name, subtitle, width: 5.2, height: 1.9, bgColor: '#1f2937' });
    sign.position.set(0, 7.2, rz + 0.9);
    grp.add(sign);
    return grp;
  };
  root.add(buildCourtyardHall('王尽美旧居', '中共一大代表纪念地', -605, 118, 9, 6, 0));
  return root;
}

// 7. 北区 · 北渚台（明湖宝鼎三层石坛）(-58, -368) + 曾巩画壁 (-58, -338)
function buildBeizhuAltarAndMural(solidMat, glowMat, collider, snowMeshes) {
  const root = new THREE.Group();

  // A) 北渚台（托起明湖宝鼎的三层汉白玉须弥座石坛 + 四向石阶 + 望柱栏板）
  {
    const v = new Vox(), g = new Vox();
    // 第一层石坛基座 (22×22m)
    v.box(-11, 0, -11, 11, 1, 11, (x, y, z) => ((x + z) & 1) ? C.STONE : C.STONE_D);
    // 第二层汉白玉坛台 (16×16m)
    v.box(-8, 2, -8, 8, 3, 8, C.MARBLE);
    // 坛周汉白玉望柱护栏（四面正中留 5m 宽御道台阶口）
    for (let i = -11; i <= 11; i += 2) {
      if (Math.abs(i) > 3) {
        v.set(i, 2, -11, C.MARBLE).set(i, 2, 11, C.MARBLE);
        v.set(-11, 2, i, C.MARBLE).set(11, 2, i, C.MARBLE);
      }
    }
    for (let i = -8; i <= 8; i += 2) {
      if (Math.abs(i) > 2) {
        v.set(i, 4, -8, C.MARBLE).set(i, 4, 8, C.MARBLE);
        v.set(-8, 4, i, C.MARBLE).set(8, 4, i, C.MARBLE);
      }
    }
    // 四向可登石阶
    v.box(-2, 1, 9, 2, 2, 11, C.STONE);
    v.box(-2, 1, -11, 2, 2, -9, C.STONE);
    v.box(9, 1, -2, 11, 2, 2, C.STONE);
    v.box(-11, 1, -2, -9, 2, 2, C.STONE);
    // 四角仿古宫灯柱
    for (const [lx, lz] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
      v.box(lx, 2, lz, lx, 5, lz, C.STONE);
      g.set(lx, 6, lz, C.LANTERN);
    }
    const ag = place(v, g, solidMat, glowMat, -58, 2, -368, collider, snowMeshes, 4);
    const sign = createSignboard({ title: '北渚台', subtitle: '明湖宝鼎石坛', width: 4.4, height: 1.6, bgColor: '#2c2018' });
    sign.position.set(0, 3.8, 11.6);
    ag.add(sign);
    root.add(ag);
  }

  // B) 曾巩画壁 (-58, -338)（北渚台正南临湖大型青石雕花画壁）
  {
    const v = new Vox(), g = new Vox();
    v.box(-11, 0, -1, 11, 1, 1, C.STONE_D);
    v.box(-10, 2, 0, 10, 7, 0, (x, y) => {
      if (Math.abs(x) === 10 || y === 2 || y === 7) return C.MARBLE;
      return ((x + y) % 3 === 0) ? C.STONE : C.ROCK;
    });
    v.box(-12, 8, -2, 12, 8, 2, C.ROOF);
    v.box(-10, 9, -1, 10, 9, 1, C.ROOF);
    v.box(-8, 10, 0, 8, 10, 0, C.GOLD);
    g.set(-10, 6, 1, C.LANTERN).set(10, 6, 1, C.LANTERN);
    const mg = place(v, g, solidMat, glowMat, -58, 2, -338, collider, snowMeshes, 8);
    const sign = createSignboard({ title: '曾巩画壁', subtitle: '北宋齐州知州治水长卷', width: 6.2, height: 2.0, bgColor: '#2c2520' });
    sign.position.set(0, 5.2, 0.9);
    mg.add(sign);
    root.add(mg);
  }
  return root;
}

// 8. 北区 · 济南战役临时指挥部旧址 (161, -395) + 南丰戏楼 (317, -284) + 闻韶驿 (582, -348)
function buildNorthExtraLandmarks(solidMat, glowMat, collider, snowMeshes) {
  const root = new THREE.Group();

  // A) 济南战役临时指挥部旧址 (161, -395)
  {
    const v = new Vox(), g = new Vox();
    v.box(-11, 0, -6, 11, 1, 6, C.STONE);
    v.box(-10, 2, -5, 10, 7, 5, (x, y, z) => (Math.abs(x) === 10 || Math.abs(z) === 5) ? C.BRICK : C.WALL_W);
    for (let s = 0; s < 3; s++) v.box(-11 + s, 8 + s, -6 + s, 11 - s, 8 + s, 6 - s, C.ROOF);
    g.set(-6, 6, 6, C.LANTERN).set(6, 6, 6, C.LANTERN);
    const jg = place(v, g, solidMat, glowMat, 161, 2, -395, collider, snowMeshes, 8);
    const sign = createSignboard({ title: '济南战役临时指挥部旧址', width: 6.8, height: 1.9, bgColor: '#5c1818' });
    sign.position.set(0, 7.2, 5.9);
    jg.add(sign);
    root.add(jg);
  }

  // B) 南丰戏楼 (317, -284)（清光绪二十年双层木质古戏楼，南丰祠正南临湖）
  {
    const v = new Vox(), g = new Vox();
    v.box(-9, 0, -7, 9, 2, 7, C.STONE);
    // 一层戏台挑檐与朱红立柱
    for (const px of [-7, -3, 3, 7]) {
      v.box(px, 3, -5, px, 7, -5, C.RED).box(px, 3, 5, px, 7, 5, C.RED);
    }
    v.box(-7, 3, -5, 7, 7, -5, C.WOOD);
    v.box(-10, 8, -7, 10, 8, 7, C.ROOF);
    // 二层重檐戏楼
    v.box(-6, 9, -4, 6, 13, 4, (x, y, z) => (Math.abs(x) === 6 || Math.abs(z) === 4) ? C.RED : C.WALL_W);
    for (let s = 0; s < 3; s++) v.box(-8 + s, 14 + s, -6 + s, 8 - s, 14 + s, 6 - s, C.ROOF);
    v.box(-4, 17, 0, 4, 17, 0, C.GOLD);
    g.set(-7, 7, 6, C.LANTERN).set(7, 7, 6, C.LANTERN);
    g.set(-5, 13, 5, C.LANTERN).set(5, 13, 5, C.LANTERN);
    const ng = place(v, g, solidMat, glowMat, 326, 2, -296, collider, snowMeshes, 8);
    const sign = createSignboard({ title: '南丰戏楼', subtitle: '清光绪古戏台', width: 4.8, height: 1.8, bgColor: '#3a1410' });
    sign.position.set(0, 12.6, 4.9);
    ng.add(sign);
    root.add(ng);
  }

  // C) 闻韶驿 (582, -348)（东门东侧曲艺文化仿古院落）
  {
    const v = new Vox(), g = new Vox();
    v.box(-11, 0, -8, 11, 1, 8, C.STONE);
    v.box(-10, 2, -7, 10, 7, 7, (x, y, z) => (Math.abs(x) === 10 || Math.abs(z) === 7) ? C.RED : C.WALL_W);
    for (let s = 0; s < 4; s++) v.box(-12 + s, 8 + s, -9 + s, 12 - s, 8 + s, 9 - s, C.ROOF);
    v.box(-6, 12, 0, 6, 12, 0, C.GOLD);
    g.set(-9, 7, 8, C.LANTERN).set(9, 7, 8, C.LANTERN);
    const wg = place(v, g, solidMat, glowMat, 582, 2, -348, collider, snowMeshes, 8);
    const sign = createSignboard({ title: '闻韶驿', subtitle: '曲山艺海 · 东门雅集', width: 4.8, height: 1.8, bgColor: '#162d54' });
    sign.position.set(0, 7.6, 7.9);
    wg.add(sign);
    root.add(wg);
  }

  return root;
}

export function buildWestNorthLandmarks(scene, solidMat, collider, snowMeshes) {
  const glowMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color(0xff9933),
    emissiveIntensity: 0.32,
  });

  scene.add(buildOuxiangXie(solidMat, glowMat, collider, snowMeshes));
  scene.add(buildLongquanPool(solidMat, glowMat, collider, snowMeshes));
  scene.add(buildYuanyangAndHuxiDock(solidMat, glowMat, collider, snowMeshes));
  scene.add(buildShanmianPavilion(solidMat, glowMat, collider, snowMeshes));
  scene.add(buildWestRockWalls(solidMat, glowMat, collider, snowMeshes));
  scene.add(buildWestHistoricBuildings(solidMat, glowMat, collider, snowMeshes));
  scene.add(buildBeizhuAltarAndMural(solidMat, glowMat, collider, snowMeshes));
  scene.add(buildNorthExtraLandmarks(solidMat, glowMat, collider, snowMeshes));

  return {
    update(nightFactor) {
      glowMat.emissiveIntensity = 0.25 + nightFactor * 1.65;
    },
  };
}
