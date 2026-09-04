import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createSuccessEmbed } from '../../utils/embed';

export const kilitleCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kilitle')
    .setDescription('Bulunulan kanalı üyelerin mesaj yazmasına kilitler.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Bu komut sadece metin kanallarında kullanılabilir.', ephemeral: true });
      return;
    }

    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false,
    });

    await interaction.reply({
      embeds: [createSuccessEmbed('Kanal Kilitlendi', '🔒 Bu kanal yetkililer haricindeki üyelerin mesaj yazmasına kilitlendi.')],
    });
  },
};
