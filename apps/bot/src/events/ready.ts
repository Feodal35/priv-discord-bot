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

  // 1. Sunucu kayıtlarını veritabanı ile eşitle
  for (const [guildId, guild] of client.guilds.cache) {
    await guildService.getOrCreateGuild(guildId, guild.name, guild.ownerId, guild.iconURL());
  }

  // 2. Bot yeniden başladığında asılı kalan boş geçici ses odalarını temizle
  await voiceService.cleanStaleTempChannels(client);

  // 3. Hatırlatıcı zamanlayıcısını başlat
  reminderService.startReminderWorker(client);

  // 4. Doğum günü cron servisini başlat
  birthdayService.startBirthdayCron(client);

  // 5. Sabit ses kanalına otomatik 7/24 bağlan
  await connectToPersistentVoice(client);

  // 6. 1543033008318316654 rolünü sunucudaki üyelere kontrol et ve senkronize et
  syncAutoRoleForExistingMembers(client).catch(() => {});

  // 7. Düzenli ses odası sağlık kontrolü (Her 30 saniyede bir kontrol et, düşerse tekrar bağlan)
  setInterval(() => {
    ensureVoiceConnection(client).catch((err) => {
      logger.error('Ses bağlantısı kontrol hatası:', err);
    });
  }, 30000);

  logger.info(`✨ Tüm Priv servisleri, ses izleyicisi, oto-rol ve cron'lar hazır!`, { service: 'READY' });
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

export const AUTO_ROLE_ID = '1543033008318316654';

async function syncAutoRoleForExistingMembers(client: Client) {
  try {
    for (const [, guild] of client.guilds.cache) {
      let role = guild.roles.cache.get(AUTO_ROLE_ID);
      if (!role) {
        role = await guild.roles.fetch(AUTO_ROLE_ID).catch(() => null) || undefined;
      }
      if (!role) continue;

      const botMember = guild.members.me;
      if (!botMember?.permissions.has('ManageRoles') || botMember.roles.highest.position <= role.position) {
        continue;
      }

      // Üyeleri çekip rolü olmayanlara ekle
      const members = await guild.members.fetch().catch(() => null);
      if (!members) continue;

      let givenCount = 0;
      for (const [, member] of members) {
        if (!member.user.bot && !member.roles.cache.has(role.id)) {
          await member.roles.add(role).catch(() => {});
          givenCount++;
        }
      }

      if (givenCount > 0) {
        logger.info(`👑 [OTO-ROL] ${guild.name} sunucusunda ${givenCount} üyeye ${role.name} rolü otomatik verildi.`, { service: 'AUTO_ROLE' });
      }
    }
  } catch (err) {
    logger.error('Mevcut üyelere otomatik rol senkronize edilirken hata:', err);
  }
}

