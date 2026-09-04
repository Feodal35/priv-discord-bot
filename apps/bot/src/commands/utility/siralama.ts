import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { prisma } from '@priv/database';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency, formatHours } from '@priv/shared';

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
          { name: 'XP / Seviye', value: 'xp' },
          { name: 'Cüzdan (Coin)', value: 'coins' },
          { name: 'Mesaj Sayısı', value: 'messageCount' },
          { name: 'Ses Süresi', value: 'voiceSeconds' },
          { name: 'Streak', value: 'dailyStreak' }
        )
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const category = interaction.options.getString('kategori') || 'xp';
    const guildId = interaction.guild.id;

    let orderByObj: any = { xp: 'desc' };
    let title = '🏆 Seviye ve XP Sıralaması';
    let formatVal = (u: any) => `Seviye ${u.level} (${formatCurrency(u.xp)} XP)`;

    if (category === 'coins') {
      orderByObj = { coins: 'desc' };
      title = '🪙 En Zenginler (Coin) Sıralaması';
      formatVal = (u: any) => `${formatCurrency(u.coins)} Coin`;
    } else if (category === 'messageCount') {
      orderByObj = { messageCount: 'desc' };
      title = '💬 En Çok Mesaj Gönderenler';
      formatVal = (u: any) => `${formatCurrency(u.messageCount)} mesaj`;
    } else if (category === 'voiceSeconds') {
      orderByObj = { voiceSeconds: 'desc' };
      title = '🎤 En Çok Ses Kanalında Kalanlar';
      formatVal = (u: any) => `${formatHours(u.voiceSeconds / 3600)}`;
    } else if (category === 'dailyStreak') {
      orderByObj = { dailyStreak: 'desc' };
      title = '🔥 En Uzun Günlük Streak Serileri';
      formatVal = (u: any) => `${u.dailyStreak} Gün`;
    }

    const topUsers = await prisma.userGuild.findMany({
      where: { guildId },
      orderBy: orderByObj,
      take: 10,
      include: { user: true },
    });

    if (topUsers.length === 0) {
      await interaction.reply({
        content: 'Henüz sıralama oluşmadı. Biraz mesaj yazarak veya ses odalarına katılarak ilk sırayı alabilirsin!',
        ephemeral: true,
      });
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = topUsers.map((u, idx) => {
      const prefix = medals[idx] || `**#${idx + 1}**`;
      return `${prefix} <@${u.userId}> — ${formatVal(u)}`;
    });

    const embed = createEmbed({
      title,
      description: lines.join('\n\n'),
      color: DEFAULT_COLORS.GOLD,
      thumbnail: interaction.guild.iconURL() || undefined,
      footer: { text: `İlk 10 üye listeleniyor • Priv Liderlik Tablosu` },
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`lb_prev_${category}_0`).setLabel('◀ Önceki').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`lb_next_${category}_1`).setLabel('Sonraki ▶').setStyle(ButtonStyle.Secondary).setDisabled(topUsers.length < 10)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
