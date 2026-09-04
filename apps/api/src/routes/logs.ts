import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { checkGuildPermission } from '../middleware/guildAuth';
import { prisma } from '@priv/database';

export const logsRouter = Router();

logsRouter.get(
  '/:id/logs',
  authenticate,
  checkGuildPermission,
  async (req: AuthenticatedRequest, res: Response) => {
    const guildId = req.params.id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 15;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.moderationLog.findMany({
        where: { guildId },
        include: { targetUser: true, moderator: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.moderationLog.count({ where: { guildId } }),
    ]);

    res.json({
      success: true,
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        reason: l.reason,
        targetUser: l.targetUser.username,
        moderatorUser: l.moderator.username,
        duration: l.durationSeconds,
        createdAt: l.createdAt.toLocaleString('tr-TR'),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);
