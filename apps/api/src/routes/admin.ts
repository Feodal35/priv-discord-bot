import { Router, Request, Response } from 'express';
import { prisma, checkDatabaseConnection } from '@priv/database';

export const adminRouter = Router();

adminRouter.get('/system', async (_req: Request, res: Response) => {
  const dbStatus = await checkDatabaseConnection();
  const guildCount = await prisma.guild.count();
  const userCount = await prisma.user.count();

  const mem = process.memoryUsage();

  res.json({
    success: true,
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
      databaseConnected: dbStatus,
      totalGuilds: guildCount,
      totalUsers: userCount,
      timestamp: new Date().toISOString(),
    },
  });
});
