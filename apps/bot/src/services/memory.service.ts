import { prisma } from '@priv/database';
import { formatCurrency, formatHours } from '@priv/shared';

export class MemoryService {
  public async addMemory(
    guildId: string,
    title: string,
    eventDate: Date,
    description: string,
    createdBy: string,
    imageUrl?: string | null,
    involvedUsers: string[] = []
  ) {
    return prisma.memory.create({
      data: {
        guildId,
        title,
        eventDate,
        description,
        createdBy,
        imageUrl,
        involvedUsers: JSON.stringify(involvedUsers),
      },
    });
  }

  public async getMemories(guildId: string) {
    return prisma.memory.findMany({
      where: { guildId },
      orderBy: { eventDate: 'desc' },
      take: 20,
    });
  }

  public async generateYearSummary(guildId: string, year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const memories = await prisma.memory.findMany({
      where: {
        guildId,
        eventDate: { gte: startDate, lte: endDate },
      },
      orderBy: { eventDate: 'asc' },
    });

    const topChatters = await prisma.userGuild.findMany({
      where: { guildId },
      orderBy: { messageCount: 'desc' },
      take: 3,
      include: { user: true },
    });

    const topVoiceUsers = await prisma.userGuild.findMany({
      where: { guildId },
      orderBy: { voiceSeconds: 'desc' },
      take: 3,
      include: { user: true },
    });

    const totalStats = await prisma.userGuild.aggregate({
      where: { guildId },
      _sum: {
        messageCount: true,
        voiceSeconds: true,
        coins: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      year,
      memberCount: totalStats._count.id,
      totalMessages: totalStats._sum.messageCount || 0,
      totalVoiceHours: (totalStats._sum.voiceSeconds || 0) / 3600,
      totalCoins: totalStats._sum.coins || 0,
      topChatters: topChatters.map((u, i) => ({
        rank: i + 1,
        username: u.user.username,
        userId: u.userId,
        messages: u.messageCount,
      })),
      topVoice: topVoiceUsers.map((u, i) => ({
        rank: i + 1,
        username: u.user.username,
        userId: u.userId,
        hours: u.voiceSeconds / 3600,
      })),
      memories: memories.map((m) => ({
        title: m.title,
        date: m.eventDate.toLocaleDateString('tr-TR'),
        description: m.description,
      })),
    };
  }
}

export const memoryService = new MemoryService();
