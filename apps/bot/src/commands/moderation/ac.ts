import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createSuccessEmbed } from '../../utils/embed';

export const acCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('aç')
    .setDescription('Kilitlenmiş olan kanalın mesaj kilidini açar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Bu komut sadece metin kanallarında kullanılabilir.', ephemeral: true });
      return;
    }

    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null,
    });

    await interaction.reply({
      embeds: [createSuccessEmbed('Kanal Kilidi Açıldı', '🔓 Kanal kilidi açıldı! Artık üyeler mesaj gönderebilir.')],
    });
  },
};
