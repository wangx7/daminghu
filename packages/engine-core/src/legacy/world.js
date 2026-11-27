// Chunk 分块大世界体素地形引擎（5.0 全 3D 实体 & 轻功踏荷 / 坐荷赏景升级版）
// - 彻底移除所有零厚度 2D 单面荷叶/花瓣，100% 升级为带厚度、V 形叶缺口、微翘卷边与露珠的 3D 体素荷叶与多层立体荷花
// - 全湖精选布置「3D 盛放荷花宝座 & 碧玉王莲」弹性独立实体，支持团团轻功踩荷连跳与按 E 坐进荷花心赏景
// - 岸畔增植 3D 菖蒲香蒲芦苇丛与浅水底鹅卵石水草（配合高通透浅滩清澈见底！）
// - 码头、长椅、石凳全量注册 3D 碰撞与可坐锚点
import * as THREE from 'three';
import { Vox, Builder, hash, linc } from './voxel/vox.js';
import { lotusPad, lotusFlower } from './voxel/props.js';
import {
  WORLD, TERRAIN, sampleTerrain, LOTUS_ZONES, DOCKS, LANDMARKS, getWaterSignedDist,
} from './map_data.js';

export const SEASON_PALETTES = {
  spring: {
    name: '春风柳絮',
    icon: '🌸',
    grass1: linc(0x74bf4e),
    grass2: linc(0x63ad42),
    grass3: linc(0x88cc5e),
    path1: linc(0xd1cbb8),
    path2: linc(0xc2bba8),
    bank: linc(0xa8a396),
    bankDark: linc(0x88847a),
    plaza1: linc(0xe0d9c8),
    plaza2: linc(0xd1c9b6),
    mud: linc(0x5d857a),
    pebble: linc(0x8ca89c),
    dirt: linc(0x7d6548),
    willowLeaf: [0x82cf4a, 0x99dc5c, 0xffb7cc],
    lotusLeaf: [0x479e4a, 0x5ab056, 0x3b8c3f],
    lotusFlower: [0xffc4d6, 0xfff0f5],
    showLotus: false,
    snow: false,
  },
  summer: {
    name: '荷风盛夏',
    icon: '🌿',
    grass1: linc(0x5eb546),
    grass2: linc(0x4ea13b),
    grass3: linc(0x6ec452),
    path1: linc(0xcfc9b8),
    path2: linc(0xbfb8a6),
    bank: linc(0xa49f94),
    bankDark: linc(0x858076),
    plaza1: linc(0xded7c5),
    plaza2: linc(0xcfc7b4),
    mud: linc(0x528278),
    pebble: linc(0x88a89a),
    dirt: linc(0x7d6548),
    willowLeaf: [0x4ca838, 0x5ec046, 0x3f912f],
    lotusLeaf: [0x359c42, 0x45b252, 0x2b8538],
    lotusFlower: [0xff8fb3, 0xffb8cf, 0xffffff],
    showLotus: true,
    snow: false,
  },
  autumn: {
    name: '秋水红枫',
    icon: '🍁',
    grass1: linc(0xb89642),
    grass2: linc(0xa68236),
    grass3: linc(0xc9a64f),
    path1: linc(0xc9bfa8),
    path2: linc(0xb8ad97),
    bank: linc(0x968f82),
    bankDark: linc(0x787268),
    plaza1: linc(0xd9cfb8),
    plaza2: linc(0xc9bfa6),
    mud: linc(0x58736c),
    pebble: linc(0x859188),
    dirt: linc(0x785c3e),
    willowLeaf: [0xe6a129, 0xd96226, 0xf2c037],
    lotusLeaf: [0x8c7b38, 0x786830, 0x9c8b42],
    lotusFlower: [0xffcad4, 0xf5ebe0],
    showLotus: true,
    snow: false,
  },
  winter: {
    name: '大明雪韵',
    icon: '❄️',
    grass1: linc(0xeef5fc),
    grass2: linc(0xdfeaf5),
    grass3: linc(0xf7fbff),
    path1: linc(0xd8e2ed),
    path2: linc(0xc8d4e0),
    bank: linc(0xa8b4c2),
    bankDark: linc(0x8894a3),
    plaza1: linc(0xe8eff7),
    plaza2: linc(0xd7e1ec),
    mud: linc(0x6b8294),
    pebble: linc(0x9cb0c2),
    dirt: linc(0x8a8a94),
    willowLeaf: [0xeaf4ff, 0xd5e6f7, 0x9eb2c4],
    lotusLeaf: [0xdde8f2],
    lotusFlower: [0xffffff],
    showLotus: false,
    snow: true,
  },
};

// 全湖精选「3D 可踩踏王莲 & 可坐盛放荷花宝座」坐标配置（靠近码头与荷塘栈道，方便团团随时踏荷连跳、坐花拍照！）
export const HERO_LOTUS_SPOTS = [
  // 南门码头荷塘踏荷连跳小径（从码头岸边一路连跳坐进中心大粉莲/白莲！）
  { x: -210, z: 160, kind: 'pad', r: 2.1 },
  { x: -205, z: 156, kind: 'pink', r: 2.3, seat: true, name: '南门粉莲宝座' },
  { x: -200, z: 151, kind: 'pad', r: 2.0 },
  { x: -195, z: 146, kind: 'white', r: 2.4, seat: true, name: '明湖白莲宝座' },
  // 司家码头荷塘踏荷群
  { x: 10,   z: 136, kind: 'pad', r: 2.1 },
  { x: 15,   z: 131, kind: 'pink', r: 2.3, seat: true, name: '司家红莲宝座' },
  { x: 21,   z: 127, kind: 'white', r: 2.3, seat: true, name: '秋柳玉莲宝座' },
  // 超然楼西侧观景荷塘（坐荷花正对超然楼拍绝美明信片！）
  { x: 454,  z: -62, kind: 'pad', r: 2.1 },
  { x: 448,  z: -58, kind: 'pink', r: 2.4, seat: true, name: '超然映日红莲' },
  { x: 442,  z: -63, kind: 'white', r: 2.3, seat: true, name: '超然凌波白莲' },
  // 铁公祠小沧浪荷塘（「四面荷花三面柳」核心赏荷点）
  { x: -488, z: -250, kind: 'pad', r: 2.1 },
  { x: -482, z: -245, kind: 'pink', r: 2.4, seat: true, name: '沧浪荷韵宝座' },
  { x: -476, z: -240, kind: 'white', r: 2.2, seat: true, name: '小沧浪白莲' },
  // 历下亭岛畔与小东湖荷塘
  { x: -30,  z: 18,  kind: 'pink', r: 2.3, seat: true, name: '历下亭畔红莲' },
  { x: 734,  z: -114, kind: 'pad', r: 2.1 },
  { x: 728,  z: -109, kind: 'white', r: 2.4, seat: true, name: '东湖玉莲宝座' },
];

export class ChunkWorld {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Material} mat
   * @param {any} [collider]
   */
  constructor(scene, mat, collider = null) {
    this.scene = scene;
    this.mat = mat;
    this.collider = collider;
    this.chunks = new Map();
    this.group = new THREE.Group();
    scene.add(this.group);
    this.palette = SEASON_PALETTES.summer;

    this.lampMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      emissive: new THREE.Color(0xffc252),
      emissiveIntensity: 0.15,
    });

    this.lotusGlowMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      emissive: new THREE.Color(0xffeef4),
      emissiveIntensity: 0.12,
    });

    this.viewRadius = 5;
    this.lastCX = null;
    this.lastCZ = null;
    this.season = 'summer';

    // 注册全湖木栈道码头的永久 3D 支撑碰撞盒（杜绝踏上码头掉水里！）
    if (this.collider) {
      for (const dk of DOCKS) {
        this.collider.addBoxVolume(dk.x - 3.2, -1.5, dk.z - 4.2, dk.x + 3.8, 2.0, dk.z + 4.8);
      }
    }

    // 构建全湖精选可踩踏 / 可坐赏景的 3D 独立弹性王莲与盛放荷花宝座
    this.heroLotusGroup = new THREE.Group();
    scene.add(this.heroLotusGroup);
    this.heroLotuses = [];
    this._buildHeroInteractiveLotuses();
  }

  _buildHeroInteractiveLotuses() {
    const padGeo = lotusPad(7, 3).geometry(0.02);
    const pinkFlowerGeo = lotusFlower('pink', 3).geometry(0.018);
    const whiteFlowerGeo = lotusFlower('white', 3).geometry(0.018);

    // 构建一个专属饱满低矮的 3D 盛放荷花花冠（让团团坐进花心时花瓣环绕四周却绝不遮挡萌脸！）
    const makeThroneFlowerGeo = (isWhite) => {
      const v = new Vox();
      const P1 = isWhite ? 0xffffff : 0xffdfea;
      const P2 = isWhite ? 0xf0f7ff : 0xff9ebb;
      const P3 = isWhite ? 0xddeee6 : 0xff6b9d;
      // 水下立体粗荷梗
      v.box(0, -6, 0, 0, -1, 0, 0x2d7a36);
      // 底层碧绿大托叶盘（直径 13 格）
      for (let x = -6; x <= 6; x++) {
        for (let z = -6; z <= 6; z++) {
          const d = Math.hypot(x, z);
          if (d <= 6.2) v.set(x, 0, z, d > 5.0 ? 0x48b252 : 0x35963f);
        }
      }
      // 外圈盛放仰瓣（舒展环绕）
      for (let x = -5; x <= 5; x++) {
        for (let z = -5; z <= 5; z++) {
          const d = Math.hypot(x, z);
          if (d >= 3.2 && d <= 5.2) {
            const lobe = Math.abs(Math.sin(Math.atan2(z, x) * 4)) > 0.25;
            if (lobe) v.set(x, d > 4.2 ? 2 : 1, z, d > 4.2 ? P3 : P2);
          }
        }
      }
      // 内圈柔粉/玉白花瓣碗 + 中央平整金黄莲蓬宝座（团团稳稳坐在莲蓬上！）
      for (let x = -3; x <= 3; x++) {
        for (let z = -3; z <= 3; z++) {
          const d = Math.hypot(x, z);
          if (d <= 2.3) v.set(x, 1, z, ((x + z) & 1) ? 0xffd447 : 0xf4b928); // 金黄莲蓬座垫
          else if (d <= 3.4) v.set(x, 2, z, P1);
        }
      }
      return v.geometry(0.018);
    };

    const pinkThroneGeo = makeThroneFlowerGeo(false);
    const whiteThroneGeo = makeThroneFlowerGeo(true);

    HERO_LOTUS_SPOTS.forEach((sp, idx) => {
      if (!sampleTerrain(sp.x, sp.z).isWater) return;
      const g = new THREE.Group();
      if (sp.kind === 'pad') {
        const m = new THREE.Mesh(padGeo, this.mat);
        m.scale.setScalar(0.32);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
        // 荷叶边缘伴生一朵立体小粉莲装饰
        const sideF = new THREE.Mesh(idx % 2 === 0 ? pinkFlowerGeo : whiteFlowerGeo, this.lotusGlowMat);
        sideF.scale.setScalar(0.28);
        sideF.position.set(1.3, -0.35, -1.1);
        g.add(sideF);
      } else {
        const m = new THREE.Mesh(sp.kind === 'white' ? whiteThroneGeo : pinkThroneGeo, this.lotusGlowMat);
        m.scale.setScalar(0.38);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      }
      const baseY = 0.12;
      g.position.set(sp.x, baseY, sp.z);
      this.heroLotusGroup.add(g);

      const padEntry = {
        id: `hero_lotus_${idx}`,
        x: sp.x,
        z: sp.z,
        r: sp.r,
        topY: sp.kind === 'pad' ? 0.32 : 0.56,
        sink: 0,
        targetSink: 0,
        baseY,
        ph: idx * 1.37,
        group: g,
        seatId: sp.seat ? `seat_lotus_${idx}` : null,
        seatCfg: sp.seat ? {
          id: `seat_lotus_${idx}`,
          type: 'lotus',
          label: `🌸 按 E 键坐进 3D「${sp.name}」花心赏湖拍照`,
          x: sp.x,
          y: 0.62,
          z: sp.z,
          yaw: Math.atan2(-sp.x, -sp.z),
          interactRadius: 4.8,
          padRef: null,
        } : null,
      };
      if (padEntry.seatCfg) padEntry.seatCfg.padRef = padEntry;
      this.heroLotuses.push(padEntry);
    });

    this._syncHeroLotusSeason(true);
  }

  _syncHeroLotusSeason(enabled) {
    this.heroLotusGroup.visible = enabled;
    if (!this.collider) return;
    for (const h of this.heroLotuses) {
      if (enabled) {
        this.collider.addLotusPad(h);
        if (h.seatCfg) this.collider.addSeat(h.seatCfg);
      } else {
        this.collider.removeLotusPad(h.id);
        if (h.seatId) this.collider.removeSeat(h.seatId);
      }
    }
  }

  setNightFactor(nightFactor) {
    this.lampMat.emissiveIntensity = 0.12 + nightFactor * 2.1;
    this.lotusGlowMat.emissiveIntensity = 0.1 + nightFactor * 0.45;
  }

  // 每帧更新 3D 荷叶与荷花宝座的随波轻晃 & 团团踩/坐时的真实弹性下沉！
  updateHeroLotuses(elapsed, dt, player) {
    if (!this.heroLotusGroup.visible) return;
    for (const h of this.heroLotuses) {
      const d = player ? Math.hypot(player.pos.x - h.x, player.pos.z - h.z) : 999;
      const standingOn = d <= h.r + 0.25 && player && Math.abs(player.pos.y - h.topY) < 1.1;
      const sittingOn = player && player.sittingSeat && player.sittingSeat.id === h.seatId;
      h.targetSink = (standingOn || sittingOn) ? 0.18 : 0;
      h.sink = THREE.MathUtils.lerp(h.sink, h.targetSink, Math.min(1, dt * 10));
      const wave = Math.sin(elapsed * 2.1 + h.ph) * 0.045;
      h.group.position.y = h.baseY + wave - h.sink;
      h.group.rotation.z = Math.sin(elapsed * 1.6 + h.ph) * 0.025;
      if (h.seatCfg) h.seatCfg.y = 0.56 + wave - h.sink;
    }
  }

  // 切换春夏秋冬：清空当前 Chunk 缓存并立即重建玩家周边区块
  setSeason(seasonKey, px, pz) {
    if (!SEASON_PALETTES[seasonKey]) return;
    this.season = seasonKey;
    this.palette = SEASON_PALETTES[seasonKey];
    this._syncHeroLotusSeason(!!this.palette.showLotus);
    for (const [, entry] of this.chunks) {
      this.group.remove(entry.group);
      entry.dispose();
    }
    this.chunks.clear();
    this.lastCX = null;
    this.lastCZ = null;
    this.primeAround(px, pz, 1);
  }

  update(px, pz, maxBuildPerFrame = 3) {
    const cx = Math.floor(px / WORLD.CHUNK_SIZE);
    const cz = Math.floor(pz / WORLD.CHUNK_SIZE);
    const R = this.viewRadius;

    if (cx !== this.lastCX || cz !== this.lastCZ) {
      for (const [key, entry] of this.chunks) {
        if (Math.abs(entry.cx - cx) > R + 1 || Math.abs(entry.cz - cz) > R + 1) {
          this.group.remove(entry.group);
          entry.dispose();
          this.chunks.delete(key);
        }
      }
      this.lastCX = cx;
      this.lastCZ = cz;
    }

    const missing = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
        const tcx = cx + dx, tcz = cz + dz;
        const x0 = tcx * WORLD.CHUNK_SIZE, z0 = tcz * WORLD.CHUNK_SIZE;
        if (x0 + WORLD.CHUNK_SIZE < WORLD.MIN_X || x0 > WORLD.MAX_X) continue;
        if (z0 + WORLD.CHUNK_SIZE < WORLD.MIN_Z || z0 > WORLD.MAX_Z) continue;
        const key = `${tcx},${tcz}`;
        if (!this.chunks.has(key)) {
          missing.push({ cx: tcx, cz: tcz, key, d2: dx * dx + dz * dz });
        }
      }
    }
    missing.sort((a, b) => a.d2 - b.d2);

    const count = Math.min(maxBuildPerFrame, missing.length);
    for (let i = 0; i < count; i++) {
      const m = missing[i];
      const entry = this._buildChunk(m.cx, m.cz);
      this.chunks.set(m.key, entry);
      this.group.add(entry.group);
    }
  }

  primeAround(px, pz, radius = 3) {
    const cx = Math.floor(px / WORLD.CHUNK_SIZE);
    const cz = Math.floor(pz / WORLD.CHUNK_SIZE);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tcx = cx + dx, tcz = cz + dz;
        const key = `${tcx},${tcz}`;
        if (!this.chunks.has(key)) {
          const entry = this._buildChunk(tcx, tcz);
          this.chunks.set(key, entry);
          this.group.add(entry.group);
        }
      }
    }
  }

  _buildChunk(cx, cz) {
    const S = WORLD.CHUNK_SIZE;
    const X0 = cx * S, Z0 = cz * S;
    const pad = 1;
    const W = S + pad * 2;
    const H = new Int16Array(W * W);
    const T = new Uint8Array(W * W);

    for (let lz = -pad; lz < S + pad; lz++) {
      for (let lx = -pad; lx < S + pad; lx++) {
        const wx = X0 + lx, wz = Z0 + lz;
        const res = sampleTerrain(wx, wz);
        const idx = (lz + pad) * W + (lx + pad);
        // 近岸浅水区水底呈现自然阶梯浅滩（-1 ~ -2m），配合清透水面清晰可见水底叠石与游鱼！
        if (res.isWater) {
          const wd = getWaterSignedDist(wx, wz);
          H[idx] = wd < 3.2 ? -1 : -2;
        } else {
          H[idx] = res.height;
        }
        T[idx] = res.type;
      }
    }

    const getH = (wx, wz) => {
      const lx = wx - X0 + pad, lz = wz - Z0 + pad;
      if (lx < 0 || lx >= W || lz < 0 || lz >= W) return sampleTerrain(wx, wz).height;
      return H[lz * W + lx];
    };
    const solid = (wx, wy, wz) => wy < getH(wx, wz);

    const b = new Builder();
    const P = this.palette;
    const NB = [[1, 0, 0, 1], [-1, 0, 0, -1], [0, 1, 2, 1], [0, -1, 2, -1]];

    const pickColor = (wx, wy, wz, h, type) => {
      const r = hash(wx, wz, 7);
      if (type === TERRAIN.WATER) return (h >= -1 && r < 0.48) ? P.pebble : P.mud;
      if (wy < h - 1) {
        if (type === TERRAIN.STONE_BANK || type === TERRAIN.PLAZA || type === TERRAIN.ROAD) return r < 0.5 ? P.bank : P.bankDark;
        return P.dirt;
      }
      if (type === TERRAIN.STONE_BANK) return r < 0.5 ? P.bank : P.bankDark;
      if (type === TERRAIN.WALKWAY) return ((wx + wz) & 1) === 0 ? P.path1 : P.path2;
      if (type === TERRAIN.ROAD) {
        if (P.snow) return r < 0.5 ? P.path1 : P.path2;
        return ((wx + wz) & 1) === 0 ? linc(0x5d626b) : linc(0x545961);
      }
      if (type === TERRAIN.PLAZA) {
        const tile = (Math.floor(wx / 2) + Math.floor(wz / 2)) & 1;
        return tile === 0 ? P.plaza1 : P.plaza2;
      }
      return r < 0.35 ? P.grass1 : (r < 0.7 ? P.grass2 : P.grass3);
    };

    for (let lz = 0; lz < S; lz++) {
      for (let lx = 0; lx < S; lx++) {
        const wx = X0 + lx, wz = Z0 + lz;
        const idx = (lz + pad) * W + (lx + pad);
        const h = H[idx];
        const type = T[idx];
        // 深水区（离岸超过 18m）水底被深蔚蓝水色柔和覆盖，跳过底面加速构建；近岸 18m 内完整渲染清澈浅滩水底！
        if (type === TERRAIN.WATER && getWaterSignedDist(wx, wz) > 18) continue;

        const top = pickColor(wx, h - 1, wz, h, type);
        const j = 0.96 + hash(wx * 3.1, wz * 5.3) * 0.08;
        b.face(wx, h - 1, wz, 1, 1, top[0] * j, top[1] * j, top[2] * j, solid);

        for (const [dx, dz, a, s] of NB) {
          const hn = H[(lz + dz + pad) * W + (lx + dx + pad)];
          if (hn < h) {
            const yStart = Math.max(hn, -2);
            for (let y = yStart; y < h; y++) {
              const c = pickColor(wx, y, wz, h, type);
              b.face(wx, y, wz, a, s, c[0] * j, c[1] * j, c[2] * j, solid);
            }
          }
        }
      }
    }

    const chunkGroup = new THREE.Group();
    const disposables = [];
    const propCoords = [];
    const padIds = [];
    const seatIds = [];

    if (b.n > 0) {
      const geo = b.geometry();
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      chunkGroup.add(mesh);
      disposables.push(geo);
    }

    this._populateFlora(chunkGroup, disposables, propCoords, padIds, seatIds, X0, Z0, S);

    return {
      cx,
      cz,
      group: chunkGroup,
      dispose: () => {
        for (const g of disposables) g.dispose();
        if (this.collider) {
          for (const [px, pz] of propCoords) this.collider.removePropColumn(px, pz);
          for (const pid of padIds) this.collider.removeLotusPad(pid);
          for (const sid of seatIds) this.collider.removeSeat(sid);
        }
      },
    };
  }

  _populateFlora(group, disposables, propCoords, padIds, seatIds, X0, Z0, S) {
    const P = this.palette;
    const b = new Builder();
    const lampB = new Builder();
    const emptySolid = () => false;

    // 任意尺寸 3D 实心六面体构建器（支持浮点厚度与微高度，彻底告别任何单面 2D 薄片！）
    const addBox3D = (target, x0, y0, z0, w, h, d, hex) => {
      const c = linc(hex);
      const x1 = x0 + w, y1 = y0 + h, z1 = z0 + d;
      const j = 0.94 + hash(Math.round(x0 * 2), Math.round(z0 * 2)) * 0.12;
      const r = c[0] * j, g = c[1] * j, bl = c[2] * j;
      const pushFace = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, sh) => {
        const p = target.n;
        target.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
        target.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
        const cr = r * sh, cg = g * sh, cb = bl * sh;
        target.col.push(cr, cg, cb, cr, cg, cb, cr, cg, cb, cr, cg, cb);
        target.idx.push(p, p + 1, p + 2, p, p + 2, p + 3);
        target.n += 4;
      };
      pushFace(x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0, 0, 1, 0, 1.0);   // 顶
      pushFace(x0, y0, z1, x0, y0, z0, x1, y0, z0, x1, y0, z1, 0, -1, 0, 0.72); // 底
      pushFace(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0, 0.9);   // +X
      pushFace(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0, 0.85); // -X
      pushFace(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1, 0.94);  // +Z
      pushFace(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1, 0.82); // -Z
    };

    const addBoxTo = (target, x0, y0, z0, x1, y1, z1, hex) => {
      const c = linc(hex);
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          for (let z = z0; z <= z1; z++) {
            const j = 0.94 + hash(x + y * 3, z) * 0.12;
            const r = c[0] * j, g = c[1] * j, bl = c[2] * j;
            if (x === x1) target.face(x, y, z, 0, 1, r, g, bl, emptySolid);
            if (x === x0) target.face(x, y, z, 0, -1, r, g, bl, emptySolid);
            if (y === y1) target.face(x, y, z, 1, 1, r, g, bl, emptySolid);
            if (y === y0) target.face(x, y, z, 1, -1, r, g, bl, emptySolid);
            if (z === z1) target.face(x, y, z, 2, 1, r, g, bl, emptySolid);
            if (z === z0) target.face(x, y, z, 2, -1, r, g, bl, emptySolid);
          }
        }
      }
    };
    const addBox = (x0, y0, z0, x1, y1, z1, hex) => addBoxTo(b, x0, y0, z0, x1, y1, z1, hex);

    // 1. 环湖垂柳 + 古风路灯 + 可坐木长椅/汉白玉石桌凳 + 翠竹花坛
    for (let wz = Z0 + 4; wz < Z0 + S; wz += 12) {
      for (let wx = X0 + 4; wx < X0 + S; wx += 12) {
        const jx = wx + Math.floor((hash(wx, wz, 1) - 0.5) * 5);
        const jz = wz + Math.floor((hash(wx, wz, 2) - 0.5) * 5);
        const t = sampleTerrain(jx, jz);
        if (t.isWater || t.type === TERRAIN.PLAZA || t.type === TERRAIN.WALKWAY || t.type === TERRAIN.ROAD || t.type === TERRAIN.STONE_BANK) continue;

        const nearRoadOrWalk =
          sampleTerrain(jx + 3, jz).type === TERRAIN.ROAD ||
          sampleTerrain(jx - 3, jz).type === TERRAIN.ROAD ||
          sampleTerrain(jx, jz + 3).type === TERRAIN.ROAD ||
          sampleTerrain(jx, jz - 3).type === TERRAIN.ROAD ||
          sampleTerrain(jx + 3, jz).type === TERRAIN.WALKWAY ||
          sampleTerrain(jx - 3, jz).type === TERRAIN.WALKWAY ||
          sampleTerrain(jx, jz + 3).type === TERRAIN.WALKWAY ||
          sampleTerrain(jx, jz - 3).type === TERRAIN.WALKWAY;
        if (nearRoadOrWalk && hash(jx, jz, 31) < 0.24) {
          addBox(jx, t.height, jz, jx, t.height + 4, jz, 0x3a3e45);
          addBoxTo(lampB, jx, t.height + 5, jz, jx, t.height + 5, jz, 0xffe49c);
          if (this.collider) {
            this.collider.addPropColumn(jx, t.height, t.height + 5, jz);
            propCoords.push([jx, jz]);
          }
          continue;
        }

        let blockedByLandmark = Math.hypot(jx - 75, jz - (-322)) < 32;
        for (let li = 0; li < LANDMARKS.length; li++) {
          const lm = LANDMARKS[li];
          const clearR = lm.id === 'chaoran' ? 42 : (lm.id === 'ferris' ? 28 : 24);
          if (Math.hypot(jx - lm.x, jz - lm.z) < clearR) { blockedByLandmark = true; break; }
        }
        // 清理全部名亭、遐园、归位与补建大型真实建筑周边及任何已注册实体碰撞区内的随机树木/路灯，杜绝树长进屋顶！
        if (!blockedByLandmark && this.collider && this.collider.isSolid(jx, t.height + 1, jz, true)) {
          blockedByLandmark = true;
        }
        if (!blockedByLandmark) {
          const extraClear = [
            [117, -15, 12], [-240, -60, 12], [-318, 146, 13], [-522, 52, 12], [399, 144, 12],
            [130, -337, 12], [311, -38, 12], [516, -203, 12], [-619, 142, 12], [364, 147, 12],
            [-502, -277, 12], [-344, 232, 12], [428, 137, 12], [-637, 171, 12], [-59, 344, 12],
            [370, -342, 14], [165, 212, 16], [306, 23, 22], [458, 94, 15], [398, -10, 18],
            [-320, 210, 16], [-400, 208, 16], [-368, 198, 28],
            [43, -376, 40], [145, 23, 24], [337, 111, 24], [88, 198, 18], [327, 76, 12],
            [-454, 176, 28], [355, -331, 16], [-778, -280, 16],
          ];
          for (let ei = 0; ei < extraClear.length; ei++) {
            const [ex, ez, er] = extraClear[ei];
            if (Math.hypot(jx - ex, jz - ez) < er) { blockedByLandmark = true; break; }
          }
        }
        if (blockedByLandmark) continue;

        const isNearLake = t.edgeDist < 34;
        const prob = isNearLake ? 0.56 : 0.34;
        const roll = hash(jx, jz, 3);
        if (roll > prob) continue;

        const baseY = t.height;
        if (roll < 0.08) {
          // 景区 3D 可坐休息区：古风实木靠背长椅 或 汉白玉石桌石凳（团团按 E 即可坐下小憩！）
          const sid = `chunk_seat_${jx}_${jz}`;
          if (hash(jx, jz, 17) < 0.58) {
            addBox3D(b, jx - 1.2, baseY, jz - 0.3, 3.4, 0.55, 1.1, 0x8b5a2b);   // 立体厚座板
            addBox3D(b, jx - 1.2, baseY + 0.55, jz - 0.45, 3.4, 0.9, 0.28, 0x6e4320); // 靠背
            addBox3D(b, jx - 1.2, baseY, jz - 0.35, 0.35, 0.85, 1.15, 0x4a2f1c); // 左扶手腿
            addBox3D(b, jx + 1.85, baseY, jz - 0.35, 0.35, 0.85, 1.15, 0x4a2f1c);// 右扶手腿
            if (this.collider) {
              this.collider.addSeat({
                id: sid, type: 'bench', label: '🪑 按 E 键在湖畔木长椅坐下小憩赏景',
                x: jx + 0.5, y: baseY + 0.62, z: jz + 0.25, yaw: 0, interactRadius: 4.2,
              });
              seatIds.push(sid);
            }
          } else {
            addBox(jx, baseY, jz, jx, baseY + 1, jz, 0xd8d2c5);
            addBox3D(b, jx - 0.4, baseY + 1.0, jz - 0.4, 1.8, 0.32, 1.8, 0xedeae2); // 圆润厚石桌面
            addBox3D(b, jx - 1.8, baseY, jz + 0.1, 0.85, 0.65, 0.85, 0xc8c2b5);
            addBox3D(b, jx + 1.9, baseY, jz + 0.1, 0.85, 0.65, 0.85, 0xc8c2b5);
            if (this.collider) {
              this.collider.addSeat({
                id: sid, type: 'stool', label: '🍵 按 E 键在汉白玉石凳坐下歇息',
                x: jx - 1.35, y: baseY + 0.7, z: jz + 0.5, yaw: Math.PI / 2, interactRadius: 4.2,
              });
              seatIds.push(sid);
            }
          }
          continue;
        }
        if (roll < 0.16) {
          const bCol = P.snow ? 0xcde3d2 : 0x3fa34d;
          const bLeaf = P.snow ? 0xeaf5ff : 0x5cc464;
          for (const [bx, bz, bh] of [[0, 0, 7], [2, 0, 6], [1, 2, 8], [-1, 1, 5]]) {
            addBox(jx + bx, baseY, jz + bz, jx + bx, baseY + bh, jz + bz, bCol);
            addBox(jx + bx - 1, baseY + bh, jz + bz, jx + bx + 1, baseY + bh, jz + bz, bLeaf);
          }
          if (this.collider) {
            this.collider.addPropColumn(jx, baseY, baseY + 7, jz);
            propCoords.push([jx, jz]);
          }
          continue;
        }
        if (roll < 0.27) {
          const flowers = P.snow ? [0xf2f8ff, 0xe2eef8] : [0xff5c8a, 0xffd166, 0xc084fc, 0xff8fab];
          addBox(jx - 1, baseY, jz - 1, jx + 1, baseY, jz + 1, P.snow ? 0xdde8f2 : 0x3b8c3f);
          for (const [fx, fz] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) {
            const fc = flowers[Math.floor(hash(jx + fx, jz + fz, 19) * flowers.length)];
            addBox3D(b, jx + fx + 0.15, baseY + 1, jz + fz + 0.15, 0.7, 0.65, 0.7, fc);
            addBox3D(b, jx + fx + 0.35, baseY + 1.65, jz + fz + 0.35, 0.3, 0.22, 0.3, 0xffe066); // 金黄花蕊
          }
          continue;
        }

        const trunkH = 5 + Math.floor(hash(jx, jz, 4) * 4);
        addBox(jx, baseY, jz, jx, baseY + trunkH, jz, 0x6b4f35);
        if (this.collider) {
          this.collider.addPropColumn(jx, baseY, baseY + trunkH, jz);
          propCoords.push([jx, jz]);
        }
        const crownY = baseY + trunkH;
        const leafHex = P.willowLeaf[Math.floor(hash(jx, jz, 5) * P.willowLeaf.length)];
        addBox(jx - 2, crownY, jz - 2, jx + 2, crownY + 2, jz + 2, leafHex);
        addBox(jx - 1, crownY + 3, jz - 1, jx + 1, crownY + 3, jz + 1, leafHex);
        const drop = 2 + Math.floor(hash(jx, jz, 6) * 4);
        const dirs = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2], [-3, 0], [3, 0], [0, -3], [0, 3]];
        for (const [dx, dz] of dirs) {
          if (hash(jx + dx, jz + dz, 8) < 0.72) {
            const len = Math.max(1, drop - Math.floor(hash(jx + dx, jz + dz, 9) * 2));
            addBox(jx + dx, crownY - len, jz + dz, jx + dx, crownY, jz + dz, P.willowLeaf[1]);
          }
        }
      }
    }

    // 1.5 近岸浅滩 3D 菖蒲香蒲芦苇丛 + 水底摇曳水草 & 彩石（透过清亮翡翠水直接可见！）
    for (let wz = Z0 + 2; wz < Z0 + S; wz += 6) {
      for (let wx = X0 + 2; wx < X0 + S; wx += 6) {
        const t = sampleTerrain(wx, wz);
        if (!t.isWater) continue;
        const wd = getWaterSignedDist(wx, wz);
        if (wd > 0.6 && wd < 3.2 && !P.snow && hash(wx, wz, 41) < 0.34) {
          // 岸畔立体翠绿香蒲丛 + 棕褐蒲棒（3D 体素茎秆）
          const reedC = this.season === 'autumn' ? 0xc29b48 : 0x43a047;
          addBox3D(b, wx + 0.1, -1.0, wz + 0.1, 0.24, 2.5, 0.24, reedC);
          addBox3D(b, wx + 0.65, -1.0, wz + 0.45, 0.22, 2.9, 0.22, reedC);
          addBox3D(b, wx + 0.6, 1.45, wz + 0.4, 0.32, 0.55, 0.32, 0x6d4527); // 立体香蒲棒！
          addBox3D(b, wx - 0.3, -1.0, wz + 0.55, 0.22, 2.1, 0.22, 0x56b858);
        } else if (wd >= 1.5 && wd < 11.0 && hash(wx, wz, 43) < 0.38) {
          // 浅水底立体水草与青灰礁石点缀（复刻参考海报清澈水底细节！）
          addBox3D(b, wx, -1.2, wz, 1.1, 0.55, 0.9, 0x607d78);
          if (!P.snow) {
            addBox3D(b, wx + 0.3, -1.0, wz + 0.2, 0.25, 0.75, 0.25, 0x2c8a56);
          }
        }
      }
    }

    // 2. 100% 全 3D 立体荷花池（彻底清除 2D 薄片！带水下荷梗、厚实缺口荷叶、微翘卷边、露珠、双层立体花瓣与金黄莲蓬，大荷叶可真实踩踏！）
    if (P.showLotus) {
      for (const lz of LOTUS_ZONES) {
        if (lz.x + lz.r < X0 || lz.x - lz.r > X0 + S || lz.z + lz.r < Z0 || lz.z - lz.r > Z0 + S) continue;
        for (let wz = Z0 + 2; wz < Z0 + S; wz += 5) {
          for (let wx = X0 + 2; wx < X0 + S; wx += 5) {
            const d = Math.hypot(wx - lz.x, wz - lz.z);
            if (d > lz.r) continue;
            // 避开精选独立英雄王莲/荷花宝座坐标防重叠
            if (HERO_LOTUS_SPOTS.some((hs) => Math.hypot(wx - hs.x, wz - hs.z) < 4.5)) continue;
            const density = 1 - d / lz.r;
            if (hash(wx, wz, 21) > density * 0.76) continue;
            if (getWaterSignedDist(wx, wz) < 1.6) continue;

            const leafC = P.lotusLeaf[Math.floor(hash(wx, wz, 22) * P.lotusLeaf.length)];
            const rimC = P.lotusLeaf[0];
            const isTall = hash(wx, wz, 26) < 0.38;
            const padY = isTall ? 0.65 : 0.14;

            // 水下立体青绿荷梗（从水底 y=-1.5 一直长到荷叶底面！）
            addBox3D(b, wx + 0.36, -1.4, wz + 0.36, 0.28, padY + 1.45, 0.28, 0x2a6e32);

            // 3D 立体十字圆盘荷叶（厚 0.24m + 微翘立体叶缘 + V 形缺口 + 晶莹露珠！）
            addBox3D(b, wx - 0.85, padY, wz - 0.45, 2.7, 0.24, 1.9, leafC);
            addBox3D(b, wx - 0.45, padY, wz - 0.85, 1.9, 0.24, 2.7, leafC);
            // 荷叶边缘微翘立体卷边（留出一侧经典 V 形缺口）
            addBox3D(b, wx - 0.85, padY + 0.2, wz - 0.45, 0.28, 0.14, 1.9, rimC);
            addBox3D(b, wx + 1.57, padY + 0.2, wz - 0.45, 0.28, 0.14, 1.9, rimC);
            addBox3D(b, wx - 0.45, padY + 0.2, wz - 0.85, 1.9, 0.14, 0.28, rimC);
            if (hash(wx, wz, 29) < 0.5) {
              addBox3D(b, wx + 0.55, padY + 0.24, wz + 0.45, 0.24, 0.18, 0.24, 0xe0f8ff); // 3D 露珠
            }

            // 注册这片 3D 荷叶为可踩踏平台（团团在任何荷塘都能踩着荷叶轻功水上漂！）
            if (this.collider) {
              const pid = `chunk_pad_${wx}_${wz}`;
              this.collider.addLotusPad({
                id: pid,
                x: wx + 0.5,
                z: wz + 0.5,
                r: 1.45,
                topY: padY + 0.26,
                sink: 0,
              });
              padIds.push(pid);
            }

            // 3D 多层立体盛放荷花（立体花托 + 外层舒展花瓣 + 内层抱合花瓣 + 金黄莲蓬花蕊）
            if (hash(wx, wz, 24) < 0.38) {
              const fHex = P.lotusFlower[Math.floor(hash(wx, wz, 25) * P.lotusFlower.length)];
              const fx = wx + 1.35, fz = wz + 0.85;
              const fy = padY + 0.55;
              addBox3D(b, fx + 0.38, -1.4, fz + 0.38, 0.24, fy + 1.45, 0.24, 0x2f7d38); // 独立花茎
              addBox3D(b, fx + 0.15, fy - 0.12, fz + 0.15, 0.7, 0.18, 0.7, 0x4ca84c);   // 绿色花萼托
              // 外层十字立体花瓣
              addBox3D(b, fx - 0.25, fy, fz + 0.1, 1.5, 0.36, 0.8, fHex);
              addBox3D(b, fx + 0.1, fy, fz - 0.25, 0.8, 0.36, 1.5, fHex);
              // 内层高耸花瓣与金黄莲蓬蕊
              addBox3D(b, fx + 0.05, fy + 0.32, fz + 0.05, 0.9, 0.42, 0.9, 0xfff3f7);
              addBox3D(b, fx + 0.28, fy + 0.72, fz + 0.28, 0.44, 0.24, 0.44, 0xffcf38);
            }
          }
        }
      }
    }

    // 3. 码头木栈道（带入水圆木立柱与栓船桩，致敬参考海报木码头质感！）
    for (const dk of DOCKS) {
      if (dk.x < X0 || dk.x >= X0 + S || dk.z < Z0 || dk.z >= Z0 + S) continue;
      addBox(dk.x - 3, 1, dk.z - 4, dk.x + 3, 1, dk.z + 4, 0x9c683e);
      // 深入水底的圆木桥桩
      for (const [px, pz] of [[-3, -4], [3, -4], [-3, 0], [3, 0], [-3, 4], [3, 4]]) {
        addBox(dk.x + px, -2, dk.z + pz, dk.x + px, 3, dk.z + pz, 0x5c3c24);
        addBox3D(b, dk.x + px + 0.1, 3.0, dk.z + pz + 0.1, 0.8, 0.25, 0.8, 0xd9a74a); // 桩帽铜箍
      }
    }

    if (b.n > 0) {
      const geo = b.geometry();
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      disposables.push(geo);
    }
    if (lampB.n > 0) {
      const lGeo = lampB.geometry();
      const lMesh = new THREE.Mesh(lGeo, this.lampMat);
      lMesh.castShadow = false;
      group.add(lMesh);
      disposables.push(lGeo);
    }
  }
}
