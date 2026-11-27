// 泉城名泉通用构建模块（读取 OSM_DATA.springs）
// 大明湖园内（感应井泉、司家井、扇面泉）率先接入，后续扩展趵突泉、五龙潭、黑虎泉直接复用！
import * as THREE from 'three';
import { Vox } from './voxel/vox.js';
import { OSM_DATA } from './osm_data.js';
import { buildSnowCap, createSignboard } from './collider.js';

const C = {
  STONE: 0xd5cfc2,
  STONE_D: 0x8f8a7f,
  MARBLE: 0xedeae2,
  WATER: 0x2ca9c9,
  WATER_LIGHT: 0x67d8ef,
};

export function buildSprings(scene, solidMat, collider, snowMeshes) {
  const springs = OSM_DATA.springs || [];
  const group = new THREE.Group();
  const bubbles = [];

  const bubbleGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xdff9ff,
    emissive: 0x45c8e8,
    emissiveIntensity: 0.45,
    roughness: 0.2,
  });

  for (const sp of springs) {
    const v = new Vox();
    // 5×5 青石雕栏泉池（中心 3×3 泉水）
    v.box(-3, 0, -3, 3, 0, 3, C.STONE_D);
    for (let i = -3; i <= 3; i++) {
      v.set(i, 1, -3, C.MARBLE).set(i, 1, 3, C.MARBLE);
      v.set(-3, 1, i, C.MARBLE).set(3, 1, i, C.MARBLE);
    }
    for (const [cx, cz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      v.set(cx, 2, cz, C.MARBLE);
    }
    v.box(-2, 0, -2, 2, 0, 2, (x, y, z) => ((x + z) & 1) ? C.WATER : C.WATER_LIGHT);
    // 泉畔小石碑
    v.box(-1, 1, -4, 1, 4, -4, C.STONE);

    const g = new THREE.Group();
    g.add(v.mesh(solidMat, 0.02));
    const sign = createSignboard({ title: sp.name, subtitle: '泉城名泉', width: 3.0, height: 1.3, bgColor: '#1f3644' });
    sign.position.set(0, 3.0, -3.35);
    g.add(sign);

    // 4 颗循环上浮泉水气泡
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(bubbleGeo, bubbleMat);
      const bx = (k % 2 === 0 ? -0.6 : 0.6) + (k - 1.5) * 0.2;
      const bz = (k < 2 ? -0.5 : 0.5);
      m.position.set(bx, 1.0, bz);
      g.add(m);
      bubbles.push({ mesh: m, phase: k * 1.57 + sp.x * 0.1 });
    }

    const snow = buildSnowCap(v, 2);
    g.add(snow);
    snowMeshes.push(snow);
    g.position.set(Math.round(sp.x), 2, Math.round(sp.z));
    collider.registerVox(v, Math.round(sp.x), 2, Math.round(sp.z));
    group.add(g);
  }

  scene.add(group);
  return {
    group,
    update(t) {
      for (const b of bubbles) {
        const p = (t * 1.4 + b.phase) % 1;
        b.mesh.position.y = 0.8 + p * 1.2;
        const s = 0.6 + Math.sin(p * Math.PI) * 0.7;
        b.mesh.scale.setScalar(s);
      }
    },
  };
}
