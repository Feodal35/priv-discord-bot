import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { moderationService } from '../../services/moderation.service';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const temizleCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('temizle')
    .setDescription('Kanaldaki belirtilen sayıda mesajı toplu olarak siler.')
    .addIntegerOption((opt) => opt.setName('sayı').setDescription('Silinecek mesaj sayısı (1-100)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.channel || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Bu komut sadece sunucu metin kanallarında kullanılabilir.', ephemeral: true });
      return;
    }

    const count = interaction.options.getInteger('sayı', true);

    if (count < 1 || count > 100) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Sayı', 'Lütfen 1 ile 100 arasında bir sayı girin.')],
        ephemeral: true,
      });
      return;
    }

    try {
      const deletedCount = await moderationService.clearMessages(interaction.channel, count);
      await interaction.reply({
        embeds: [createSuccessEmbed('Mesajlar Temizlendi', `🧹 Kanaldan başarıyla **${deletedCount} adet** mesaj silindi.`)],
        ephemeral: true,
      });
    } catch (err) {
      await interaction.reply({
        embeds: [createErrorEmbed('Temizleme Başarısız', '14 günden eski mesajlar Discord kısıtlamaları gereği toplu silinemez.')],
        ephemeral: true,
      });
    }
  },
};
