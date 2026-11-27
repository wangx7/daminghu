// 大明湖核心片区标准模块（js/districts/daming.js）
// 遵循统一片区协议：{ id, mount(ctx) -> { update, unmount, refs } }
import { buildAllLandmarks } from '../landmarks.js';
import { buildExtraLandmarks } from '../landmarks_extra.js';
import { buildFullLakeBuildings } from '../landmarks_full.js';
import { buildWestNorthLandmarks } from '../landmarks_west_north.js';
import { buildLakeWallsAndScenery } from '../walls.js';
import { buildSprings } from '../springs.js';

export const DISTRICT_ID = 'daming';

export function mount({ scene, voxelMat, collider, snowMeshes }) {
  collider.beginScope?.(DISTRICT_ID);
  const landmarks = buildAllLandmarks(scene, voxelMat, collider, snowMeshes);
  const extraLandmarks = buildExtraLandmarks(scene, voxelMat, collider, snowMeshes);
  const fullBuildings = buildFullLakeBuildings(scene, voxelMat, collider, snowMeshes);
  const westNorth = buildWestNorthLandmarks(scene, voxelMat, collider, snowMeshes);
  const wallsAndScenery = buildLakeWallsAndScenery(scene, voxelMat, collider, snowMeshes);
  const springs = buildSprings(scene, voxelMat, collider, snowMeshes);
  collider.endScope?.();

  return {
    refs: {
      chaoran: landmarks.chaoran,
      cruise: landmarks.cruise,
      cruises: landmarks.cruises,
      ferris: fullBuildings.ferris,
      waterPosts: wallsAndScenery.waterPosts,
    },
    update(_dt, elapsed, nightFactor) {
      landmarks.update(elapsed, nightFactor);
      extraLandmarks.update(elapsed, nightFactor);
      fullBuildings.update(elapsed, nightFactor);
      westNorth.update(nightFactor);
      wallsAndScenery.update(elapsed, nightFactor);
      springs.update(elapsed);
    },
    unmount() {
      // 大明湖为核心常驻片区，默认不卸载；保留标准接口以便测试
      collider.clearScope?.(DISTRICT_ID);
    },
  };
}
