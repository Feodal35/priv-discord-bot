import { config } from '@priv/config';
import { createDiscordClient } from './client';
import { logger } from './utils/logger';
import { checkDatabaseConnection } from '@priv/database';

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

  try {
    await client.login(config.DISCORD_TOKEN);
  } catch (error) {
    logger.error('❌ Discord bağlantısı başarısız:', error);
  }
}

bootstrap().catch((err) => {
  logger.error('Kritik bot başlatma hatası:', err);
});
