import { prisma } from '@priv/database';
import { UserProfileDto, getLevelProgress } from '@priv/shared';
import { Client } from 'discord.js';

export class UserService {
  public async getOrCreateUser(userId: string, username: string, avatar?: string | null) {
    return prisma.user.upsert({
      where: { id: userId },
      update: {
        username,
        avatar,
      },
      create: {
        id: userId,
        username,
        avatar,
      },
    });
  }

  public async getOrCreateUserGuild(userId: string, guildId: string, username?: string, avatar?: string | null) {
    await this.getOrCreateUser(userId, username || 'Bilinmeyen Kullanıcı', avatar);

    return prisma.userGuild.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      update: {},
      create: {
        userId,
        guildId,
      },
      include: {
        user: true,
      },
    });
  }

  public async getUserProfile(userId: string, guildId: string, client?: Client): Promise<UserProfileDto> {
    const userGuild = await this.getOrCreateUserGuild(userId, guildId);
    const progress = getLevelProgress(userGuild.xp);

    // Sunucudaki sıralamasını bul
    const higherXpCount = await prisma.userGuild.count({
      where: {
        guildId,
        xp: { gt: userGuild.xp },
      },
    });
    const rank = higherXpCount + 1;

    // Başarım sayısını bul
    const achievementCount = await prisma.userAchievement.count({
      where: { guildId, userId },
    });

    let displayName = userGuild.user.username;
    let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';

    if (client) {
      try {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        displayName = member.displayName || member.user.username;
        avatarUrl = member.displayAvatarURL({ size: 256 });
      } catch {
        // Fallback to user avatar
        if (userGuild.user.avatar) {
          avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${userGuild.user.avatar}.png`;
        }
      }
    }

    let parsedBadges: string[] = [];
    try {
      parsedBadges = JSON.parse(userGuild.badges || '[]');
    } catch {
      parsedBadges = [];
    }

    return {
      userId,
      guildId,
      username: userGuild.user.username,
      displayName,
      avatarUrl,
      level: userGuild.level,
      xp: userGuild.xp,
      xpNeeded: progress.nextLevelXp,
      progressPercent: progress.progressPercent,
      coins: userGuild.coins,
      bankCoins: userGuild.bankCoins,
      streak: userGuild.dailyStreak,
      messageCount: userGuild.messageCount,
      voiceHours: userGuild.voiceSeconds / 3600,
      achievementCount,
      rank,
      joinedAt: userGuild.createdAt,
      title: userGuild.title,
      bio: userGuild.bio,
      badges: parsedBadges,
    };
  }

  public async updateBio(userId: string, guildId: string, bio: string) {
    const sanitized = bio.trim().slice(0, 200);
    return prisma.userGuild.update({
      where: { userId_guildId: { userId, guildId } },
      data: { bio: sanitized },
    });
  }

  public async getUserDataExport(userId: string, guildId: string) {
    const userGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId, guildId } },
      include: {
        user: true,
      },
    });

    const achievements = await prisma.userAchievement.findMany({
      where: { userId, guildId },
      include: { achievement: true },
    });

    const inventory = await prisma.inventory.findMany({
      where: { userId, guildId },
      include: { item: true },
    });

    const transactions = await prisma.economyTransaction.findMany({
      where: { guildId, OR: [{ fromUserId: userId }, { toUserId: userId }] },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    return {
      userGuild,
      achievements,
      inventory,
      recentTransactions: transactions,
    };
  }

  public async deleteUserData(userId: string, guildId: string) {
    return prisma.$transaction([
      prisma.userAchievement.deleteMany({ where: { userId, guildId } }),
      prisma.inventory.deleteMany({ where: { userId, guildId } }),
      prisma.userQuest.deleteMany({ where: { userId, guildId } }),
      prisma.birthday.deleteMany({ where: { userId, guildId } }),
      prisma.reminder.deleteMany({ where: { userId, guildId } }),
      prisma.voiceSession.deleteMany({ where: { userId, guildId } }),
      prisma.userGuild.delete({ where: { userId_guildId: { userId, guildId } } }),
    ]);
  }
}

export const userService = new UserService();
