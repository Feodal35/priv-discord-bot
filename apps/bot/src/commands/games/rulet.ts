import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK_NUMBERS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

export const ruletCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rulet')
    .setDescription('Şansını Rulet çarkında dene ve coin kazan!')
    .addIntegerOption((opt) =>
      opt
        .setName('bahis')
        .setDescription('Yatırmak istediğiniz coin miktarı (Minimum 10)')
        .setMinValue(10)
        .setMaxValue(100000)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('renk')
        .setDescription('Oynamak istediğiniz renk (Kırmızı: 2x, Siyah: 2x, Yeşil: 14x)')
        .addChoices(
          { name: '🔴 Kırmızı (2x Kazanç)', value: 'red' },
          { name: '⚫ Siyah (2x Kazanç)', value: 'black' },
          { name: '🟢 Yeşil (0 - 14x Kazanç)', value: 'green' }
        )
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('sayı')
        .setDescription('Doğrudan sayı tahmini (0-36) (Tam 36x Kazanç!)')
        .setMinValue(0)
        .setMaxValue(36)
        .setRequired(false)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut yalnızca sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const bet = interaction.options.getInteger('bahis', true);
    const colorPick = interaction.options.getString('renk');
    const numberPick = interaction.options.getInteger('sayı');

    if (!colorPick && numberPick === null) {
      await interaction.reply({
        embeds: [createErrorEmbed('Eksik Seçim', 'Lütfen ya bir **renk** ya da bir **sayı** seçin!')],
        ephemeral: true,
      });
      return;
    }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const balance = await economyService.getBalance(guildId, userId);
    if (balance.coins < bet) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Yetersiz Bakiye',
            `Rulet oynamak için \`${formatCurrency(bet)} Coin\` gerekiyor. Mevcut bakiyeniz: \`${formatCurrency(balance.coins)} Coin\``
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // Bahsi düş
    await economyService.modifyBalance(guildId, userId, bet, 'REMOVE', 'Rulet Bahsi');

    // İlk dönme mesajı
    const initialEmbed = createEmbed({
      title: '🎡 Rulet Çarkı Dönüyor...',
      description:
        `💰 **Yatırılan Bahis:** \`${formatCurrency(bet)} Coin\`\n` +
        `🎯 **Tahmininiz:** ${numberPick !== null ? `\`Sayı ${numberPick}\` (36x)` : colorPick === 'red' ? '🔴 Kırmızı (2x)' : colorPick === 'black' ? '⚫ Siyah (2x)' : '🟢 Yeşil (14x)'}\n\n` +
        `*Top çarkta dönüyor... ⚪*`,
      color: 0xf1c40f,
    });

    await interaction.reply({ embeds: [initialEmbed] });

    // 1.5 saniye bekle
    await new Promise((r) => setTimeout(r, 1500));

    // Sonuç hesapla (0-36)
    const winningNumber = Math.floor(Math.random() * 37);
    let winningColor: 'red' | 'black' | 'green' = 'green';
    let colorEmoji = '🟢';

    if (winningNumber === 0) {
      winningColor = 'green';
      colorEmoji = '🟢';
    } else if (RED_NUMBERS.has(winningNumber)) {
      winningColor = 'red';
      colorEmoji = '🔴';
    } else {
      winningColor = 'black';
      colorEmoji = '⚫';
    }

    let isWin = false;
    let multiplier = 0;

    if (numberPick !== null) {
      if (numberPick === winningNumber) {
        isWin = true;
        multiplier = 36;
      }
    } else if (colorPick) {
      if (colorPick === winningColor) {
        isWin = true;
        multiplier = colorPick === 'green' ? 14 : 2;
      }
    }

    let resultDesc = '';
    let resultColor: any = DEFAULT_COLORS.DANGER;

    if (isWin) {
      const winAmount = bet * multiplier;
      await economyService.modifyBalance(guildId, userId, winAmount, 'ADD', 'Rulet Kazancı');
      resultColor = DEFAULT_COLORS.SUCCESS;
      resultDesc =
        `🎉 **TEBRİKLER KAZANDIN!**\n\n` +
        `🎲 **Gelen Sonuç:** ${colorEmoji} **${winningNumber}** (${winningColor === 'red' ? 'Kırmızı' : winningColor === 'black' ? 'Siyah' : 'Yeşil'})\n` +
        `💸 **Çarpan:** \`${multiplier}x\`\n` +
        `💰 **Kazanılan Net Tutar:** \`+${formatCurrency(winAmount)} Coin\``;
    } else {
      resultDesc =
        `💀 **KAYBETTİN!**\n\n` +
        `🎲 **Gelen Sonuç:** ${colorEmoji} **${winningNumber}** (${winningColor === 'red' ? 'Kırmızı' : winningColor === 'black' ? 'Siyah' : 'Yeşil'})\n` +
        `💸 **Kaybedilen Bahis:** \`-${formatCurrency(bet)} Coin\`\n\n` +
        `*Şansını bir sonraki turda tekrar dene!*`;
    }

    const finalEmbed = createEmbed({
      title: isWin ? '🎡 Rulet — Zafer!' : '🎡 Rulet — Sonuç',
      description: resultDesc,
      color: resultColor,
      footer: { text: 'Vip Metro • Kumar & Şans Oyunları' },
    });

    await interaction.editReply({ embeds: [finalEmbed] });
  },
};
