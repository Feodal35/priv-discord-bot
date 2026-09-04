import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Kök dizindeki veya çalışma alanındaki .env dosyasını yükle
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN gereklidir.'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID gereklidir.'),
  DISCORD_CLIENT_SECRET: z.string().optional().default(''),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL gereklidir. PostgreSQL bağlantı adresi girilmelidir.'),
  REDIS_URL: z.string().optional(),
  SESSION_SECRET: z.string().default('priv_super_secret_session_key_123456789'),
  JWT_SECRET: z.string().default('priv_super_secret_jwt_key_123456789'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DASHBOARD_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:4000'),
  DISCORD_REDIRECT_URI: z.string().default('http://localhost:4000/api/auth/callback'),
  DEFAULT_BOT_NAME: z.string().default('Priv'),
  DEFAULT_PREFIX: z.string().default('/'),
  DEFAULT_EMBED_COLOR: z.string().default('#5865F2'),
  DEFAULT_CURRENCY_NAME: z.string().default('Coin'),
  DEFAULT_CURRENCY_EMOJI: z.string().default('🪙'),
  DEFAULT_TIMEZONE: z.string().default('Europe/Istanbul'),
  AI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.string().default('gemini'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let validatedConfig: EnvConfig;

export function getConfig(): EnvConfig {
  if (!validatedConfig) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const errorDetails = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      console.warn(
        `[UYARI] Ortam değişkenleri doğrulamasında eksiklikler tespit edildi:\n${errorDetails}\nVarsayılan değerlerle devam ediliyor veya eksik değerler atanmalıdır.`
      );
      // Geliştirme ve derleme (build) sırasında token henüz girilmemiş olabilir; bu sebeple fallback sağlarız
      validatedConfig = {
        DISCORD_TOKEN: process.env.DISCORD_TOKEN || 'MISSING_DISCORD_TOKEN',
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || 'MISSING_CLIENT_ID',
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
        DATABASE_URL:
          process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/priv_discord_bot?schema=public',
        REDIS_URL: process.env.REDIS_URL,
        SESSION_SECRET: process.env.SESSION_SECRET || 'priv_super_secret_session_key_123456789',
        JWT_SECRET: process.env.JWT_SECRET || 'priv_super_secret_jwt_key_123456789',
        NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
        PORT: Number(process.env.PORT) || 4000,
        DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:5173',
        API_URL: process.env.API_URL || 'http://localhost:4000',
        DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || 'http://localhost:4000/api/auth/callback',
        DEFAULT_BOT_NAME: process.env.DEFAULT_BOT_NAME || 'Priv',
        DEFAULT_PREFIX: process.env.DEFAULT_PREFIX || '/',
        DEFAULT_EMBED_COLOR: process.env.DEFAULT_EMBED_COLOR || '#5865F2',
        DEFAULT_CURRENCY_NAME: process.env.DEFAULT_CURRENCY_NAME || 'Coin',
        DEFAULT_CURRENCY_EMOJI: process.env.DEFAULT_CURRENCY_EMOJI || '🪙',
        DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'Europe/Istanbul',
        AI_API_KEY: process.env.AI_API_KEY,
        AI_PROVIDER: process.env.AI_PROVIDER || 'gemini',
      };
    } else {
      validatedConfig = parsed.data;
    }
  }
  return validatedConfig;
}

export const config = getConfig();
