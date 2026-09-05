import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { prisma } from '@priv/database';
import { DEFAULT_COLORS, formatCurrency, formatHours, getLevelFromXp } from '@priv/shared';
import { createLeaderboardCard } from '../../utils/canvas';
import { voiceService } from '../../services/voice.service';

export type LbCategory = 'xp' | 'coins' | 'messageCount' | 'voiceSeconds' | 'dailyStreak';

export interface LbConfig {
  title: string;
  icon: string;
  color: number;
  orderBy: Record<string, string>;
  formatVal: (u: any) => string;
}

export const LB_CONFIGS: Record<LbCategory, LbConfig> = {
  xp: {
    title: 'Seviye ve XP Sıralaması',
    icon: '⭐',
    color: 0xf1c40f,
    orderBy: { xp: 'desc' },
    formatVal: (u) => `Seviye ${getLevelFromXp(u.xp)} — ${formatCurrency(u.xp)} XP`,
  },
  coins: {
    title: 'En Zenginler (Coin)',
    icon: '🪙',
    color: 0xf39c12,
    orderBy: { coins: 'desc' },
    formatVal: (u) => `${formatCurrency(u.coins)} Coin`,
  },
  messageCount: {
    title: 'En Çok Mesaj Gönderenler',
    icon: '💬',
    color: 0x2ecc71,
    orderBy: { messageCount: 'desc' },
    formatVal: (u) => `${formatCurrency(u.messageCount)} mesaj`,
  },
  voiceSeconds: {
    title: 'En Çok Ses Kanalında Kalanlar',
    icon: '🎤',
    color: 0x3498db,
    orderBy: { voiceSeconds: 'desc' },
    formatVal: (u) => {
      const liveSec = voiceService.getLiveVoiceSeconds(u.guildId, u.userId, u.voiceSeconds);
      return formatHours(liveSec / 3600);
    },
  },
  dailyStreak: {
    title: 'En Uzun Günlük Streak',
    icon: '🔥',
    color: 0xe74c3c,
    orderBy: { dailyStreak: 'desc' },
    formatVal: (u) => `${u.dailyStreak} Gün`,
  },
};

export function buildCategoryButtons(active: LbCategory): ActionRowBuilder<ButtonBuilder> {
  const cats: Array<{ id: LbCategory; label: string; emoji: string }> = [
    { id: 'xp',           label: 'XP/Seviye',  emoji: '⭐' },
    { id: 'coins',        label: 'Coin',        emoji: '🪙' },
    { id: 'messageCount', label: 'Mesaj',       emoji: '💬' },
    { id: 'voiceSeconds', label: 'Ses',         emoji: '🎤' },
    { id: 'dailyStreak',  label: 'Streak',      emoji: '🔥' },
  ];

  const row = new ActionRowBuilder<ButtonBuilder>();
  cats.forEach(({ id, label, emoji }) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`lb_cat_${id}`)
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(id === active ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(id === active)
    );
  });
  return row;
}

export async function buildLeaderboardReply(
  guildId: string,
  guildName: string,
  guildIconUrl: string | null | undefined,
  category: LbCategory,
  client: any
) {
  const cfg = LB_CONFIGS[category];

  let topUsers = await prisma.userGuild.findMany({
    where: { guildId },
    orderBy: cfg.orderBy,
    take: 15,
    include: { user: true },
  });

  if (topUsers.length === 0) return null;

  // Ses sıralaması için anlık aktif ses sürelerini de ekle ve yeniden sırala
  if (category === 'voiceSeconds') {
    topUsers = topUsers
      .map((u) => ({
        ...u,
        _liveSeconds: voiceService.getLiveVoiceSeconds(guildId, u.userId, u.voiceSeconds),
      }))
      .sort((a, b) => b._liveSeconds - a._liveSeconds)
      .slice(0, 10);
  } else {
    topUsers = topUsers.slice(0, 10);
  }

  const entries = await Promise.all(
    topUsers.map(async (u, idx) => {
      let username = u.user.username;
      try {
        const guild = client.guilds.cache.get(guildId);
        const member = await guild?.members.fetch(u.userId).catch(() => null);
        username = member?.displayName || u.user.username;
      } catch { /* sessiz */ }

      return {
        rank: idx + 1,
        username,
        value: cfg.formatVal(u),
        avatarUrl: `https://cdn.discordapp.com/avatars/${u.userId}/${u.user.avatar ?? 'default'}.png`,
      };
    })
  );

  let imageBuffer: Buffer | null = null;
  try {
    imageBuffer = await createLeaderboardCard({
      title: cfg.title,
      icon: cfg.icon,
      entries,
      guildIconUrl: guildIconUrl || undefined,
      guildName,
    });
  } catch (err) {
    console.error('[SIRALAMA] Canvas kartı oluşturma hatası:', err);
  }

  const podiumIcons = ['🥇', '🥈', '🥉'];
  const podiumLines = topUsers.slice(0, 3).map((u, idx) => {
    return `${podiumIcons[idx]} **#${idx + 1}** <@${u.userId}> — \`${cfg.formatVal(u)}\``;
  });

  const embed = new EmbedBuilder()
    .setColor(cfg.color)
    .setTitle(`${cfg.icon} ${cfg.title}`)
    .setDescription(
      `🏆 **Liderlik Kürsüsü:**\n` +
      podiumLines.join('\n') +
      `\n\n📊 *Detaylı ilk 10 sıralaması aşağıdaki tabloda gösterilmektedir.*`
    )
    .setFooter({ text: `${guildName} • Liderlik Tablosu • Priv Bot` })
    .setTimestamp();

  if (imageBuffer) {
    embed.setImage('attachment://siralama.png');
  }

  return { embed, imageBuffer, entries, cfg };
}

export const siralamaCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('sıralama')
    .setDescription('Sunucu liderlik tablosunu (Leaderboard) görüntüler.')
    .addStringOption((opt) =>
      opt
        .setName('kategori')
        .setDescription('Başlangıç sıralaması kategorisi')
        .setRequired(false)
        .addChoices(
          { name: '⭐ XP / Seviye',     value: 'xp' },
          { name: '🪙 Cüzdan (Coin)',   value: 'coins' },
          { name: '💬 Mesaj Sayısı',    value: 'messageCount' },
          { name: '🎤 Ses Süresi',      value: 'voiceSeconds' },
          { name: '🔥 Streak',          value: 'dailyStreak' }
        )
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const category = (interaction.options.getString('kategori') || 'xp') as LbCategory;

    const result = await buildLeaderboardReply(
      interaction.guild.id,
      interaction.guild.name,
      interaction.guild.iconURL({ extension: 'png', size: 128 }),
      category,
      interaction.client
    );

    if (!result) {
      await interaction.editReply({
        content: 'Henüz sıralama oluşmadı. Biraz mesaj yazarak veya ses odalarına katılarak ilk sırayı alabilirsin!',
      });
      return;
    }

    const catRow = buildCategoryButtons(category);

    if (result.imageBuffer) {
      const attachment = new AttachmentBuilder(result.imageBuffer, { name: 'siralama.png' });
      await interaction.editReply({ embeds: [result.embed], files: [attachment], components: [catRow] });
    } else {
      await interaction.editReply({ embeds: [result.embed], components: [catRow] });
    }
  },
};
