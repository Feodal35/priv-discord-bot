import { VoiceState, AuditLogEvent, Client } from 'discord.js';
import { voiceService } from '../services/voice.service';
import { logService } from '../services/log.service';
import { AUTO_JOIN_CHANNEL_ID, connectToPersistentVoice } from './ready';

// Aktif seste kalma sürelerini takip eden hafıza tablosu: "${guildId}:${userId}" -> timestamp
export const voiceJoinTimes = new Map<string, number>();

/**
 * Bot başladığında mevcut seste olan kullanıcıların sürelerini başlatır
 */
export function initVoiceSessionsFromGuilds(client: Client) {
  for (const [, guild] of client.guilds.cache) {
    for (const [, channel] of guild.channels.cache) {
      if (channel.isVoiceBased()) {
        for (const [memberId, member] of channel.members) {
          if (!member.user.bot) {
            voiceJoinTimes.set(`${guild.id}:${memberId}`, Date.now());
          }
        }
      }
    }
  }
}

/**
 * Süreyi Türkçeleştirilmiş detaylı metne çevirir (Örn: "1 saat 24 dakika 15 saniye")
 */
function formatDetailedDuration(seconds: number): string {
  if (seconds < 1) return '1 saniye';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} saat`);
  if (minutes > 0) parts.push(`${minutes} dakika`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} saniye`);

  return parts.join(' ');
}

export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  const client = newState.client;
  const member = newState.member || oldState.member;
  const guild = newState.guild || oldState.guild;

  // 1. Botun kendisi ses kanalından çıkarılmışsa otomatik olarak geri bağlan
  if (member?.id === client.user?.id) {
    if (!newState.channelId || newState.channelId !== AUTO_JOIN_CHANNEL_ID) {
      setTimeout(() => {
        connectToPersistentVoice(client).catch(() => {});
      }, 2000);
    }
  }

  // 2. Dinamik ses kanalı ve XP / ses süresi takibi
  await voiceService.handleVoiceState(oldState, newState, client);

  // 3. DETAYLI SES LOGLARI (Sadece gerçek kullanıcılar için)
  if (!member || member.user.bot || !guild) return;

  const cacheKey = `${guild.id}:${member.id}`;
  const nowUnix = Math.floor(Date.now() / 1000);
  const avatarUrl = member.displayAvatarURL({ size: 128 });

  try {
    // A) KULLANICI SES KANALINA KATILDI
    if (!oldState.channelId && newState.channelId) {
      voiceJoinTimes.set(cacheKey, Date.now());
      const newChannel = newState.channel;
      const memberCount = newChannel?.members.size || 1;

      const micStatus = newState.selfMute ? '🔇 Kapalı' : '🎙️ Açık';
      const deafStatus = newState.selfDeaf ? '🔇 Sağırlaştırılmış' : '🔊 Açık';
      const cameraStatus = newState.selfVideo ? '📹 Açık' : 'Kapalı';
      const streamStatus = newState.streaming ? '📺 Canlı Yayın Başlatıldı' : 'Yayın Yok';

      const desc =
        `**Kullanıcı:** <@${member.id}> (\`${member.user.tag}\`)\n` +
        `**Katıldığı Kanal:** <#${newState.channelId}> (\`${newChannel?.name}\`)\n` +
        `**Kanaldaki Üye Sayısı:** \`${memberCount}\` üye\n\n` +
        `• **Mikrofon:** ${micStatus}\n` +
        `• **Kulaklık:** ${deafStatus}\n` +
        `• **Kamera:** ${cameraStatus}\n` +
        `• **Ekran:** ${streamStatus}\n` +
        `• **Giriş Saati:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`;

      await logService.logEvent(
        guild.id,
        'VOICE',
        'Ses Kanalına Katıldı',
        desc,
        client,
        undefined,
        {
          thumbnailUrl: avatarUrl,
          color: 0x2ecc71, // Canlı Yeşil
        }
      );
      return;
    }

    // B) KULLANICI SES KANALINDAN AYRILDI
    if (oldState.channelId && !newState.channelId) {
      const oldChannel = oldState.channel;
      const remainingCount = oldChannel?.members.size || 0;

      const joinedAt = voiceJoinTimes.get(cacheKey);
      voiceJoinTimes.delete(cacheKey);

      let durationText = 'Bilinmiyor';
      if (joinedAt) {
        const durationSec = Math.floor((Date.now() - joinedAt) / 1000);
        durationText = formatDetailedDuration(durationSec);
      }

      const desc =
        `**Kullanıcı:** <@${member.id}> (\`${member.user.tag}\`)\n` +
        `**Ayrıldığı Kanal:** <#${oldState.channelId}> (\`${oldChannel?.name}\`)\n` +
        `**Kanalda Kalma Süresi:** ⏱️ **${durationText}**\n` +
        `**Kanaldaki Kalan Üye:** \`${remainingCount}\` üye\n` +
        `**Ayrılış Saati:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`;

      await logService.logEvent(
        guild.id,
        'VOICE',
        'Ses Kanalından Ayrıldı',
        desc,
        client,
        undefined,
        {
          thumbnailUrl: avatarUrl,
          color: 0xe74c3c, // Kırmızı
        }
      );
      return;
    }

    // C) KULLANICI SES KANALI DEĞİŞTİRDİ (Switch / Move)
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const oldChannel = oldState.channel;
      const newChannel = newState.channel;
      const newCount = newChannel?.members.size || 1;

      const joinedAt = voiceJoinTimes.get(cacheKey);
      voiceJoinTimes.set(cacheKey, Date.now()); // Yeni oda için süreyi sıfırla

      let durationText = '';
      if (joinedAt) {
        const durationSec = Math.floor((Date.now() - joinedAt) / 1000);
        durationText = `\n• **Önceki Kanalda Geçirilen Süre:** ⏱️ ${formatDetailedDuration(durationSec)}`;
      }

      // Yetkili tarafından mı taşındı denetimi (Audit Log)
      let movedBy = '';
      try {
        const auditLogs = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberMove,
          limit: 1,
        }).catch(() => null);
        const logEntry = auditLogs?.entries.first();
        if (logEntry && Date.now() - logEntry.createdTimestamp < 3500) {
          movedBy = `\n🛡️ **Yetkili Tarafından Taşındı:** <@${logEntry.executorId}>`;
        }
      } catch {}

      const desc =
        `**Kullanıcı:** <@${member.id}> (\`${member.user.tag}\`)\n` +
        `**Eski Kanal:** <#${oldState.channelId}> (\`${oldChannel?.name}\`)\n` +
        `**Yeni Kanal:** <#${newState.channelId}> (\`${newChannel?.name}\`)\n` +
        `**Yeni Kanaldaki Üye:** \`${newCount}\` üye` +
        durationText +
        (movedBy || '\n🔄 **Kendi İsteğiyle Geçiş Yaptı**') +
        `\n**Geçiş Saati:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`;

      await logService.logEvent(
        guild.id,
        'VOICE',
        'Ses Kanalı Değiştirdi',
        desc,
        client,
        undefined,
        {
          thumbnailUrl: avatarUrl,
          color: 0x3498db, // Mavi
        }
      );
      return;
    }

    // D) AYNI KANAL İÇİNDEKİ DURUM DEĞİŞİKLİKLERİ (Yayın, Kamera, Yetkili Susturması)
    if (oldState.channelId && newState.channelId && oldState.channelId === newState.channelId) {
      // D.1) EKRAN PAYLAŞIMI (STREAMING)
      if (!oldState.streaming && newState.streaming) {
        await logService.logEvent(
          guild.id,
          'VOICE',
          'Ekran Paylaşımı Başlatıldı',
          `**Kullanıcı:** <@${member.id}> (\`${member.user.tag}\`)\n` +
          `**Kanal:** <#${newState.channelId}> (\`${newState.channel?.name}\`)\n` +
          `**Durum:** 📺 Canlı yayın / ekran paylaşımı başlatıldı.\n` +
          `**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`,
          client,
          undefined,
          { thumbnailUrl: avatarUrl, color: 0x9b59b6 }
        );
      } else if (oldState.streaming && !newState.streaming) {
        await logService.logEvent(
          guild.id,
          'VOICE',
          'Ekran Paylaşımı Sonlandırıldı',
          `**Kullanıcı:** <@${member.id}> (\`${member.user.tag}\`)\n` +
          `**Kanal:** <#${newState.channelId}> (\`${newState.channel?.name}\`)\n` +
          `**Durum:** 📺 Canlı yayın / ekran paylaşımı sonlandırıldı.\n` +
          `**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`,
          client,
          undefined,
          { thumbnailUrl: avatarUrl, color: 0x7f8c8d }
        );
      }

      // D.2) KAMERA (VİDEO)
      if (!oldState.selfVideo && newState.selfVideo) {
        await logService.logEvent(
          guild.id,
          'VOICE',
          'Kamera Açıldı',
          `**Kullanıcı:** <@${member.id}> (\`${member.user.tag}\`)\n` +
          `**Kanal:** <#${newState.channelId}> (\`${newState.channel?.name}\`)\n` +
          `**Durum:** 📹 Kamera görüntüsü açıldı.\n` +
          `**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`,
          client,
          undefined,
          { thumbnailUrl: avatarUrl, color: 0x9b59b6 }
        );
      } else if (oldState.selfVideo && !newState.selfVideo) {
        await logService.logEvent(
          guild.id,
          'VOICE',
          'Kamera Kapatıldı',
          `**Kullanıcı:** <@${member.id}> (\`${member.user.tag}\`)\n` +
          `**Kanal:** <#${newState.channelId}> (\`${newState.channel?.name}\`)\n` +
          `**Durum:** 📷 Kamera görüntüsü kapatıldı.\n` +
          `**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`,
          client,
          undefined,
          { thumbnailUrl: avatarUrl, color: 0x7f8c8d }
        );
      }

      // D.3) YETKİLİ TARAFINDAN SUSTURMA (SERVER MUTE)
      if (oldState.serverMute !== newState.serverMute) {
        let modNotice = '';
        try {
          const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 }).catch(() => null);
          const logEntry = auditLogs?.entries.first();
          if (logEntry && logEntry.targetId === member.id && Date.now() - logEntry.createdTimestamp < 3500) {
            modNotice = `\n🛡️ **Yetkili:** <@${logEntry.executorId}>`;
          }
        } catch {}

        const isMuted = newState.serverMute;
        await logService.logEvent(
          guild.id,
          'MODERATION',
          isMuted ? 'Sunucuda Seste Susturuldu' : 'Sunucuda Seste Susturulması Kaldırıldı',
          `**Kullanıcı:** <@${member.id}> (\`${member.user.tag}\`)\n` +
          `**Kanal:** <#${newState.channelId}> (\`${newState.channel?.name}\`)\n` +
          `**Durum:** ${isMuted ? '🔇 Yetkili tarafından seste susturuldu (Server Mute).' : '🔊 Sesteki susturması açıldı.'}${modNotice}\n` +
          `**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`,
          client,
          undefined,
          { thumbnailUrl: avatarUrl, color: isMuted ? 0xe74c3c : 0x2ecc71 }
        );
      }

      // D.4) YETKİLİ TARAFINDAN SAĞIRLAŞTIRMA (SERVER DEAFEN)
      if (oldState.serverDeaf !== newState.serverDeaf) {
        let modNotice = '';
        try {
          const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 }).catch(() => null);
          const logEntry = auditLogs?.entries.first();
          if (logEntry && logEntry.targetId === member.id && Date.now() - logEntry.createdTimestamp < 3500) {
            modNotice = `\n🛡️ **Yetkili:** <@${logEntry.executorId}>`;
          }
        } catch {}

        const isDeaf = newState.serverDeaf;
        await logService.logEvent(
          guild.id,
          'MODERATION',
          isDeaf ? 'Sunucuda Sağırlaştırıldı' : 'Sunucuda Sağırlaştırılması Kaldırıldı',
          `**Kullanıcı:** <@${member.id}> (\`${member.user.tag}\`)\n` +
          `**Kanal:** <#${newState.channelId}> (\`${newState.channel?.name}\`)\n` +
          `**Durum:** ${isDeaf ? '🔇 Yetkili tarafından sağırlaştırıldı (Server Deafen).' : '🔊 Sesteki sağırlaştırması kaldırıldı.'}${modNotice}\n` +
          `**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`,
          client,
          undefined,
          { thumbnailUrl: avatarUrl, color: isDeaf ? 0xe74c3c : 0x2ecc71 }
        );
      }
    }
  } catch (logErr) {
    console.error('[SES LOG HATASI]:', logErr);
  }
}

