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
  | 'MEMBER_UPDATE'
  | 'ROLE_UPDATE'
  | 'ECONOMY'
  | 'CLAN'
  | 'SYSTEM';

export interface LogOptions {
  fields?: { name: string; value: string; inline?: boolean }[];
  thumbnailUrl?: string | null;
  color?: number;
  author?: { name: string; iconURL?: string };
}

export class LogService {
  public async logEvent(
    guildId: string,
    category: LogCategory,
    title: string,
    description: string,
    client: Client,
    fieldsOrOptions?: { name: string; value: string; inline?: boolean }[] | LogOptions,
    extraOptions?: LogOptions
  ) {
    try {
      const settings = await guildService.getGuildSettings(guildId);
      const targetChannelId = settings.logChannelId || LOG_CHANNEL_ID;
      if (!targetChannelId) return;

      const channel = (await client.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null;
      if (!channel) return;

      // Parametre çözümleme
      let fields: { name: string; value: string; inline?: boolean }[] | undefined;
      let options: LogOptions = {};

      if (Array.isArray(fieldsOrOptions)) {
        fields = fieldsOrOptions;
        if (extraOptions) options = extraOptions;
      } else if (fieldsOrOptions && typeof fieldsOrOptions === 'object') {
        options = fieldsOrOptions;
        fields = options.fields;
      }

      let color: any = options.color || DEFAULT_COLORS.INFO;
      let icon: string = EMOJIS.INFO;

      switch (category) {
        case 'MODERATION':
          if (!options.color) color = DEFAULT_COLORS.DANGER;
          icon = EMOJIS.SHIELD;
          break;
        case 'MESSAGE_DELETE':
        case 'MESSAGE_UPDATE':
          if (!options.color) color = DEFAULT_COLORS.WARNING;
          icon = '📝';
          break;
        case 'MEMBER_JOIN':
          if (!options.color) color = DEFAULT_COLORS.SUCCESS;
          icon = '📥';
          break;
        case 'MEMBER_LEAVE':
          if (!options.color) color = DEFAULT_COLORS.SECONDARY;
          icon = '📤';
          break;
        case 'MEMBER_UPDATE':
        case 'ROLE_UPDATE':
          if (!options.color) color = 0x3498DB;
          icon = '👤';
          break;
        case 'VOICE':
          if (!options.color) color = DEFAULT_COLORS.PURPLE;
          icon = '🎙️';
          break;
        case 'ECONOMY':
          if (!options.color) color = DEFAULT_COLORS.GOLD;
          icon = EMOJIS.COIN;
          break;
        case 'CLAN':
          if (!options.color) color = 0x9b59b6;
          icon = '🛡️';
          break;
        case 'SYSTEM':
          if (!options.color) color = DEFAULT_COLORS.PRIMARY;
          icon = '⚙️';
          break;
      }

      const embed = createEmbed({
        title: `${icon} ${title}`,
        description,
        color,
        fields,
        footer: { text: `Vip Metro • Denetim Kaydı [${category}]` },
        timestamp: true,
      });

      if (options.thumbnailUrl) {
        embed.setThumbnail(options.thumbnailUrl);
      }

      if (options.author) {
        embed.setAuthor({ name: options.author.name, iconURL: options.author.iconURL });
      }

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[HATA] Log gönderilirken hata oluştu:', err);
    }
  }
}

export const logService = new LogService();

