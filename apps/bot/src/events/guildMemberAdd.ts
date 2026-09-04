import { GuildMember, TextChannel, AttachmentBuilder } from 'discord.js';
import { guildService } from '../services/guild.service';
import { logService } from '../services/log.service';
import { achievementService } from '../services/achievement.service';
import { clanRoleService } from '../services/clanRole.service';
import { registerService } from '../services/register.service';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';
import { createWelcomeCard } from '../utils/canvas';
import { logger } from '../utils/logger';

// Kullanıcının belirttiği güncel klan / guild rol ID'si
export const AUTO_ROLE_ID = '1543392872504762498';

export async function onGuildMemberAdd(member: GuildMember) {
  const guild = member.guild;
  const settings = await guildService.getGuildSettings(guild.id);

  // 1. KLAN / GUILD ROLÜ DENETİMİ (1543392872504762498)
  try {
    await clanRoleService.checkAndSyncMember(member);
  } catch (error) {
    logger.error(`[CLAN_ROLE] Yeni üye kontrolünde hata (${member.id}):`, error);
  }

  // 2. KAYIT SİSTEMİ VEYA GENEL HOŞ GELDİN KARTI
  try {
    let registerSettings = registerService.getSettings(guild.id);
    let handledByRegister = false;

    // Kanal ayarlanmamışsa otomatik tespit et
    if (!registerSettings.registerChannelId) {
      registerSettings = registerService.autoConfigure(guild);
    }

    if (registerSettings.enabled && registerSettings.registerChannelId) {
      handledByRegister = await registerService.sendWelcomeCard(member);
    }

    // Kayıt sistemi devrede değilse normal Canvas hoş geldin kartını gönder
    if (!handledByRegister) {
      let welcomeChannel: TextChannel | null = null;
      if (settings.welcomeChannelId) {
        welcomeChannel = (await guild.channels.fetch(settings.welcomeChannelId).catch(() => null)) as TextChannel | null;
      }

      // 1542620110882349162 (Ana Sohbet) veya isimden bul
      if (!welcomeChannel) {
        welcomeChannel = (await guild.channels.fetch('1542620110882349162').catch(() => null)) as TextChannel | null;
      }

      if (!welcomeChannel) {
        welcomeChannel = guild.channels.cache.find(
          (ch) => ch.isTextBased() && ['sohbet', 'hoş-geldin', 'hosgeldin', 'welcome', 'giris-cikis', 'giriş-çıkış', 'genel-sohbet', 'chat'].includes(ch.name)
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
    const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
    const isNewAccount = accountAgeDays < 7;
    const isBot = member.user.bot;
    const createdUnix = Math.floor(member.user.createdTimestamp / 1000);
    const nowUnix = Math.floor(Date.now() / 1000);

    const safetyBadge = isBot
      ? '🤖 Bot Hesabı'
      : isNewAccount
      ? `⚠️ **Şüpheli / Yeni Hesap** (${accountAgeDays} gün önce açılmış)`
      : `✅ **Güvenli Hesap** (${accountAgeDays} gün önce açılmış)`;

    const desc =
      `**Kullanıcı:** <@${member.id}> (\`${member.user.tag}\`)\n` +
      `**ID:** \`${member.id}\`\n` +
      `**Hesap Durumu:** ${safetyBadge}\n` +
      `**Hesap Açılış:** <t:${createdUnix}:f> (<t:${createdUnix}:R>)\n` +
      `**Sunucudaki Toplam Üye:** \`${guild.memberCount}\` üye\n` +
      `**Katılış Zamanı:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`;

    await logService.logEvent(
      guild.id,
      'MEMBER_JOIN',
      isBot ? 'Bot Sunucuya Eklendi' : 'Yeni Üye Katıldı',
      desc,
      member.client,
      undefined,
      {
        thumbnailUrl: member.displayAvatarURL({ size: 128 }),
        color: isNewAccount ? 0xe67e22 : 0x2ecc71,
      }
    );
  } catch { /* sessiz devam */ }
}

