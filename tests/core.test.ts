import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SEASON_SKINS,
  SKIN_MAP,
  WEAPON_CATALOG,
  WEAPON_MAP,
  pickQuizQuestion,
} from '../packages/shared/src/index.ts';
import { P2PRoomClient, compute3DRayHit } from '../packages/engine-core/src/p2pRoomClient.ts';
import type { PlatformAdapter } from '../packages/engine-core/src/platformAdapter.ts';
import {
  computeSplashFalloff,
  resolveBallisticSegment,
  selectBestAimTarget,
  traceAuthoritativeBallistic,
  type AimCandidate,
  type BallisticTarget,
} from '../packages/engine-core/src/combatBallistics.ts';
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

test('ballistics CCD: quehua_bow hits stationary bot consistently at 30/60/120 FPS and before wall behind target', () => {
  const bow = WEAPON_MAP.quehua_bow;
  const testY = 12; // 高于地形与桥面，避免误撞大明湖默认地形
  const botTarget: BallisticTarget = {
    id: 'bot-1',
    x: 0,
    y: testY,
    z: 30,
    hitRadius: 1.85 + bow.projectileRadius,
  };

  // 目标背后紧贴一堵墙 (z: 31.3..33)
  const collider = new WorldCollider();
  collider.beginScope('behind_bot');
  collider.addBoxVolume(-5, 0, 31.3, 5, 20, 33);
  collider.endScope();

  for (const fps of [30, 60, 120]) {
    const dt = 1 / fps;
    let x = 0;
    let y = testY;
    let z = 0;
    const vx = 0;
    let vy = 0.5 * bow.gravity * (30 / bow.projectileSpeed); // 补偿重力下坠
    const vz = bow.projectileSpeed;

    let hitType: 'none' | 'wall' | 'ground' | 'target' = 'none';
    let targetId: string | null = null;
    for (let step = 0; step < fps * 2; step++) {
      const prevX = x;
      const prevY = y;
      const prevZ = z;
      vy -= bow.gravity * dt;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      const seg = resolveBallisticSegment(prevX, prevY, prevZ, x, y, z, [botTarget], collider, 0.4);
      if (seg.hitType !== 'none') {
        hitType = seg.hitType;
        targetId = seg.targetId;
        break;
      }
    }
    assert.equal(hitType, 'target', `expected target hit at ${fps} FPS`);
    assert.equal(targetId, 'bot-1', `expected bot-1 hit at ${fps} FPS`);
  }
});

test('multiplayer nearest hit: front target is always hit before back target regardless of join order', () => {
  const front: BallisticTarget = { id: 'front', x: 0, y: 2.5, z: 20, hitRadius: 2.2 };
  const back: BallisticTarget = { id: 'back', x: 0, y: 2.5, z: 32, hitRadius: 2.2 };

  for (const weapon of [WEAPON_MAP.spring_blaster, WEAPON_MAP.quehua_bow]) {
    const resBackFirst = traceAuthoritativeBallistic({
      originX: 0,
      originY: 2.5,
      originZ: 0,
      dirX: 0,
      dirY: 0,
      dirZ: 1,
      weapon,
      targets: [back, front],
    });
    const resFrontFirst = traceAuthoritativeBallistic({
      originX: 0,
      originY: 2.5,
      originZ: 0,
      dirX: 0,
      dirY: 0,
      dirZ: 1,
      weapon,
      targets: [front, back],
    });
    assert.equal(resBackFirst.directTargetId, 'front', `${weapon.id} should hit front even when back is listed first`);
    assert.equal(resFrontFirst.directTargetId, 'front', `${weapon.id} should hit front when front is listed first`);
  }
});

test('lotus_mortar parabola & splash: ground impact between two targets splashes both with consistent falloff', () => {
  const mortar = WEAPON_MAP.lotus_mortar;
  const groundY = 1.2;
  const aimPoint = { x: 0, y: groundY, z: 42 };
  const origin = { x: 0, y: groundY + 1.45, z: 1.4 };

  // 使用与客户端 DamingLakeGame.fireWeapon 相同的重力抬高补偿
  const dist = Math.hypot(aimPoint.x - origin.x, aimPoint.y - origin.y, aimPoint.z - origin.z);
  const flightTime = Math.min(2.2, dist / mortar.projectileSpeed);
  const compensatedY = aimPoint.y + 0.5 * mortar.gravity * flightTime * flightTime;
  const dx = aimPoint.x - origin.x;
  const dy = compensatedY - origin.y;
  const dz = aimPoint.z - origin.z;

  const targets: BallisticTarget[] = [
    { id: 'left', x: -4.2, y: groundY + 1.25, z: 42, hitRadius: 2.4, splashX: -4.2, splashY: groundY, splashZ: 42 },
    { id: 'right', x: 4.2, y: groundY + 1.25, z: 42, hitRadius: 2.4, splashX: 4.2, splashY: groundY, splashZ: 42 },
    { id: 'far', x: 14, y: groundY + 1.25, z: 42, hitRadius: 2.4, splashX: 14, splashY: groundY, splashZ: 42 },
  ];

  const trace = traceAuthoritativeBallistic({
    originX: origin.x,
    originY: origin.y,
    originZ: origin.z,
    dirX: dx,
    dirY: dy,
    dirZ: dz,
    weapon: mortar,
    targets,
    getGroundHeight: () => groundY,
  });

  assert.equal(trace.hitType, 'ground');
  const hitIds = trace.splashHits.map((h) => h.targetId).sort();
  assert.deepEqual(hitIds, ['left', 'right']);
  for (const h of trace.splashHits) {
    assert.equal(h.damage, Math.round(mortar.damage * computeSplashFalloff(h.distance, mortar.splashRadius)));
    assert.ok(h.damage > 0 && h.damage < mortar.damage);
  }
});

test('aim assist: direct crosshair enemy beats nearby edge bird, and angular error beats raw distance', () => {
  const candidates: AimCandidate[] = [
    {
      id: 'bird-near',
      x: 1.7,
      y: 2.5,
      z: 12,
      kind: 'wildlife',
      name: '白鹭',
      directRadius: 1.35,
      assistBaseRadius: 2.2,
      assistMaxRadius: 4.2,
    },
    {
      id: 'bot-far',
      x: 0.1,
      y: 2.5,
      z: 50,
      kind: 'enemy',
      name: '游侠靶 1',
      hpRatio: 1,
      directRadius: 1.2,
      assistBaseRadius: 1.9,
      assistMaxRadius: 4.0,
    },
  ];

  const lockedPractice = selectBestAimTarget({
    rayOrigin: { x: 0, y: 2.5, z: 0 },
    rayDir: { x: 0, y: 0, z: 1 },
    maxRange: 135,
    candidates,
    mode: 'practice_solo',
    isTouch: false,
  });
  assert.equal(lockedPractice?.id, 'bot-far');
  assert.equal(lockedPractice?.isDirect, true);

  // 两名敌人都不在直指范围内，远处敌人偏离角度更小，应优先锁定远处敌人而非近处边缘敌人
  const angularCandidates: AimCandidate[] = [
    {
      id: 'near-edge',
      x: 1.6,
      y: 2.5,
      z: 15,
      kind: 'enemy',
      name: '近处边缘',
      directRadius: 1.2,
      assistBaseRadius: 1.9,
      assistMaxRadius: 4.0,
    },
    {
      id: 'far-center',
      x: 1.5,
      y: 2.5,
      z: 55,
      kind: 'enemy',
      name: '远处正中',
      directRadius: 1.2,
      assistBaseRadius: 1.9,
      assistMaxRadius: 4.0,
    },
  ];
  const lockedAngular = selectBestAimTarget({
    rayOrigin: { x: 0, y: 2.5, z: 0 },
    rayDir: { x: 0, y: 0, z: 1 },
    maxRange: 135,
    candidates: angularCandidates,
    mode: 'practice_solo',
    isTouch: true,
  });
  assert.equal(lockedAngular?.id, 'far-center');
});

function createFakePlatform(startMs = 10000): { platform: PlatformAdapter; advanceMs: (ms: number) => void } {
  let nowMs = startMs;
  const platform: PlatformAdapter = {
    now: () => nowMs,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    getDevicePixelRatio: () => 1,
    isMobileViewport: () => false,
    createCanvas: () => {
      throw new Error('not needed in headless test');
    },
  };
  return {
    platform,
    advanceMs: (ms: number) => {
      nowMs += ms;
    },
  };
}

test('room leaveRoom: preserves driver vehicle when not a passenger, disembarks when actually a passenger', () => {
  const passengerEvents: Array<{ driverId: string | null }> = [];
  const { platform } = createFakePlatform();
  const room = new P2PRoomClient(
    {
      onPassengerSync: (info) => passengerEvents.push({ driverId: info.driverId }),
    },
    null,
    platform,
  );

  // 未处于乘客状态时离开/重置房间，不应触发离座回调（避免清除玩家正在驾驶的载具）
  room.leaveRoom(false);
  assert.equal(passengerEvents.length, 0);

  // 实际作为乘客时离房，应正常通知离座
  (room as any).localPassengerOf = 'driver-1';
  room.leaveRoom(false);
  assert.equal(passengerEvents.length, 1);
  assert.equal(passengerEvents[0].driverId, null);
});

test('room host clock: match ends at the same wall-clock time across 10/30/60 FPS', () => {
  for (const fps of [10, 30, 60]) {
    const fake = createFakePlatform(10000);
    let matchEnded = false;
    const room = new P2PRoomClient(
      {
        onMatchEnd: () => {
          matchEnded = true;
        },
      },
      null,
      fake.platform,
    );

    const r = room as any;
    r.status = 'connected';
    r.isHost = true;
    r.localPlayerId = 'host-1';
    r.config = { mode: 'ffa', teamSize: 2, matchDurationSec: 10, fillBots: false };
    r.hostEntities.set('host-1', {
      id: 'host-1',
      name: '房主',
      isHost: true,
      isBot: false,
      team: 'none',
      x: 0,
      y: 2,
      z: 0,
      yaw: 0,
      vehicle: 'foot',
      passengerOf: null,
      seatIndex: -1,
      vehicleHp: 0,
      vehicleMaxHp: 0,
      skinId: 'summer_lotus',
      weaponId: 'spring_blaster',
      hp: 100,
      maxHp: 100,
      alive: true,
      kills: 0,
      deaths: 0,
      respawnTimer: 0,
      respawnAt: 0,
      lastFireAt: 0,
      botHomeX: 0,
      botHomeZ: 0,
      botPhase: 0,
      botFireCd: 0,
    });
    room.startMatch();

    const frameMs = 1000 / fps;
    const clampedDt = Math.min(0.05, 1 / fps);
    const state = { x: 0, y: 2, z: 0, yaw: 0, vehicle: 'foot' as const, skinId: 'summer_lotus' as const, weaponId: 'spring_blaster' as const };

    // 9.5 秒内不应提前结束
    const steps95 = Math.floor(9500 / frameMs);
    for (let i = 0; i < steps95; i++) {
      fake.advanceMs(frameMs);
      room.update(clampedDt, state);
    }
    assert.equal(matchEnded, false, `match should not end early at ${fps} FPS`);

    // 再推进 1 秒（超过 10 秒墙钟），无论 10/30/60 FPS 都必须结束
    const steps10 = Math.ceil(1000 / frameMs);
    for (let i = 0; i < steps10; i++) {
      fake.advanceMs(frameMs);
      room.update(clampedDt, state);
    }
    assert.equal(matchEnded, true, `match should end on time at ${fps} FPS`);
  }
});

test('room host mortar flight: hits moving target that enters impact zone during projectile flight', () => {
  const fake = createFakePlatform(20000);
  const hits: number[] = [];
  const room = new P2PRoomClient(
    {
      onLocalHit: (dmg) => hits.push(dmg),
    },
    null,
    fake.platform,
  );

  const r = room as any;
  r.status = 'connected';
  r.isHost = true;
  r.phase = 'playing';
  r.localPlayerId = 'host-1';
  r.config = { mode: 'ffa', teamSize: 2, matchDurationSec: 180, fillBots: false };
  r.matchEndAt = fake.platform.now() + 180000;
  r.hostEntities.set('host-1', {
    id: 'host-1',
    name: '房主',
    isHost: true,
    isBot: false,
    team: 'none',
    x: 0,
    y: 2,
    z: 0,
    yaw: 0,
    vehicle: 'foot',
    passengerOf: null,
    seatIndex: -1,
    vehicleHp: 0,
    vehicleMaxHp: 0,
    skinId: 'summer_lotus',
    weaponId: 'lotus_mortar',
    hp: 100,
    maxHp: 100,
    alive: true,
    kills: 0,
    deaths: 0,
    respawnTimer: 0,
    respawnAt: 0,
    lastFireAt: 0,
    botHomeX: 0,
    botHomeZ: 0,
    botPhase: 0,
    botFireCd: 0,
  });
  // 目标开火时在 x = -12（远离落点 x = 0, z = 40），随后横移进入落点
  const movingTarget = {
    id: 'guest-1',
    name: '横移目标',
    isHost: false,
    isBot: false,
    team: 'none' as const,
    x: -12,
    y: 2,
    z: 40,
    yaw: 0,
    vehicle: 'foot' as const,
    passengerOf: null,
    seatIndex: -1,
    vehicleHp: 0,
    vehicleMaxHp: 0,
    skinId: 'summer_lotus' as const,
    weaponId: 'spring_blaster' as const,
    hp: 100,
    maxHp: 100,
    alive: true,
    kills: 0,
    deaths: 0,
    respawnTimer: 0,
    respawnAt: 0,
    lastFireAt: 0,
    botHomeX: 0,
    botHomeZ: 40,
    botPhase: 0,
    botFireCd: 0,
  };
  r.hostEntities.set('guest-1', movingTarget);

  // 向 (0, 2, 40) 提前量位置发射荷花水炮
  const mortar = WEAPON_MAP.lotus_mortar;
  const dist = 38.6;
  const tFlight = dist / mortar.projectileSpeed;
  const compY = 2 + 0.5 * mortar.gravity * tFlight * tFlight;
  const pitch = Math.asin((compY - 3.45) / Math.hypot(dist, compY - 3.45));
  r.processAuthoritativeFire('host-1', 0, 2, 0, 0, 'lotus_mortar', pitch);

  // 开火瞬间尚未撞击，不应提前扣血
  assert.equal(hits.length, 0);
  assert.equal(movingTarget.hp, 100);

  // 逐帧推进 1 秒，期间目标匀速横移到 (0, 2, 40)
  const dt = 1 / 60;
  const state = { x: 0, y: 2, z: 0, yaw: 0, vehicle: 'foot' as const, skinId: 'summer_lotus' as const, weaponId: 'lotus_mortar' as const };
  for (let i = 0; i < 65; i++) {
    movingTarget.x = Math.min(0, movingTarget.x + 16 * dt);
    fake.advanceMs(dt * 1000);
    room.update(dt, state);
  }

  assert.ok(hits.length > 0, 'moving target entering mortar landing zone should be hit on arrival');
  assert.ok(movingTarget.hp < 100, 'moving target HP should decrease upon impact');
});
