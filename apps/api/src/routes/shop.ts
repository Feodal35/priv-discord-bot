import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { checkGuildPermission } from '../middleware/guildAuth';
import { prisma } from '@priv/database';
import { z } from 'zod';

export const shopRouter = Router();

const createShopItemSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200),
  price: z.number().int().positive(),
  type: z.enum(['ROLE', 'CUSTOM_ROLE', 'BADGE', 'TITLE', 'COSMETIC', 'ITEM']),
  roleId: z.string().optional().nullable(),
  stock: z.number().int().default(-1),
});

// Mağaza ürünlerini getir
shopRouter.get(
  '/:id/shop',
  authenticate,
  checkGuildPermission,
  async (req: AuthenticatedRequest, res: Response) => {
    const guildId = req.params.id;
    const items = await prisma.shopItem.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, items });
  }
);

// Yeni mağaza ürünü ekle
shopRouter.post(
  '/:id/shop',
  authenticate,
  checkGuildPermission,
  async (req: AuthenticatedRequest, res: Response) => {
    const guildId = req.params.id;
    const parsed = createShopItemSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.format() });
      return;
    }

    const item = await prisma.shopItem.create({
      data: {
        guildId,
        ...parsed.data,
      },
    });

    res.json({ success: true, item });
  }
);

// Mağaza ürününü sil
shopRouter.delete(
  '/:id/shop/:itemId',
  authenticate,
  checkGuildPermission,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id: guildId, itemId } = req.params;

    await prisma.shopItem.deleteMany({
      where: { id: itemId, guildId },
    });

    res.json({ success: true, message: 'Ürün silindi.' });
  }
);
