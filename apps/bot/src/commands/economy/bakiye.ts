import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { guildService } from '../../services/guild.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

export const bakiyeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('bakiye')
    .setDescription('Cüzdan ve banka bakiyesini görüntüler.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Bakiyesini görmek istediğin üye').setRequired(false)),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const target = interaction.options.getUser('üye') || interaction.user;
    const balance = await economyService.getBalance(interaction.guild.id, target.id);
    const settings = await guildService.getGuildSettings(interaction.guild.id);

    const embed = createEmbed({
      title: `${settings.currencyEmoji} ${target.username} — Bakiye Durumu`,
      thumbnail: target.displayAvatarURL(),
      color: DEFAULT_COLORS.GOLD,
      fields: [
        {
          name: 'Cüzdan',
          value: `**${formatCurrency(balance.coins)} ${settings.currencyName}**`,
          inline: true,
        },
        {
          name: 'Banka',
          value: `**${formatCurrency(balance.bankCoins)} ${settings.currencyName}**`,
          inline: true,
        },
        {
          name: 'Toplam Varlık',
          value: `**${formatCurrency(balance.total)} ${settings.currencyName}**`,
          inline: true,
        },
      ],
      footer: {
        text: '/günlük ve /çalış komutlarıyla para kazanabilirsin!',
      },
    });

    await interaction.reply({ embeds: [embed] });
  },
};
