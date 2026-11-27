import * as THREE from 'three';
import type { SkinConfig } from '@daminghu/shared';
import { Vox, charMaterial } from './legacy/voxel/vox.js';

const EYE = 0x2a1e2e;
const PINK = 0xff9db0;

function fillBlob(
  v: any,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  rx: number,
  ry: number,
  rz: number,
  cy: number,
  p: number,
  color: number | ((x: number, y: number) => number),
) {
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        const val =
          Math.pow(Math.abs(x) / rx, p) +
          Math.pow(Math.abs(y - cy) / ry, p) +
          Math.pow(Math.abs(z) / rz, p);
        if (val <= 1) {
          v.set(x, y, z, typeof color === 'function' ? color(x, y) : color);
        }
      }
    }
  }
}

/**
 * 构建四季主题体素团团模型（纯外观、零数值加成）
 */
export function buildSeasonalTuanMesh(skin: SkinConfig): THREE.Mesh {
  const { body, shade, scarf, scarfDark, accent, hatColor, hatRibbon } = skin.palette;
  const v = new Vox();

  fillBlob(v, -6, 6, 0, 11, -5, 5, 6.7, 6.1, 5.7, 5.5, 2.8, (_x, y) => (y <= 1 ? shade : body));
  // 头顶小尖
  v.box(-1, 12, -1, 1, 12, 1, body);
  v.set(0, 13, 0, body).set(1, 14, 0, body);

  // 眼睛与腮红
  v.box(-2, 6, 5, -2, 7, 5, EYE);
  v.box(2, 6, 5, 2, 7, 5, EYE);
  v.set(0, 5, 5, 0xd9506e);
  for (const x of [-4, -3, 3, 4]) v.set(x, 5, 5, PINK);

  // 四季主题围巾
  const ring: Array<[number, number]> = [];
  v.each((x: number, y: number, z: number) => {
    if (
      y === 2 &&
      !(v.has(x + 1, y, z) && v.has(x - 1, y, z) && v.has(x, y, z + 1) && v.has(x, y, z - 1))
    ) {
      ring.push([x, z]);
    }
  });
  for (const [x, z] of ring) v.set(x, 2, z, scarf);
  v.set(3, 2, 5, scarf).set(4, 2, 5, scarf).set(3, 1, 5, scarfDark).set(3, 0, 5, accent);

  // 左右小手与双脚
  v.box(-7, 5, 0, -7, 6, 1, body);
  v.box(7, 7, 0, 7, 8, 1, body).set(8, 9, 0, body).set(8, 9, 1, body);
  v.box(-3, -1, 1, -2, -1, 3, shade);
  v.box(2, -1, 1, 3, -1, 3, shade);

  // 四季主题头饰（春柳花环 / 夏草帽 / 秋枫贝雷 / 冬雪绒帽）
  if (hatColor !== undefined) {
    const ribbon = hatRibbon ?? accent;
    if (skin.season === 'summer') {
      // 盛夏小草帽
      for (let x = -8; x <= 8; x++) {
        for (let z = -7; z <= 7; z++) {
          const r = Math.hypot(x / 8.2, z / 7.2);
          if (r <= 1.0 && r >= 0.45) v.set(x, 11, z, (Math.abs(x) + Math.abs(z)) % 2 ? hatColor : shade);
        }
      }
      for (let y = 12; y <= 14; y++) {
        for (let x = -5; x <= 5; x++) {
          for (let z = -4; z <= 4; z++) {
            const r = Math.hypot(x / (5.4 - (y - 11) * 0.45), z / (4.5 - (y - 11) * 0.4));
            if (r <= 1.0) v.set(x, y, z, y === 12 && r > 0.72 ? ribbon : hatColor);
          }
        }
      }
    } else if (skin.season === 'winter') {
      // 冬日毛绒尖帽 + 雪球顶
      for (let y = 11; y <= 15; y++) {
        const rad = Math.max(1.2, 6.2 - (y - 11) * 1.1);
        for (let x = -6; x <= 6; x++) {
          for (let z = -5; z <= 5; z++) {
            if (Math.hypot(x / rad, z / (rad * 0.88)) <= 1) {
              v.set(x, y, z, y === 11 ? ribbon : hatColor);
            }
          }
        }
      }
      v.box(-1, 16, -1, 1, 17, 1, 0xffffff);
    } else if (skin.season === 'spring') {
      // 春日柳叶桃花环
      for (let a = 0; a < 24; a++) {
        const rad = (a / 24) * Math.PI * 2;
        const hx = Math.round(Math.cos(rad) * 5.6);
        const hz = Math.round(Math.sin(rad) * 4.8);
        v.set(hx, 11, hz, a % 4 === 0 ? ribbon : hatColor);
        if (a % 6 === 0) v.set(hx, 12, hz, ribbon);
      }
    } else {
      // 金秋雅韵小檐帽 + 枫叶徽
      for (let y = 11; y <= 13; y++) {
        const rad = 6.0 - (y - 11) * 0.9;
        for (let x = -6; x <= 6; x++) {
          for (let z = -5; z <= 5; z++) {
            if (Math.hypot(x / rad, z / (rad * 0.9)) <= 1) {
              v.set(x, y, z, y === 11 && z > 2 ? ribbon : hatColor);
            }
          }
        }
      }
      v.set(4, 12, 3, ribbon).set(5, 13, 3, accent);
    }
  }

  const cMat = charMaterial(0.24);
  const mesh: THREE.Mesh = v.mesh(cMat, 0.02);
  mesh.scale.setScalar(0.115);
  mesh.position.y = 0.12;
  return mesh;
}

/**
 * 将四季皮肤实时应用到玩家角色模型与敞篷跑车车身涂装
 */
export function applySkinToPlayer(player: any, skin: SkinConfig) {
  if (!player?.root) return;
  if (player.tuanMesh) {
    player.root.remove(player.tuanMesh);
    player.tuanMesh.geometry?.dispose?.();
  }
  const nextMesh = buildSeasonalTuanMesh(skin);
  player.tuanMesh = nextMesh;
  player.root.add(nextMesh);

  // 同步跑车车身微调色调（利用材质染色，零几何体重建开销）
  const carBody = player.car?.group?.children?.[0] as THREE.Mesh | undefined;
  if (carBody && carBody.material && !Array.isArray(carBody.material)) {
    const mat = (carBody.material as THREE.MeshStandardMaterial).clone();
    mat.color.setHex(skin.palette.carPrimary).lerp(new THREE.Color(0xffffff), 0.35);
    carBody.material = mat;
  }
}
