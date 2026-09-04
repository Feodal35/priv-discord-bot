import { GuildMember, TextChannel, AttachmentBuilder } from 'discord.js';
import { guildService } from '../services/guild.service';
import { logService } from '../services/log.service';
import { achievementService } from '../services/achievement.service';
import { clanRoleService } from '../services/clanRole.service';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';
import { createWelcomeCard } from '../utils/canvas';
import { logger } from '../utils/logger';

// Kullanıcının belirttiği otomatik verilecek kalıcı rol ID'si
export const AUTO_ROLE_ID = '1543033008318316654';

export async function onGuildMemberAdd(member: GuildMember) {
  const guild = member.guild;
  const settings = await guildService.getGuildSettings(guild.id);

  // 1. KLAN / GUILD ROLÜ DENETİMİ (1543033008318316654)
  try {
    await clanRoleService.checkAndSyncMember(member);
  } catch (error) {
    logger.error(`[CLAN_ROLE] Yeni üye kontrolünde hata (${member.id}):`, error);
  }

  // 2. ULTRA KALİTELİ CANVAS HOŞ GELDİN KARTI
  try {
    let welcomeChannel: TextChannel | null = null;
    if (settings.welcomeChannelId) {
      welcomeChannel = (await guild.channels.fetch(settings.welcomeChannelId).catch(() => null)) as TextChannel | null;
    }

    // Eğer ayarlı kanal yoksa adı hoşgeldin, welcome, giriş veya genel olan kanalı dene
    if (!welcomeChannel) {
      welcomeChannel = guild.channels.cache.find(
        (ch) => ch.isTextBased() && ['hoş-geldin', 'hosgeldin', 'welcome', 'giris-cikis', 'giriş-çıkış', 'genel-sohbet', 'chat'].includes(ch.name)
      ) as TextChannel | null;
    }

    if (welcomeChannel) {
      let imageBuffer: Buffer | null = null;
      try {
        imageBuffer = await createWelcomeCard({
          avatarUrl: member.displayAvatarURL({ extension: 'png', size: 256 }),
          username: member.user.username,
          guildName: guild.name,
          memberCount: guild.memberCount,
        });
      } catch (canvasErr) {
        logger.error('[WELCOME] Canvas hoş geldin kartı oluşturulamadı:', canvasErr);
      }

      const embed = createEmbed({
        title: `🎉 ${member.user.username} Sunucumuza Katıldı!`,
        description: `Hoş geldin <@${member.id}>! Seninle birlikte **${guild.memberCount}** kişi olduk.\nKuralları okumayı ve sohbet kanallarında tanışmayı unutma!`,
        color: DEFAULT_COLORS.PRIMARY as any,
        footer: { text: `Hesap Kuruluşu: ${new Date(member.user.createdTimestamp).toLocaleDateString('tr-TR')}` },
        timestamp: false,
      });

      if (imageBuffer) {
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });
        embed.setImage('attachment://welcome.png');
        await welcomeChannel.send({ content: `<@${member.id}>`, embeds: [embed], files: [attachment] }).catch(() => {});
      } else {
        await welcomeChannel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => {});
      }
    }
  } catch (welcomeErr) {
    logger.error('[WELCOME] Karşılama mesajı gönderilirken hata:', welcomeErr);
  }

  // 3. İLK ADIM BAŞARIMI
  try {
    await achievementService.checkAndUnlock(guild.id, member.id, 'FIRST_STEP', member.client);
  } catch { /* sessiz devam */ }

  // 4. DENETİM & GÜVENLİK LOGU
  try {
    await logService.logEvent(
      guild.id,
      'MEMBER_JOIN',
      'Yeni Üye Katıldı',
      `**Kullanıcı:** <@${member.id}> (${member.user.tag})\n**ID:** \`${member.id}\`\n**Hesap Tarihi:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n**Sunucu Toplamı:** ${guild.memberCount} üye`,
      member.client
    );
  } catch { /* sessiz devam */ }
}
