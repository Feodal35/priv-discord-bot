import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { checkGuildPermission } from '../middleware/guildAuth';
import { prisma } from '@priv/database';

export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/:id/leaderboard',
  authenticate,
  checkGuildPermission,
  async (req: AuthenticatedRequest, res: Response) => {
    const guildId = req.params.id;
    const category = (req.query.category as string) || 'xp';

    let orderByObj: any = { xp: 'desc' };
    if (category === 'coins') orderByObj = { coins: 'desc' };
    else if (category === 'messages') orderByObj = { messageCount: 'desc' };
    else if (category === 'voice') orderByObj = { voiceSeconds: 'desc' };
    else if (category === 'streak') orderByObj = { dailyStreak: 'desc' };

    const users = await prisma.userGuild.findMany({
      where: { guildId },
      orderBy: orderByObj,
      take: 25,
      include: { user: true },
    });

    res.json({
      success: true,
      leaderboard: users.map((u, i) => ({
        rank: i + 1,
        userId: u.userId,
        username: u.user.username,
        avatar: u.user.avatar,
        level: u.level,
        xp: u.xp,
        coins: u.coins,
        messageCount: u.messageCount,
        voiceHours: Math.round(u.voiceSeconds / 3600),
        streak: u.dailyStreak,
      })),
    });
  }
);
