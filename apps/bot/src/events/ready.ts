import { Client, ActivityType } from 'discord.js';
import { logger } from '../utils/logger';
import { voiceService } from '../services/voice.service';
import { reminderService } from '../services/reminder.service';
import { birthdayService } from '../services/birthday.service';
import { guildService } from '../services/guild.service';
import { deployCommands } from '../deploy-commands';

export async function onReady(client: Client) {
  logger.info(`🤖 ${client.user?.tag} başarıyla Discord'a bağlandı!`, { service: 'READY' });

  // 0. Komutları Discord'a otomatik senkronize et (Sunuculara anında yansır)
  try {
    for (const [guildId] of client.guilds.cache) {
      await deployCommands(guildId);
    }
    await deployCommands();
    logger.info(`✅ Tüm eğik çizgi (/) komutları Discord'a başarıyla senkronize edildi!`, { service: 'READY' });
  } catch (err) {
    logger.error('Komutlar senkronize edilirken hata oluştu:', err);
  }

  // Bot aktivitesi ayarla
  client.user?.setActivity({
    name: 'Priv Sunucusu | /yardım',
    type: ActivityType.Custom,
    state: '🔥 Priv Topluluk Sistemi Aktif',
  });

  // 1. Sunucu kayıtlarını veritabanı ile eşitle
  for (const [guildId, guild] of client.guilds.cache) {
    await guildService.getOrCreateGuild(guildId, guild.name, guild.ownerId, guild.iconURL());
  }

  // 2. Bot yeniden başladığında asılı kalan boş geçici ses odalarını temizle
  await voiceService.cleanStaleTempChannels(client);

  // 3. Hatırlatıcı zamanlayıcısını başlat (Restart sonrası DB'den yükler)
  reminderService.startReminderWorker(client);

  // 4. Doğum günü cron servisini başlat
  birthdayService.startBirthdayCron(client);

  logger.info(`✨ Tüm Priv servisleri, cron'lar ve arka plan izleyicileri hazır!`, { service: 'READY' });
}
