import { describe, it, expect } from 'vitest';
import { getLevelFromXp, getXpForLevel, getLevelProgress, createProgressBar } from '@priv/shared';

describe('Seviye ve XP Hesaplama Motoru', () => {
  it('Level 1 için 0 XP olmalı', () => {
    expect(getXpForLevel(1)).toBe(0);
    expect(getLevelFromXp(0)).toBe(1);
  });

  it('XP arttıkça seviye doğru hesaplanmalı', () => {
    const xpLevel2 = getXpForLevel(2);
    expect(xpLevel2).toBeGreaterThan(0);
    expect(getLevelFromXp(xpLevel2)).toBe(2);

    const xpLevel5 = getXpForLevel(5);
    expect(getLevelFromXp(xpLevel5)).toBe(5);
  });

  it('İlerleme yüzdesi 0 ile 100 arasında olmalı', () => {
    const progress = getLevelProgress(150);
    expect(progress.progressPercent).toBeGreaterThanOrEqual(0);
    expect(progress.progressPercent).toBeLessThanOrEqual(100);
    expect(progress.currentLevel).toBeGreaterThanOrEqual(1);
    expect(progress.nextLevel).toBe(progress.currentLevel + 1);
  });

  it('createProgressBar doğru uzunluk ve format üretmeli', () => {
    const bar50 = createProgressBar(50, 10);
    expect(bar50).toContain('50%');
    expect(bar50).toContain('█');
    expect(bar50).toContain('░');
  });
});
