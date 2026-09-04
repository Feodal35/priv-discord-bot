import { describe, it, expect } from 'vitest';
import { calculateShipPercentage } from '@priv/shared';

describe('Ship Algoritması', () => {
  it('Aynı gün içerisinde aynı iki kullanıcı için aynı yüzdeyi vermeli', () => {
    const percent1 = calculateShipPercentage('user_a', 'user_b');
    const percent2 = calculateShipPercentage('user_a', 'user_b');
    const percentSymmetric = calculateShipPercentage('user_b', 'user_a');

    expect(percent1).toBe(percent2);
    expect(percent1).toBe(percentSymmetric);
    expect(percent1).toBeGreaterThanOrEqual(1);
    expect(percent1).toBeLessThanOrEqual(100);
  });
});
