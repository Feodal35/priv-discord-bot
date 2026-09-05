import { config } from '@priv/config';
import { createDiscordClient } from './client';
import { logger } from './utils/logger';
import { checkDatabaseConnection } from '@priv/database';
import { voiceService } from './services/voice.service';

// Global çökme önleyici hata yakalayıcılar
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
});

// Bot yeniden başlarken (restart / deploy) aktif sürelerin kaybolmaması için güvenli kapatma
async function handleShutdown(signal: string) {
  logger.info(`[SHUTDOWN] ${signal} sinyali alındı. Aktif ses süreleri veritabanına kalıcı olarak kaydediliyor...`);
  try {
    await voiceService.flushAllSessions();
    logger.info('[SHUTDOWN] Tüm oturumlar başarıyla kaydedildi.');
  } catch (err) {
    logger.error('[SHUTDOWN] Oturumlar kaydedilirken hata:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

async function bootstrap() {
  logger.info('🚀 Priv Bot başlatılıyor...', { service: 'BOOTSTRAP' });

  // 1. Veritabanı bağlantısı kontrolü
  const dbOk = await checkDatabaseConnection();
  if (!dbOk) {
    logger.warn('⚠️ Veritabanı bağlantısı kurulamadı veya henüz başlatılmadı. Veritabanı komutları hata verebilir.');
  } else {
    logger.info('✅ Veritabanı bağlantısı başarılı.', { service: 'DATABASE' });
  }

  // 2. Token kontrolü
  if (!config.DISCORD_TOKEN || config.DISCORD_TOKEN === 'MISSING_DISCORD_TOKEN') {
    logger.error('❌ DISCORD_TOKEN tanımlanmamış! Lütfen .env dosyasını doldurun.');
    logger.info('💡 Örnek dosya için .env.example dosyasını inceleyin.');
    return;
  }

  // 3. Discord Client oluştur ve bağlan
  const client = createDiscordClient();

  client.on('error', (err) => {
    logger.error('Discord Client hatası:', err);
  });

  try {
    await client.login(config.DISCORD_TOKEN);
  } catch (error) {
    logger.error('❌ Discord bağlantısı başarısız:', error);
  }
}

bootstrap().catch((err) => {
  logger.error('Kritik bot başlatma hatası:', err);
});
