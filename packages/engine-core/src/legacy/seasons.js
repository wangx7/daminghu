// 四季天气粒子系统（复用 vox.js 的 Bits 方块粒子池）
// 春：粉色花瓣与轻舞柳絮 | 夏：夜色流萤 | 秋：金黄银杏与红枫落叶 | 冬：漫天体素飘雪
import { Bits, hash } from './voxel/vox.js';

export class SeasonWeather {
  constructor(scene) {
    this.count = 420;
    this.bits = new Bits(this.count);
    scene.add(this.bits.mesh);
    this.season = 'summer';

    // 预生成粒子局部种子偏移（始终跟随团团周边 75m×36m 空间循环）
    this.particles = [];
    for (let i = 0; i < this.count; i++) {
      this.particles.push({
        ox: (hash(i, 1, 7) - 0.5) * 90,
        oy: hash(i, 2, 7) * 34,
        oz: (hash(i, 3, 7) - 0.5) * 90,
        spd: 0.7 + hash(i, 4, 7) * 1.4,
        ph: hash(i, 5, 7) * Math.PI * 2,
        cIdx: Math.floor(hash(i, 6, 7) * 3),
      });
    }
  }

  setSeason(season) {
    this.season = season;
  }

  update(t, playerPos, nightFactor) {
    this.bits.begin();
    const s = this.season;
    const px = playerPos.x, pz = playerPos.z;

    if (s === 'summer' && nightFactor < 0.35) {
      // 盛夏白天保持通透，不放过多粒子
      this.bits.end();
      return;
    }

    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      if (s === 'spring') {
        if (i > 220) break;
        const y = ((p.oy - t * 1.4 * p.spd) % 30 + 30) % 30 + 1;
        const x = px + p.ox + Math.sin(t * 0.9 + p.ph) * 4.5;
        const z = pz + p.oz + Math.cos(t * 0.7 + p.ph) * 4.5;
        const col = p.cIdx === 0 ? 0xffb7cc : (p.cIdx === 1 ? 0xffe0ea : 0xffffff);
        this.bits.add(x, y, z, 0.24, col, 1.0, t * 2 + p.ph, 0.1);
      } else if (s === 'summer') {
        // 夏夜萤火虫（在荷塘与垂柳低空闪烁）
        if (i > 140) break;
        const y = 1.5 + (p.oy % 9) + Math.sin(t * 2.1 + p.ph) * 0.9;
        const x = px + p.ox * 0.8 + Math.sin(t * 0.6 + p.ph) * 3;
        const z = pz + p.oz * 0.8 + Math.cos(t * 0.5 + p.ph) * 3;
        const pulse = 0.7 + 0.6 * Math.sin(t * 4.2 + p.ph);
        this.bits.add(x, y, z, 0.22, 0xd8ff66, 1.6 * pulse, t + p.ph);
      } else if (s === 'autumn') {
        if (i > 240) break;
        const y = ((p.oy - t * 2.1 * p.spd) % 30 + 30) % 30 + 1;
        const x = px + p.ox + Math.sin(t * 1.1 + p.ph) * 5;
        const z = pz + p.oz + Math.cos(t * 0.8 + p.ph) * 3;
        const col = p.cIdx === 0 ? 0xf5b82e : (p.cIdx === 1 ? 0xe05a2b : 0xffd24d);
        this.bits.add(x, y, z, 0.3, col, 1.0, t * 2.6 + p.ph, 0.08);
      } else if (s === 'winter') {
        const y = ((p.oy - t * 3.4 * p.spd) % 34 + 34) % 34 + 0.5;
        const x = px + p.ox + Math.sin(t * 0.8 + p.ph) * 3.2;
        const z = pz + p.oz + Math.cos(t * 0.6 + p.ph) * 2.5;
        this.bits.add(x, y, z, 0.26, 0xf2f8ff, 1.1, t + p.ph);
      }
    }
    this.bits.end();
  }
}
