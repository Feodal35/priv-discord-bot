import { prisma } from '@priv/database';
import { QuestType } from '@priv/shared';

export class QuestService {
  /**
   * Kullanıcının aktif görevlerini ve ilerlemelerini getirir (Yoksa periyoda göre oluşturur)
   */
  public async getUserQuests(guildId: string, userId: string) {
    // Önce sunucunun veya sistemin genel görevlerini al
    const quests = await prisma.quest.findMany({
      where: {
        OR: [{ guildId: null }, { guildId }],
      },
    });

    const now = new Date();
    // Günlük reset: Gece yarısı 00:00
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const userQuests = [];

    for (const q of quests) {
      let uq = await prisma.userQuest.findFirst({
        where: {
          guildId,
          userId,
          questId: q.id,
          resetAt: { gte: now },
        },
        include: { quest: true },
      });

      if (!uq) {
        uq = await prisma.userQuest.create({
          data: {
            guildId,
            userId,
            questId: q.id,
            currentAmount: 0,
            isCompleted: false,
            isClaimed: false,
            resetAt: endOfDay,
          },
          include: { quest: true },
        });
      }

      userQuests.push(uq);
    }

    return userQuests;
  }

  /**
   * Belirli bir görev tipindeki ilerlemeyi artırır
   */
  public async incrementProgress(guildId: string, userId: string, type: QuestType, amount: number = 1) {
    const activeUserQuests = await this.getUserQuests(guildId, userId);

    for (const uq of activeUserQuests) {
      if (uq.quest.type === type && !uq.isCompleted) {
        const newAmount = uq.currentAmount + amount;
        const isCompleted = newAmount >= uq.quest.targetAmount;

        await prisma.userQuest.update({
          where: { id: uq.id },
          data: {
            currentAmount: newAmount,
            isCompleted,
          },
        });
      }
    }
  }

  /**
   * Tamamlanan görevin ödülünü toplar
   */
  public async claimQuest(guildId: string, userId: string, userQuestId: string) {
    const uq = await prisma.userQuest.findUnique({
      where: { id: userQuestId },
      include: { quest: true },
    });

    if (!uq || uq.userId !== userId || uq.guildId !== guildId) {
      return { success: false, message: 'Görev bulunamadı.' };
    }

    if (!uq.isCompleted) {
      return { success: false, message: 'Bu görev henüz tamamlanmadı.' };
    }

    if (uq.isClaimed) {
      return { success: false, message: 'Bu görevin ödülü daha önce zaten toplandı.' };
    }

    await prisma.$transaction([
      prisma.userQuest.update({
        where: { id: userQuestId },
        data: { isClaimed: true },
      }),
      prisma.userGuild.update({
        where: { userId_guildId: { userId, guildId } },
        data: {
          coins: { increment: uq.quest.rewardCoins },
          xp: { increment: uq.quest.rewardXp },
        },
      }),
      prisma.economyTransaction.create({
        data: {
          guildId,
          toUserId: userId,
          amount: uq.quest.rewardCoins,
          type: 'QUEST',
          reason: `Görev Tamamlandı: ${uq.quest.title}`,
        },
      }),
    ]);

    return {
      success: true,
      rewardCoins: uq.quest.rewardCoins,
      rewardXp: uq.quest.rewardXp,
      title: uq.quest.title,
    };
  }
}

export const questService = new QuestService();
