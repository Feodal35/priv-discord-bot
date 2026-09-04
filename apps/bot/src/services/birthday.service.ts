import { prisma } from '@priv/database';
import { Client, TextChannel } from 'discord.js';
import { guildService } from './guild.service';
import { createSuccessEmbed } from '../utils/embed';

export const DEFAULT_BIRTHDAY_CHANNEL_ID = '1542620110882349162';

export class BirthdayService {
  private timer: NodeJS.Timeout | null = null;

  public async setBirthday(guildId: string, userId: string, day: number, month: number) {
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      return { success: false, message: 'Geçersiz gün veya ay girdin.' };
    }

    await prisma.birthday.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      update: {
        day,
        month,
      },
      create: {
        guildId,
        userId,
        day,
        month,
      },
    });

    const monthNames = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
    ];

    return {
      success: true,
      message: `Doğum günün başarıyla **${day} ${monthNames[month - 1]}** olarak kaydedildi!`,
    };
  }

  public startBirthdayCron(client: Client) {
    if (this.timer) clearInterval(this.timer);

    // Her 30 dakikada bir kontrol et
    this.timer = setInterval(async () => {
      await this.checkBirthdays(client);
    }, 1000 * 60 * 30);

    // Başlangıçta hemen bir kontrol yap
    this.checkBirthdays(client);
  }

  private async checkBirthdays(client: Client) {
    try {
      const now = new Date();
      // Türkiye saati ile gün ve ay
      const istanbulDate = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      }).formatToParts(now);

      const day = parseInt(istanbulDate.find((p) => p.type === 'day')?.value || '1', 10);
      const month = parseInt(istanbulDate.find((p) => p.type === 'month')?.value || '1', 10);
      const year = parseInt(istanbulDate.find((p) => p.type === 'year')?.value || '2026', 10);

      const birthdays = await prisma.birthday.findMany({
        where: {
          day,
          month,
          OR: [
            { lastCelebratedYear: null },
            { lastCelebratedYear: { lt: year } },
          ],
        },
      });

      for (const b of birthdays) {
        const settings = await guildService.getGuildSettings(b.guildId);
        const targetChannelId = settings.birthdayChannelId || DEFAULT_BIRTHDAY_CHANNEL_ID;
        if (!targetChannelId) continue;

        try {
          const guild = await client.guilds.fetch(b.guildId).catch(() => null);
          if (!guild) continue;

          const channel = (await guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null;
          if (channel) {
            const member = await guild.members.fetch(b.userId).catch(() => null);

            const embed = createSuccessEmbed(
              '🎂 Doğum Günün Kutlu Olsun!',
              `🎉 Bugün <@${b.userId}> üyemizin doğum günü!\n\n` +
              `✨ Priv ailesi olarak yeni yaşının sana sağlık, mutluluk ve başarı getirmesini dileriz! Nice mutlu senelere! 🥳🎈🎁\n\n` +
              `💰 **Doğum Günü Hediyesi:** \`+1.000 Coin\` hesabına eklendi!`
            );
            if (member) embed.setThumbnail(member.displayAvatarURL());

            await channel.send({ content: `🎉 Bugün bir doğum günü var! <@${b.userId}>`, embeds: [embed] }).catch(() => {});

            // Doğum günü rolü varsa ekle
            if (settings.birthdayRoleId) {
              const member = await guild.members.fetch(b.userId).catch(() => null);
              const role = guild.roles.cache.get(settings.birthdayRoleId);
              if (member && role && guild.members.me?.permissions.has('ManageRoles') && guild.members.me.roles.highest.position > role.position) {
                await member.roles.add(role).catch(() => {});
              }
            }

            // Hediye 1000 Coin
            await prisma.userGuild.update({
              where: { userId_guildId: { userId: b.userId, guildId: b.guildId } },
              data: { coins: { increment: 1000 } },
            }).catch(() => {});
          }

          // Kutlandı olarak güncelle
          await prisma.birthday.update({
            where: { id: b.id },
            data: { lastCelebratedYear: year },
          });
        } catch (err) {
          console.error('[HATA] Doğum günü kutlanırken hata oluştu:', b.id, err);
        }
      }
    } catch (e) {
      console.error('[HATA] Doğum günü cron hatası:', e);
    }
  }
}

export const birthdayService = new BirthdayService();
