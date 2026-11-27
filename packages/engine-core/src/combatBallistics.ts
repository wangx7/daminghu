import type { GameMode, WeaponConfig } from '@daminghu/shared';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface SolidRaycastHit {
  x: number;
  y: number;
  z: number;
  dist: number;
}

export interface SolidRaycaster {
  raycastSolid(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    step?: number,
  ): SolidRaycastHit | null;
}

export interface BallisticTarget {
  id: string;
  x: number;
  y: number;
  z: number;
  hitRadius: number;
  /** Optional ground/feet position for splash distance; defaults to (x, y, z) */
  splashX?: number;
  splashY?: number;
  splashZ?: number;
}

export interface BallisticSplashHit {
  targetId: string;
  damage: number;
  distance: number;
  falloff: number;
  dirX: number;
  dirY: number;
  dirZ: number;
}

export interface BallisticTraceResult {
  hitType: 'none' | 'wall' | 'ground' | 'target';
  impactX: number;
  impactY: number;
  impactZ: number;
  directTargetId: string | null;
  splashHits: BallisticSplashHit[];
  travelDistance: number;
}

/**
 * 连续碰撞检测（CCD）：计算线段 A -> B 与球体 (C, radius) 的首次相交参数 t ∈ [0, 1]。
 * 若不相交返回 null；若起点 A 已在球内返回 0。
 */
export function segmentSphereIntersectT(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
): number | null {
  const rSq = radius * radius;
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const lenSq = dx * dx + dy * dy + dz * dz;

  const fx = ax - cx;
  const fy = ay - cy;
  const fz = az - cz;
  const c = fx * fx + fy * fy + fz * fz - rSq;
  if (c <= 0) return 0;
  if (lenSq < 1e-10) return null;

  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const disc = b * b - 4 * lenSq * c;
  if (disc < 0) return null;

  const t = (-b - Math.sqrt(disc)) / (2 * lenSq);
  if (t >= 0 && t <= 1) return t;
  return null;
}

/**
 * 计算溅射衰减系数与伤害（本地练习场与联机房主共用，保证双端结算一致）
 */
export function computeSplashFalloff(distance: number, splashRadius: number): number {
  if (splashRadius <= 0) return 0;
  const clamped = Math.max(0, Math.min(splashRadius, distance));
  return 1 - (clamped / splashRadius) * 0.55;
}

/**
 * 在单个时间步线段 prev -> next 上，同时比较墙体、地面和所有候选目标的首次接触位置，返回最近碰撞者。
 */
export function resolveBallisticSegment(
  prevX: number,
  prevY: number,
  prevZ: number,
  nextX: number,
  nextY: number,
  nextZ: number,
  targets: readonly BallisticTarget[],
  collider?: SolidRaycaster | null,
  groundY?: number,
): {
  hitType: 'none' | 'wall' | 'ground' | 'target';
  t: number;
  impactX: number;
  impactY: number;
  impactZ: number;
  targetId: string | null;
} {
  const dx = nextX - prevX;
  const dy = nextY - prevY;
  const dz = nextZ - prevZ;
  const segLen = Math.hypot(dx, dy, dz);

  let bestT = Infinity;
  let hitType: 'none' | 'wall' | 'ground' | 'target' = 'none';
  let targetId: string | null = null;

  // 1. 墙体/建筑/树木实体碰撞
  if (collider && segLen > 1e-6) {
    const wallHit = collider.raycastSolid(prevX, prevY, prevZ, nextX, nextY, nextZ, 0.4);
    if (wallHit) {
      const wallT = Math.max(0, Math.min(1, wallHit.dist / segLen));
      if (wallT < bestT) {
        bestT = wallT;
        hitType = 'wall';
        targetId = null;
      }
    }
  }

  // 2. 地面/水面碰撞
  if (groundY !== undefined && nextY <= groundY) {
    const groundT = prevY > groundY && prevY !== nextY ? Math.max(0, Math.min(1, (prevY - groundY) / (prevY - nextY))) : 0;
    if (groundT < bestT) {
      bestT = groundT;
      hitType = 'ground';
      targetId = null;
    }
  }

  // 3. 所有候选目标的连续路径碰撞（取沿路径最近者）
  for (let i = 0; i < targets.length; i++) {
    const tgt = targets[i];
    const t = segmentSphereIntersectT(prevX, prevY, prevZ, nextX, nextY, nextZ, tgt.x, tgt.y, tgt.z, tgt.hitRadius);
    if (t !== null && t < bestT) {
      bestT = t;
      hitType = 'target';
      targetId = tgt.id;
    }
  }

  if (hitType === 'none') {
    return {
      hitType: 'none',
      t: 1,
      impactX: nextX,
      impactY: nextY,
      impactZ: nextZ,
      targetId: null,
    };
  }

  return {
    hitType,
    t: bestT,
    impactX: prevX + dx * bestT,
    impactY: prevY + dy * bestT,
    impactZ: prevZ + dz * bestT,
    targetId,
  };
}

/**
 * 统一的弹道步进与溅射结算（供联机房主权威判定与回归测试使用，与本地 CombatSystem 物理参数一致）
 */
export function traceAuthoritativeBallistic(params: {
  originX: number;
  originY: number;
  originZ: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  weapon: WeaponConfig;
  targets: readonly BallisticTarget[];
  collider?: SolidRaycaster | null;
  getGroundHeight?: (x: number, z: number) => number;
  stepDt?: number;
  maxLifeSec?: number;
}): BallisticTraceResult {
  const {
    originX,
    originY,
    originZ,
    dirX,
    dirY,
    dirZ,
    weapon,
    targets,
    collider,
    getGroundHeight,
    stepDt = 1 / 60,
    maxLifeSec = 3.2,
  } = params;

  const dirLen = Math.hypot(dirX, dirY, dirZ) || 1;
  const ndx = dirX / dirLen;
  const ndy = dirY / dirLen;
  const ndz = dirZ / dirLen;

  let x = originX;
  let y = originY;
  let z = originZ;
  let vx = ndx * weapon.projectileSpeed;
  let vy = ndy * weapon.projectileSpeed;
  let vz = ndz * weapon.projectileSpeed;

  let hitType: 'none' | 'wall' | 'ground' | 'target' = 'none';
  let directTargetId: string | null = null;
  let impactX = originX;
  let impactY = originY;
  let impactZ = originZ;
  let travelDistance = 0;

  // 无重力武器直接单段精确判定（快且无步进误差）
  if (weapon.gravity <= 0) {
    const endX = originX + ndx * weapon.maxRange;
    const endY = originY + ndy * weapon.maxRange;
    const endZ = originZ + ndz * weapon.maxRange;
    const seg = resolveBallisticSegment(originX, originY, originZ, endX, endY, endZ, targets, collider);
    hitType = seg.hitType;
    directTargetId = seg.targetId;
    impactX = seg.impactX;
    impactY = seg.impactY;
    impactZ = seg.impactZ;
    travelDistance = Math.hypot(impactX - originX, impactY - originY, impactZ - originZ);
  } else {
    const maxSteps = Math.ceil(maxLifeSec / stepDt);
    for (let step = 0; step < maxSteps; step++) {
      const prevX = x;
      const prevY = y;
      const prevZ = z;
      vy -= weapon.gravity * stepDt;
      const nextX = prevX + vx * stepDt;
      const nextY = prevY + vy * stepDt;
      const nextZ = prevZ + vz * stepDt;
      const groundY = getGroundHeight ? Math.max(0.4, getGroundHeight(nextX, nextZ)) : undefined;

      const seg = resolveBallisticSegment(prevX, prevY, prevZ, nextX, nextY, nextZ, targets, collider, groundY);
      if (seg.hitType !== 'none') {
        hitType = seg.hitType;
        directTargetId = seg.targetId;
        impactX = seg.impactX;
        impactY = seg.impactY;
        impactZ = seg.impactZ;
        travelDistance += Math.hypot(impactX - prevX, impactY - prevY, impactZ - prevZ);
        break;
      }

      const stepDist = Math.hypot(nextX - prevX, nextY - prevY, nextZ - prevZ);
      travelDistance += stepDist;
      x = nextX;
      y = nextY;
      z = nextZ;
      impactX = x;
      impactY = y;
      impactZ = z;

      if (Math.hypot(x - originX, y - originY, z - originZ) >= weapon.maxRange) {
        break;
      }
    }
  }

  const splashHits: BallisticSplashHit[] = [];
  if (weapon.splashRadius > 0 && hitType !== 'none') {
    for (let i = 0; i < targets.length; i++) {
      const tgt = targets[i];
      const tx = tgt.splashX ?? tgt.x;
      const ty = tgt.splashY ?? tgt.y;
      const tz = tgt.splashZ ?? tgt.z;
      const dx = tx - impactX;
      const dy = ty - impactY;
      const dz = tz - impactZ;
      const dist = Math.hypot(dx, dy, dz);
      if (tgt.id === directTargetId || dist <= weapon.splashRadius) {
        const falloff = tgt.id === directTargetId ? 1 : computeSplashFalloff(dist, weapon.splashRadius);
        const dirScale = dist > 0.01 ? 1 / dist : 0;
        splashHits.push({
          targetId: tgt.id,
          damage: Math.round(weapon.damage * falloff),
          distance: dist,
          falloff,
          dirX: dirScale > 0 ? dx * dirScale : ndx,
          dirY: dirScale > 0 ? dy * dirScale : ndy,
          dirZ: dirScale > 0 ? dz * dirScale : ndz,
        });
      }
    }
  }

  return {
    hitType,
    impactX,
    impactY,
    impactZ,
    directTargetId,
    splashHits,
    travelDistance,
  };
}

export interface AimCandidate {
  id: string;
  x: number;
  y: number;
  z: number;
  kind: 'enemy' | 'wildlife';
  name: string;
  hpRatio?: number;
  /** 准星直接命中的紧凑半径（命中实体核心判定区） */
  directRadius: number;
  /** 磁吸辅助的基础半径 */
  assistBaseRadius: number;
  /** 磁吸辅助的最大半径 */
  assistMaxRadius: number;
}

export interface AimSelectionResult {
  id: string;
  x: number;
  y: number;
  z: number;
  kind: 'enemy' | 'wildlife';
  name: string;
  distance: number;
  hpRatio?: number;
  isDirect: boolean;
  angularError: number;
}

/**
 * 准星辅助选目标（优先级：直接指向 > 模式优先类别 > 偏离准星角度最小，并对当前锁定目标提供防抖余量）
 */
export function selectBestAimTarget(params: {
  rayOrigin: Vec3Like;
  rayDir: Vec3Like;
  maxRange: number;
  candidates: readonly AimCandidate[];
  mode: GameMode;
  isMultiplayerCombat?: boolean;
  isTouch?: boolean;
  previousTargetId?: string | null;
}): AimSelectionResult | null {
  const {
    rayOrigin,
    rayDir,
    maxRange,
    candidates,
    mode,
    isMultiplayerCombat = false,
    isTouch = false,
    previousTargetId = null,
  } = params;

  const preferKind: 'enemy' | 'wildlife' | null =
    isMultiplayerCombat || mode === 'practice_solo' || mode === 'practice_team'
      ? 'enemy'
      : mode === 'hunt'
        ? 'wildlife'
        : null;

  // 桌面端磁吸范围更克制，避免抢锁；触屏端保留较宽容的辅助范围
  const assistScale = isTouch ? 1.0 : 0.65;
  const distGrowRate = isTouch ? 0.024 : 0.014;

  let best: (AimSelectionResult & { priorityRank: number; score: number }) | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const rx = c.x - rayOrigin.x;
    const ry = c.y - rayOrigin.y;
    const rz = c.z - rayOrigin.z;
    const t = rx * rayDir.x + ry * rayDir.y + rz * rayDir.z;
    if (t <= 2 || t > maxRange) continue;

    const px = rayOrigin.x + rayDir.x * t - c.x;
    const py = rayOrigin.y + rayDir.y * t - c.y;
    const pz = rayOrigin.z + rayDir.z * t - c.z;
    const perpDist = Math.hypot(px, py, pz);

    const isDirect = perpDist <= c.directRadius;
    const assistRadius = Math.max(
      c.directRadius,
      Math.min(c.assistMaxRadius * assistScale, c.assistBaseRadius * assistScale + t * distGrowRate),
    );
    if (!isDirect && perpDist > assistRadius) continue;

    const angularError = perpDist / t;
    const isPreferred = preferKind !== null && c.kind === preferKind;
    // 优先级档位（越大越优先）：
    // 3: 模式优先目标且准星直接指向
    // 2: 非优先目标但准星直接指向
    // 1: 模式优先目标且在磁吸范围内
    // 0: 非优先目标且在磁吸范围内
    const priorityRank = (isDirect ? 2 : 0) + (isPreferred ? 1 : 0);

    // 同档位内：直接指向比距离（近的遮挡远的），磁吸比偏离准星角度（含当前目标防抖余量）
    let score = isDirect ? t : angularError;
    if (!isDirect && previousTargetId && c.id === previousTargetId) {
      score *= 0.82;
    }

    if (!best || priorityRank > best.priorityRank || (priorityRank === best.priorityRank && score < best.score)) {
      best = {
        id: c.id,
        x: c.x,
        y: c.y,
        z: c.z,
        kind: c.kind,
        name: c.name,
        distance: t,
        hpRatio: c.hpRatio,
        isDirect,
        angularError,
        priorityRank,
        score,
      };
    }
  }

  if (!best) return null;
  return {
    id: best.id,
    x: best.x,
    y: best.y,
    z: best.z,
    kind: best.kind,
    name: best.name,
    distance: best.distance,
    hpRatio: best.hpRatio,
    isDirect: best.isDirect,
    angularError: best.angularError,
  };
}
