import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { userService } from '../../services/user.service';
import { createEmbed } from '../../utils/embed';
import { STREAK_MILESTONES, DEFAULT_COLORS, EMOJIS, formatCurrency } from '@priv/shared';

export const streakCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('Günlük aktiflik serini ve streak ödüllerini görüntüler.'),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const profile = await userService.getUserProfile(interaction.user.id, interaction.guild.id, interaction.client);

    const milestoneFields = STREAK_MILESTONES.map((m) => {
      const isReached = profile.streak >= m.days;
      const statusIcon = isReached ? '✅' : '🔒';
      return {
        name: `${statusIcon} ${m.days} Gün — ${m.title}`,
        value: `Ödül: **${formatCurrency(m.rewardCoins)} Coin** + **${formatCurrency(m.rewardXp)} XP**`,
        inline: false,
      };
    });

    const embed = createEmbed({
      title: `${EMOJIS.STREAK} Günlük Streak Bilgisi`,
      description: `Mevcut serin: **${profile.streak} Gün** 🔥\n\nHer gün sunucuya gelip \`/günlük\` komutunu kullanarak serini sürdür ve özel ödüller kazan!`,
      color: DEFAULT_COLORS.GOLD,
      thumbnail: interaction.user.displayAvatarURL(),
      fields: milestoneFields,
      footer: {
        text: 'Seriyi korumak için her gün 20-48 saat aralığında /günlük komutunu kullanmalısın.',
      },
    });

    await interaction.reply({ embeds: [embed] });
  },
};
