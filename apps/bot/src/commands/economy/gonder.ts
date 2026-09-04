import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const gonderCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('gönder')
    .setDescription('Başka bir kullanıcıya güvenli şekilde coin transfer eder.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Coin göndereceğin kullanıcı').setRequired(true))
    .addIntegerOption((opt) => opt.setName('miktar').setDescription('Gönderilecek miktar').setRequired(true))
    .addStringOption((opt) => opt.setName('sebep').setDescription('Transfer açıklaması').setRequired(false)),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('üye', true);
    const amount = interaction.options.getInteger('miktar', true);
    const reason = interaction.options.getString('sebep') || undefined;

    if (targetUser.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Hedef', 'Botlara coin gönderemezsin.')],
        ephemeral: true,
      });
      return;
    }

    const result = await economyService.transferCoins(
      interaction.guild.id,
      interaction.user.id,
      targetUser.id,
      amount,
      reason
    );

    if (!result.success) {
      await interaction.reply({
        embeds: [createErrorEmbed('Transfer Başarısız', result.message)],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [createSuccessEmbed('Transfer Tamamlandı!', result.message)],
    });
  },
};
