import { GuildMember, PartialGuildMember, TextChannel } from 'discord.js';
import { guildService } from '../services/guild.service';
import { logService } from '../services/log.service';
import { parsePlaceholders } from '@priv/shared';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export async function onGuildMemberRemove(member: GuildMember | PartialGuildMember) {
  const guild = member.guild;
  const settings = await guildService.getGuildSettings(guild.id);

  // 1. Ayrılma Mesajı
  if (settings.leaveChannelId) {
    const channel = (await guild.channels.fetch(settings.leaveChannelId).catch(() => null)) as TextChannel | null;
    if (channel) {
      const leaveText = parsePlaceholders(settings.leaveMessage, {
        user: member.user?.tag || 'Ayrılan Üye',
        username: member.user?.username || 'Üye',
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

  // 2. Denetim Logu
  await logService.logEvent(
    guild.id,
    'MEMBER_LEAVE',
    'Üye Sunucudan Ayrıldı',
    `**Kullanıcı:** <@${member.id}> (${member.user?.tag || 'Bilinmiyor'})\n**Kalan Üye Sayısı:** ${guild.memberCount}`,
    member.client
  );
}
