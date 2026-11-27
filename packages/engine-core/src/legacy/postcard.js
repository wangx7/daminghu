// 团团大明湖宣纸明信片拍照系统（一键生成 1280×860 宣纸金框 + 诗词落款 + 朱砂印章高清明信片）
import { LANDMARKS } from './map_data.js';

function findNearestLandmark(x, z) {
  let best = LANDMARKS[0];
  let bestD = Infinity;
  for (const lm of LANDMARKS) {
    const d = Math.hypot(x - lm.x, z - lm.z);
    if (d < bestD) { bestD = d; best = lm; }
  }
  return { lm: best, dist: bestD };
}

export function capturePostcard({ renderer, renderScene, player, sky, sound, createCanvas }) {
  // 立即渲染最新一帧，确保 WebGL 画布非黑屏（无需常驻开启 preserveDrawingBuffer）
  renderScene();
  sound?.playShutter();

  const src = renderer.domElement;
  const W = 1280, H = 860;
  const cvs = createCanvas ? createCanvas(W, H) : document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const ctx = cvs.getContext('2d');

  // 1. 宣纸暖色底纹
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#faf5ea');
  bgGrad.addColorStop(1, '#efe6d2');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 细微金边双框
  ctx.strokeStyle = '#c8a258';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, W - 36, H - 36);
  ctx.strokeStyle = 'rgba(200, 162, 88, 0.38)';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // 2. 居中裁切绘制 3D 实景画面（1200×640 黄金画幅）
  const px = 40, py = 40, pw = 1200, ph = 640;
  const srcAspect = src.width / Math.max(1, src.height);
  const dstAspect = pw / ph;
  let sx = 0, sy = 0, sw = src.width, sh = src.height;
  if (srcAspect > dstAspect) {
    sw = src.height * dstAspect;
    sx = (src.width - sw) * 0.5;
  } else {
    sh = src.width / dstAspect;
    sy = (src.height - sh) * 0.5;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  ctx.drawImage(src, sx, sy, sw, sh, px, py, pw, ph);
  ctx.restore();

  // 画幅精致描边
  ctx.strokeStyle = 'rgba(130, 102, 56, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px, py, pw, ph);

  // 3. 底部诗词题跋与落款
  const { lm } = findNearestLandmark(player.pos.x, player.pos.z);
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const timeName = sky?.getModeName ? sky.getModeName() : '明湖晴空';

  ctx.fillStyle = '#2a2218';
  ctx.font = 'bold 34px WK, "PingFang SC", "Microsoft YaHei", serif';
  ctx.textAlign = 'left';
  ctx.fillText(`大明湖 · ${lm.name}`, 44, 738);

  // 景点小标签胶囊
  const titleW = ctx.measureText(`大明湖 · ${lm.name}`).width;
  ctx.fillStyle = 'rgba(197, 59, 50, 0.12)';
  ctx.strokeStyle = 'rgba(197, 59, 50, 0.45)';
  ctx.lineWidth = 1;
  ctx.font = '18px WK, "PingFang SC", sans-serif';
  const tagText = lm.tag || '泉城名胜';
  const tagW = ctx.measureText(tagText).width + 22;
  ctx.beginPath();
  ctx.roundRect(44 + titleW + 16, 710, tagW, 32, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a82c24';
  ctx.fillText(tagText, 44 + titleW + 27, 732);

  // 诗词副文
  ctx.fillStyle = '#5c4d3a';
  ctx.font = '21px WK, "PingFang SC", serif';
  ctx.fillText(lm.poem || '四面荷花三面柳，一城山色半城湖。', 44, 782);

  // 右侧落款日期与时辰
  ctx.textAlign = 'right';
  ctx.fillStyle = '#6f5e48';
  ctx.font = '18px WK, "PingFang SC", sans-serif';
  ctx.fillText(`拍摄于 ${dateStr} · ${timeName}`, W - 126, 744);
  ctx.fillStyle = '#8b7a62';
  ctx.font = '16px WK, "PingFang SC", sans-serif';
  ctx.fillText('团团泉城数字体素游记', W - 126, 776);

  // 右下角朱砂方印「游历明湖」
  const sealX = W - 106, sealY = 716, sealS = 64;
  ctx.fillStyle = '#b92c24';
  ctx.beginPath();
  ctx.roundRect(sealX, sealY, sealS, sealS, 6);
  ctx.fill();
  ctx.strokeStyle = '#f8e6d8';
  ctx.lineWidth = 2;
  ctx.strokeRect(sealX + 4, sealY + 4, sealS - 8, sealS - 8);
  ctx.fillStyle = '#fff5eb';
  ctx.font = 'bold 21px WK, serif';
  ctx.textAlign = 'center';
  ctx.fillText('明游', sealX + sealS * 0.5, sealY + 28);
  ctx.fillText('湖历', sealX + sealS * 0.5, sealY + 53);

  return cvs.toDataURL('image/png');
}
