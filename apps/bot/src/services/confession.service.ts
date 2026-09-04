import crypto from 'crypto';
import { prisma } from '@priv/database';
import { Client, TextChannel } from 'discord.js';
import { guildService } from './guild.service';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

// Kullanıcının belirlediği sabit itiraf kanalı ID'si
export const CONFESSION_CHANNEL_ID = '1545496276576116878';

export class ConfessionService {
  public async submitConfession(guildId: string, authorId: string, content: string, client: Client) {
    const settings = await guildService.getGuildSettings(guildId);
    if (!settings.confessionEnabled) {
      return { success: false, message: 'Bu sunucuda itiraf sistemi devre dışı bırakılmış.' };
    }

    // Hedef kanal ID'si: Öncelik kullanıcının belirttiği 1545496276576116878, ardından db ayarı
    const targetChannelId = CONFESSION_CHANNEL_ID || settings.confessionChannelId;

    if (!targetChannelId) {
      return {
        success: false,
        message: 'İtiraf kanalı henüz ayarlanmamış!',
      };
    }

    const channel = (await client.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null;
    if (!channel) {
      return { success: false, message: `İtiraf kanalı (<#${targetChannelId}>) bulunamadı veya botun kanala erişim yetkisi yok.` };
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
      description: `>>> *"${content.replace(/"/g, '\\"')}"*`,
      color: 0x9b59b6 as any,
      footer: {
        text: 'Bu itiraf %100 gizli ve anonimdir. Sen de /itiraf yazarak içini dökebilirsin!',
      },
      timestamp: true,
    });

    const sentMessage = await channel.send({ embeds: [embed] });

    // İtiraf mesajına otomatik şık tepkiler ekle
    await sentMessage.react('❤️').catch(() => {});
    await sentMessage.react('💔').catch(() => {});
    await sentMessage.react('👀').catch(() => {});

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
      message: `İtirafın başarıyla <#${targetChannelId}> kanalında **#${confessionNumber}** numarasıyla paylaşıldı! 🤫`,
    };
  }
}

export const confessionService = new ConfessionService();
