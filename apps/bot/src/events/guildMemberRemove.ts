import { GuildMember, PartialGuildMember, TextChannel, AuditLogEvent } from 'discord.js';
import { guildService } from '../services/guild.service';
import { logService } from '../services/log.service';
import { parsePlaceholders } from '@priv/shared';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

/**
 * Gün ve ay cinsinden Türkçe süre metni üretir
 */
function formatStayDuration(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours < 1) {
      const minutes = Math.floor(ms / (1000 * 60));
      return `${Math.max(1, minutes)} dakika`;
    }
    return `${hours} saat`;
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return `${months} ay ${remainingDays} gün`;
  }
  return `${days} gün`;
}

export async function onGuildMemberRemove(member: GuildMember | PartialGuildMember) {
  const guild = member.guild;
  const settings = await guildService.getGuildSettings(guild.id);
  const user = member.user;
  const nowUnix = Math.floor(Date.now() / 1000);
  const avatarUrl = user ? user.displayAvatarURL({ size: 128 }) : undefined;

  // 1. Ayrılma Mesajı (Kullanıcı yapılandırdıysa)
  if (settings.leaveChannelId) {
    const channel = (await guild.channels.fetch(settings.leaveChannelId).catch(() => null)) as TextChannel | null;
    if (channel) {
      const leaveText = parsePlaceholders(settings.leaveMessage, {
        user: user?.tag || 'Ayrılan Üye',
        username: user?.username || 'Üye',
        server: guild.name,
        memberCount: guild.memberCount,
      });

      const embed = createEmbed({
        title: `👋 Görüşmek Üzere`,
        description: leaveText,
        color: DEFAULT_COLORS.SECONDARY,
      });

      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  // 2. Denetim Kaydı Analizi (Kendi mi çıktı, Yetkili mi attı/yasakladı?)
  let actionType = '📤 Kendi İsteğiyle Ayrıldı';
  let executorStr = '';
  let reasonStr = '';
  let embedColor = 0x95a5a6; // Gri/Secondary

  try {
    const kickLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 }).catch(() => null);
    const kickEntry = kickLogs?.entries.first();

    const banLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 }).catch(() => null);
    const banEntry = banLogs?.entries.first();

    if (kickEntry && kickEntry.targetId === member.id && Date.now() - kickEntry.createdTimestamp < 3500) {
      actionType = '🥾 Sunucudan Atıldı (Kick)';
      executorStr = `\n🛡️ **İşlemi Yapan Yetkili:** <@${kickEntry.executorId}>`;
      if (kickEntry.reason) reasonStr = `\n📝 **Sebep:** ${kickEntry.reason}`;
      embedColor = 0xe67e22;
    } else if (banEntry && banEntry.targetId === member.id && Date.now() - banEntry.createdTimestamp < 3500) {
      actionType = '🔨 Sunucudan Yasaklandı (Ban)';
      executorStr = `\n🛡️ **İşlemi Yapan Yetkili:** <@${banEntry.executorId}>`;
      if (banEntry.reason) reasonStr = `\n📝 **Sebep:** ${banEntry.reason}`;
      embedColor = 0xe74c3c;
    }
  } catch {}

  // Sunucuda kalma süresi
  let stayDurationStr = 'Bilinmiyor';
  if (member.joinedTimestamp) {
    stayDurationStr = formatStayDuration(Date.now() - member.joinedTimestamp);
  }

  // Sahip olduğu roller
  const roles = member.roles?.cache
    ? member.roles.cache.filter((r) => r.id !== guild.id).map((r) => `<@&${r.id}>`).join(' ')
    : 'Yok';

  const desc =
    `**Kullanıcı:** <@${member.id}> (\`${user?.tag || member.id}\`)\n` +
    `**Ayrılış Türü:** ${actionType}` +
    executorStr +
    reasonStr +
    `\n**Sunucuda Kaldığı Süre:** ⏱️ ${stayDurationStr}\n` +
    `**Ayrılırken Sahip Olduğu Roller:** ${roles || 'Yok'}\n` +
    `**Kalan Üye Sayısı:** \`${guild.memberCount}\` üye\n` +
    `**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`;

  await logService.logEvent(
    guild.id,
    'MEMBER_LEAVE',
    'Üye Sunucudan Ayrıldı',
    desc,
    member.client,
    undefined,
    { thumbnailUrl: avatarUrl, color: embedColor }
  );
}

