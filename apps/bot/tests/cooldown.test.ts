import { describe, it, expect } from 'vitest';
import { CooldownManager } from '../src/utils/cooldown';

describe('Cooldown Yöneticisi', () => {
  it('İlk çağrıda cooldown tetiklenmemeli', () => {
    const manager = new CooldownManager();
    const res = manager.check('test_cmd', 'user_123', 5);
    expect(res.onCooldown).toBe(false);
    expect(res.remainingSeconds).toBe(0);
  });

  it('Hemen ardından gelen çağrıda cooldown aktif olmalı', () => {
    const manager = new CooldownManager();
    manager.check('test_cmd', 'user_123', 5);
    const res2 = manager.check('test_cmd', 'user_123', 5);

    expect(res2.onCooldown).toBe(true);
    expect(res2.remainingSeconds).toBeGreaterThan(0);
    expect(res2.remainingSeconds).toBeLessThanOrEqual(5);
  });

  it('Farklı kullanıcılar birbirini etkilememeli', () => {
    const manager = new CooldownManager();
    manager.check('test_cmd', 'user_1', 10);
    const resUser2 = manager.check('test_cmd', 'user_2', 10);

    expect(resUser2.onCooldown).toBe(false);
  });
});
