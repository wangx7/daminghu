import type { MinimapTargetDot } from '@daminghu/shared';
import { ISLAND_POLYS, LANDMARKS, ROAD_LINES, WATER_POLYS, WORLD } from './legacy/map_data.js';

export function renderDamingMinimap(
  canvas: HTMLCanvasElement,
  playerX: number,
  playerZ: number,
  playerYaw: number,
  visitedIds: Set<string>,
  targets: MinimapTargetDot[],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const spanX = WORLD.MAX_X - WORLD.MIN_X;
  const spanZ = WORLD.MAX_Z - WORLD.MIN_Z;
  const toX = (x: number) => ((x - WORLD.MIN_X) / spanX) * w;
  const toY = (z: number) => ((z - WORLD.MIN_Z) / spanZ) * h;

  // 宣纸墨青底色
  ctx.fillStyle = '#14202b';
  ctx.fillRect(0, 0, w, h);

  // 水体
  ctx.fillStyle = '#1f5c7a';
  for (const poly of WATER_POLYS as number[][][]) {
    if (!poly.length) continue;
    ctx.beginPath();
    ctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) ctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    ctx.closePath();
    ctx.fill();
  }

  // 岛屿
  ctx.fillStyle = '#2d6a4f';
  for (const poly of ISLAND_POLYS as number[][][]) {
    if (!poly.length) continue;
    ctx.beginPath();
    ctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) ctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    ctx.closePath();
    ctx.fill();
  }

  // 主干道
  ctx.strokeStyle = 'rgba(232, 214, 174, 0.32)';
  ctx.lineWidth = 1;
  for (const line of ROAD_LINES as number[][][]) {
    if (line.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(toX(line[0][0]), toY(line[0][1]));
    for (let i = 1; i < line.length; i++) ctx.lineTo(toX(line[i][0]), toY(line[i][1]));
    ctx.stroke();
  }

  // 21 景点圆点
  for (const lm of LANDMARKS as Array<{ id: string; x: number; z: number }>) {
    const visited = visitedIds.has(lm.id);
    ctx.fillStyle = visited ? '#f59e0b' : 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(toX(lm.x), toY(lm.z), visited ? 2.6 : 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // AI 靶子 / 红蓝队员点位
  for (const t of targets) {
    if (!t.alive) continue;
    ctx.fillStyle = t.team === 'red' ? '#ff4d6d' : t.team === 'blue' ? '#38bdf8' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(toX(t.x), toY(t.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 玩家箭头
  const px = toX(playerX);
  const py = toY(playerZ);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-playerYaw + Math.PI);
  ctx.fillStyle = '#fde047';
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -5.5);
  ctx.lineTo(4.2, 4.5);
  ctx.lineTo(0, 2.2);
  ctx.lineTo(-4.2, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
