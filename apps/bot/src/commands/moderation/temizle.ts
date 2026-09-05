import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { moderationService } from '../../services/moderation.service';
import { createErrorEmbed } from '../../utils/embed';

export const temizleCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('temizle')
    .setDescription('Kanaldaki belirtilen sayıda mesajı toplu olarak siler.')
    .addIntegerOption((opt) =>
      opt
        .setName('sayı')
        .setDescription('Silinecek mesaj sayısı (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption((opt) =>
      opt
        .setName('üye')
        .setDescription('Sadece bu üyenin mesajlarını sil (isteğe bağlı)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.channel || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: 'Bu komut sadece sunucu metin kanallarında kullanılabilir.', flags: MessageFlags.Ephemeral });
      return;
    }

    const count = interaction.options.getInteger('sayı', true);
    const targetUser = interaction.options.getUser('üye');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      let deletedCount = 0;

      if (targetUser) {
        // Belirli üyenin mesajlarını sil
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const userMessages = messages.filter((m) => m.author.id === targetUser.id).first(count);
        const deleted = await interaction.channel.bulkDelete(userMessages, true);
        deletedCount = deleted.size;
      } else {
        deletedCount = await moderationService.clearMessages(interaction.channel, count);
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🧹 Mesajlar Temizlendi')
        .setDescription(
          `**${deletedCount}** adet mesaj başarıyla silindi.` +
          (targetUser ? `\n\n👤 **Filtre:** ${targetUser} kullanıcısının mesajları` : '')
        )
        .addFields(
          { name: '📋 Kanal', value: `${interaction.channel}`, inline: true },
          { name: '👮 Yetkili', value: `${interaction.user}`, inline: true },
          { name: '🗑️ Silinen', value: `${deletedCount} mesaj`, inline: true },
        )
        .setFooter({ text: '14 günden eski mesajlar Discord kısıtlamaları gereği toplu silinemez.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Temizleme Başarısız', '14 günden eski mesajlar Discord kısıtlamaları gereği toplu silinemez.')],
      });
    }
  },
};
