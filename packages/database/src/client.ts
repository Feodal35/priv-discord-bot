import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: isDev ? ['warn', 'error'] : ['error'],
  });

if (!isProd) {
  globalThis.prismaGlobal = prisma;
}

/**
 * Basit ve güvenilir In-Memory önbellek (Redis yoksa veya kapalıysa otomatik devreye girer)
 */
class SimpleCache {
  private cache = new Map<string, { val: any; expiresAt: number }>();

  public get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.val as T;
  }

  public set(key: string, val: any, ttlSeconds: number = 60): void {
    this.cache.set(key, { val, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public deletePattern(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new SimpleCache();

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('[HATA] Veritabanı bağlantısı kurulamadı:', error);
    return false;
  }
}
