import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { guildService } from './guild.service';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS, EMOJIS } from '@priv/shared';

export type LogCategory =
  | 'MODERATION'
  | 'MESSAGE_DELETE'
  | 'MESSAGE_UPDATE'
  | 'VOICE'
  | 'MEMBER_JOIN'
  | 'MEMBER_LEAVE'
  | 'ECONOMY'
  | 'SYSTEM';

export class LogService {
  public async logEvent(
    guildId: string,
    category: LogCategory,
    title: string,
    description: string,
    client: Client,
    fields?: { name: string; value: string; inline?: boolean }[]
  ) {
    try {
      const settings = await guildService.getGuildSettings(guildId);
      if (!settings.logChannelId) return;

      const channel = (await client.channels.fetch(settings.logChannelId).catch(() => null)) as TextChannel | null;
      if (!channel) return;

      let color: number = DEFAULT_COLORS.INFO;
      let icon: string = EMOJIS.INFO;

      switch (category) {
        case 'MODERATION':
          color = DEFAULT_COLORS.DANGER;
          icon = EMOJIS.SHIELD;
          break;
        case 'MESSAGE_DELETE':
        case 'MESSAGE_UPDATE':
          color = DEFAULT_COLORS.WARNING;
          icon = '📝';
          break;
        case 'MEMBER_JOIN':
          color = DEFAULT_COLORS.SUCCESS;
          icon = '📥';
          break;
        case 'MEMBER_LEAVE':
          color = DEFAULT_COLORS.SECONDARY;
          icon = '📤';
          break;
        case 'VOICE':
          color = DEFAULT_COLORS.PURPLE;
          icon = EMOJIS.VOICE;
          break;
        case 'ECONOMY':
          color = DEFAULT_COLORS.GOLD;
          icon = EMOJIS.COIN;
          break;
      }

      const embed = createEmbed({
        title: `${icon} ${title}`,
        description,
        color,
        fields,
        footer: { text: `Kategori: ${category}` },
      });

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[HATA] Log gönderilirken hata oluştu:', err);
    }
  }
}

export const logService = new LogService();
