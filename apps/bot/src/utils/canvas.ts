import { createCanvas, loadImage, SKRSContext2D } from '@napi-rs/canvas';

// ─────────────────────────────────────────────────────────────
// LAYOUT CONSTANTS
// ─────────────────────────────────────────────────────────────
const W = 620;
const H = 220;
const AV = 150;
const AV_Y = 28;
const AV1_X = 35;
const AV2_X = W - 35 - AV; // 435
const HCX = W / 2;          // 310
const HCY = H / 2 - 5;      // 105
const HEART_SIZE = 55;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function fetchBuf(url: string): Promise<Buffer> {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

function clipRoundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function heartPath(ctx: SKRSContext2D, cx: number, cy: number, s: number) {
  const top = cy - s * 0.25;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.8);
  ctx.bezierCurveTo(cx - s * 0.05, cy + s * 0.45, cx - s, cy + s * 0.05, cx - s, top);
  ctx.arcTo(cx - s, top - s * 0.5, cx,     top - s * 0.5, s * 0.5);
  ctx.arcTo(cx + s, top - s * 0.5, cx + s, top,           s * 0.5);
  ctx.bezierCurveTo(cx + s, cy + s * 0.05, cx + s * 0.05, cy + s * 0.45, cx, cy + s * 0.8);
  ctx.closePath();
}

// ─────────────────────────────────────────────────────────────
// SHIP CARD
// ─────────────────────────────────────────────────────────────
export async function createShipImage(
  avatar1Url: string,
  avatar2Url: string,
  percent: number
): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── 1. BACKGROUND ──
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   '#0d0d1a');
  bg.addColorStop(0.5, '#14142b');
  bg.addColorStop(1,   '#0d0d1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Dot pattern
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let gx = 0; gx < W; gx += 18)
    for (let gy = 0; gy < H; gy += 18)
      ctx.fillRect(gx, gy, 1.5, 1.5);

  // ── 2. AVATAR HELPER ──
  const drawAvatar = async (url: string, ax: number) => {
    ctx.save();
    clipRoundRect(ctx, ax, AV_Y, AV, AV, 16);
    ctx.clip();
    try {
      const cleanUrl = url.replace('.webp', '.png').split('?')[0] + '?size=256';
      const buf = await fetchBuf(cleanUrl);
      const img = await loadImage(buf);
      ctx.drawImage(img, ax, AV_Y, AV, AV);
    } catch {
      const fb = ctx.createLinearGradient(ax, AV_Y, ax + AV, AV_Y + AV);
      fb.addColorStop(0, '#2b2b4e');
      fb.addColorStop(1, '#1a1a35');
      ctx.fillStyle = fb;
      ctx.fillRect(ax, AV_Y, AV, AV);
    }
    ctx.restore();
    // Border
    ctx.save();
    clipRoundRect(ctx, ax, AV_Y, AV, AV, 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  };

  await drawAvatar(avatar1Url, AV1_X);
  await drawAvatar(avatar2Url, AV2_X);

  // ── 3. DASHED CONNECTOR ──
  const lineY = AV_Y + AV / 2;
  const lineX1 = AV1_X + AV + 8;
  const lineX2 = AV2_X - 8;
  const lineGrad = ctx.createLinearGradient(lineX1, 0, lineX2, 0);
  lineGrad.addColorStop(0,   'rgba(255,255,255,0.04)');
  lineGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  lineGrad.addColorStop(1,   'rgba(255,255,255,0.04)');
  ctx.save();
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(lineX1, lineY);
  ctx.lineTo(lineX2, lineY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── 4a. HEART shadow ──
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 24;
  heartPath(ctx, HCX, HCY, HEART_SIZE);
  ctx.fillStyle = '#111122';
  ctx.fill();
  ctx.restore();

  // ── 4b. HEART dark fill ──
  heartPath(ctx, HCX, HCY, HEART_SIZE);
  const heartBg = ctx.createRadialGradient(HCX, HCY - HEART_SIZE * 0.1, 2, HCX, HCY, HEART_SIZE * 1.1);
  heartBg.addColorStop(0, '#232340');
  heartBg.addColorStop(1, '#0e0e1e');
  ctx.fillStyle = heartBg;
  ctx.fill();

  // ── 4c. HEART colour fill (rises from bottom) ──
  const fillRatio   = Math.max(0.04, percent / 100);
  const heartTop    = HCY - HEART_SIZE * 1.05;
  const heartBottom = HCY + HEART_SIZE * 0.85;
  const fillH = (heartBottom - heartTop) * fillRatio;
  const fillY = heartBottom - fillH;

  ctx.save();
  heartPath(ctx, HCX, HCY, HEART_SIZE);
  ctx.clip();

  const fillGrad = ctx.createLinearGradient(0, fillY, 0, heartBottom);
  if (percent >= 75) {
    fillGrad.addColorStop(0, '#ff6b9d');
    fillGrad.addColorStop(1, '#c0392b');
  } else if (percent >= 50) {
    fillGrad.addColorStop(0, '#f39c12');
    fillGrad.addColorStop(1, '#e74c3c');
  } else if (percent >= 25) {
    fillGrad.addColorStop(0, '#9b59b6');
    fillGrad.addColorStop(1, '#3498db');
  } else {
    fillGrad.addColorStop(0, '#555577');
    fillGrad.addColorStop(1, '#2d2d3e');
  }
  ctx.fillStyle = fillGrad;
  ctx.fillRect(HCX - HEART_SIZE - 5, fillY, (HEART_SIZE + 5) * 2, fillH + 5);
  ctx.restore();

  // ── 4d. HEART stroke ──
  heartPath(ctx, HCX, HCY, HEART_SIZE);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── 5. PERCENT TEXT ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 8;
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`%${percent}`, HCX, HCY + 6);
  ctx.restore();

  // ── 6. PROGRESS BAR ──
  const barX = 36, barW = W - 72, barH = 9, barY = H - 26, barR = 5;

  ctx.save();
  clipRoundRect(ctx, barX, barY, barW, barH, barR);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fill();
  ctx.restore();

  const fW = Math.max(barR * 2, (barW * percent) / 100);
  const barFillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  if (percent >= 75) {
    barFillGrad.addColorStop(0, '#ff6b9d'); barFillGrad.addColorStop(1, '#c0392b');
  } else if (percent >= 50) {
    barFillGrad.addColorStop(0, '#f39c12'); barFillGrad.addColorStop(1, '#e74c3c');
  } else if (percent >= 25) {
    barFillGrad.addColorStop(0, '#3498db'); barFillGrad.addColorStop(1, '#9b59b6');
  } else {
    barFillGrad.addColorStop(0, '#555577'); barFillGrad.addColorStop(1, '#2d2d3e');
  }
  ctx.save();
  clipRoundRect(ctx, barX, barY, fW, barH, barR);
  ctx.fillStyle = barFillGrad;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText(`${percent}%`, barX + barW, barY - 7);
  ctx.restore();

  return canvas.toBuffer('image/png') as unknown as Buffer;
}

// ─────────────────────────────────────────────────────────────
// LEVEL CARD
// ─────────────────────────────────────────────────────────────
export async function createLevelCard(
  avatarUrl: string,
  username: string,
  level: number,
  xp: number,
  xpNeeded: number,
  rank: number
): Promise<Buffer> {
  const CW = 600, CH = 130;
  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext('2d');

  // BG
  const bg = ctx.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, '#0d0d1a');
  bg.addColorStop(1, '#1a1a35');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Avatar circle
  const AVS = 86, AVX = 20, AVY = (CH - AVS) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(AVX + AVS / 2, AVY + AVS / 2, AVS / 2, 0, Math.PI * 2);
  ctx.clip();
  try {
    const cleanUrl = avatarUrl.replace('.webp', '.png').split('?')[0] + '?size=128';
    const buf = await fetchBuf(cleanUrl);
    const img = await loadImage(buf);
    ctx.drawImage(img, AVX, AVY, AVS, AVS);
  } catch {
    ctx.fillStyle = '#2b2b4e';
    ctx.fillRect(AVX, AVY, AVS, AVS);
  }
  ctx.restore();

  // Avatar ring
  const ringColor = level >= 20 ? '#f39c12' : level >= 10 ? '#9b59b6' : '#5865F2';
  ctx.save();
  ctx.beginPath();
  ctx.arc(AVX + AVS / 2, AVY + AVS / 2, AVS / 2 + 2.5, 0, Math.PI * 2);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  const textX = AVX + AVS + 18;

  // Username
  ctx.save();
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.fillText(username, textX, 18);
  ctx.restore();

  // Level
  ctx.save();
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#a0a0c0';
  ctx.textBaseline = 'top';
  ctx.fillText(`Seviye ${level}`, textX, 44);
  ctx.restore();

  // Rank (top-right)
  ctx.save();
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`#${rank}`, CW - 20, 18);
  ctx.restore();

  // XP text (top-right)
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#a0a0c0';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`${xp.toLocaleString('tr-TR')} / ${xpNeeded.toLocaleString('tr-TR')} XP`, CW - 20, 40);
  ctx.restore();

  // Progress bar
  const bX = textX, bY = CH - 32, bW = CW - textX - 20, bH = 10, bR = 5;
  ctx.save();
  clipRoundRect(ctx, bX, bY, bW, bH, bR);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.restore();

  const ratio = Math.min(xp / xpNeeded, 1);
  const pW = Math.max(bR * 2, bW * ratio);
  const pg = ctx.createLinearGradient(bX, 0, bX + bW, 0);
  if (level >= 20) { pg.addColorStop(0, '#f39c12'); pg.addColorStop(1, '#e74c3c'); }
  else if (level >= 10) { pg.addColorStop(0, '#9b59b6'); pg.addColorStop(1, '#3498db'); }
  else { pg.addColorStop(0, '#5865F2'); pg.addColorStop(1, '#7289da'); }

  ctx.save();
  clipRoundRect(ctx, bX, bY, pW, bH, bR);
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.restore();

  return canvas.toBuffer('image/png') as unknown as Buffer;
}
