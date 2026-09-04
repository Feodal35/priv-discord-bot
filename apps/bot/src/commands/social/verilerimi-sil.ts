import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createWarningEmbed } from '../../utils/embed';

export const verilerimiSilCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('verilerimi-sil')
    .setDescription('KVKK kapsamında bu sunucudaki profil, ekonomi ve başarım verilerini siler.'),
  cooldown: 30,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const embed = createWarningEmbed(
      'Veri Silme Onayı',
      '⚠️ Bu işlem geri alınamaz! Bu sunucudaki:\n• XP ve Seviyen\n• Cüzdan ve Banka Bakiyen\n• Streak serin\n• Başarımların ve Envanterin\n\ntamamen silinecektir. Devam etmek istiyor musun?'
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_delete_data_${interaction.user.id}`)
        .setLabel('Evet, Verilerimi Sil')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`cancel_delete_data_${interaction.user.id}`)
        .setLabel('İptal')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
