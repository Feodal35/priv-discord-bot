import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from '@priv/config';
import { authRouter } from './routes/auth';
import { guildsRouter } from './routes/guilds';
import { settingsRouter } from './routes/settings';
import { statsRouter } from './routes/stats';
import { shopRouter } from './routes/shop';
import { logsRouter } from './routes/logs';
import { leaderboardRouter } from './routes/leaderboard';
import { adminRouter } from './routes/admin';

export function createServer(): express.Application {
  const app = express();

  // Güvenlik Başlıkları
  app.use(helmet());

  // CORS Yapılandırması
  app.use(
    cors({
      origin: [config.DASHBOARD_URL, 'http://localhost:5173'],
      credentials: true,
    })
  );

  // Genel Rate Limiting (15 dakikada en fazla 500 istek)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Çok fazla istek yapıldı. Lütfen daha sonra tekrar deneyin.' },
  });
  app.use(limiter);

  // Body parser ve çerezler
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Temel Sağlık Kontrolü
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // API Rotaları
  app.use('/api/auth', authRouter);
  app.use('/api/guilds', guildsRouter);
  app.use('/api/guilds', settingsRouter);
  app.use('/api/guilds', statsRouter);
  app.use('/api/guilds', shopRouter);
  app.use('/api/guilds', logsRouter);
  app.use('/api/guilds', leaderboardRouter);
  app.use('/api/admin', adminRouter);

  // Merkezi Hata Yakalayıcı
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API HATA]', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Sunucuda bir hata meydana geldi.',
    });
  });

  return app;
}
