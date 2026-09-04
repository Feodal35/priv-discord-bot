import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { userService } from '../../services/user.service';
import { createEmbed } from '../../utils/embed';
import { createProgressBar, formatCurrency, DEFAULT_COLORS, EMOJIS } from '@priv/shared';

export const seviyeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('seviye')
    .setDescription('Seviye ve XP ilerlemeni görüntüler.')
    .addUserOption((option) =>
      option.setName('üye').setDescription('Seviyesini görmek istediğin üye').setRequired(false)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('üye') || interaction.user;
    const profile = await userService.getUserProfile(targetUser.id, interaction.guild.id, interaction.client);

    const progressBar = createProgressBar(profile.progressPercent, 12);

    const embed = createEmbed({
      title: `${EMOJIS.LEVEL} ${profile.displayName} — Seviye Durumu`,
      thumbnail: profile.avatarUrl,
      color: DEFAULT_COLORS.PRIMARY,
      fields: [
        {
          name: 'Mevcut Seviye',
          value: `**Seviye ${profile.level}**`,
          inline: true,
        },
        {
          name: 'Sunucu Sıralaması',
          value: `**#${profile.rank}** Sırada`,
          inline: true,
        },
        {
          name: 'Sonraki Seviyeye İlerleme',
          value: `${progressBar}\nToplam XP: **${formatCurrency(profile.xp)}** / **${formatCurrency(profile.xpNeeded)}** XP`,
          inline: false,
        },
      ],
      footer: {
        text: 'Mesaj yazarak ve ses kanallarında vakit geçirerek XP kazanabilirsin!',
      },
    });

    await interaction.reply({ embeds: [embed] });
  },
};
