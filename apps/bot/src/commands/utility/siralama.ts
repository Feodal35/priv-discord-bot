import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { prisma } from '@priv/database';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency, formatHours } from '@priv/shared';
import { createLeaderboardCard } from '../../utils/canvas';

export const siralamaCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('sıralama')
    .setDescription('Sunucu liderlik tablosunu (Leaderboard) görüntüler.')
    .addStringOption((opt) =>
      opt
        .setName('kategori')
        .setDescription('Sıralama kategorisi')
        .setRequired(false)
        .addChoices(
          { name: 'XP / Seviye',      value: 'xp' },
          { name: 'Cüzdan (Coin)',    value: 'coins' },
          { name: 'Mesaj Sayısı',     value: 'messageCount' },
          { name: 'Ses Süresi',       value: 'voiceSeconds' },
          { name: 'Streak',           value: 'dailyStreak' }
        )
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const category = interaction.options.getString('kategori') || 'xp';
    const guildId = interaction.guild.id;

    let orderByObj: any = { xp: 'desc' };
    let title = 'Seviye ve XP Sıralaması';
    let icon = '⭐';
    let formatVal = (u: any) => `Seviye ${u.level} — ${formatCurrency(u.xp)} XP`;

    if (category === 'coins') {
      orderByObj = { coins: 'desc' };
      title = 'En Zenginler (Coin) Sıralaması';
      icon = '🪙';
      formatVal = (u: any) => `${formatCurrency(u.coins)} Coin`;
    } else if (category === 'messageCount') {
      orderByObj = { messageCount: 'desc' };
      title = 'En Çok Mesaj Gönderenler';
      icon = '💬';
      formatVal = (u: any) => `${formatCurrency(u.messageCount)} mesaj`;
    } else if (category === 'voiceSeconds') {
      orderByObj = { voiceSeconds: 'desc' };
      title = 'En Çok Ses Kanalında Kalanlar';
      icon = '🎤';
      formatVal = (u: any) => `${formatHours(u.voiceSeconds / 3600)}`;
    } else if (category === 'dailyStreak') {
      orderByObj = { dailyStreak: 'desc' };
      title = 'En Uzun Günlük Streak Serileri';
      icon = '🔥';
      formatVal = (u: any) => `${u.dailyStreak} Gün`;
    }

    const topUsers = await prisma.userGuild.findMany({
      where: { guildId },
      orderBy: orderByObj,
      take: 10,
      include: { user: true },
    });

    if (topUsers.length === 0) {
      await interaction.editReply({
        content: 'Henüz sıralama oluşmadı. Biraz mesaj yazarak veya ses odalarına katılarak ilk sırayı alabilirsin!',
      });
      return;
    }

    // Build canvas entries
    const entries = await Promise.all(
      topUsers.map(async (u, idx) => {
        let username = u.user.username;
        try {
          const member = await interaction.guild!.members.fetch(u.userId).catch(() => null);
          username = member?.displayName || u.user.username;
        } catch { /* skip */ }

        return {
          rank: idx + 1,
          username,
          value: formatVal(u),
          avatarUrl: `https://cdn.discordapp.com/avatars/${u.userId}/${u.user.avatar ?? 'default'}.png`,
        };
      })
    );

    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createLeaderboardCard({
        title,
        icon,
        entries,
        guildIconUrl: interaction.guild.iconURL({ extension: 'png', size: 128 }) || undefined,
      });
    } catch (err) {
      console.error('[SIRALAMA] Canvas hatası:', err);
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = topUsers.map((u, idx) => {
      const prefix = medals[idx] || `**#${idx + 1}**`;
      return `${prefix} <@${u.userId}> — ${formatVal(u)}`;
    });

    const embed = createEmbed({
      title: `${icon} ${title}`,
      description: lines.join('\n\n'),
      color: DEFAULT_COLORS.GOLD as any,
      thumbnail: imageBuffer ? undefined : (interaction.guild.iconURL() || undefined),
      footer: { text: `İlk 10 üye listeleniyor • Priv Liderlik Tablosu` },
      timestamp: false,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`lb_prev_${category}_0`).setLabel('◀ Önceki').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`lb_next_${category}_1`).setLabel('Sonraki ▶').setStyle(ButtonStyle.Secondary).setDisabled(topUsers.length < 10)
    );

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'siralama.png' });
      embed.setImage('attachment://siralama.png');
      await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [row] });
    }
  },
};
