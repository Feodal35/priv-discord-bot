import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@priv/config';

export interface AuthUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  accessToken?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ success: false, message: 'Oturum açmanız gerekiyor.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Geçersiz veya süresi dolmuş oturum.' });
    return;
  }
}
