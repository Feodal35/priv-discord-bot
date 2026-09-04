import { Client, ActivityType } from 'discord.js';
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import { logger } from '../utils/logger';
import { voiceService } from '../services/voice.service';
import { reminderService } from '../services/reminder.service';
import { birthdayService } from '../services/birthday.service';
import { guildService } from '../services/guild.service';
import { deployCommands, clearGuildCommands } from '../deploy-commands';
import { clanRoleService } from '../services/clanRole.service';

// Botun 7/24 bağlı kalacağı kalıcı ses kanalı
export const AUTO_JOIN_CHANNEL_ID = '1543030493224632331';

export async function onReady(client: Client) {
  logger.info(`🤖 ${client.user?.tag} başarıyla Discord'a bağlandı!`, { service: 'READY' });

  // 0. Komutları Discord ile senkronize et ve duplike (2 adet gözükme) sorununu çöz:
  //    Daha önce sunucu bazlı (guild-level) kaydedilen komutlar Discord arayüzünde
  //    global komutlarla çakışıp her komutun 2 kez çıkmasına sebep olur.
  //    Sunuculardaki eski özel kayıtları temizleyip tek bir global kayıt bırakıyoruz!
  try {
    for (const [guildId] of client.guilds.cache) {
      await clearGuildCommands(guildId);
    }
    await deployCommands(); // Tek ve net global kayıt
    logger.info(`✅ Komutlar senkronize edildi: Çift gözükme temizlendi, tek global liste aktif!`, { service: 'READY' });
  } catch (err) {
    logger.error('Komutlar senkronize edilirken hata oluştu:', err);
  }

  // Zengin bot aktivitesi ve durumu
  client.user?.setPresence({
    status: 'online',
    activities: [
      {
        name: 'Priv Topluluğu | /yardım',
        type: ActivityType.Custom,
        state: '👑 Priv • Gelişmiş Ekonomi, Oyun ve Topluluk Botu',
      },
    ],
  });

  // 1. Sunucu kayıtlarını veritabanı ile eşitle ve itiraf kanalını (1545496276576116878) bağla
  for (const [guildId, guild] of client.guilds.cache) {
    await guildService.getOrCreateGuild(guildId, guild.name, guild.ownerId, guild.iconURL());
    await guildService.updateGuildSettings(guildId, {
      confessionChannelId: '1545496276576116878',
      confessionEnabled: true,
      welcomeChannelId: '1542620110882349162',
      logChannelId: '1545497145379917954',
    }).catch(() => {});
  }

  // 2. Bot yeniden başladığında asılı kalan boş geçici ses odalarını temizle
  await voiceService.cleanStaleTempChannels(client);

  // 3. Hatırlatıcı zamanlayıcısını başlat
  reminderService.startReminderWorker(client);

  // 4. Doğum günü cron servisini başlat
  birthdayService.startBirthdayCron(client);

  // 5. Sabit ses kanalına otomatik 7/24 bağlan
  await connectToPersistentVoice(client);

  // 6. Klan / Guild Rolü (1543033008318316654) Sıkı Denetimi:
  //    Klanı olmayan/salanlardan rolü geri alır, klanı olanlara rolü verir!
  clanRoleService.syncAllGuilds(client).catch((err) => {
    logger.error('Klan rolü senkronizasyon hatası:', err);
  });

  // Her 5 dakikada bir otomatik tarama yap (salanların rolünü geri almak için)
  setInterval(() => {
    clanRoleService.syncAllGuilds(client).catch(() => {});
  }, 5 * 60 * 1000);

  // 7. Düzenli ses odası sağlık kontrolü (Her 30 saniyede bir kontrol et, düşerse tekrar bağlan)
  setInterval(() => {
    ensureVoiceConnection(client).catch((err) => {
      logger.error('Ses bağlantısı kontrol hatası:', err);
    });
  }, 30000);

  logger.info(`✨ Tüm Priv servisleri, ses izleyicisi, klan rol denetimi ve cron'lar hazır!`, { service: 'READY' });
}

export async function connectToPersistentVoice(client: Client) {
  try {
    let targetGuild = null;
    let targetChannel = null;

    // Önce önbellekten ara
    for (const [, guild] of client.guilds.cache) {
      const ch = guild.channels.cache.get(AUTO_JOIN_CHANNEL_ID);
      if (ch && ch.isVoiceBased()) {
        targetGuild = guild;
        targetChannel = ch;
        break;
      }
    }

    // Önbellekte yoksa fetch et
    if (!targetGuild || !targetChannel) {
      for (const [, guild] of client.guilds.cache) {
        try {
          const fetched = await guild.channels.fetch(AUTO_JOIN_CHANNEL_ID).catch(() => null);
          if (fetched && fetched.isVoiceBased()) {
            targetGuild = guild;
            targetChannel = fetched;
            break;
          }
        } catch { /* devam et */ }
      }
    }

    if (!targetGuild || !targetChannel) {
      logger.warn(`⚠️ Ses kanalı bulunamadı! Kanal ID: ${AUTO_JOIN_CHANNEL_ID}`, { service: 'VOICE_AUTO' });
      return;
    }

    // Mevcut bağlantıyı kontrol et
    const existingConnection = getVoiceConnection(targetGuild.id);
    if (existingConnection && existingConnection.state.status === VoiceConnectionStatus.Ready) {
      return;
    }

    const connection = joinVoiceChannel({
      channelId: targetChannel.id,
      guildId: targetGuild.id,
      adapterCreator: targetGuild.voiceAdapterCreator as any,
      selfDeaf: true,  // Kulaklık kapalı (sağırlaştırılmış)
      selfMute: false, // Mikrofon açık
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        connection.destroy();
        logger.warn('Ses bağlantısı koptu, 3 saniye sonra tekrar bağlanılıyor...', { service: 'VOICE_AUTO' });
        setTimeout(() => connectToPersistentVoice(client), 3000);
      }
    });

    logger.info(`🎤 Bot kalıcı ses odasına başarıyla katıldı: [${targetChannel.name}] (Sunucu: ${targetGuild.name})`, {
      service: 'VOICE_AUTO',
    });
  } catch (error) {
    logger.error('Otomatik ses kanalına bağlanırken hata oluştu:', error);
  }
}

async function ensureVoiceConnection(client: Client) {
  for (const [, guild] of client.guilds.cache) {
    const ch = guild.channels.cache.get(AUTO_JOIN_CHANNEL_ID);
    if (ch && ch.isVoiceBased()) {
      const conn = getVoiceConnection(guild.id);
      if (!conn || conn.state.status === VoiceConnectionStatus.Destroyed || conn.state.status === VoiceConnectionStatus.Disconnected) {
        await connectToPersistentVoice(client);
      }
      break;
    }
  }
}

