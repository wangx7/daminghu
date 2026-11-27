// 体素道具库：房子、小房子、松树、桌子、碗……都返回 Vox（或一组 Vox），由剧集自己摆放
import * as THREE from 'three';
import { Vox, hash } from './vox.js';

export const disc = (v, y, r, c, cx = 0, cz = 0) => { for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (Math.abs(x) + Math.abs(z) <= r * 1.5 + .01) v.set(cx + x, y, cz + z, typeof c === 'function' ? c(x, y, z) : c); };
export const merge = (dst, src, dx = 0, dy = 0, dz = 0) => src.each((x, y, z, c) => dst.set(x + dx, y + dy, z + dz, c));

export function pine(R, seed, snow = true) {
  const v = new Vox(), G = [0x2f6b4a, 0x27593f, 0x3a7a52, 0x1f4b38], th = R > 3 ? 3 : 2;
  for (let y = 0; y < th + 2; y++) { v.set(0, y, 0, 0x6b452b); if (R > 4) { v.set(1, y, 0, 0x6b452b); v.set(0, y, 1, 0x5e3b25); v.set(1, y, 1, 0x6b452b); } }
  let y = th;
  for (let r = R; r >= 1; r--) { const g = (x, yy, z) => G[Math.floor(hash(x + yy * 3, z, seed) * 4)]; disc(v, y, r, g); disc(v, y + 1, Math.max(r - 1, 0), g); y += 2; }
  v.set(0, y, 0, G[0]); if (snow) v.snow(0xf5f9ff, .8, seed);
  return v;
}

// 大房子：正面朝 +z，前墙在 z=0，门洞 15 格宽。返回墙和屋顶、发光的窗和屋里、红灯笼、两扇门、新旧桃符
export function house() {
  const v = new Vox(), glow = new Vox(), lan = new Vox(), roof = new Vox();
  const WALL = [0xf4e7d0, 0xeedfc4, 0xf8eedb], WOOD = 0x6e3b2a, STONE = [0x8f93a6, 0x7d8296], TILE = [0x47526e, 0x3c4660, 0x525e7c], X = 24, D = 24, HH = 20;
  for (let x = -X; x <= X; x++) for (let y = 0; y < HH; y++) for (let z = -D; z <= 0; z++) {
    if (!(Math.abs(x) === X || z === 0 || z === -D)) continue;
    const corner = Math.abs(x) === X && (z === 0 || z === -D);
    v.set(x, y, z, y < 2 ? STONE[Math.floor(hash(x, y, z) * 2)] : (corner || y === HH - 1) ? WOOD : WALL[Math.floor(hash(x + y * 5, z, 61) * 3)]);
  }
  for (let x = -8; x <= 8; x++) for (let y = 0; y <= 16; y++) { if (Math.abs(x) <= 7 && y < 16) v.del(x, y, 0); else v.set(x, y, 0, WOOD); }
  for (const sx of [-1, 1]) for (let ax = 11; ax <= 20; ax++) for (let y = 7; y <= 15; y++) {
    const x = sx * ax, edge = ax === 11 || ax === 20 || y === 7 || y === 15, bar = ax === 15 || ax === 16 || y === 11;
    if (edge || bar) v.set(x, y, 0, WOOD); else { v.del(x, y, 0); glow.set(x, y, -1, 0xffd88a); }
  }
  glow.box(-7, 0, -4, 7, 15, -4, 0xffd08a);                                        // 屋里的暖光，开门才看得见
  for (let x = -7; x <= 7; x++) for (let z = -3; z <= -1; z++) v.set(x, -1, z, 0x8a6a52);
  for (let k = 0; k <= 8; k++) for (let x = -X - 4; x <= X + 4; x++) for (let z = -D - 4 + 2 * k; z <= 4 - 2 * k; z++) roof.set(x, HH + k, z, k === 8 ? 0x2f3850 : TILE[(x + 99) % 3]);
  for (const sx of [-1, 1]) { for (const zc of [-D - 4, 4]) roof.set(sx * (X + 5), HH + 1, zc, TILE[1]).set(sx * (X + 6), HH + 2, zc, TILE[1]); roof.set(sx * (X + 5), HH + 9, -12, 0x2f3850).set(sx * (X + 5), HH + 8, -12, 0x2f3850); }
  roof.snow(0xf5f9ff, .88, 62); merge(v, roof);
  for (const sx of [-1, 1]) { lan.box(sx * 11 - 1, 13, 2, sx * 11 + 1, 16, 4, 0xff4a30); lan.set(sx * 11, 12, 3, 0xffc040); for (let y = 17; y <= 19; y++) v.set(sx * 11, y, 3, 0x3a2418); }
  const leafL = new Vox().box(0, 0, 0, 6, 15, 0, (x, y) => (x === 0 || x === 6 || y === 0 || y === 15) ? 0xa82a22 : 0xc8362c).set(5, 7, 1, 0xffc83a);
  const leafR = new Vox().box(-7, 0, 0, 0, 15, 0, (x, y) => (x === 0 || x === -7 || y === 0 || y === 15) ? 0xa82a22 : 0xc8362c).set(-6, 7, 1, 0xffc83a);
  const strip = (base, mark) => new Vox().box(0, 0, 0, 1, 10, 0, (x, y) => (y % 3 === 1 && hash(x, y, 63) < .8) ? mark : base);
  return { body: v, glow, lan, leafL, leafR, oldStrip: strip(0xa07666, 0x6e4a3e), newStrip: strip(0xe8312f, 0xffd24a) };
}

// 远处山坡上的小房子（很多间，用实例化画）。门在 z=1 那一面
export function miniHouse(snow = true) {
  const v = new Vox(), roof = new Vox();
  v.box(-5, 0, -6, 5, 5, 0, (x, y, z) => y === 0 ? 0x8f93a6 : [0xf4e7d0, 0xeedfc4][Math.floor(hash(x + y, z, 64) * 2)]);
  v.box(-1, 0, 0, 1, 3, 0, 0xb23a2e);
  for (let k = 0; k <= 2; k++) for (let x = -7; x <= 7; x++) for (let z = -8 + 2 * k; z <= 2 - 2 * k; z++) roof.set(x, 6 + k, z, [0x47526e, 0x3c4660][(x + 9) % 2]);
  if (snow) roof.snow(0xf5f9ff, .9, 65); merge(v, roof);
  return v;
}

export function table() {
  const v = new Vox(); v.box(-7, 3, -3, 7, 3, 3, (x, y, z) => (x + 20) % 4 === 0 ? 0x8a5630 : 0x9e6638);
  for (const sx of [-6, 6]) for (const sz of [-2, 2]) v.box(sx, 0, sz, sx, 2, sz, 0x7a4a28);
  v.box(-6, 4, -1, -4, 6, 1, 0x7a3a2a); v.set(-5, 7, 0, 0x7a3a2a).set(-5, 8, 0, 0xd8b070); v.set(-5, 5, 2, 0xe8312f).set(-5, 5, 1, 0xe8312f);   // 酒坛，贴着红纸
  return v;
}
export function bowl() {
  const v = new Vox(); v.box(-1, 0, -1, 1, 0, 1, 0xe9eef8);
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) { const rim = Math.abs(x) === 2 || Math.abs(z) === 2; if (rim && Math.abs(x) === 2 && Math.abs(z) === 2) continue; v.set(x, 1, z, rim ? 0x4a78c8 : 0xffb84a); }
  return v;
}
// 立在地上的灯笼杆
export function lampPost() {
  const v = new Vox(), lan = new Vox();
  for (let y = 0; y <= 17; y++) v.set(0, y, 0, 0x4a2e1c); v.set(-1, 17, 0, 0x4a2e1c).set(-2, 17, 0, 0x4a2e1c).set(-2, 16, 0, 0x2a1a12);
  lan.box(-3, 12, -1, -1, 15, 1, 0xff4a30); lan.set(-2, 11, 0, 0xffc040);
  return { post: v, lan };
}

// 阔叶树，一年四个样子。kind: bud（刚冒芽的光枝）/ spring（开花）/ summer / autumn / winter（光枝积雪）。R 是树冠半径
export function tree(kind, R = 11, seed = 1) {
  const v = new Vox(), big = R >= 8, tw = big ? 1 : 0, th = Math.round(R * .9), ry = Math.round(R * .8), cy = th + ry - 2, BARK = [0x7a5236, 0x6b452b, 0x86603e];
  const bark = (x, y, z) => BARK[Math.floor(hash(x + y * 3, z, seed) * 3)], bare = kind === 'winter' || kind === 'bud';
  for (let y = 0; y <= (bare ? th + ry : th + 2); y++) v.box(0, y, 0, tw, y, tw, bark);
  if (big) v.set(-1, 0, 0, BARK[1]).set(tw + 1, 0, tw, BARK[1]).set(0, 0, -1, BARK[1]).set(tw, 0, tw + 1, BARK[1]).set(-1, 1, 0, BARK[0]).set(tw + 1, 1, tw, BARK[0]);
  if (bare) {
    const n = big ? 8 : 5;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + hash(i, seed, 91), len = Math.round(R * (.6 + .4 * hash(i, seed, 92))), y0 = th - 2 + Math.floor(hash(i, seed, 93) * ry);
      for (let s = 1; s <= len; s++) {
        const x = Math.round(Math.cos(a) * s), z = Math.round(Math.sin(a) * s), y = y0 + Math.round(s * .75);
        v.set(x, y, z, bark(x, y, z)); if (big && s < len * .5) v.set(x, y - 1, z, bark(x, y, z));
        if (s === Math.round(len * .55)) for (let k = 1; k <= (big ? 3 : 2); k++) v.set(x, y + k, z, BARK[2]);
        if (kind === 'bud' && (s === len || s % 3 === 2)) v.set(x, y + 1, z, s % 2 ? 0x9bdc76 : 0xffb7c9);
      }
    }
    if (kind === 'winter') v.snow(0xf5f9ff, .92, seed);
  } else {
    const P = { spring: [0xffb7c9, 0xff9db8, 0xffd3de, 0xfff0f3, 0xffb7c9, 0xf78fb0], summer: [0x3f9a44, 0x35893c, 0x4bab4e, 0x57b85a, 0x3f9a44, 0x2f7d38], autumn: [0xf08a24, 0xe2582a, 0xf6b02c, 0xd94a2a, 0xf7c948, 0xf08a24] }[kind];
    for (let x = -R - 1; x <= R + 1; x++) for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let z = -R - 1; z <= R + 1; z++) {
      const d = Math.pow(Math.abs(x - tw / 2) / R, 2.4) + Math.pow(Math.abs(y - cy) / ry, 2.4) + Math.pow(Math.abs(z - tw / 2) / R, 2.4);
      if (d <= .82 + .3 * hash(x * 1.7 + y * 5.1, z * 2.3, seed)) v.set(x, y, z, P[Math.floor(hash(x * 1.3 + y * 7, z, seed + 1) * 6)]);
    }
  }
  return v;
}

// 一块田（W×D，从 0,0 角开始）：sprout 小苗 / wheat 金黄的麦子 / stubble 割完的麦茬和草垛
export function crops(kind, W = 26, D = 24) {
  const v = new Vox();
  for (let z = 1; z < D - 1; z += (kind === 'wheat' ? 2 : 3)) for (let x = 1; x < W - 1; x++) {
    if (kind === 'sprout') { if (x % 2 === 0) { v.set(x, 0, z, 0x6fc24a); if (hash(x, z, 31) < .6) v.set(x, 1, z, 0x8fdc5e); } }
    else if (kind === 'wheat') { const h = 4 + Math.floor(hash(x, z, 32) * 2); for (let y = 0; y < h; y++) v.set(x, y, z, y < h - 2 ? 0xc9b84a : hash(x + y, z, 33) < .5 ? 0xf2c744 : 0xe8b130); }
    else if (hash(x, z, 34) < .45) v.set(x, 0, z, 0xd8b469);
  }
  if (kind === 'stubble') for (const [cx, cz, r] of [[7, 8, 4], [18, 15, 5]]) for (let y = 0; y <= r + 2; y++) disc(v, y, Math.max(0, Math.round(r - y * .75)), (x, yy, z) => hash(x + yy, z, 35) < .5 ? 0xe9c052 : 0xd9a93c, cx, cz);
  return v;
}

export function melon() {
  const v = new Vox();
  for (let x = -4; x <= 4; x++) for (let y = 0; y <= 6; y++) for (let z = -3; z <= 3; z++)
    if (Math.pow(Math.abs(x) / 4.6, 2.6) + Math.pow(Math.abs(y - 3) / 3.6, 2.6) + Math.pow(Math.abs(z) / 3.6, 2.6) <= 1) v.set(x, y, z, (x + 8) % 2 ? 0x2f8f3e : 0x1f6a30);
  v.set(0, 7, 0, 0x6b452b);
  return v;
}
// 一牙西瓜，尖朝上
export function melonSlice() {
  const v = new Vox();
  for (let y = 0; y <= 4; y++) { const w = y === 0 ? 3 : 4 - y; for (let x = -w; x <= w; x++) for (const z of [0, 1]) v.set(x, y, z, y === 0 ? 0x2f8f3e : y === 1 && Math.abs(x) === w ? 0xdff0c8 : 0xf0463c); }
  v.set(-1, 2, 1, 0x2a1e2e).set(1, 2, 1, 0x2a1e2e).set(0, 3, 1, 0x2a1e2e);
  return v;
}

export function snowman() {
  const v = new Vox(), W = [0xfdfdff, 0xf1f5fd];
  const ball = (cy, r) => { for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) if (Math.pow(Math.abs(x) / (r + .3), 2.6) + Math.pow(Math.abs(y) / (r + .3), 2.6) + Math.pow(Math.abs(z) / (r + .3), 2.6) <= 1) v.set(x, cy + y, z, W[Math.floor(hash(x + y, z, 36) * 2)]); };
  ball(4, 4); ball(11, 3);
  v.set(-1, 12, 3, 0x2a1e2e).set(1, 12, 3, 0x2a1e2e).set(0, 11, 3, 0xff8a2a).set(0, 11, 4, 0xff8a2a).set(0, 11, 5, 0xff8a2a);
  v.set(0, 6, 4, 0x2a1e2e).set(0, 4, 4, 0x2a1e2e);
  for (const sx of [-1, 1]) for (let k = 1; k <= 4; k++) v.set(sx * (3 + k), 6 + Math.round(k * .6), 0, 0x6b452b);
  v.box(-2, 15, -2, 2, 15, 2, 0x3f63c4); v.box(-1, 16, -1, 1, 17, 1, 0x3f63c4);
  return v;
}

// ---------- 第 10 集《山村咏怀》的道具 ----------

// 村里的白墙青瓦农舍：正面朝 +z，石基白墙木柱、双层翘角青瓦屋顶、烟囱与暖色门窗框
export function cottage(seed = 1, kind = 0) {
  const v = new Vox(), roof = new Vox();
  const X = 6, D = 5, HH = 10;
  const WALL = [[0xfaf1e2, 0xf3e6d0], [0xf7ecda, 0xefe0c6], [0xfcf5e8, 0xf4e8d4]][kind % 3];
  const STONE = [0x949ba8, 0x838a98, 0xa3a9b5], WOOD = 0x73442a, DOOR = 0x9c462e, GLASS = 0xffe4a8;
  const TILE = [0x3d5166, 0x334558, 0x496077];
  const r = (x, y, z, s) => hash(x + y * 7, z + seed * 3, s);
  for (let x = -X; x <= X; x++) for (let y = 0; y < HH; y++) for (let z = -D; z <= 0; z++) {
    if (!(Math.abs(x) === X || z === 0 || z === -D)) continue;
    const corner = Math.abs(x) === X && (z === 0 || z === -D);
    const beam = y === HH - 1 || (y === 5 && (Math.abs(x) === X || z === 0));
    v.set(x, y, z, y < 2 ? STONE[Math.floor(r(x, y, z, 1) * 3)] : (corner || beam) ? WOOD : WALL[Math.floor(r(x, y, z, 2) * 2)]);
  }
  // 门洞（宽 3、高 6，留给暖光透出）与木门框
  for (let x = -2; x <= 2; x++) for (let y = 0; y <= 6; y++) {
    if (Math.abs(x) <= 1 && y < 6) v.del(x, y, 0);
    else v.set(x, y, 0, DOOR);
  }
  // 左右木格暖窗
  for (const sx of [-1, 1]) for (let ax = 3; ax <= 5; ax++) for (let y = 3; y <= 6; y++) {
    const frame = ax === 3 || ax === 5 || y === 3 || y === 6;
    v.set(sx * ax, y, 0, frame ? WOOD : GLASS);
  }
  // 青瓦人字坡屋顶（更舒展的檐口）
  for (let k = 0; k <= 4; k++) {
    const ex = X + 3 - Math.floor(k * 1.1), ez = D + 3 - Math.floor(k * 1.4);
    if (ez < 0) continue;
    for (let x = -ex; x <= ex; x++) for (let z = -ez; z <= ez; z++) {
      roof.set(x, HH + k, z - 2, TILE[(x + k + 120) % 3]);
    }
  }
  for (let x = -X - 1; x <= X + 1; x++) roof.set(x, HH + 5, -2, 0x2a394a);                           // 正脊
  for (const sx of [-1, 1]) {                                                                        // 四角微翘飞檐
    for (const sz of [-D - 5, 1]) {
      roof.set(sx * (X + 4), HH + 1, sz, TILE[2]);
      roof.set(sx * (X + 4), HH + 2, sz, TILE[1]);
    }
  }
  // 青砖小烟囱（立在屋顶右侧偏后，清晰可辨）
  for (let y = HH + 1; y <= HH + 7; y++) {
    v.box(3, y, -5, 4, y, -4, (y % 2) ? 0x8d5f4c : 0x7b5140);
  }
  v.box(2, HH + 8, -6, 5, HH + 8, -3, 0x5c3c31);
  merge(v, roof);
  return v;
}

// 山坡古亭：花岗岩双层台基、朱红/暖木立柱、开敞美人靠栏杆、青黛翘角重檐、金顶宝珠
export function pavilion(style = 'classic') {
  const v = new Vox(), roof = new Vox(), S = 5;
  const stone = style === 'stone';
  const TILE = stone ? [0x355966, 0x2b4b57, 0x436d7a] : [0x385870, 0x2e4c63, 0x466b85];
  const PILLAR = stone ? 0xc44b38 : 0xb83a2c;
  const RAIL = stone ? 0x9e603d : 0xa8462e;
  const GOLD = 0xffd654;
  // 石台基
  for (let x = -S - 1; x <= S + 1; x++) for (let z = -S - 1; z <= S + 1; z++) {
    v.set(x, 0, z, (Math.abs(x) === S + 1 || Math.abs(z) === S + 1) ? 0x8d95a6 : 0xd4cbb8);
  }
  for (let x = -S; x <= S; x++) for (let z = -S; z <= S; z++) v.set(x, 1, z, 0xe0d7c4);
  // 四根醒目朱红柱子（在翠绿山坡上一眼能认出是亭子）
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let y = 2; y <= 10; y++) v.set(sx * S, y, sz * S, PILLAR);
  // 开敞栏杆（正面留出入口，其余三面围栏）
  for (let x = -S + 1; x <= S - 1; x++) {
    v.set(x, 4, -S, RAIL).set(x, 3, -S, 0xb8764a);
    if (Math.abs(x) >= 2) v.set(x, 4, S, RAIL);
  }
  for (let z = -S + 1; z <= S - 1; z++) {
    v.set(-S, 4, z, RAIL).set(S, 4, z, RAIL);
    if (z % 2 === 0) v.set(-S, 3, z, 0xb8764a).set(S, 3, z, 0xb8764a);
  }
  // 顶枋横梁
  for (let x = -S; x <= S; x++) for (const z of [-S, S]) v.set(x, 10, z, RAIL);
  for (let z = -S; z <= S; z++) for (const x of [-S, S]) v.set(x, 10, z, RAIL);
  // 石桌石凳（亭内）
  if (stone) {
    v.box(-1, 2, -1, 1, 3, 1, 0xc2b8a4);
    for (const sx of [-3, 3]) v.set(sx, 2, 0, 0xb0a692);
  }
  // 舒展四坡攒尖顶 + 飞翘檐角 + 金色宝顶
  for (let k = 0; k <= 4; k++) {
    const e = S + 4 - Math.round(k * 1.9);
    if (e < 0) continue;
    for (let x = -e; x <= e; x++) for (let z = -e; z <= e; z++) {
      roof.set(x, 11 + k, z, TILE[(Math.abs(x) + Math.abs(z) + k) % 3]);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    roof.set(sx * (S + 5), 12, sz * (S + 4), TILE[2]);
    roof.set(sx * (S + 4), 12, sz * (S + 5), TILE[2]);
    roof.set(sx * (S + 5), 13, sz * (S + 5), GOLD);
  }
  roof.set(0, 15, 0, GOLD).set(0, 16, 0, 0xffe478).set(0, 17, 0, 0xfff3b8);
  merge(v, roof);
  return v;
}

// 路边野花簇：丰满叶丛 + 多瓣立体花朵 + 金黄花蕊；seed 换花色和高矮
export function sprig(seed = 1, h = 7) {
  const v = new Vox(), GR = [0x46993d, 0x398233, 0x5cb54c];
  const PAL = [
    [0xff8ab0, 0xff6294, 0xffb8cf],   // 桃粉
    [0xffb7cc, 0xff8ea8, 0xffe2ec],   // 樱粉
    [0xffffff, 0xffe4ed, 0xfff5f8],   // 玉白
    [0xffd452, 0xffb830, 0xfff099],   // 迎春金黄
    [0xcfa6ff, 0xb27cf5, 0xe8d4ff],   // 紫丁香
  ][seed % 5];
  // 底部小叶丛
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 1], [2, -1]]) {
    v.set(dx, 0, dz, GR[Math.abs(dx + dz) % 3]);
    if (Math.abs(dx) + Math.abs(dz) === 1) v.set(dx, 1, dz, GR[2]);
  }
  // 主花茎与交错绿叶
  for (let y = 0; y < h; y++) v.set(0, y, 0, GR[y % 3]);
  v.set(1, Math.max(2, h - 3), 0, GR[2]).set(2, Math.max(3, h - 2), 0, GR[1]);
  v.set(-1, Math.max(2, h - 4), 0, GR[2]).set(-2, Math.max(3, h - 3), 0, GR[1]);
  v.set(0, Math.max(2, h - 3), 1, GR[1]).set(0, Math.max(2, h - 2), -1, GR[2]);
  // 立体五瓣大花冠（直径 5 格，远近都一眼可见）
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
    v.set(dx, h + (edge ? 1 : 0), dz, edge ? PAL[2] : PAL[(Math.abs(dx + dz)) % 2]);
  }
  v.set(0, h + 1, 0, 0xffd23f).set(0, h + 2, 0, 0xfff08a);
  // 旁生一朵小副花增加花簇层次
  const sx = seed % 2 ? 2 : -2, sy = Math.max(3, h - 3);
  for (let y = 1; y < sy; y++) v.set(sx > 0 ? 1 : -1, y, 1, GR[0]);
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) v.set(sx + dx, sy, 1 + dz, PAL[(dx + dz + 4) % 2]);
  v.set(sx, sy + 1, 1, 0xffe478);
  return v;
}

// 方块数字：5×7 点阵，数字 1–10（做「数一数」用的 3D 数字）
const FONT = {
  0: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '00100'],
  2: ['01110', '00001', '00001', '00110', '01000', '10000', '11111'],
  3: ['01110', '10001', '00001', '00110', '00001', '10001', '01110'],
  4: ['00010', '00110', '01100', '11111', '00100', '00100', '00100'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '01110'],
  6: ['00110', '01001', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '10000', '10000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};
export function digits(n, c = 0xe8452f, board = 0xfff8ec) {
  const v = new Vox(), t = String(n), W = 5 + (t.length - 1) * 7;
  for (let x = -1; x <= W; x++) for (let y = -1; y <= 7; y++) v.set(x, y, -1, board);      // 白色小牌子
  for (let x = -1; x <= W; x++) { v.set(x, 7, -2, 0xf0a63a); v.set(x, -1, -2, 0xf0a63a); } // 上下一条金边
  [...t].forEach((ch, i) => {
    const rows = FONT[ch]; if (!rows) return;
    rows.forEach((row, r) => [...row].forEach((b, x) => {
      if (b === '1') v.set(i * 7 + x, 6 - r, 0, c);
    }));
  });
  return v;
}

// ---------- 第 12 集《池上》夏日荷塘道具 ----------

// 小木船：船头朝 +z，船底在 y=0，内舱底在 y=1，可坐团团
export function boat() {
  const v = new Vox(), W1 = 0x8f5832, W2 = 0x7a4826, W3 = 0xa3693e, RIM = 0x5e341a;
  const wood = (x, y, z) => (x + z) % 3 === 0 ? W2 : (y === 0 ? W2 : W1);
  for (let z = -11; z <= 11; z++) {
    const az = Math.abs(z);
    const hw = az > 9 ? 1 : az > 7 ? 3 : az > 5 ? 4 : 5;
    const rise = az > 8 ? az - 8 : 0;                                        // 船头船尾微翘
    for (let x = -hw; x <= hw; x++) {
      v.set(x, rise, z, wood(x, rise, z));                                   // 船底
      if (Math.abs(x) === hw || az >= 10) {
        for (let h = 1; h <= 3; h++) v.set(x, rise + h, z, h === 3 ? RIM : wood(x, rise + h, z));
      }
    }
  }
  for (const sz of [-5, 4]) for (let x = -4; x <= 4; x++) v.set(x, 2, sz, W3);  // 前后坐板
  v.set(0, 4, 11, 0xd8a85a).set(0, 4, -11, 0xd8a85a);                           // 船头船尾小木饰
  return v;
}

// 青绿竹篙（竖直朝 +y，原点在底端）
export function bambooPole(len = 28) {
  const v = new Vox();
  for (let y = 0; y < len; y++) v.set(0, y, 0, y % 5 === 0 ? 0x3b7a36 : 0x62b04e);
  return v;
}

// 体素荷叶：带 V 形缺口、叶脉和晶莹小露珠
export function lotusPad(R = 6, seed = 1) {
  const v = new Vox(), G = [0x3d9944, 0x33863b, 0x4aaa4e, 0x2d7735];
  const cutA = hash(seed, 1, 71) * Math.PI * 2;
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    const d = Math.hypot(x, z);
    if (d > R + .2) continue;
    const ang = Math.atan2(z, x);
    let da = Math.abs(ang - cutA); if (da > Math.PI) da = Math.PI * 2 - da;
    if (da < .24 && d > 1.2) continue;                                       // 经典 V 形叶缺口
    const rim = d > R - .9;
    const vein = Math.abs(Math.sin((ang - cutA) * 4)) < .12;
    v.set(x, rim ? 1 : 0, z, vein ? 0x5cc458 : G[Math.floor(hash(x + seed * 3, z, 72) * 4)]);
  }
  if (R >= 5) v.set(Math.round(Math.cos(cutA + 2) * (R * .45)), 1, Math.round(Math.sin(cutA + 2) * (R * .45)), 0xdff8ff);  // 露珠
  return v;
}

// 体素荷花：kind = 'white'（白莲）/ 'pink'（粉莲）/ 'bud'（花苞），原点在茎底
export function lotusFlower(kind = 'white', stemH = 7) {
  const v = new Vox(), ST = 0x3b8c3e;
  for (let y = 0; y < stemH; y++) v.set(0, y, 0, y % 2 ? ST : 0x4aa04a);
  const y0 = stemH;
  if (kind === 'bud') {
    const C1 = 0xffc6d8, C2 = 0xff9cb8;
    v.box(-1, y0, -1, 1, y0 + 2, 1, (x, y, z) => y === y0 ? 0x62b04e : (y === y0 + 2 ? C2 : C1));
    v.set(0, y0 + 3, 0, C2);
    return v;
  }
  const white = kind === 'white';
  const P1 = white ? 0xffffff : 0xffd2e0, P2 = white ? 0xf2f7ff : 0xffa6c2, P3 = white ? 0xe8f3ec : 0xff86ad;
  // 外圈花瓣
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]]) {
    v.set(dx, y0, dz, P3);
    if (Math.abs(dx) + Math.abs(dz) === 2) v.set(dx * 1.5 | 0, y0 + 1, dz * 1.5 | 0, P2);
  }
  // 内圈花瓣
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    v.set(dx, y0 + 1, dz, P1);
    if (Math.abs(dx) + Math.abs(dz) === 1) v.set(dx, y0 + 2, dz, P1);
  }
  v.set(0, y0, 0, 0x62b04e).set(0, y0 + 1, 0, 0xffe04a).set(0, y0 + 2, 0, 0xffc430);   // 金黄花蕊
  return v;
}

// 岸边垂柳：苍劲微弯树干 + 垂坠翠绿柳条
export function willow(R = 10, seed = 1) {
  const v = new Vox(), BARK = [0x6e4b30, 0x5c3e26, 0x7c583a];
  const LEAF = [0x58b848, 0x48a43c, 0x6ec958, 0x3b8f34];
  const th = Math.round(R * 1.15);
  for (let y = 0; y <= th; y++) {
    const lean = Math.round(y * .22);
    v.box(lean, y, 0, lean + 1, y, 1, BARK[(y + seed) % 3]);
  }
  const cx = Math.round(th * .22), cy = th + 2;
  for (let x = -R; x <= R; x++) for (let y = -Math.round(R * .45); y <= Math.round(R * .45); y++) for (let z = -R; z <= R; z++) {
    const d = Math.hypot(x / R, y / (R * .48), z / R);
    if (d <= .9 + .18 * hash(x * 2, z * 3, seed)) v.set(cx + x, cy + y, z, LEAF[Math.floor(hash(x + y * 5, z, seed) * 4)]);
  }
  // 垂坠柳条
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2 + hash(i, seed, 81) * .3;
    const rad = R * (.65 + .3 * hash(i, seed, 82));
    const px = cx + Math.round(Math.cos(a) * rad), pz = Math.round(Math.sin(a) * rad);
    const len = 6 + Math.floor(hash(i, seed, 83) * 8);
    for (let k = 0; k < len; k++) v.set(px, cy - 2 - k, pz, LEAF[(i + k) % 4]);
  }
  return v;
}

// 岸边小木栈桥（朝 +z 伸向水面）
export function pier() {
  const v = new Vox(), W1 = 0x8a5834, W2 = 0x734627, POST = 0x56321a;
  for (let z = 0; z <= 18; z += 2) for (let x = -6; x <= 6; x++) v.set(x, 3, z, z % 4 === 0 ? W1 : W2);
  for (let z = 0; z <= 18; z++) for (const x of [-5, 5]) v.set(x, 2, z, POST);
  for (const z of [2, 10, 17]) for (const x of [-6, 6]) for (let y = -4; y <= (z === 17 ? 7 : 5); y++) v.set(x, y, z, POST);
  return v;
}

// 角色：几个表情各是一个模型，mood() 切换；pose() 摆位置、朝向、跳、压扁、发抖、歪头
export function actor(models, mat, yBase = 0) {
  const g = new THREE.Group(), inner = new THREE.Group(), meshes = {}; g.add(inner);
  for (const k in models) { const m = models[k].mesh(mat, .015); m.position.set(-.5, yBase, -.5); m.visible = false; inner.add(m); meshes[k] = m; }
  return {
    g, mood(k) { for (const j in meshes) meshes[j].visible = j === k; },
    pose({ x = 0, y = 0, z = 0, ry = 0, hop = 0, squash = 0, shiver = 0, tilt = 0, lean = 0, t = 0, scale = 1, show = true }) {
      g.visible = show; g.position.set(x + (shiver ? Math.sin(t * 70) * .22 * shiver : 0), y + hop, z); g.rotation.set(0, ry, 0);
      inner.rotation.set(lean, 0, tilt); inner.scale.set(scale * (1 + squash * .5), scale * (1 - squash), scale * (1 + squash * .5));
    },
  };
}
