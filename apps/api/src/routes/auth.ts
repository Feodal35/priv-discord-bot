import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '@priv/config';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '@priv/database';

export const authRouter = Router();

// Discord OAuth2 Giriş Yönlendirmesi
authRouter.get('/login', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: config.DISCORD_CLIENT_ID,
    redirect_uri: config.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

// OAuth2 Callback
authRouter.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    res.redirect(`${config.DASHBOARD_URL}?error=missing_code`);
    return;
  }

  try {
    // 1. Token Takası
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        client_secret: config.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.DISCORD_REDIRECT_URI,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // 2. Kullanıcı Bilgilerini Çek
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const discordUser = userResponse.data;

    // 3. Veritabanına kaydet / güncelle
    await prisma.user.upsert({
      where: { id: discordUser.id },
      update: {
        username: discordUser.username,
        discriminator: discordUser.discriminator || '0',
        avatar: discordUser.avatar,
      },
      create: {
        id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator || '0',
        avatar: discordUser.avatar,
      },
    });

    // 4. JWT Token Üret
    const payload = {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      accessToken,
    };

    const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });

    // Cookie ve yönlendirme
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${config.DASHBOARD_URL}/servers?token=${token}`);
  } catch (error: any) {
    console.error('[HATA] Discord OAuth2 hatası:', error?.response?.data || error.message);
    res.redirect(`${config.DASHBOARD_URL}?error=auth_failed`);
  }
});

// Oturum Açmış Kullanıcı Bilgisi
authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    user: {
      id: req.user?.id,
      username: req.user?.username,
      discriminator: req.user?.discriminator,
      avatar: req.user?.avatar,
    },
  });
});

// Çıkış Yap
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Başarıyla çıkış yapıldı.' });
});
