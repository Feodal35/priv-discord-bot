import { prisma } from '@priv/database';
import { STREAK_MILESTONES, formatCurrency } from '@priv/shared';
import { guildService } from './guild.service';
import { achievementService } from './achievement.service';
import { Client, TextChannel } from 'discord.js';

export interface DailyClaimResult {
  success: boolean;
  alreadyClaimed?: boolean;
  message: string;
  streak: number;
  streakReset: boolean;
  rewardCoins: number;
  milestoneBonus: number;
  milestoneTitle: string;
}

export class StreakService {
  /**
   * Günlük streak ve günlük ödül alma işlemi
   */
  public async claimDaily(
    guildId: string,
    userId: string,
    channel?: TextChannel,
    client?: Client
  ): Promise<DailyClaimResult> {
    const settings = await guildService.getGuildSettings(guildId);
    const userGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });

    const now = new Date();
    const lastClaim = userGuild?.lastDailyClaim;

    if (lastClaim) {
      const diffMs = now.getTime() - lastClaim.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // 20 saatten önce tekrar alınamaz
      if (diffHours < 20) {
        const remainingHours = Math.ceil(20 - diffHours);
        return {
          success: false,
          alreadyClaimed: true,
          message: `Günlük ödülünü zaten aldın. Tekrar alabilmek için **${remainingHours} saat** beklemelisin.`,
          streak: userGuild?.dailyStreak || 0,
          streakReset: false,
          rewardCoins: 0,
          milestoneBonus: 0,
          milestoneTitle: '',
        };
      }

      // 48 saatten fazla geçtiyse streak sıfırlanır
      let newStreak = (userGuild?.dailyStreak || 0) + 1;
      let streakReset = false;
      if (diffHours > 48) {
        newStreak = 1;
        streakReset = true;
      }

      const totalCoins = settings.dailyReward + (newStreak - 1) * settings.dailyStreakBonus;

      // Veritabanı güncelleme
      await prisma.$transaction([
        prisma.userGuild.update({
          where: { userId_guildId: { userId, guildId } },
          data: {
            coins: { increment: totalCoins },
            dailyStreak: newStreak,
            lastDailyClaim: now,
          },
        }),
        prisma.economyTransaction.create({
          data: {
            guildId,
            toUserId: userId,
            amount: totalCoins,
            type: 'DAILY',
            reason: `Günlük Ödül (${newStreak}. Gün Serisi)`,
          },
        }),
      ]);

      // Streak başarımları
      if (newStreak >= 7 && client && channel) {
        await achievementService.checkAndUnlock(guildId, userId, 'STREAK_WARRIOR', client, channel);
      }

      // Özel kilometre taşı kontrolü
      const milestone = STREAK_MILESTONES.find((m) => m.days === newStreak);
      let milestoneBonus = 0;
      let milestoneTitle = '';

      if (milestone) {
        milestoneBonus = milestone.rewardCoins;
        milestoneTitle = milestone.title;

        await prisma.$transaction([
          prisma.userGuild.update({
            where: { userId_guildId: { userId, guildId } },
            data: {
              coins: { increment: milestone.rewardCoins },
              xp: { increment: milestone.rewardXp },
              title: milestone.title,
            },
          }),
          prisma.economyTransaction.create({
            data: {
              guildId,
              toUserId: userId,
              amount: milestone.rewardCoins,
              type: 'REWARD',
              reason: `${milestone.days} Günlük Streak Kilometre Taşı!`,
            },
          }),
        ]);
      }

      return {
        success: true,
        alreadyClaimed: false,
        message: 'Günlük ödülün başarıyla hesabına yatırıldı!',
        streak: newStreak,
        streakReset,
        rewardCoins: totalCoins,
        milestoneBonus,
        milestoneTitle,
      };
    } else {
      // İlk kez ödül alma
      const totalCoins = settings.dailyReward;

      await prisma.$transaction([
        prisma.userGuild.update({
          where: { userId_guildId: { userId, guildId } },
          data: {
            coins: { increment: totalCoins },
            dailyStreak: 1,
            lastDailyClaim: now,
          },
        }),
        prisma.economyTransaction.create({
          data: {
            guildId,
            toUserId: userId,
            amount: totalCoins,
            type: 'DAILY',
            reason: 'İlk Günlük Ödül',
          },
        }),
      ]);

      return {
        success: true,
        alreadyClaimed: false,
        message: 'İlk günlük ödülün hesabına yatırıldı!',
        streak: 1,
        streakReset: false,
        rewardCoins: totalCoins,
        milestoneBonus: 0,
        milestoneTitle: '',
      };
    }
  }
}

export const streakService = new StreakService();
