import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { DEFAULT_COLORS, EMOJIS, UserProfileDto, createProgressBar, formatCurrency, formatHours } from '@priv/shared';

export interface EmbedOptions {
  title?: string;
  description?: string;
  color?: ColorResolvable;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string; iconURL?: string };
  thumbnail?: string;
  image?: string;
  timestamp?: boolean;
}

export function createEmbed(options: EmbedOptions = {}): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  embed.setColor(options.color ?? (DEFAULT_COLORS.PRIMARY as unknown as ColorResolvable));
  if (options.fields && options.fields.length > 0) embed.addFields(options.fields);
  if (options.footer) embed.setFooter(options.footer);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.timestamp !== false) embed.setTimestamp();

  return embed;
}

export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return createEmbed({
    title: `${EMOJIS.SUCCESS} ${title}`,
    description,
    color: DEFAULT_COLORS.SUCCESS as unknown as ColorResolvable,
  });
}

export function createErrorEmbed(title: string, description: string): EmbedBuilder {
  return createEmbed({
    title: `${EMOJIS.ERROR} ${title}`,
    description,
    color: DEFAULT_COLORS.DANGER as unknown as ColorResolvable,
  });
}

export function createInfoEmbed(title: string, description: string): EmbedBuilder {
  return createEmbed({
    title: `${EMOJIS.INFO} ${title}`,
    description,
    color: DEFAULT_COLORS.INFO as unknown as ColorResolvable,
  });
}

export function createWarningEmbed(title: string, description: string): EmbedBuilder {
  return createEmbed({
    title: `${EMOJIS.WARNING} ${title}`,
    description,
    color: DEFAULT_COLORS.WARNING as unknown as ColorResolvable,
  });
}

export function createProfileEmbed(profile: UserProfileDto, currencyName: string, currencyEmoji: string): EmbedBuilder {
  const progressBar = createProgressBar(profile.progressPercent, 10);
  const badgesDisplay = profile.badges.length > 0 ? profile.badges.join(' ') : 'Henüz rozet yok';

  return createEmbed({
    title: `👤 ${profile.displayName} — Priv Profili`,
    description: `*${profile.bio}*\n\n**Ünvan:** \`${profile.title}\`\n**Rozetler:** ${badgesDisplay}`,
    thumbnail: profile.avatarUrl,
    color: DEFAULT_COLORS.PURPLE as unknown as ColorResolvable,
    fields: [
      {
        name: `${EMOJIS.LEVEL} Seviye & XP`,
        value: `**Seviye:** ${profile.level}\n**XP:** ${formatCurrency(profile.xp)} / ${formatCurrency(profile.xpNeeded)}\n${progressBar}`,
        inline: false,
      },
      {
        name: `${currencyEmoji} Bakiye`,
        value: `**Cüzdan:** ${formatCurrency(profile.coins)} ${currencyName}\n**Banka:** ${formatCurrency(profile.bankCoins)} ${currencyName}`,
        inline: true,
      },
      {
        name: `${EMOJIS.STREAK} Günlük Streak`,
        value: `**${profile.streak} Gün** kesintisiz aktiflik`,
        inline: true,
      },
      {
        name: `${EMOJIS.RANK} Sıralama`,
        value: `#${profile.rank} Sırada`,
        inline: true,
      },
      {
        name: `${EMOJIS.MESSAGE} Mesaj Sayısı`,
        value: `${formatCurrency(profile.messageCount)} mesaj`,
        inline: true,
      },
      {
        name: `${EMOJIS.VOICE} Ses Süresi`,
        value: `${formatHours(profile.voiceHours)}`,
        inline: true,
      },
      {
        name: `🏆 Başarımlar`,
        value: `${profile.achievementCount} Başarım`,
        inline: true,
      },
    ],
    footer: {
      text: `Katılım: ${new Date(profile.joinedAt).toLocaleDateString('tr-TR')}`,
    },
  });
}
