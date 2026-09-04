import { createCanvas, loadImage, SKRSContext2D } from '@napi-rs/canvas';

export interface MarriageCardData {
  user1Name: string;
  user1Avatar: string;
  user2Name: string;
  user2Avatar: string;
  ringType: 'SILVER' | 'GOLD' | 'DIAMOND';
  lovePoints: number;
  jointCoins: number;
  marriedAt: Date;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Altın / Gümüş / Pırlanta Yüzük Vektörel Çizimi
 */
function drawRingIcon(ctx: SKRSContext2D, cx: number, cy: number, ringType: string) {
  ctx.save();
  const radius = 24;

  let ringColor = '#c0c0c0'; // Silver
  let gemColor = '#e0e0e0';

  if (ringType === 'GOLD') {
    ringColor = '#ffd700';
    gemColor = '#ffe066';
  } else if (ringType === 'DIAMOND') {
    ringColor = '#f0f3f4';
    gemColor = '#00ffff';
  }

  // Yüzük halkası (Gölge ve parlama)
  ctx.shadowColor = ringColor;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, cy + 4, radius, 0, Math.PI * 2);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Yüzük taşı (Taşın parlama efekti)
  ctx.shadowColor = gemColor;
  ctx.shadowBlur = 15;
  ctx.fillStyle = gemColor;

  ctx.beginPath();
  ctx.moveTo(cx, cy - radius - 10);
  ctx.lineTo(cx + 9, cy - radius + 2);
  ctx.lineTo(cx, cy - radius + 10);
  ctx.lineTo(cx - 9, cy - radius + 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Kalp vektörel çizimi
 */
function drawHeart(ctx: SKRSContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.fillStyle = '#ff2a6d';
  ctx.shadowColor = '#ff2a6d';
  ctx.shadowBlur = 15;

  ctx.beginPath();
  const top = cy - size * 0.3;
  ctx.moveTo(cx, cy + size * 0.7);
  ctx.bezierCurveTo(cx - size * 0.1, cy + size * 0.35, cx - size, cy, cx - size, top);
  ctx.arcTo(cx - size, top - size * 0.5, cx, top - size * 0.5, size * 0.5);
  ctx.arcTo(cx + size, top - size * 0.5, cx + size, top, size * 0.5);
  ctx.bezierCurveTo(cx + size, cy, cx + size * 0.1, cy + size * 0.35, cx, cy + size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export async function createMarriageCard(data: MarriageCardData): Promise<Buffer> {
  const width = 740;
  const height = 340;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Arka Plan: Asil Kırmızı/Bordo Kadife Nikah Cüzdanı Dokusu
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#4a0e17');
  bgGrad.addColorStop(0.5, '#2b080e');
  bgGrad.addColorStop(1, '#1a0408');

  roundRect(ctx, 0, 0, width, height, 22);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // 2. Altın Yaldız Çift Kenarlık
  ctx.save();
  const goldGrad = ctx.createLinearGradient(0, 0, width, height);
  goldGrad.addColorStop(0, '#bf953f');
  goldGrad.addColorStop(0.25, '#fcf6ba');
  goldGrad.addColorStop(0.5, '#b38728');
  goldGrad.addColorStop(0.75, '#fbf5b7');
  goldGrad.addColorStop(1, '#aa771c');

  // Dış Çerçeve
  roundRect(ctx, 10, 10, width - 20, height - 20, 18);
  ctx.strokeStyle = goldGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // İç İnce Çerçeve
  roundRect(ctx, 16, 16, width - 32, height - 32, 14);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // 3. Başlık: Uluslararası Aile Cüzdanı
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#fcf6ba';
  ctx.shadowColor = 'rgba(212, 175, 55, 0.6)';
  ctx.shadowBlur = 8;
  ctx.fillText('👑 ULUSLARARASI AİLE CÜZDANI 👑', width / 2, 48);

  ctx.font = 'italic 12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#e8c784';
  ctx.shadowBlur = 0;
  ctx.fillText('VİP METRO PROTOKOLÜ VE SOSYAL EVLİLİK KAYDI', width / 2, 68);
  ctx.restore();

  // 4. Avatarlar
  const avatarSize = 100;
  const av1X = 75;
  const av1Y = 95;
  const av2X = width - 75 - avatarSize;
  const av2Y = 95;

  // Avatar 1 Çizimi
  try {
    const av1Img = await loadImage(data.user1Avatar);
    ctx.save();
    roundRect(ctx, av1X, av1Y, avatarSize, avatarSize, 14);
    ctx.clip();
    ctx.drawImage(av1Img, av1X, av1Y, avatarSize, avatarSize);
    ctx.restore();
  } catch {
    ctx.fillStyle = '#771122';
    roundRect(ctx, av1X, av1Y, avatarSize, avatarSize, 14);
    ctx.fill();
  }

  // Avatar 1 Altın Çerçeve
  roundRect(ctx, av1X, av1Y, avatarSize, avatarSize, 14);
  ctx.strokeStyle = '#fcf6ba';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Avatar 2 Çizimi
  try {
    const av2Img = await loadImage(data.user2Avatar);
    ctx.save();
    roundRect(ctx, av2X, av2Y, avatarSize, avatarSize, 14);
    ctx.clip();
    ctx.drawImage(av2Img, av2X, av2Y, avatarSize, avatarSize);
    ctx.restore();
  } catch {
    ctx.fillStyle = '#771122';
    roundRect(ctx, av2X, av2Y, avatarSize, avatarSize, 14);
    ctx.fill();
  }

  // Avatar 2 Altın Çerçeve
  roundRect(ctx, av2X, av2Y, avatarSize, avatarSize, 14);
  ctx.strokeStyle = '#fcf6ba';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Avatar Altı İsimler
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';

  const name1 = data.user1Name.length > 14 ? data.user1Name.slice(0, 12) + '...' : data.user1Name;
  const name2 = data.user2Name.length > 14 ? data.user2Name.slice(0, 12) + '...' : data.user2Name;

  ctx.fillText(name1, av1X + avatarSize / 2, av1Y + avatarSize + 24);
  ctx.fillText(name2, av2X + avatarSize / 2, av2Y + avatarSize + 24);
  ctx.restore();

  // 5. Ortadaki Semboller (Aşk Kalbi & Yüzük)
  const midX = width / 2;
  const midY = 145;

  drawHeart(ctx, midX, midY - 12, 34);
  drawRingIcon(ctx, midX, midY + 34, data.ringType);

  // 6. Orta Bilgi Paneli (Kutu ve Değerler)
  const boxX = 200;
  const boxY = 230;
  const boxW = width - 400;
  const boxH = 82;

  ctx.save();
  roundRect(ctx, boxX, boxY, boxW, boxH, 12);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Gün Hesabı
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - new Date(data.marriedAt).getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffTime / (1000 * 60 * 60)) % 24);

  let ringTitle = 'Gümüş Yüzük 💍';
  if (data.ringType === 'GOLD') ringTitle = 'Altın Yüzük 💛';
  if (data.ringType === 'DIAMOND') ringTitle = 'Pırlanta Yüzük 💎';

  // Bilgi Metinleri
  ctx.textAlign = 'left';
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#e0d0b0';

  ctx.fillText(`🗓️ Evlilik Süresi:`, boxX + 16, boxY + 26);
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${diffDays} Gün ${diffHours} Saat`, boxX + 130, boxY + 26);

  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#e0d0b0';
  ctx.fillText(`💍 Yüzük Türü:`, boxX + 16, boxY + 48);
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#fcf6ba';
  ctx.fillText(ringTitle, boxX + 130, boxY + 48);

  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#e0d0b0';
  ctx.fillText(`❤️ Aşk Puanı:`, boxX + 16, boxY + 70);
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ff6b8b';
  ctx.fillText(`${data.lovePoints} Puan`, boxX + 130, boxY + 70);

  // Kasa miktarı sağ tarafta
  ctx.textAlign = 'right';
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#e0d0b0';
  ctx.fillText(`🪙 Ortak Kasa:`, boxX + boxW - 16, boxY + 40);
  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`${data.jointCoins.toLocaleString('tr-TR')} Coin`, boxX + boxW - 16, boxY + 65);

  ctx.restore();

  return canvas.toBuffer('image/png');
}
