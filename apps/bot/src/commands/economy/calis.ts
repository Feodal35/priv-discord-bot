import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { createSuccessEmbed, createWarningEmbed } from '../../utils/embed';

export const calisCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('çalış')
    .setDescription('Sunucu için bir iş yaparak coin kazanırsın (1 saat bekleme süresi).'),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const res = await economyService.claimWork(interaction.guild.id, interaction.user.id);

    if (!res.success) {
      const embed = createWarningEmbed('Dinlenme Zamanı', res.message);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const embed = createSuccessEmbed('İş Tamamlandı!', res.message);
    await interaction.reply({ embeds: [embed] });
  },
};
