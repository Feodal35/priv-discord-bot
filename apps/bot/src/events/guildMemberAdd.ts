import { GuildMember, TextChannel } from 'discord.js';
import { guildService } from '../services/guild.service';
import { logService } from '../services/log.service';
import { achievementService } from '../services/achievement.service';
import { parsePlaceholders } from '@priv/shared';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export async function onGuildMemberAdd(member: GuildMember) {
  const guild = member.guild;
  const settings = await guildService.getGuildSettings(guild.id);

  // 1. Karşılama Mesajı
  if (settings.welcomeChannelId) {
    const channel = (await guild.channels.fetch(settings.welcomeChannelId).catch(() => null)) as TextChannel | null;
    if (channel) {
      const welcomeText = parsePlaceholders(settings.welcomeMessage, {
        user: `<@${member.id}>`,
        username: member.user.username,
        server: guild.name,
        memberCount: guild.memberCount,
      });

      const embed = createEmbed({
        title: `👋 Hoş Geldin, ${member.user.username}!`,
        description: welcomeText,
        thumbnail: member.displayAvatarURL(),
        color: DEFAULT_COLORS.SUCCESS,
        footer: { text: `Sunucunun ${guild.memberCount}. üyesi olarak katıldın.` },
      });

      await channel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => {});
    }
  }

  // 2. Otomatik Rol Verme
  if (settings.autoRoleId && guild.members.me?.permissions.has('ManageRoles')) {
    const role = guild.roles.cache.get(settings.autoRoleId);
    if (role && guild.members.me.roles.highest.position > role.position) {
      await member.roles.add(role).catch(() => {});
    }
  }

  // 3. İlk Adım Başarımı
  await achievementService.checkAndUnlock(guild.id, member.id, 'FIRST_STEP', member.client);

  // 4. Denetim Logu
  await logService.logEvent(
    guild.id,
    'MEMBER_JOIN',
    'Yeni Üye Katıldı',
    `**Kullanıcı:** <@${member.id}> (${member.user.tag})\n**Hesap Kuruluşu:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n**Toplam Üye:** ${guild.memberCount}`,
    member.client
  );
}
