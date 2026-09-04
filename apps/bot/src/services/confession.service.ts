import crypto from 'crypto';
import { prisma } from '@priv/database';
import { Client, TextChannel } from 'discord.js';
import { guildService } from './guild.service';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export class ConfessionService {
  public async submitConfession(guildId: string, authorId: string, content: string, client: Client) {
    const settings = await guildService.getGuildSettings(guildId);
    if (!settings.confessionEnabled) {
      return { success: false, message: 'Bu sunucuda itiraf sistemi devre dışı bırakılmış.' };
    }

    if (!settings.confessionChannelId) {
      return {
        success: false,
        message: 'İtiraf kanalı henüz ayarlanmamış! Sunucu yetkilisinden `/ayarlar` menüsünden itiraf kanalını seçmesini isteyin.',
      };
    }

    const channel = (await client.channels.fetch(settings.confessionChannelId).catch(() => null)) as TextChannel | null;
    if (!channel) {
      return { success: false, message: 'Ayarlanan itiraf kanalı bulunamadı veya bota kapalı.' };
    }

    // Sıradaki itiraf numarasını bul
    const lastConfession = await prisma.confession.findFirst({
      where: { guildId },
      orderBy: { confessionNumber: 'desc' },
    });
    const confessionNumber = (lastConfession?.confessionNumber || 0) + 1;

    // Gizlilik için SHA256 ile hashle
    const authorHash = crypto.createHash('sha256').update(`${authorId}-${guildId}-priv-salt`).digest('hex');

    const embed = createEmbed({
      title: `🤫 Anonim İtiraf #${confessionNumber}`,
      description: `> *"${content.replace(/"/g, '\\"')}"*`,
      color: DEFAULT_COLORS.PURPLE,
      footer: {
        text: 'Bu itiraf tamamen anonim olarak gönderilmiştir. Sen de /itiraf yazarak paylaşabilirsin!',
      },
    });

    const sentMessage = await channel.send({ embeds: [embed] });

    await prisma.confession.create({
      data: {
        guildId,
        confessionNumber,
        content,
        authorHash,
        messageId: sentMessage.id,
      },
    });

    return {
      success: true,
      confessionNumber,
      message: `İtirafın başarıyla **#${confessionNumber}** numarasıyla anonim olarak paylaşıldı!`,
    };
  }
}

export const confessionService = new ConfessionService();
