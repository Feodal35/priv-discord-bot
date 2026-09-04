import { prisma, memoryCache } from '@priv/database';
import { GuildSettings } from '@priv/database';

export class GuildService {
  private cacheKey(guildId: string): string {
    return `guild_settings:${guildId}`;
  }

  public async getOrCreateGuild(guildId: string, name: string, ownerId: string, icon?: string | null) {
    return prisma.guild.upsert({
      where: { id: guildId },
      update: {
        name,
        icon,
        ownerId,
      },
      create: {
        id: guildId,
        name,
        icon,
        ownerId,
        settings: {
          create: {},
        },
      },
      include: {
        settings: true,
      },
    });
  }

  public async getGuildSettings(guildId: string): Promise<GuildSettings> {
    const cached = memoryCache.get<GuildSettings>(this.cacheKey(guildId));
    if (cached) return cached;

    let settings = await prisma.guildSettings.findUnique({
      where: { guildId },
    });

    if (!settings) {
      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild) {
        await prisma.guild.create({
          data: {
            id: guildId,
            name: 'Priv Sunucusu',
            ownerId: '',
          },
        });
      }

      settings = await prisma.guildSettings.create({
        data: { guildId },
      });
    }

    memoryCache.set(this.cacheKey(guildId), settings, 120); // 2 dakika cache
    return settings;
  }

  public async updateGuildSettings(guildId: string, data: Partial<GuildSettings>): Promise<GuildSettings> {
    const updated = await prisma.guildSettings.upsert({
      where: { guildId },
      update: data,
      create: {
        guildId,
        ...data,
      },
    });

    memoryCache.set(this.cacheKey(guildId), updated, 120);
    return updated;
  }
}

export const guildService = new GuildService();
