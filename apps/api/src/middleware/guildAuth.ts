import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import axios from 'axios';
import { prisma } from '@priv/database';

export async function checkGuildPermission(
  req: AuthenticatedRequest,
  res: any,
  next: any
): Promise<void> {
  const guildId = req.params.guildId || req.params.id;
  const user = req.user;

  if (!user || !guildId) {
    res.status(400).json({ success: false, message: 'Geçersiz istek parametreleri.' });
    return;
  }

  // Veritabanında sunucu var mı kontrolü
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
  });

  if (!guild) {
    res.status(404).json({ success: false, message: 'Sunucu bulunamadı veya bot bu sunucuda ekli değil.' });
    return;
  }

  // Kullanıcı sunucu sahibi ise doğrudan izin ver
  if (guild.ownerId === user.id) {
    next();
    return;
  }

  // Kullanıcının Discord yetkilerini Discord API üzerinden kontrol et (Access token varsa)
  if (user.accessToken) {
    try {
      const response = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });

      const userGuild = response.data.find((g: any) => g.id === guildId);
      if (userGuild) {
        // ADMINISTRATOR (0x8) veya MANAGE_GUILD (0x20) izni
        const permissions = BigInt(userGuild.permissions);
        const hasAdmin = (permissions & BigInt(0x8)) === BigInt(0x8);
        const hasManageGuild = (permissions & BigInt(0x20)) === BigInt(0x20);

        if (hasAdmin || hasManageGuild) {
          next();
          return;
        }
      }
    } catch (err) {
      console.error('[HATA] Discord sunucu yetkisi doğrulanamadı:', err);
    }
  }

  res.status(403).json({
    success: false,
    message: 'Bu sunucunun ayarlarını yönetmek için Yönetici veya Sunucuyu Yönet yetkisine sahip olmalısınız.',
  });
}
