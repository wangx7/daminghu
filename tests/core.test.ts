import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SEASON_SKINS,
  SKIN_MAP,
  WEAPON_CATALOG,
  WEAPON_MAP,
  pickQuizQuestion,
} from '../packages/shared/src/index.ts';
import { compute3DRayHit } from '../packages/engine-core/src/p2pRoomClient.ts';
import { computeSeatWorldPos, computeVehicleSeatOffset } from '../packages/engine-core/src/remotePlayerManager.ts';
import { WorldCollider } from '../packages/engine-core/src/legacy/collider.js';

test('shared catalog: skins and weapons integrity', () => {
  assert.equal(SEASON_SKINS.length, 4);
  for (const s of SEASON_SKINS) {
    assert.equal(SKIN_MAP[s.id]?.name, s.name);
  }
  assert.equal(WEAPON_CATALOG.length, 3);
  for (const w of WEAPON_CATALOG) {
    assert.equal(WEAPON_MAP[w.id]?.name, w.name);
    assert.ok(w.damage > 0 && w.cooldownSec > 0 && w.maxRange > 0);
  }
});

test('shared quiz: pickQuizQuestion returns valid questions for all categories', () => {
  for (const cat of ['poetry', 'math', 'mixed'] as const) {
    const q = pickQuizQuestion(cat);
    assert.ok(q.prompt.length > 0);
    assert.ok(q.options.length >= 2);
    assert.ok(q.answerIndex >= 0 && q.answerIndex < q.options.length);
  }
});

test('p2p anti-air: compute3DRayHit hits high-altitude helicopter and rejects misses', () => {
  // 地面玩家在 (0, 2, 0) 抬头 45° 朝 +Z 方向射击高空直升机 (0, 32, 30)
  const yaw = 0;
  const pitch = Math.PI / 4;
  const fx = Math.sin(yaw) * Math.cos(pitch);
  const fy = Math.sin(pitch);
  const fz = Math.cos(yaw) * Math.cos(pitch);

  const hit = compute3DRayHit(0, 2, 0, fx, fy, fz, 210, 0, 32, 30, 4.2);
  assert.equal(hit.hit, true);
  assert.ok(hit.perpDist < 0.01);

  // 偏离射线太远的目标应未命中
  const miss = compute3DRayHit(0, 2, 0, fx, fy, fz, 210, 15, 32, 30, 4.2);
  assert.equal(miss.hit, false);

  // 背后的目标应未命中
  const behind = compute3DRayHit(0, 2, 0, fx, fy, fz, 210, 0, 2, -10, 4.2);
  assert.equal(behind.hit, false);

  // 超出射程的目标应未命中
  const tooFar = compute3DRayHit(0, 2, 0, fx, fy, fz, 20, 0, 32, 30, 4.2);
  assert.equal(tooFar.hit, false);
});

test('vehicle seats: computeSeatWorldPos rotates offsets correctly by driver yaw', () => {
  const carOffset = computeVehicleSeatOffset('car', 0);
  const pos0 = computeSeatWorldPos(10, 2, 20, 0, 'car', 0);
  assert.ok(Math.abs(pos0.x - (10 + carOffset.lx)) < 1e-6);
  assert.ok(Math.abs(pos0.y - (2 + carOffset.ly)) < 1e-6);
  assert.ok(Math.abs(pos0.z - (20 + carOffset.lz)) < 1e-6);

  // 旋转 180° 后本地偏移应取反
  const posPi = computeSeatWorldPos(10, 2, 20, Math.PI, 'car', 0);
  assert.ok(Math.abs(posPi.x - (10 - carOffset.lx)) < 1e-5);
  assert.ok(Math.abs(posPi.z - (20 - carOffset.lz)) < 1e-5);

  // 直升机 3 个乘客座应互不重叠
  const s0 = computeSeatWorldPos(0, 30, 0, 0, 'heli', 0);
  const s1 = computeSeatWorldPos(0, 30, 0, 0, 'heli', 1);
  const s2 = computeSeatWorldPos(0, 30, 0, 0, 'heli', 2);
  assert.notEqual(s0.x, s1.x);
  assert.notEqual(s0.z, s2.z);
});

test('WorldCollider: AABB volume, raycastSolid wall blocking, and scope cleanup', () => {
  const collider = new WorldCollider();
  collider.beginScope('test_wall');
  // 在 x=10 处放一堵高墙 (x: 9..11, y: 0..10, z: -5..5)
  collider.addBoxVolume(9, 0, -5, 11, 10, 5);
  collider.endScope();

  assert.equal(collider.isSolid(10, 3, 0), true);
  assert.equal(collider.isSolid(5, 3, 0), false);

  // 从 (0, 3, 0) 射向 (20, 3, 0) 必须在 x≈9 处被墙截停
  const wallHit = collider.raycastSolid(0, 3, 0, 20, 3, 0, 0.4);
  assert.ok(wallHit !== null);
  assert.ok(wallHit.x >= 8.5 && wallHit.x <= 11.5);

  // 清理作用域后墙体碰撞消失，射线畅通
  collider.clearScope('test_wall');
  assert.equal(collider.isSolid(10, 3, 0), false);
  const clearHit = collider.raycastSolid(0, 3, 0, 20, 3, 0, 0.4);
  assert.equal(clearHit, null);
});
