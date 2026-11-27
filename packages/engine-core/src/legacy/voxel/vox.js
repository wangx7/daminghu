// 体素建模工具：把一堆小方块合成一个网格，只画露在外面的面，并在顶点上烘焙环境遮蔽（方块夹角处变暗）
import * as THREE from 'three';

const AO = [0.45, 0.64, 0.83, 1.0];
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const _c = new THREE.Color();

export const hash = (x, z = 0, s = 0) => { const n = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, oct = 4) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); n += a; a *= .5; f *= 2.03; } return s / n; }
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.n = 0; }
  // 体素 (x,y,z) 在 a 轴（0=x 1=y 2=z）s 方向（±1）上的一个面；solid(x,y,z) 用来算遮蔽
  face(x, y, z, a, s, r, g, b, solid) {
    const u = (a + 1) % 3, v = (a + 2) % 3, q = [x, y, z]; q[a] += s;
    const ao = [0, 0, 0, 0], base = this.n, nrm = [0, 0, 0]; nrm[a] = s;
    for (let i = 0; i < 4; i++) {
      const cu = CORNERS[i][0], cv = CORNERS[i][1], du = cu * 2 - 1, dv = cv * 2 - 1;
      const p = [x, y, z]; if (s > 0) p[a] += 1; p[u] += cu; p[v] += cv;
      const n1 = [q[0], q[1], q[2]]; n1[u] += du;
      const n2 = [q[0], q[1], q[2]]; n2[v] += dv;
      const n3 = [q[0], q[1], q[2]]; n3[u] += du; n3[v] += dv;
      const s1 = solid(n1[0], n1[1], n1[2]) ? 1 : 0, s2 = solid(n2[0], n2[1], n2[2]) ? 1 : 0, s3 = solid(n3[0], n3[1], n3[2]) ? 1 : 0;
      const k = (s1 && s2) ? 0 : 3 - (s1 + s2 + s3); ao[i] = k;
      const m = AO[k];
      this.pos.push(p[0], p[1], p[2]); this.nor.push(nrm[0], nrm[1], nrm[2]);
      this.col.push(r * m, g * (m * .97 + .03), b * (m * .9 + .1));  // 暗处略偏蓝
    }
    this.n += 4;
    const t = (ao[0] + ao[2] < ao[1] + ao[3]) ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
    if (s > 0) for (let i = 0; i < 6; i++) this.idx.push(base + t[i]);
    else for (let i = 5; i >= 0; i--) this.idx.push(base + t[i]);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.idx), 1));
    g.computeBoundingSphere();
    return g;
  }
}

const K = (x, y, z) => (x + 512) + (y + 512) * 1024 + (z + 512) * 1048576;
// 一个体素模型：set / box 往里放方块，mesh() 生成网格
export class Vox {
  constructor() { this.m = new Map(); }
  set(x, y, z, c) { this.m.set(K(x, y, z), c); return this; }
  del(x, y, z) { this.m.delete(K(x, y, z)); return this; }
  has(x, y, z) { return this.m.has(K(x, y, z)); }
  box(x0, y0, z0, x1, y1, z1, c) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c); return this; }
  each(fn) { for (const [k, c] of this.m) { const x = k % 1024 - 512, y = Math.floor(k / 1024) % 1024 - 512, z = Math.floor(k / 1048576) - 512; fn(x, y, z, c); } }
  // 露在上面的方块上积雪（prob 是积雪的比例）
  snow(c = 0xf4f8ff, prob = 1, seed = 0) { const add = []; this.each((x, y, z) => { if (!this.has(x, y + 1, z) && hash(x, z, seed + y) < prob) add.push([x, y + 1, z]); }); for (const p of add) this.set(p[0], p[1], p[2], c); return this; }
  geometry(jitter = .035) {
    const b = new Builder(), solid = (x, y, z) => this.has(x, y, z);
    this.each((x, y, z, c) => {
      _c.set(c); const j = 1 + (hash(x * 3.1 + y * 7.7, z * 5.3) - .5) * 2 * jitter;
      const r = _c.r * j, g = _c.g * j, bl = _c.b * j;
      if (!this.has(x + 1, y, z)) b.face(x, y, z, 0, 1, r, g, bl, solid);
      if (!this.has(x - 1, y, z)) b.face(x, y, z, 0, -1, r, g, bl, solid);
      if (!this.has(x, y + 1, z)) b.face(x, y, z, 1, 1, r, g, bl, solid);
      if (!this.has(x, y - 1, z)) b.face(x, y, z, 1, -1, r, g, bl, solid);
      if (!this.has(x, y, z + 1)) b.face(x, y, z, 2, 1, r, g, bl, solid);
      if (!this.has(x, y, z - 1)) b.face(x, y, z, 2, -1, r, g, bl, solid);
    });
    return b.geometry();
  }
  mesh(mat, jitter) { const m = new THREE.Mesh(this.geometry(jitter), mat); m.castShadow = m.receiveShadow = true; return m; }
}

// 角色专用材质：在场景灯光之外给自己补一点光，逆光或帽檐阴影下脸也不会发黑
export function charMaterial(fill = .2) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: 0 });
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * ${fill.toFixed(3)};`); };
  return m;
}

export const linc = hex => { _c.set(hex); return [_c.r, _c.g, _c.b]; };
// 高度图地形：height(x,z) 给出每一格的高度，color(x,y,z,h) 给出这一块的颜色 [r,g,b]（用 linc 转好的）
export function heightfield({ X0, X1, Z0, Z1, height, color, maxDrop = 60 }) {
  const NX = X1 - X0, NZ = Z1 - Z0, HG = new Int16Array(NX * NZ);
  for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) HG[z * NX + x] = Math.round(height(x + X0, z + Z0));
  const getH = (x, z) => { x = Math.floor(x); z = Math.floor(z); return (x < X0 || x >= X1 || z < Z0 || z >= Z1) ? -99 : HG[(z - Z0) * NX + (x - X0)]; };
  const b = new Builder(), solid = (x, y, z) => y < getH(x, z), NB = [[1, 0, 0, 1], [-1, 0, 0, -1], [0, 1, 2, 1], [0, -1, 2, -1]];
  for (let z = Z0 + 1; z < Z1 - 1; z++) for (let x = X0 + 1; x < X1 - 1; x++) {
    const h = getH(x, z), top = color(x, h - 1, z, h);
    b.face(x, h - 1, z, 1, 1, top[0], top[1], top[2], solid);
    for (const [dx, dz, a, s] of NB) {
      const hn = getH(x + dx, z + dz);
      for (let y = Math.max(hn, h - maxDrop); y < h; y++) { const c = color(x, y, z, h); b.face(x, y, z, a, s, c[0], c[1], c[2], solid); }
    }
  }
  return { geometry: b.geometry(), getH };
}

// 一池子小方块，每帧重新摆：雪花、火星、纸屑、热气、花瓣都用它
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
export class Bits {
  constructor(n) {
    this.n = n; this.i = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), n);
    this.mesh.frustumCulled = false; this.mesh.setColorAt(0, _c.set(0xffffff));
  }
  begin() { this.i = 0; }
  // gain > 1 会发亮（配合泛光）；sy 不给就是正方块
  add(x, y, z, s, color, gain = 1, rot = 0, sy = s) {
    if (this.i >= this.n || s <= 0) return;
    _p.set(x, y, z); _e.set(rot * .7, rot, rot * .4); _q.setFromEuler(_e); _s.set(s, sy, s); _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(this.i, _m); _c.set(color).multiplyScalar(gain); this.mesh.setColorAt(this.i, _c); this.i++;
  }
  end() {
    _s.set(0, 0, 0); _m.compose(_p.set(0, -999, 0), _q.identity(), _s);
    for (let k = this.i; k < this.n; k++) this.mesh.setMatrixAt(k, _m);
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
}
