import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { guildService } from '../../services/guild.service';

export const itirafCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('itiraf')
    .setDescription('Sunucuya tamamen anonim bir itiraf gönderir.'),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const settings = await guildService.getGuildSettings(interaction.guild.id);
    if (!settings.confessionEnabled) {
      await interaction.reply({
        content: '⚠️ Bu sunucuda itiraf sistemi devre dışı bırakılmış.',
        ephemeral: true,
      });
      return;
    }

    if (!settings.confessionChannelId) {
      await interaction.reply({
        content: '⚠️ İtiraf kanalı henüz ayarlanmamış! Sunucu yetkilisine danışın.',
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('confession_modal')
      .setTitle('🤫 Anonim İtiraf Paylaşımı');

    const confessionInput = new TextInputBuilder()
      .setCustomId('confession_text')
      .setLabel('İtirafın (Tamamen anonimdir)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Buraya içini dökmek istediğin şeyi yaz...')
      .setMinLength(10)
      .setMaxLength(1000)
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(confessionInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
  },
};
