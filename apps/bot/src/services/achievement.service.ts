import { prisma } from '@priv/database';
import { Client, TextChannel } from 'discord.js';
import { createSuccessEmbed } from '../utils/embed';
import { RARITY, RarityType, formatCurrency } from '@priv/shared';

export class AchievementService {
  public async checkAndUnlock(
    guildId: string,
    userId: string,
    achievementCode: string,
    client?: Client,
    channel?: TextChannel
  ): Promise<boolean> {
    const achievement = await prisma.achievement.findUnique({
      where: { code: achievementCode },
    });
    if (!achievement) return false;

    // Kullanıcı zaten bu başarımı almış mı?
    const existing = await prisma.userAchievement.findUnique({
      where: {
        guildId_userId_achievementId: {
          guildId,
          userId,
          achievementId: achievement.id,
        },
      },
    });

    if (existing) return false;

    // Başarımı kilitle & ödülleri ekle
    await prisma.$transaction([
      prisma.userAchievement.create({
        data: {
          guildId,
          userId,
          achievementId: achievement.id,
        },
      }),
      prisma.userGuild.update({
        where: { userId_guildId: { userId, guildId } },
        data: {
          coins: { increment: achievement.rewardCoins },
          xp: { increment: achievement.rewardXp },
        },
      }),
      prisma.economyTransaction.create({
        data: {
          guildId,
          toUserId: userId,
          amount: achievement.rewardCoins,
          type: 'REWARD',
          reason: `Başarım Ödülü: ${achievement.name}`,
        },
      }),
    ]);

    // Kanalda veya DM ile tebrik mesajı gönder
    if (channel) {
      const rarityData = RARITY[achievement.rarity as RarityType] || RARITY.COMMON;
      const embed = createSuccessEmbed(
        'Yeni Başarım Açıldı!',
        `🏆 <@${userId}> yeni bir başarımın kilidini açtı!\n\n**${achievement.icon} ${achievement.name}** (${rarityData.emoji} ${rarityData.name})\n*${achievement.description}*\n\n🎁 **Ödüller:** \`${formatCurrency(achievement.rewardCoins)} Coin\` & \`${formatCurrency(achievement.rewardXp)} XP\``
      );

      channel.send({ embeds: [embed] }).catch(() => {});
    }

    return true;
  }

  public async getUserAchievements(guildId: string, userId: string) {
    return prisma.userAchievement.findMany({
      where: { guildId, userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  public async getAllAchievements() {
    return prisma.achievement.findMany();
  }
}

export const achievementService = new AchievementService();
