import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { checkGuildPermission } from '../middleware/guildAuth';
import { prisma, memoryCache } from '@priv/database';
import { z } from 'zod';

export const settingsRouter = Router();

const updateSettingsSchema = z.object({
  botName: z.string().min(1).max(32).optional(),
  embedColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  currencyName: z.string().min(1).max(20).optional(),
  currencyEmoji: z.string().min(1).max(10).optional(),
  welcomeChannelId: z.string().nullable().optional(),
  leaveChannelId: z.string().nullable().optional(),
  logChannelId: z.string().nullable().optional(),
  confessionChannelId: z.string().nullable().optional(),
  birthdayChannelId: z.string().nullable().optional(),
  tempVoiceCategoryId: z.string().nullable().optional(),
  tempVoiceCreateChannelId: z.string().nullable().optional(),
  autoRoleId: z.string().nullable().optional(),
  birthdayRoleId: z.string().nullable().optional(),
  muteRoleId: z.string().nullable().optional(),
  welcomeMessage: z.string().max(1000).optional(),
  leaveMessage: z.string().max(1000).optional(),
  economyEnabled: z.boolean().optional(),
  levelEnabled: z.boolean().optional(),
  gamesEnabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  confessionEnabled: z.boolean().optional(),
  autoModEnabled: z.boolean().optional(),
  dailyReward: z.number().int().min(1).optional(),
  workMinReward: z.number().int().min(1).optional(),
  workMaxReward: z.number().int().min(1).optional(),
  workCooldownMinutes: z.number().int().min(1).optional(),
  dailyStreakBonus: z.number().int().min(0).optional(),
  maxTransferAmount: z.number().int().min(1).optional(),
});

// Ayarları getir
settingsRouter.get(
  '/:id/settings',
  authenticate,
  checkGuildPermission,
  async (req: AuthenticatedRequest, res: Response) => {
    const guildId = req.params.id;

    let settings = await prisma.guildSettings.findUnique({
      where: { guildId },
    });

    if (!settings) {
      settings = await prisma.guildSettings.create({
        data: { guildId },
      });
    }

    res.json({ success: true, settings });
  }
);

// Ayarları güncelle
settingsRouter.put(
  '/:id/settings',
  authenticate,
  checkGuildPermission,
  async (req: AuthenticatedRequest, res: Response) => {
    const guildId = req.params.id;

    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.format() });
      return;
    }

    const updated = await prisma.guildSettings.upsert({
      where: { guildId },
      update: parsed.data,
      create: {
        guildId,
        ...parsed.data,
      },
    });

    // Önbelleği temizle
    memoryCache.delete(`guild_settings:${guildId}`);

    res.json({ success: true, settings: updated });
  }
);
