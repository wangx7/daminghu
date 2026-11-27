import * as THREE from 'three';

/**
 * 递归释放 Object3D 子树下的全部 BufferGeometry、Material 与 Canvas/Data Texture，
 * 避免切换皮肤、武器、模式或销毁场景时产生 WebGL 显存泄漏。
 */
export function disposeObject3D(root: THREE.Object3D | null | undefined, options?: { disposeTextures?: boolean }) {
  if (!root) return;
  const disposeTextures = options?.disposeTextures ?? false;
  const seenGeos = new Set<THREE.BufferGeometry>();
  const seenMats = new Set<THREE.Material>();

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry && !seenGeos.has(mesh.geometry)) {
      seenGeos.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat || seenMats.has(mat)) continue;
        seenMats.add(mat);
        if (disposeTextures) {
          const anyMat = mat as unknown as Record<string, unknown>;
          for (const key of ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap']) {
            const tex = anyMat[key];
            if (tex instanceof THREE.Texture) {
              tex.dispose();
            }
          }
        }
        mat.dispose();
      }
    }
  });
}
