import { prisma } from '@priv/database';
import { Client, TextChannel } from 'discord.js';
import { createInfoEmbed } from '../utils/embed';

export class ReminderService {
  private timer: NodeJS.Timeout | null = null;

  public async createReminder(
    guildId: string,
    userId: string,
    channelId: string | null,
    remindAt: Date,
    message: string,
    isDm: boolean = false
  ) {
    return prisma.reminder.create({
      data: {
        guildId,
        userId,
        channelId,
        remindAt,
        message,
        isDm,
      },
    });
  }

  public startReminderWorker(client: Client) {
    if (this.timer) clearInterval(this.timer);

    // Her 10 saniyede bir vadesi dolmuş hatırlatıcıları kontrol et
    this.timer = setInterval(async () => {
      try {
        const now = new Date();
        const dueReminders = await prisma.reminder.findMany({
          where: {
            isCompleted: false,
            remindAt: { lte: now },
          },
          take: 20,
        });

        for (const rem of dueReminders) {
          try {
            const embed = createInfoEmbed(
              '⏰ Hatırlatıcı Zamanı!',
              `Merhaba <@${rem.userId}>, bana hatırlatmamı istediğin not:\n\n> **${rem.message}**`
            );

            let delivered = false;

            // DM gönderimi
            if (rem.isDm) {
              const user = await client.users.fetch(rem.userId).catch(() => null);
              if (user) {
                await user.send({ embeds: [embed] }).catch(() => {});
                delivered = true;
              }
            }

            // Kanala gönderim
            if (!delivered && rem.channelId) {
              const channel = (await client.channels.fetch(rem.channelId).catch(() => null)) as TextChannel | null;
              if (channel) {
                await channel.send({ content: `<@${rem.userId}>`, embeds: [embed] }).catch(() => {});
                delivered = true;
              }
            }

            // Tamamlandı olarak işaretle
            await prisma.reminder.update({
              where: { id: rem.id },
              data: { isCompleted: true },
            });
          } catch (err) {
            console.error('[HATA] Hatırlatıcı teslim edilemedi:', rem.id, err);
            await prisma.reminder.update({
              where: { id: rem.id },
              data: { isCompleted: true },
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('[HATA] Hatırlatıcı kontrol hatası:', e);
      }
    }, 10000);
  }
}

export const reminderService = new ReminderService();
