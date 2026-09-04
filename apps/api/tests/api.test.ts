import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

describe('API Güvenlik ve Validasyon Testleri', () => {
  const JWT_SECRET = 'test_jwt_secret_key_12345678901234567890';

  it('JWT token başarıyla imzalanmalı ve doğrulanmalı', () => {
    const payload = {
      id: '123456789',
      username: 'testuser',
      discriminator: '0',
      avatar: null,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    expect(typeof token).toBe('string');

    const decoded = jwt.verify(token, JWT_SECRET) as typeof payload;
    expect(decoded.id).toBe(payload.id);
    expect(decoded.username).toBe(payload.username);
  });

  it('Geçersiz token doğrulanamamalı', () => {
    expect(() => {
      jwt.verify('gecersiz_token_verisi', JWT_SECRET);
    }).toThrow();
  });

  it('Zod Hex renk doğrulamasını doğru yapmalı', () => {
    const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

    expect(colorSchema.safeParse('#5865F2').success).toBe(true);
    expect(colorSchema.safeParse('#ff0000').success).toBe(true);
    expect(colorSchema.safeParse('mavi').success).toBe(false);
    expect(colorSchema.safeParse('#123').success).toBe(false);
  });

  it('Mağaza ürünü ekleme şeması negatif fiyatı reddetmeli', () => {
    const shopSchema = z.object({
      name: z.string().min(1).max(50),
      price: z.number().int().positive(),
      type: z.enum(['ROLE', 'CUSTOM_ROLE', 'BADGE', 'TITLE', 'COSMETIC', 'ITEM']),
    });

    const valid = shopSchema.safeParse({
      name: 'VIP Rol',
      price: 5000,
      type: 'ROLE',
    });
    expect(valid.success).toBe(true);

    const invalid = shopSchema.safeParse({
      name: 'Hatalı Ürün',
      price: -100,
      type: 'ROLE',
    });
    expect(invalid.success).toBe(false);
  });
});
