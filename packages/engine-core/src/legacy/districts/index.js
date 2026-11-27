// 泉城全域多片区注册表与按需流式加载管理器（阶段 5 架构基座）
// 设计原则：
// 1. 每个景区片区独立模块化（js/districts/<id>.js），按 bbox 距离动态 import() 挂载与卸载；
// 2. 玩家距离片区 bbox < LOAD_DIST(600m) 自动加载，离开 > UNLOAD_DIST(900m) 自动卸载（常驻片区除外）；
// 3. 传送前可调用 ensureLoaded(id)，确保目标片区就绪后再切换视角。
import * as damingDistrict from './daming.js';

const LOAD_DIST = 600;
const UNLOAD_DIST = 900;

// 泉城 1:1 绿地与历史街区规划片区目录（原点 = 大明湖历下亭，+X 正东，+Z 正南）
export const DISTRICTS = [
  {
    id: 'daming',
    name: '大明湖景区',
    tag: '核心主湖 · 94处实景',
    bbox: { minX: -900, maxX: 960, minZ: -460, maxZ: 360 },
    persistent: true,
    status: 'ready',
    syncModule: damingDistrict,
  },
  {
    id: 'baihuazhou',
    name: '百花洲 · 曲水亭街',
    tag: '南门直连 · 下一片区',
    bbox: { minX: -360, maxX: 220, minZ: 260, maxZ: 620 },
    persistent: false,
    status: 'planned',
  },
  {
    id: 'furong_quancheng',
    name: '芙蓉街 · 珍珠泉 · 泉城路',
    tag: '老城中轴步行街',
    bbox: { minX: -200, maxX: 520, minZ: 520, maxZ: 1360 },
    persistent: false,
    status: 'planned',
  },
  {
    id: 'wulongtan',
    name: '五龙潭公园',
    tag: '西南门直连 · 清泉潭影',
    bbox: { minX: -960, maxX: -480, minZ: 780, maxZ: 1280 },
    persistent: false,
    status: 'planned',
  },
  {
    id: 'baotuquan',
    name: '趵突泉景区',
    tag: '天下第一泉',
    bbox: { minX: -760, maxX: -180, minZ: 1240, maxZ: 1680 },
    persistent: false,
    status: 'planned',
  },
  {
    id: 'heihu_jiefangge',
    name: '黑虎泉 · 解放阁',
    tag: '护城河东南绿廊',
    bbox: { minX: 480, maxX: 1080, minZ: 1280, maxZ: 1780 },
    persistent: false,
    status: 'planned',
  },
];

function distToBBox(x, z, b) {
  const dx = x < b.minX ? b.minX - x : (x > b.maxX ? x - b.maxX : 0);
  const dz = z < b.minZ ? b.minZ - z : (z > b.maxZ ? z - b.maxZ : 0);
  return Math.hypot(dx, dz);
}

export class DistrictManager {
  constructor(ctx) {
    this.ctx = ctx; // { scene, voxelMat, collider, snowMeshes }
    this.mounted = new Map(); // id -> instance
    this.loading = new Set();
    this._checkAccum = 0;
  }

  // 启动时同步挂载所有常驻核心片区（大明湖），返回其 refs 供主循环绑定
  mountCore() {
    let primaryRefs = {};
    for (const d of DISTRICTS) {
      if (d.status === 'ready' && d.persistent && d.syncModule) {
        const inst = d.syncModule.mount(this.ctx);
        this.mounted.set(d.id, inst);
        if (d.id === 'daming') primaryRefs = inst.refs || {};
      }
    }
    return primaryRefs;
  }

  async ensureLoaded(id) {
    if (this.mounted.has(id)) return this.mounted.get(id);
    const meta = DISTRICTS.find((d) => d.id === id);
    if (!meta || meta.status !== 'ready') return null;
    if (this.loading.has(id)) return null;
    this.loading.add(id);
    try {
      const mod = meta.syncModule || await meta.loader();
      const inst = mod.mount(this.ctx);
      this.mounted.set(id, inst);
      return inst;
    } finally {
      this.loading.delete(id);
    }
  }

  unmountDistrict(id) {
    const meta = DISTRICTS.find((d) => d.id === id);
    if (!meta || meta.persistent) return;
    const inst = this.mounted.get(id);
    if (!inst) return;
    inst.unmount?.();
    this.mounted.delete(id);
  }

  // 每帧更新所有已挂载片区，并每 0.5 秒检查一次按需流式加载/卸载
  update(dt, elapsed, nightFactor, playerPos) {
    for (const inst of this.mounted.values()) {
      inst.update?.(dt, elapsed, nightFactor);
    }
    this._checkAccum += dt;
    if (this._checkAccum < 0.5 || !playerPos) return;
    this._checkAccum = 0;

    for (const d of DISTRICTS) {
      if (d.status !== 'ready' || d.persistent) continue;
      const dist = distToBBox(playerPos.x, playerPos.z, d.bbox);
      if (dist < LOAD_DIST && !this.mounted.has(d.id)) {
        this.ensureLoaded(d.id);
      } else if (dist > UNLOAD_DIST && this.mounted.has(d.id)) {
        this.unmountDistrict(d.id);
      }
    }
  }
}
