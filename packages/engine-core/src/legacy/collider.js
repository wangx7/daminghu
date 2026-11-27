// 全局 3D 体素碰撞器 + 自动屋顶积雪层生成器 + 高清书法牌匾工具
import * as THREE from 'three';
import { Vox, hash } from './voxel/vox.js';
import { sampleTerrain, getBridgeHeight } from './map_data.js';

const GRID_CELL = 32;
function cellKey(cx, cz) {
  return `${cx},${cz}`;
}

export class WorldCollider {
  constructor() {
    this.volumes = [];
    this.boxes = [];        // 高速实心 AABB 碰撞盒（码头、演艺船、桥栏、长墙垣等）
    this.props = new Map(); // 动态 Chunk 树干与路灯杆碰撞表：key="ix,iz" -> { y0, y1 }
    this.lotusPads = new Map(); // 可踩踏 3D 弹性荷叶/王莲支撑表：id -> { id, x, z, r, topY, sink, mesh, baseY }
    this.seats = new Map();     // 全园可坐交互锚点（3D荷花、王莲、木长椅、石凳、名亭）：id -> seat

    // 2D 空间网格哈希索引（32m×32m Cell，将 isSolid / getLotusPadAt 从 O(N) 降至 O(1)！）
    this.volGrid = new Map();
    this.boxGrid = new Map();
    this.padGrid = new Map();

    // 片区碰撞作用域（支持后续卸载远距离片区时一键清除该片区的碰撞体与座椅）
    this._currentScope = null;
    this._scopes = new Map(); // scopeId -> { volumes: [], boxes: [], seatIds: [] }
  }

  beginScope(scopeId) {
    this._currentScope = scopeId;
    if (!this._scopes.has(scopeId)) {
      this._scopes.set(scopeId, { volumes: [], boxes: [], seatIds: [] });
    }
  }

  endScope() {
    this._currentScope = null;
  }

  clearScope(scopeId) {
    const rec = this._scopes.get(scopeId);
    if (!rec) return;
    for (const vol of rec.volumes) {
      this._removeGrid(this.volGrid, vol.minX, vol.maxX, vol.minZ, vol.maxZ, vol);
      const idx = this.volumes.indexOf(vol);
      if (idx >= 0) this.volumes.splice(idx, 1);
    }
    for (const b of rec.boxes) {
      this._removeGrid(this.boxGrid, b.minX, b.maxX, b.minZ, b.maxZ, b);
      const idx = this.boxes.indexOf(b);
      if (idx >= 0) this.boxes.splice(idx, 1);
    }
    for (const sid of rec.seatIds) {
      this.seats.delete(sid);
    }
    this._scopes.delete(scopeId);
  }

  _insertGrid(grid, minX, maxX, minZ, maxZ, item) {
    const x0 = Math.floor(minX / GRID_CELL), x1 = Math.floor(maxX / GRID_CELL);
    const z0 = Math.floor(minZ / GRID_CELL), z1 = Math.floor(maxZ / GRID_CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = cellKey(cx, cz);
        let bucket = grid.get(k);
        if (!bucket) { bucket = []; grid.set(k, bucket); }
        bucket.push(item);
      }
    }
  }

  _removeGrid(grid, minX, maxX, minZ, maxZ, item) {
    const x0 = Math.floor(minX / GRID_CELL), x1 = Math.floor(maxX / GRID_CELL);
    const z0 = Math.floor(minZ / GRID_CELL), z1 = Math.floor(maxZ / GRID_CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = cellKey(cx, cz);
        const bucket = grid.get(k);
        if (!bucket) continue;
        const idx = bucket.indexOf(item);
        if (idx >= 0) bucket.splice(idx, 1);
      }
    }
  }

  addPropColumn(ix, y0, y1, iz) {
    this.props.set(`${ix},${iz}`, { y0, y1 });
  }

  removePropColumn(ix, iz) {
    this.props.delete(`${ix},${iz}`);
  }

  // 注册高速实心 AABB 碰撞盒
  addBoxVolume(minX, minY, minZ, maxX, maxY, maxZ) {
    const b = { minX, minY, minZ, maxX, maxY, maxZ };
    this.boxes.push(b);
    this._insertGrid(this.boxGrid, minX, maxX, minZ, maxZ, b);
    if (this._currentScope) this._scopes.get(this._currentScope)?.boxes.push(b);
  }

  // 注册 3D 可踩踏弹性荷叶 / 王莲平台
  addLotusPad(pad) {
    const prev = this.lotusPads.get(pad.id);
    if (prev) this._removeGrid(this.padGrid, prev.x - prev.r - 1, prev.x + prev.r + 1, prev.z - prev.r - 1, prev.z + prev.r + 1, prev);
    this.lotusPads.set(pad.id, pad);
    this._insertGrid(this.padGrid, pad.x - pad.r - 1, pad.x + pad.r + 1, pad.z - pad.r - 1, pad.z + pad.r + 1, pad);
  }

  removeLotusPad(id) {
    const prev = this.lotusPads.get(id);
    if (prev) {
      this._removeGrid(this.padGrid, prev.x - prev.r - 1, prev.x + prev.r + 1, prev.z - prev.r - 1, prev.z + prev.r + 1, prev);
      this.lotusPads.delete(id);
    }
  }

  // 查询 (wx, wz) 处是否有可站立的 3D 荷叶平台（O(1) 空间网格查询）
  getLotusPadAt(wx, wz, extraR = 0.15) {
    const bucket = this.padGrid.get(cellKey(Math.floor(wx / GRID_CELL), Math.floor(wz / GRID_CELL)));
    if (!bucket) return null;
    for (let i = 0; i < bucket.length; i++) {
      const pad = bucket[i];
      const dx = wx - pad.x, dz = wz - pad.z;
      const lim = pad.r + extraR;
      if (dx * dx + dz * dz <= lim * lim) {
        return pad;
      }
    }
    return null;
  }

  // 注册可坐交互点（荷花花心、王莲、公园木长椅、石桌石凳、古亭美人靠/石凳）
  addSeat(seat) {
    this.seats.set(seat.id, seat);
    if (this._currentScope) this._scopes.get(this._currentScope)?.seatIds.push(seat.id);
  }

  removeSeat(id) {
    this.seats.delete(id);
  }

  findNearbySeat(px, py, pz, maxDist = 4.2) {
    let best = null;
    let bestD = maxDist;
    for (const s of this.seats.values()) {
      if (Math.abs(py - s.y) > 3.6) continue;
      const d = Math.hypot(px - s.x, pz - s.z);
      const limit = s.interactRadius || maxDist;
      if (d <= limit && d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  // 注册一个 Vox 建筑模型到全局碰撞表（支持任意局部坐标偏移与绕 Y 轴旋转）
  registerVox(vox, ox, oy, oz, rotY = 0) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    vox.each((x, y, z) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    });
    if (minX === Infinity) return;
    const rad = Math.hypot(Math.max(Math.abs(minX), Math.abs(maxX)) + 1, Math.max(Math.abs(minZ), Math.abs(maxZ)) + 1);
    const vol = {
      vox,
      ox,
      oy,
      oz,
      rotY,
      cos: Math.cos(-rotY),
      sin: Math.sin(-rotY),
      minX: ox - rad,
      maxX: ox + rad,
      minY: oy + minY - 1,
      maxY: oy + maxY + 2,
      minZ: oz - rad,
      maxZ: oz + rad,
    };
    this.volumes.push(vol);
    this._insertGrid(this.volGrid, vol.minX, vol.maxX, vol.minZ, vol.maxZ, vol);
    if (this._currentScope) this._scopes.get(this._currentScope)?.volumes.push(vol);
  }

  // 查询世界浮点坐标 (wx, wy, wz) 处的体素是否为实心方块（O(1) 空间网格加速！）
  isSolid(wx, wy, wz, ignoreProps = false) {
    const ix = Math.floor(wx);
    const iy = Math.floor(wy);
    const iz = Math.floor(wz);

    // 1. 地形与水面以下水底
    const t = sampleTerrain(ix, iz);
    if (!t.isWater && iy < t.height) return true;
    if (t.isWater && iy < t.height) return true;

    // 2. 桥梁桥面厚度
    const bh = getBridgeHeight(wx, wz);
    if (bh !== null && wy <= bh && wy >= bh - 1.4) return true;

    const ck = cellKey(Math.floor(wx / GRID_CELL), Math.floor(wz / GRID_CELL));

    // 2.2 3D 可踩踏荷叶平台（O(1) 网格查询）
    if (!ignoreProps && wy >= -0.45 && wy <= 1.35) {
      const pBucket = this.padGrid.get(ck);
      if (pBucket) {
        for (let i = 0; i < pBucket.length; i++) {
          const pad = pBucket[i];
          const dx = wx - pad.x, dz = wz - pad.z;
          if (dx * dx + dz * dz <= pad.r * pad.r) {
            const top = pad.topY - (pad.sink || 0);
            if (wy <= top && wy >= top - 0.55) return true;
          }
        }
      }
    }

    // 2.4 实心 AABB 盒（O(1) 网格查询）
    const bBucket = this.boxGrid.get(ck);
    if (bBucket) {
      for (let i = 0; i < bBucket.length; i++) {
        const b = bBucket[i];
        if (wx >= b.minX && wx <= b.maxX && wy >= b.minY && wy <= b.maxY && wz >= b.minZ && wz <= b.maxZ) {
          return true;
        }
      }
    }

    // 2.5 动态树干与路灯杆（O(1) 查表，开车/走路撞树真实阻挡！）
    if (!ignoreProps) {
      const prop = this.props.get(`${ix},${iz}`);
      if (prop && iy >= prop.y0 && iy <= prop.y1) return true;
    }

    // 3. 已注册的所有 3D 体素建筑与墙垣（O(1) 网格查询）
    const vBucket = this.volGrid.get(ck);
    if (vBucket) {
      for (let i = 0; i < vBucket.length; i++) {
        const v = vBucket[i];
        if (wx < v.minX || wx > v.maxX || wy < v.minY || wy > v.maxY || wz < v.minZ || wz > v.maxZ) continue;
        let lx = wx - v.ox;
        const ly = wy - v.oy;
        let lz = wz - v.oz;
        if (v.rotY !== 0) {
          const rx = lx * v.cos - lz * v.sin;
          const rz = lx * v.sin + lz * v.cos;
          lx = rx;
          lz = rz;
        }
        if (v.vox.has(Math.floor(lx), Math.floor(ly), Math.floor(lz))) return true;
      }
    }
    return false;
  }

  // 第三人称相机 Spring-Arm 射线防穿墙检测：按距离自适应步长，兼顾精度与性能
  castCameraDistance(tx, ty, tz, dirX, dirY, dirZ, maxDist, minDist = 2.2) {
    for (let d = 1.4; d <= maxDist; ) {
      const px = tx + dirX * d;
      const py = ty + dirY * d;
      const pz = tz + dirZ * d;
      if (this.isSolid(px, py, pz, true) || this.isSolid(px, py - 0.25, pz, true)) {
        return Math.max(minDist, d - 0.58);
      }
      d += d < 12 ? 0.45 : (d < 28 ? 0.85 : 1.35);
    }
    return maxDist;
  }

  // 检测团团 AABB（底面中心 x, y, z，水平半径 r，高度 h）是否与实体重叠
  collidesBox(x, y, z, r = 0.42, h = 1.45) {
    const ys = [y + 0.002, y + h * 0.5, y + h];
    const xs = [x - r, x + r];
    const zs = [z - r, z + r];
    for (const cy of ys) {
      for (const cx of xs) {
        for (const cz of zs) {
          if (this.isSolid(cx, cy, cz)) return true;
        }
      }
    }
    return false;
  }

  // 检测脚底正下方是否有支撑（用于稳定站立，彻底杜绝地面上下抖动）
  hasGroundSupport(x, y, z, r = 0.42) {
    const checkY = y - 0.06;
    const xs = [x - r, x + r];
    const zs = [z - r, z + r];
    for (const cx of xs) {
      for (const cz of zs) {
        if (this.isSolid(cx, checkY, cz)) return true;
      }
    }
    return false;
  }

  // 查找某 (x, z) 在当前高度 maxY 以下（含脚下）最近的站立地面高度
  findGroundBelow(x, z, maxY) {
    const startY = Math.floor(maxY);
    for (let y = startY; y >= -5; y--) {
      if (this.isSolid(x, y, z) && !this.isSolid(x, y + 1, z)) {
        return y + 1;
      }
    }
    return -5;
  }
}

// ====== 自动为任意 Vox 建筑生成「冬季屋顶积雪覆盖层」======
const SNOW_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.92,
  metalness: 0.02,
});

export function buildSnowCap(vox, minY = 2) {
  const snow = new Vox();
  vox.each((x, y, z) => {
    if (y >= minY && !vox.has(x, y + 1, z)) {
      const c = hash(x, z, y) < 0.5 ? 0xf5faff : 0xe6f1fc;
      snow.set(x, y + 1, z, c);
    }
  });
  const mesh = snow.mesh(SNOW_MAT, 0.015);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.visible = false; // 平时隐藏，切换冬季时统一显示
  return mesh;
}

// ====== 2K 级高清矢量程序化书法牌匾 / 楹联生成器（实木大漆暗纹 + 双层回字纹鎏金雕框 + 浮雕金字 + 朱砂篆印）======
export function createSignboard({
  title,
  subtitle = '',
  width = 8,
  height = 2.6,
  bgColor = '#22130e',
  borderColor = '#e2b857',
  textColor = '#ffea9f',
  vertical = false,
  seal = '明湖',
}) {
  // 分级分辨率：旗舰大匾/长楹联保留 1024px 高清，常规名亭/石碑降为 512px（显存直降 ~70% 且近看依然清晰！）
  const isHero = width >= 6.8 || height >= 4.5;
  const scale = isHero ? 1.0 : 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((vertical ? 256 : 1024) * scale);
  canvas.height = Math.round((vertical ? 1024 : 384) * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const W = vertical ? 256 : 1024;
  const H = vertical ? 1024 : 384;

  // 1. 细腻实木大漆 / 靛蓝皇家御匾渐变底色 + 微纹理
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, bgColor);
  grad.addColorStop(0.5, bgColor);
  grad.addColorStop(1, '#120b09');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 细腻漆面丝光暗纹
  ctx.fillStyle = 'rgba(255, 224, 150, 0.035)';
  for (let y = 0; y < H; y += 6) {
    ctx.fillRect(0, y, W, 2);
  }

  // 2. 双层鎏金雕花边框 + 四角传统回字云纹装饰
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 14;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255, 234, 159, 0.72)';
  ctx.strokeRect(30, 30, W - 60, H - 60);

  // 四角回字纹角花
  const drawCorner = (cx, cy, sx, sy) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(32, 0); ctx.lineTo(32, 18); ctx.lineTo(14, 18); ctx.lineTo(14, 32); ctx.lineTo(0, 32);
    ctx.stroke();
    ctx.restore();
  };
  drawCorner(36, 36, 1, 1);
  drawCorner(W - 36, 36, -1, 1);
  drawCorner(36, H - 36, 1, -1);
  drawCorner(W - 36, H - 36, -1, -1);

  // 3. 浮雕鎏金书法大字（阴影 + 渐变填充）
  const textGrad = ctx.createLinearGradient(0, 40, 0, H - 40);
  textGrad.addColorStop(0, '#fff7cc');
  textGrad.addColorStop(0.55, textColor);
  textGrad.addColorStop(1, '#cfa03c');

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = textGrad;

  if (vertical) {
    const chars = [...title];
    const padY = 92;
    const step = (H - padY * 2) / Math.max(1, chars.length);
    const fontSize = Math.min(104, Math.floor(step * 0.82));
    ctx.font = `bold ${fontSize}px WK, "KaiTi", "STKaiti", serif`;
    chars.forEach((ch, idx) => {
      ctx.fillText(ch, W / 2, padY + step * (idx + 0.5));
    });
  } else {
    const mainSize = subtitle ? 156 : 190;
    ctx.font = `bold ${mainSize}px WK, "KaiTi", "STKaiti", serif`;
    ctx.fillText(title, W / 2, subtitle ? H * 0.43 : H * 0.52);
    if (subtitle) {
      ctx.shadowBlur = 6;
      ctx.font = 'bold 52px WK, "KaiTi", sans-serif';
      ctx.fillStyle = 'rgba(255, 240, 194, 0.92)';
      ctx.fillText(subtitle, W / 2, H * 0.78);
    }
    // 右下角朱砂红印章落款
    if (seal) {
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      const sx = W - 108, sy = H - 104, sw = 52, sh = 52;
      ctx.fillStyle = '#b92b27';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = '#ffdfd9';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(sx + 4, sy + 4, sw - 8, sh - 8);
      ctx.fillStyle = '#fff3ee';
      ctx.font = 'bold 20px WK, serif';
      ctx.fillText(seal.slice(0, 2), sx + sw / 2, sy + sh / 2 + 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.42,
    metalness: 0.12,
    emissive: new THREE.Color(textColor),
    emissiveMap: tex,
    emissiveIntensity: 0.24,
  });
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.3), mat);
}
