import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { guildService } from './guild.service';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS, EMOJIS } from '@priv/shared';

// Kullanıcının belirlediği sabit log kanalı ID'si
export const LOG_CHANNEL_ID = '1545497145379917954';

export type LogCategory =
  | 'MODERATION'
  | 'MESSAGE_DELETE'
  | 'MESSAGE_UPDATE'
  | 'VOICE'
  | 'MEMBER_JOIN'
  | 'MEMBER_LEAVE'
  | 'ECONOMY'
  | 'CLAN'
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
      const targetChannelId = settings.logChannelId || LOG_CHANNEL_ID;
      if (!targetChannelId) return;

      const channel = (await client.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null;
      if (!channel) return;

      let color: any = DEFAULT_COLORS.INFO;
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
        case 'CLAN':
          color = 0x9b59b6;
          icon = '🛡️';
          break;
        case 'SYSTEM':
          color = DEFAULT_COLORS.PRIMARY;
          icon = '⚙️';
          break;
      }

      const embed = createEmbed({
        title: `${icon} ${title}`,
        description,
        color,
        fields,
        footer: { text: `Priv Denetim Kaydı • ${category}` },
        timestamp: true,
      });

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[HATA] Log gönderilirken hata oluştu:', err);
    }
  }
}

export const logService = new LogService();
