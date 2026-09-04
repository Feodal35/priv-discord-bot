import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { birthdayService, DEFAULT_BIRTHDAY_CHANNEL_ID } from '../../services/birthday.service';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const dogumgunuCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('doğumgünü')
    .setDescription('Doğum gününü kaydeder. Günü geldiğinde ana sohbette kutlama yapılır!')
    .addIntegerOption((opt) => opt.setName('gün').setDescription('Doğduğun gün (1-31)').setRequired(true))
    .addIntegerOption((opt) => opt.setName('ay').setDescription('Doğduğun ay (1-12)').setRequired(true)),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const day = interaction.options.getInteger('gün', true);
    const month = interaction.options.getInteger('ay', true);

    const result = await birthdayService.setBirthday(interaction.guild.id, interaction.user.id, day, month);

    if (!result.success) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Tarih', result.message)],
        ephemeral: true,
      });
      return;
    }

    const embed = createSuccessEmbed(
      '🎂 Doğum Günü Kaydedildi!',
      `${result.message}\n\n🎉 Günü geldiğinde <#${DEFAULT_BIRTHDAY_CHANNEL_ID}> kanalında senin için özel bir kutlama yapılacak ve hediye coinlerin verilecek!`
    );

    await interaction.reply({
      embeds: [embed],
    });
  },
};
