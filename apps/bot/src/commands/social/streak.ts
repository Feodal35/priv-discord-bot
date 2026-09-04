import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { userService } from '../../services/user.service';
import { createEmbed } from '../../utils/embed';
import { STREAK_MILESTONES, DEFAULT_COLORS, EMOJIS, formatCurrency } from '@priv/shared';
import { createStreakCard } from '../../utils/canvas';

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

    await interaction.deferReply();

    const profile = await userService.getUserProfile(interaction.user.id, interaction.guild.id, interaction.client);

    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createStreakCard({
        avatarUrl:  interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
        username:   profile.displayName,
        streak:     profile.streak,
        milestones: STREAK_MILESTONES,
      });
    } catch (err) {
      console.error('[STREAK] Canvas hatası:', err);
    }

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
      title: `${EMOJIS.STREAK} Günlük Streak — ${profile.streak} Gün`,
      description: `Mevcut serin: **${profile.streak} Gün** 🔥\n\nHer gün \`/günlük\` komutunu kullanarak serini sürdür ve özel ödüller kazan!`,
      color: DEFAULT_COLORS.GOLD as any,
      fields: milestoneFields,
      footer: { text: 'Vip Metro • Her gün /günlük alarak serini sürdür (Ödüller her gece 00:00\'da yenilenir).' },
      timestamp: false,
    });

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'streak.png' });
      embed.setImage('attachment://streak.png');
      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
