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
// VECTOR ICONS (Font bağımsız, her platformda kusursuz çalışan ikonlar)
// ─────────────────────────────────────────────────────────────

function drawTrophyIcon(ctx: SKRSContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.fillStyle = '#f39c12';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.4, cy - size * 0.4);
  ctx.lineTo(cx + size * 0.4, cy - size * 0.4);
  ctx.lineTo(cx + size * 0.3, cy + size * 0.05);
  ctx.quadraticCurveTo(cx, cy + size * 0.25, cx - size * 0.3, cy + size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - size * 0.08, cy + size * 0.12, size * 0.16, size * 0.2);
  ctx.fillRect(cx - size * 0.28, cy + size * 0.28, size * 0.56, size * 0.1);
  ctx.restore();
}

function drawCoinIcon(ctx: SKRSContext2D, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0, '#f39c12');
  grad.addColorStop(1, '#f1c40f');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.font = `bold ${Math.round(radius * 1.1)}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('¢', cx, cy + 1);
  ctx.restore();
}

function drawFlameIcon(ctx: SKRSContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  const grad = ctx.createLinearGradient(cx, cy + size * 0.5, cx, cy - size * 0.5);
  grad.addColorStop(0, '#e74c3c');
  grad.addColorStop(0.5, '#e67e22');
  grad.addColorStop(1, '#f1c40f');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.5);
  ctx.bezierCurveTo(cx + size * 0.38, cy - size * 0.2, cx + size * 0.48, cy + size * 0.2, cx + size * 0.28, cy + size * 0.45);
  ctx.quadraticCurveTo(cx, cy + size * 0.58, cx - size * 0.28, cy + size * 0.45);
  ctx.bezierCurveTo(cx - size * 0.48, cy + size * 0.2, cx - size * 0.28, cy - size * 0.2, cx, cy - size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3cd';
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.05);
  ctx.bezierCurveTo(cx + size * 0.15, cy + size * 0.1, cx + size * 0.18, cy + size * 0.3, cx, cy + size * 0.42);
  ctx.bezierCurveTo(cx - size * 0.18, cy + size * 0.3, cx - size * 0.15, cy + size * 0.1, cx, cy - size * 0.05);
  ctx.fill();
  ctx.restore();
}

function drawChatIcon(ctx: SKRSContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.fillStyle = '#3498db';
  clipRoundRect(ctx, cx - size * 0.45, cy - size * 0.38, size * 0.9, size * 0.6, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.18, cy + size * 0.18);
  ctx.lineTo(cx - size * 0.32, cy + size * 0.42);
  ctx.lineTo(cx + size * 0.05, cy + size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(cx + i * size * 0.2, cy - size * 0.08, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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
  pg.addColorStop(0, ringColor);
  pg.addColorStop(1, '#7289da');
  ctx.save();
  clipRoundRect(ctx, bX, bY, pW, bH, bR);
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.restore();

  // XP label
  ctx.save();
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${xp.toLocaleString('tr-TR')} / ${xpNeeded.toLocaleString('tr-TR')} XP`, bX + bW, bY - 4);
  ctx.restore();

  return canvas.toBuffer('image/png') as unknown as Buffer;
}

// ─────────────────────────────────────────────────────────────
// BALANCE CARD  (520 × 160)
// ─────────────────────────────────────────────────────────────
export async function createBalanceCard(opts: {
  avatarUrl: string;
  username: string;
  coins: number;
  bankCoins: number;
  total: number;
  currencyName: string;
  currencyEmoji: string;
}): Promise<Buffer> {
  const CW = 520, CH = 160;
  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, '#0a0a18');
  bg.addColorStop(1, '#1a1a30');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Gold top border
  const border = ctx.createLinearGradient(0, 0, CW, 0);
  border.addColorStop(0,   'rgba(243,156,18,0)');
  border.addColorStop(0.3, '#f39c12');
  border.addColorStop(0.7, '#f39c12');
  border.addColorStop(1,   'rgba(243,156,18,0)');
  ctx.fillStyle = border;
  ctx.fillRect(0, 0, CW, 3);

  // Avatar
  const AVS = 72, AVX = 20, AVY = (CH - AVS) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(AVX + AVS / 2, AVY + AVS / 2, AVS / 2, 0, Math.PI * 2);
  ctx.clip();
  try {
    const buf = await fetchBuf(opts.avatarUrl.replace('.webp','.png').split('?')[0] + '?size=128');
    const img = await loadImage(buf);
    ctx.drawImage(img, AVX, AVY, AVS, AVS);
  } catch {
    ctx.fillStyle = '#1e1e3a';
    ctx.fillRect(AVX, AVY, AVS, AVS);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(AVX + AVS / 2, AVY + AVS / 2, AVS / 2 + 2, 0, Math.PI * 2);
  ctx.strokeStyle = '#f39c12';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  const TX = AVX + AVS + 18;

  // Username
  ctx.save();
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.fillText(opts.username + ' — Bakiye', TX, 16);
  ctx.restore();

  // Three panels
  const panels = [
    { label: 'Cüzdan',        val: opts.coins,     color: '#f39c12' },
    { label: 'Banka',         val: opts.bankCoins, color: '#7289da' },
    { label: 'Toplam Varlık', val: opts.total,     color: '#2ecc71' },
  ];
  const panW = 130, panH = 60, panY = 48, panGap = 8;
  panels.forEach((p, i) => {
    const px = TX + i * (panW + panGap);
    ctx.save();
    clipRoundRect(ctx, px, panY, panW, panH, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.restore();

    // Accent left strip
    ctx.fillStyle = p.color;
    ctx.fillRect(px, panY, 3, panH);

    drawCoinIcon(ctx, px + 16, panY + 14, 5);

    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, px + 26, panY + 14);
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = p.color;
    ctx.textBaseline = 'top';
    ctx.fillText(p.val.toLocaleString('tr-TR') + ' Coin', px + 10, panY + 28);
    ctx.restore();
  });

  // Bottom hint
  ctx.save();
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textBaseline = 'bottom';
  ctx.fillText('/günlük ve /çalış ile coin kazan', TX, CH - 10);
  ctx.restore();

  return canvas.toBuffer('image/png') as unknown as Buffer;
}

// ─────────────────────────────────────────────────────────────
// STREAK CARD  (560 × 180)
// ─────────────────────────────────────────────────────────────
export async function createStreakCard(opts: {
  avatarUrl: string;
  username: string;
  streak: number;
  milestones: { days: number; title: string; rewardCoins: number; rewardXp: number }[];
}): Promise<Buffer> {
  const CW = 560, CH = 180;
  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext('2d');

  // BG
  const bg = ctx.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, '#0a0a18');
  bg.addColorStop(1, '#1a100a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Orange top bar
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(0, 0, CW, 3);

  // Big vector flame icon
  drawFlameIcon(ctx, 58, 50, 70);

  const TX = 115;

  // Streak number
  ctx.save();
  ctx.font = 'bold 44px sans-serif';
  ctx.fillStyle = '#f39c12';
  ctx.textBaseline = 'top';
  ctx.fillText(String(opts.streak), TX, 14);
  ctx.restore();

  ctx.save();
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textBaseline = 'top';
  ctx.fillText('Günlük Seri  •  ' + opts.username, TX, 64);
  ctx.restore();

  // Milestone row (dots)
  const milestones = opts.milestones;
  const dotY = 115;
  const spacing = Math.min((CW - 40) / milestones.length, 90);

  milestones.forEach((m, i) => {
    const mx = 20 + i * spacing + spacing / 2;
    const reached = opts.streak >= m.days;

    // Line connector
    if (i < milestones.length - 1) {
      ctx.save();
      ctx.strokeStyle = reached ? '#f39c12' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      ctx.setLineDash(reached ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(mx + 8, dotY);
      ctx.lineTo(mx + spacing - 8, dotY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, dotY, 10, 0, Math.PI * 2);
    ctx.fillStyle = reached ? '#f39c12' : 'rgba(255,255,255,0.12)';
    ctx.fill();
    if (reached) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Day label below dot
    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.fillStyle = reached ? '#f39c12' : 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(m.days + 'G', mx, dotY + 14);
    ctx.restore();

    // Title
    ctx.save();
    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(m.title.substring(0, 10), mx, dotY + 27);
    ctx.restore();
  });

  return canvas.toBuffer('image/png') as unknown as Buffer;
}

// ─────────────────────────────────────────────────────────────
// LEADERBOARD CARD  (600 × 380)
// ─────────────────────────────────────────────────────────────
export async function createLeaderboardCard(opts: {
  title: string;
  icon: string;
  entries: { rank: number; username: string; value: string; avatarUrl?: string }[];
  guildIconUrl?: string;
}): Promise<Buffer> {
  const CW = 600, CH = 60 + opts.entries.length * 48;
  const canvas = createCanvas(CW, Math.max(CH, 200));
  const ctx = canvas.getContext('2d');

  // BG
  const bg = ctx.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#0a0a18');
  bg.addColorStop(1, '#12122a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, Math.max(CH, 200));

  // Header
  const hg = ctx.createLinearGradient(0, 0, CW, 50);
  hg.addColorStop(0, '#f39c12');
  hg.addColorStop(1, '#e67e22');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, CW, 50);

  ctx.save();
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(opts.title, 16, 25);
  ctx.restore();

  // Rows
  const badgeColors: Record<number, { bg: string; text: string }> = {
    1: { bg: '#f1c40f', text: '#000000' },
    2: { bg: '#bdc3c7', text: '#000000' },
    3: { bg: '#cd7f32', text: '#ffffff' },
  };

  for (let i = 0; i < opts.entries.length; i++) {
    const e = opts.entries[i];
    const ry = 50 + i * 48;
    const isEven = i % 2 === 0;

    // Row BG
    ctx.save();
    clipRoundRect(ctx, 8, ry + 4, CW - 16, 40, 6);
    ctx.fillStyle = isEven ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.restore();

    // Top-3 highlight
    if (e.rank <= 3) {
      const gold = ['rgba(243,156,18,0.15)', 'rgba(189,195,199,0.12)', 'rgba(205,127,50,0.12)'];
      ctx.save();
      clipRoundRect(ctx, 8, ry + 4, CW - 16, 40, 6);
      ctx.fillStyle = gold[e.rank - 1];
      ctx.fill();
      ctx.restore();
    }

    // Avatar mini circle
    if (e.avatarUrl) {
      try {
        const buf = await fetchBuf(e.avatarUrl.replace('.webp','.png').split('?')[0] + '?size=64');
        const img = await loadImage(buf);
        const cx = 34, cy = ry + 24;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, cx - 16, cy - 16, 32, 32);
        ctx.restore();
      } catch { /* skip */ }
    }

    // Rank badge (Vector)
    const badge = badgeColors[e.rank];
    if (badge) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(68, ry + 24, 12, 0, Math.PI * 2);
      ctx.fillStyle = badge.bg;
      ctx.fill();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = badge.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(e.rank), 68, ry + 24);
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${e.rank}`, 68, ry + 24);
      ctx.restore();
    }

    // Username
    ctx.save();
    ctx.font = e.rank <= 3 ? 'bold 14px sans-serif' : '14px sans-serif';
    ctx.fillStyle = e.rank <= 3 ? '#ffffff' : 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(e.username, 100, ry + 24);
    ctx.restore();

    // Value (right)
    ctx.save();
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = e.rank === 1 ? '#f39c12' : e.rank === 2 ? '#bdc3c7' : e.rank === 3 ? '#cd7f32' : 'rgba(255,255,255,0.6)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(e.value, CW - 18, ry + 24);
    ctx.restore();
  }

  return canvas.toBuffer('image/png') as unknown as Buffer;
}

// ─────────────────────────────────────────────────────────────
// SERVER STATS CARD  (640 × 240)
// ─────────────────────────────────────────────────────────────
export async function createServerStatsCard(opts: {
  guildName: string;
  guildIconUrl?: string;
  memberCount: number;
  humanCount: number;
  onlineCount: number;
  voiceCount: number;
  totalMessages: number;
  totalVoiceHours: number;
  totalCoins: number;
  totalAchievements: number;
  topChatter?: string;
  topVoice?: string;
}): Promise<Buffer> {
  const CW = 640, CH = 240;
  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext('2d');

  // BG
  const bg = ctx.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, '#0a0a18');
  bg.addColorStop(1, '#0f1628');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Header band
  ctx.fillStyle = '#5865F2';
  ctx.fillRect(0, 0, CW, 4);

  // Guild icon
  if (opts.guildIconUrl) {
    try {
      const buf = await fetchBuf(opts.guildIconUrl.split('?')[0] + '?size=128');
      const img = await loadImage(buf);
      ctx.save();
      ctx.beginPath();
      ctx.arc(42, 42, 30, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 12, 12, 60, 60);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.arc(42, 42, 31, 0, Math.PI * 2);
      ctx.strokeStyle = '#5865F2';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    } catch { /* skip */ }
  }

  // Guild name
  ctx.save();
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.fillText(opts.guildName.substring(0, 30), 84, 16);
  ctx.restore();

  ctx.save();
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textBaseline = 'top';
  ctx.fillText('Sunucu İstatistikleri', 84, 44);
  ctx.restore();

  // Stat grid  (3 x 2)
  const stats = [
    { label: 'ÜYELER',      value: `${opts.memberCount} (${opts.humanCount} insan)`, color: '#3498db' },
    { label: 'ÇEVRİMİÇİ',   value: `${opts.onlineCount} aktif`,                     color: '#2ecc71' },
    { label: 'SESTE',       value: `${opts.voiceCount} kişi`,                       color: '#9b59b6' },
    { label: 'MESAJLAR',    value: opts.totalMessages.toLocaleString('tr-TR'),      color: '#e67e22' },
    { label: 'SES SÜRESİ',  value: opts.totalVoiceHours.toFixed(1) + ' sa.',        color: '#1abc9c' },
    { label: 'TOPLAM COIN', value: opts.totalCoins.toLocaleString('tr-TR'),         color: '#f1c40f' },
  ];

  const colW = CW / 3, rowH = 56, startY = 86;
  stats.forEach((s, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const sx = col * colW + 12, sy = startY + row * rowH;

    ctx.save();
    clipRoundRect(ctx, sx, sy, colW - 20, rowH - 8, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = s.color;
    ctx.textBaseline = 'top';
    ctx.fillText(s.label, sx + 10, sy + 8);
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(s.value, sx + 10, sy + 25);
    ctx.restore();
  });

  // Top users strip at bottom
  if (opts.topChatter || opts.topVoice) {
    ctx.save();
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textBaseline = 'bottom';
    const parts: string[] = [];
    if (opts.topChatter) parts.push('En Çok Konuşan: ' + opts.topChatter);
    if (opts.topVoice)   parts.push('En Çok Seste: ' + opts.topVoice);
    ctx.fillText(parts.join('   •   '), 12, CH - 10);
    ctx.restore();
  }

  return canvas.toBuffer('image/png') as unknown as Buffer;
}

// ─────────────────────────────────────────────────────────────
// DAILY REWARD CARD  (480 × 160)
// ─────────────────────────────────────────────────────────────
export async function createDailyRewardCard(opts: {
  avatarUrl: string;
  username: string;
  coins: number;
  streak: number;
  currencyName: string;
  milestoneBonus?: number;
  milestoneTitle?: string;
}): Promise<Buffer> {
  const CW = 480, CH = 160;
  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext('2d');

  // BG
  const bg = ctx.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, '#0a1a0a');
  bg.addColorStop(1, '#0d1f0d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Green top bar
  const tb = ctx.createLinearGradient(0, 0, CW, 0);
  tb.addColorStop(0, '#27ae60');
  tb.addColorStop(1, '#2ecc71');
  ctx.fillStyle = tb;
  ctx.fillRect(0, 0, CW, 3);

  // Vector Coin Icon
  drawCoinIcon(ctx, 48, 55, 25);

  // Avatar
  const AVS = 56, AVX = CW - 76, AVY = (CH - AVS) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(AVX + AVS / 2, AVY + AVS / 2, AVS / 2, 0, Math.PI * 2);
  ctx.clip();
  try {
    const buf = await fetchBuf(opts.avatarUrl.replace('.webp','.png').split('?')[0] + '?size=64');
    const img = await loadImage(buf);
    ctx.drawImage(img, AVX, AVY, AVS, AVS);
  } catch {
    ctx.fillStyle = '#1e1e3a';
    ctx.fillRect(AVX, AVY, AVS, AVS);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(AVX + AVS / 2, AVY + AVS / 2, AVS / 2 + 2, 0, Math.PI * 2);
  ctx.strokeStyle = '#27ae60';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  const TX = 94;

  // Title
  ctx.save();
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#2ecc71';
  ctx.textBaseline = 'top';
  ctx.fillText('Günlük Ödül Toplandı!', TX, 18);
  ctx.restore();

  // Coin amount
  ctx.save();
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = '#f39c12';
  ctx.textBaseline = 'top';
  ctx.fillText('+' + opts.coins.toLocaleString('tr-TR') + ' ' + opts.currencyName, TX, 42);
  ctx.restore();

  // Streak
  ctx.save();
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textBaseline = 'top';
  ctx.fillText(`🔥 ${opts.streak} Günlük Seri${opts.milestoneTitle ? '  •  🎉 ' + opts.milestoneTitle : ''}`, TX, 84);
  ctx.restore();

  // Username
  ctx.save();
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textBaseline = 'bottom';
  ctx.fillText(opts.username + '  •  Yarın tekrar gel!', TX, CH - 12);
  ctx.restore();

  return canvas.toBuffer('image/png') as unknown as Buffer;
}

// ─────────────────────────────────────────────────────────────
// PROFILE CARD  (700 × 260)
// ─────────────────────────────────────────────────────────────
export async function createProfileCard(opts: {
  avatarUrl: string;
  username: string;
  title: string;
  bio: string;
  level: number;
  xp: number;
  xpNeeded: number;
  coins: number;
  streak: number;
  rank: number;
  messageCount: number;
  badges: string[];
}): Promise<Buffer> {
  const CW = 700, CH = 260;
  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext('2d');

  // BG
  const bg = ctx.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, '#0a0a18');
  bg.addColorStop(0.6, '#12122a');
  bg.addColorStop(1, '#0a0a18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Grid dots
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (let gx = 0; gx < CW; gx += 22)
    for (let gy = 0; gy < CH; gy += 22)
      ctx.fillRect(gx, gy, 1.5, 1.5);

  const accentColor = opts.level >= 30 ? '#f39c12' : opts.level >= 20 ? '#e74c3c' : opts.level >= 10 ? '#9b59b6' : '#5865F2';

  // Left accent bar
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 4, CH);

  // Avatar (circle)
  const AVS = 100, AVX = 28, AVY = (CH - AVS) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(AVX + AVS / 2, AVY + AVS / 2, AVS / 2, 0, Math.PI * 2);
  ctx.clip();
  try {
    const buf = await fetchBuf(opts.avatarUrl.replace('.webp', '.png').split('?')[0] + '?size=256');
    const img = await loadImage(buf);
    ctx.drawImage(img, AVX, AVY, AVS, AVS);
  } catch {
    ctx.fillStyle = '#1e1e3a';
    ctx.fillRect(AVX, AVY, AVS, AVS);
  }
  ctx.restore();

  // Avatar ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(AVX + AVS / 2, AVY + AVS / 2, AVS / 2 + 3, 0, Math.PI * 2);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  // Level badge
  const badgeX = AVX + AVS - 12, badgeY = AVY + AVS - 12;
  ctx.save();
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 14, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.fill();
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(opts.level), badgeX, badgeY);
  ctx.restore();

  const TX = AVX + AVS + 22;

  // Username
  ctx.save();
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(opts.username, TX, 22);
  ctx.restore();

  // Title
  ctx.save();
  ctx.font = '13px sans-serif';
  ctx.fillStyle = accentColor;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(opts.title, TX, 50);
  ctx.restore();

  // Bio
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(opts.bio.substring(0, 55), TX, 70);
  ctx.restore();

  // Badges row
  if (opts.badges.length > 0) {
    ctx.save();
    ctx.font = '18px sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(opts.badges.slice(0, 8).join(' '), TX, 90);
    ctx.restore();
  }

  // Stat pills with crisp vector icons
  const pills = [
    { label: '#' + opts.rank,                          sub: 'SIRA',   type: 'trophy', color: '#f39c12' },
    { label: opts.coins.toLocaleString('tr-TR'),       sub: 'COIN',   type: 'coin',   color: '#f1c40f' },
    { label: opts.streak + ' Gün',                     sub: 'STREAK', type: 'flame',  color: '#e67e22' },
    { label: opts.messageCount.toLocaleString('tr-TR'), sub: 'MESAJ',  type: 'chat',   color: '#3498db' },
  ];
  const pillW = 115, pillH = 46, pillY = 120, pillGap = 10;
  pills.forEach((p, i) => {
    const px = TX + i * (pillW + pillGap);
    ctx.save();
    clipRoundRect(ctx, px, pillY, pillW, pillH, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.restore();

    // Vektörel ikon çizimi
    const iconX = px + 14;
    const iconY = pillY + 13;
    if (p.type === 'trophy') drawTrophyIcon(ctx, iconX, iconY, 14);
    else if (p.type === 'coin') drawCoinIcon(ctx, iconX, iconY, 6);
    else if (p.type === 'flame') drawFlameIcon(ctx, iconX, iconY, 14);
    else if (p.type === 'chat') drawChatIcon(ctx, iconX, iconY, 13);

    // Kategori etiketi
    ctx.save();
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = p.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.sub, px + 25, iconY);
    ctx.restore();

    // Değer
    ctx.save();
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(p.label, px + 10, pillY + 24);
    ctx.restore();
  });

  // XP progress bar
  const bX = TX, bY = CH - 38, bW = CW - TX - 20, bH = 12, bR = 6;
  ctx.save();
  clipRoundRect(ctx, bX, bY, bW, bH, bR);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fill();
  ctx.restore();

  const xpRatio = Math.min(opts.xp / opts.xpNeeded, 1);
  const xpFillW = Math.max(bR * 2, bW * xpRatio);
  const xpGrad = ctx.createLinearGradient(bX, 0, bX + bW, 0);
  xpGrad.addColorStop(0, accentColor);
  xpGrad.addColorStop(1, '#7289da');
  ctx.save();
  clipRoundRect(ctx, bX, bY, xpFillW, bH, bR);
  ctx.fillStyle = xpGrad;
  ctx.fill();
  ctx.restore();

  // XP label
  ctx.save();
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${opts.xp.toLocaleString('tr-TR')} / ${opts.xpNeeded.toLocaleString('tr-TR')} XP`, bX + bW, bY - 4);
  ctx.restore();

  return canvas.toBuffer('image/png') as unknown as Buffer;
}

// ─────────────────────────────────────────────────────────────
// WELCOME CARD  (750 × 280)
// ─────────────────────────────────────────────────────────────
export async function createWelcomeCard(opts: {
  avatarUrl: string;
  username: string;
  guildName: string;
  memberCount: number;
}): Promise<Buffer> {
  const CW = 750, CH = 280;
  const canvas = createCanvas(CW, CH);
  const ctx = canvas.getContext('2d');

  // Deep dark gradient background
  const bg = ctx.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, '#090a16');
  bg.addColorStop(0.5, '#13122c');
  bg.addColorStop(1, '#090a16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Decorative border
  const borderGrad = ctx.createLinearGradient(0, 0, CW, 0);
  borderGrad.addColorStop(0, '#5865F2');
  borderGrad.addColorStop(0.5, '#9b59b6');
  borderGrad.addColorStop(1, '#ff6b9d');
  ctx.fillStyle = borderGrad;
  ctx.fillRect(0, 0, CW, 4);

  // Subtle grid dot pattern
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let gx = 0; gx < CW; gx += 20) {
    for (let gy = 0; gy < CH; gy += 20) {
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
  }

  // Glowing circle background behind avatar
  const AVS = 120;
  const AVX = 45;
  const AVY = (CH - AVS) / 2;
  const acx = AVX + AVS / 2;
  const acy = AVY + AVS / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(155, 89, 182, 0.6)';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(acx, acy, AVS / 2 + 5, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1c38';
  ctx.fill();
  ctx.restore();

  // Avatar image
  ctx.save();
  ctx.beginPath();
  ctx.arc(acx, acy, AVS / 2, 0, Math.PI * 2);
  ctx.clip();
  try {
    const buf = await fetchBuf(opts.avatarUrl.replace('.webp', '.png').split('?')[0] + '?size=256');
    const img = await loadImage(buf);
    ctx.drawImage(img, AVX, AVY, AVS, AVS);
  } catch {
    ctx.fillStyle = '#2b2b4e';
    ctx.fillRect(AVX, AVY, AVS, AVS);
  }
  ctx.restore();

  // Avatar border rings
  ctx.save();
  ctx.beginPath();
  ctx.arc(acx, acy, AVS / 2 + 3, 0, Math.PI * 2);
  const ringGrad = ctx.createLinearGradient(AVX, AVY, AVX + AVS, AVY + AVS);
  ringGrad.addColorStop(0, '#ff6b9d');
  ringGrad.addColorStop(0.5, '#9b59b6');
  ringGrad.addColorStop(1, '#5865F2');
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // Text panel coordinates
  const TX = AVX + AVS + 35;

  // Subtitle / Welcome greeting tag
  ctx.save();
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#ff6b9d';
  ctx.textBaseline = 'top';
  ctx.fillText('ARAMIZA BİRİ KATILDI', TX, 48);
  ctx.restore();

  // Username
  ctx.save();
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 10;
  const displayUser = opts.username.length > 20 ? opts.username.substring(0, 18) + '...' : opts.username;
  ctx.fillText(displayUser, TX, 74);
  ctx.restore();

  // Guild name
  ctx.save();
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.textBaseline = 'top';
  ctx.fillText(`${opts.guildName} sunucusuna hoş geldin!`, TX, 120);
  ctx.restore();

  // Member count pill
  const pillW = 260, pillH = 38, pillY = 162;
  ctx.save();
  clipRoundRect(ctx, TX, pillY, pillW, pillH, 10);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  clipRoundRect(ctx, TX, pillY, pillW, pillH, 10);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#2ecc71';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Seninle birlikte ${opts.memberCount} kişiyiz!`, TX + 16, pillY + pillH / 2);
  ctx.restore();

  return canvas.toBuffer('image/png') as unknown as Buffer;
}
