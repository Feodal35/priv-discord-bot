import { prisma } from '@priv/database';
import { guildService } from './guild.service';
import { questService } from './quest.service';
import { formatCurrency } from '@priv/shared';

export class EconomyService {
  /**
   * Kullanıcının güncel bakiyesini döner
   */
  public async getBalance(guildId: string, userId: string) {
    const userGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });
    return {
      coins: userGuild?.coins || 0,
      bankCoins: userGuild?.bankCoins || 0,
      total: (userGuild?.coins || 0) + (userGuild?.bankCoins || 0),
    };
  }

  /**
   * İki kullanıcı arasında güvenli coin transferi yapar (Database Transaction)
   */
  public async transferCoins(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    if (fromUserId === toUserId) {
      return { success: false, message: 'Kendine coin gönderemezsin.' };
    }

    if (amount <= 0 || isNaN(amount) || !Number.isInteger(amount)) {
      return { success: false, message: 'Lütfen geçerli ve pozitif bir tam sayı miktarı gir.' };
    }

    const settings = await guildService.getGuildSettings(guildId);
    if (!settings.economyEnabled) {
      return { success: false, message: 'Bu sunucuda ekonomi sistemi devre dışı bırakılmış.' };
    }

    if (amount > settings.maxTransferAmount) {
      return {
        success: false,
        message: `Tek seferde en fazla **${formatCurrency(settings.maxTransferAmount)} ${settings.currencyName}** gönderebilirsin.`,
      };
    }

    // Sender bakiye kontrolü ve transaction
    try {
      return await prisma.$transaction(async (tx) => {
        const sender = await tx.userGuild.findUnique({
          where: { userId_guildId: { userId: fromUserId, guildId } },
        });

        if (!sender || sender.coins < amount) {
          const current = sender?.coins || 0;
          return {
            success: false,
            message: `Yetersiz bakiye! Cüzdanında **${formatCurrency(current)} ${settings.currencyName}** bulunuyor, **${formatCurrency(amount)}** gönderemezsin.`,
          };
        }

        // Gönderenden düş
        await tx.userGuild.update({
          where: { userId_guildId: { userId: fromUserId, guildId } },
          data: { coins: { decrement: amount } },
        });

        // Alıcıya ekle (alıcı kaydı yoksa oluştur)
        await tx.userGuild.upsert({
          where: { userId_guildId: { userId: toUserId, guildId } },
          update: { coins: { increment: amount } },
          create: {
            userId: toUserId,
            guildId,
            coins: amount,
          },
        });

        // İşlem kaydı oluştur
        await tx.economyTransaction.create({
          data: {
            guildId,
            fromUserId,
            toUserId,
            amount,
            type: 'TRANSFER',
            reason: reason || 'Kullanıcılar arası transfer',
          },
        });

        // Görev ilerlemesi
        await questService.incrementProgress(guildId, fromUserId, 'TRANSFER_COIN', amount);

        return {
          success: true,
          message: `<@${toUserId}> kullanıcısına başarıyla **${formatCurrency(amount)} ${settings.currencyName}** gönderildi!`,
        };
      });
    } catch (error) {
      console.error('[HATA] Coin transferi sırasında hata oluştu:', error);
      return { success: false, message: 'Transfer işlemi gerçekleştirilirken bir hata oluştu.' };
    }
  }

  /**
   * Çalış komutu ile cooldown'lı coin kazanma
   */
  public async claimWork(guildId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    gainedCoins?: number;
    remainingMinutes?: number;
  }> {
    const settings = await guildService.getGuildSettings(guildId);
    if (!settings.economyEnabled) {
      return { success: false, message: 'Ekonomi sistemi devre dışı.' };
    }

    const userGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });

    const now = new Date();
    const lastWork = userGuild?.lastWorkClaim;

    if (lastWork) {
      const diffMs = now.getTime() - lastWork.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      if (diffMinutes < settings.workCooldownMinutes) {
        const remainingMinutes = Math.ceil(settings.workCooldownMinutes - diffMinutes);
        return {
          success: false,
          remainingMinutes,
          message: `Biraz dinlenmelisin! Tekrar çalışabilmek için **${remainingMinutes} dakika** beklemelisin.`,
        };
      }
    }

    // Min - Max arası rastgele kazanç
    const range = settings.workMaxReward - settings.workMinReward;
    const gainedCoins = Math.floor(Math.random() * (range + 1)) + settings.workMinReward;

    const jobs = [
      'sunucu moderatörlüğü yaptın',
      'kod yazdın ve bug çözdün',
      'tasarım hazırladın',
      'ses kanalında DJ\'lik yaptın',
      'sunucu turnuvasını organize ettin',
      'özel emojiler çizdin',
      'sohbeti canlı tuttun',
    ];
    const randomJob = jobs[Math.floor(Math.random() * jobs.length)];

    await prisma.$transaction([
      prisma.userGuild.update({
        where: { userId_guildId: { userId, guildId } },
        data: {
          coins: { increment: gainedCoins },
          lastWorkClaim: now,
        },
      }),
      prisma.economyTransaction.create({
        data: {
          guildId,
          toUserId: userId,
          amount: gainedCoins,
          type: 'WORK',
          reason: `İş: ${randomJob}`,
        },
      }),
    ]);

    return {
      success: true,
      gainedCoins,
      message: `Harika bir iş çıkardın! Başarıyla ${randomJob} ve **${formatCurrency(gainedCoins)} ${settings.currencyName}** kazandın!`,
    };
  }

  /**
   * Bakiye ekleme / çıkarma (Admin veya oyunlar için)
   */
  public async modifyBalance(
    guildId: string,
    userId: string,
    amount: number,
    type: 'ADD' | 'REMOVE',
    reason?: string
  ) {
    if (type === 'ADD') {
      return prisma.$transaction([
        prisma.userGuild.upsert({
          where: { userId_guildId: { userId, guildId } },
          update: { coins: { increment: amount } },
          create: { userId, guildId, coins: amount },
        }),
        prisma.economyTransaction.create({
          data: {
            guildId,
            toUserId: userId,
            amount,
            type: 'ADMIN',
            reason: reason || 'Yönetici bakiye eklemesi',
          },
        }),
      ]);
    } else {
      return prisma.$transaction([
        prisma.userGuild.update({
          where: { userId_guildId: { userId, guildId } },
          data: { coins: { decrement: amount } },
        }),
        prisma.economyTransaction.create({
          data: {
            guildId,
            toUserId: userId,
            amount: -amount,
            type: 'ADMIN',
            reason: reason || 'Yönetici bakiye kesintisi',
          },
        }),
      ]);
    }
  }
}

export const economyService = new EconomyService();
