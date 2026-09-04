import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { blackjackService } from '../../services/blackjack.service';
import { economyService } from '../../services/economy.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

export const blackjackCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Krupiyeye karşı Blackjack (21) oynar.')
    .addIntegerOption((opt) =>
      opt
        .setName('bahis')
        .setDescription('Yatırmak istediğiniz coin miktarı (Minimum 10)')
        .setMinValue(10)
        .setMaxValue(100000)
        .setRequired(true)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut yalnızca sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const bet = interaction.options.getInteger('bahis', true);
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const balance = await economyService.getBalance(guildId, userId);
    if (balance.coins < bet) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Yetersiz Bakiye',
            `Bu oyunu oynamak için \`${formatCurrency(bet)} Coin\` gerekiyor. Mevcut bakiyeniz: \`${formatCurrency(balance.coins)} Coin\``
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // Bahsi düş
    await economyService.modifyBalance(guildId, userId, bet, 'REMOVE', 'Blackjack Bahsi');

    const game = blackjackService.createGame(userId, guildId, bet);
    const pScore = blackjackService.calculateScore(game.playerCards);
    const dScore = blackjackService.calculateScore([game.dealerCards[0]]);

    if (game.isFinished) {
      // Doğal Blackjack kazancı (2.5x)
      const winAmount = Math.floor(bet * 2.5);
      await economyService.modifyBalance(guildId, userId, winAmount, 'ADD', 'Blackjack 21 Kazancı');

      const embed = createEmbed({
        title: '🃏 Blackjack (21) — Sonuç',
        description:
          `**Senin Elin:** ${blackjackService.formatHand(game.playerCards)} (\`${pScore}\`)\n` +
          `**Krupiyenin Eli:** ${blackjackService.formatHand(game.dealerCards)} (\`${blackjackService.calculateScore(game.dealerCards)}\`)\n\n` +
          `${game.statusText}\n\n` +
          `💰 **Kazanılan:** \`+${formatCurrency(winAmount)} Coin\``,
        color: DEFAULT_COLORS.SUCCESS,
      });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const embed = createEmbed({
      title: '🃏 Blackjack (21)',
      description:
        `**Senin Elin:** ${blackjackService.formatHand(game.playerCards)} (\`${pScore}\`)\n` +
        `**Krupiyenin Eli:** ${blackjackService.formatHand(game.dealerCards, true)} (\`${dScore} + ?\`)\n\n` +
        `💰 **Mevcut Bahis:** \`${formatCurrency(bet)} Coin\`\n\n` +
        `Kart çekmek için **Kart Çek (Hit)**, elinizde kalmak için **Pas (Stand)** butonuna basın!`,
      color: DEFAULT_COLORS.PRIMARY,
    });
    embed.setFooter({ text: 'Vip Metro • Kumar & Şans Oyunları' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_hit_${game.id}`)
        .setLabel('Kart Çek (Hit)')
        .setEmoji('🃏')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`bj_stand_${game.id}`)
        .setLabel('Pas (Stand)')
        .setEmoji('🛑')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
