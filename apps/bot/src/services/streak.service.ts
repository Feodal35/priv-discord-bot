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

function getIstanbulDateKey(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}

function getDaysDifferenceIstanbul(past: Date, current: Date): number {
  const pStr = getIstanbulDateKey(past);
  const cStr = getIstanbulDateKey(current);
  const pTime = new Date(pStr + 'T00:00:00Z').getTime();
  const cTime = new Date(cStr + 'T00:00:00Z').getTime();
  return Math.round((cTime - pTime) / (1000 * 60 * 60 * 24));
}

function getTimeUntilMidnightIstanbul(): { hours: number; minutes: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);

  const secondsPassedToday = hour * 3600 + minute * 60 + second;
  const secondsLeft = Math.max(0, 86400 - secondsPassedToday);
  return {
    hours: Math.floor(secondsLeft / 3600),
    minutes: Math.floor((secondsLeft % 3600) / 60),
  };
}

export class StreakService {
  /**
   * Günlük streak ve günlük ödül alma işlemi (Türkiye Saati Gece 00:00 bazlı)
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
      const daysDiff = getDaysDifferenceIstanbul(lastClaim, now);
      const diffHours = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);

      // Aynı takvim günü içinde tekrar ödül alınamaz
      if (daysDiff === 0) {
        const { hours, minutes } = getTimeUntilMidnightIstanbul();
        return {
          success: false,
          alreadyClaimed: true,
          message: `Bugünkü günlük ödülünü zaten aldın! Mevcut serin: **${userGuild?.dailyStreak || 0} Gün** 🔥\nBir sonraki ödülün bu gece 00:00'da (**${hours} saat ${minutes} dakika sonra**) açılacak.`,
          streak: userGuild?.dailyStreak || 0,
          streakReset: false,
          rewardCoins: 0,
          milestoneBonus: 0,
          milestoneTitle: '',
        };
      }

      // Günlük streak hesaplama (Dün alındıysa veya 48 saat içindeyse seriyi koru/artır)
      let newStreak = (userGuild?.dailyStreak || 0) + 1;
      let streakReset = false;

      if (daysDiff > 1 && diffHours > 48) {
        // 48 saatten ve 1 takvim gününden fazla kaçırıldıysa sıfırla
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
        message: 'İlk günlük ödülün başarıyla hesabına yatırıldı! Her gün gelerek serini artırabilirsin.',
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
