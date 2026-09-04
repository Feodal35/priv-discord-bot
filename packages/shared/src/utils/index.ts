/**
 * Seviyeye ulaşmak için gereken toplam XP'yi hesaplar
 * Formül: 100 * (level ^ 1.5)
 */
export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level - 1, 1.5));
}

/**
 * Mevcut XP'ye göre kullanıcının ulaştığı seviyeyi hesaplar
 */
export function getLevelFromXp(xp: number): number {
  let level = 1;
  while (getXpForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}

/**
 * Bir sonraki seviye için kalan ve mevcut ilerleme yüzdesini hesaplar
 */
export function getLevelProgress(xp: number): {
  currentLevel: number;
  nextLevel: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpInLevel: number;
  xpNeededForNext: number;
  progressPercent: number;
} {
  const currentLevel = getLevelFromXp(xp);
  const nextLevel = currentLevel + 1;
  const currentLevelXp = getXpForLevel(currentLevel);
  const nextLevelXp = getXpForLevel(nextLevel);
  const xpInLevel = Math.max(0, xp - currentLevelXp);
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpInLevel / xpNeededForNext) * 100)));

  return {
    currentLevel,
    nextLevel,
    currentLevelXp,
    nextLevelXp,
    xpInLevel,
    xpNeededForNext,
    progressPercent,
  };
}

/**
 * Discord embedleri için metin tabanlı ilerleme çubuğu üretir
 * Örnek: [██████████░░░░░░░░░░] 50%
 */
export function createProgressBar(percent: number, totalSegments: number = 12): string {
  const clamped = Math.min(100, Math.max(0, percent));
  const filledSegments = Math.round((clamped / 100) * totalSegments);
  const emptySegments = totalSegments - filledSegments;

  const filledBar = '█'.repeat(filledSegments);
  const emptyBar = '░'.repeat(emptySegments);

  return `${filledBar}${emptyBar} ${clamped}%`;
}

/**
 * Para miktarını Türkçe formatlar (Örn: 12.500)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR').format(Math.floor(amount));
}

/**
 * Saniyeyi saat ve dakikaya çevirir
 */
export function formatSecondsToDuration(seconds: number): string {
  if (seconds <= 0) return '0 dk';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours} sa ${minutes} dk`;
  }
  if (hours > 0) {
    return `${hours} sa`;
  }
  return `${minutes} dk`;
}

/**
 * Saat cinsinden süreyi Türkçe formatlar
 */
export function formatHours(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins} dakika`;
  }
  return `${hours.toFixed(1).replace('.0', '')} saat`;
}

/**
 * İki kullanıcı ID'sinden tutarlı rastgele ship uyum yüzdesi üretir
 */
export function calculateShipPercentage(user1Id: string, user2Id: string): number {
  const combined = [user1Id, user2Id].sort().join('-');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  const dateStr = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  return (positiveHash % 100) + 1;
}

/**
 * Karşılama ve ayrılma mesajlarındaki değişkenleri değiştirir
 */
export function parsePlaceholders(
  template: string,
  variables: {
    user?: string;
    username?: string;
    server?: string;
    memberCount?: number;
    level?: number;
  }
): string {
  return template
    .replace(/{user}/g, variables.user || '')
    .replace(/{username}/g, variables.username || '')
    .replace(/{server}/g, variables.server || '')
    .replace(/{memberCount}/g, variables.memberCount ? String(variables.memberCount) : '')
    .replace(/{level}/g, variables.level ? String(variables.level) : '1');
}
