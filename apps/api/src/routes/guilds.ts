import { Router, Response } from 'express';
import axios from 'axios';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '@priv/database';
import { config } from '@priv/config';

export const guildsRouter = Router();

// Kullanıcının yönettiği sunucuları listele
guildsRouter.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.accessToken) {
    res.status(401).json({ success: false, message: 'Discord erişim anahtarı bulunamadı.' });
    return;
  }

  try {
    const response = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${req.user.accessToken}` },
    });

    const userGuilds = response.data;
    // Yalnızca Yönetici veya Sunucuyu Yönet yetkisi olanlar
    const adminGuilds = userGuilds.filter((g: any) => {
      const perms = BigInt(g.permissions);
      return (perms & BigInt(0x8)) === BigInt(0x8) || (perms & BigInt(0x20)) === BigInt(0x20);
    });

    // Botun bulunduğu sunucuları veritabanından sorgula
    const botGuilds = await prisma.guild.findMany({
      select: { id: true },
    });
    const botGuildIds = new Set(botGuilds.map((b) => b.id));

    const result = adminGuilds.map((g: any) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
      owner: g.owner,
      hasBot: botGuildIds.has(g.id),
      inviteUrl: `https://discord.com/oauth2/authorize?client_id=${config.DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${g.id}`,
    }));

    res.json({ success: true, guilds: result });
  } catch (error: any) {
    console.error('[HATA] Sunucu listesi alınırken hata:', error?.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Sunucu listesi Discord API üzerinden alınamadı.' });
  }
});

// Belirli bir sunucunun temel bilgilerini getir
guildsRouter.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const guild = await prisma.guild.findUnique({
    where: { id: req.params.id },
    include: { settings: true },
  });

  if (!guild) {
    res.status(404).json({ success: false, message: 'Sunucu bulunamadı.' });
    return;
  }

  res.json({ success: true, guild });
});
