import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { questService } from '../../services/quest.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

interface SlotSymbol {
  name: string;
  emoji: string;
  weight: number;
  tripleMultiplier: number;
}

const SYMBOLS: SlotSymbol[] = [
  { name: 'Kiraz', emoji: '🍒', weight: 32, tripleMultiplier: 3 },
  { name: 'Limon', emoji: '🍋', weight: 26, tripleMultiplier: 5 },
  { name: 'Üzüm', emoji: '🍇', weight: 20, tripleMultiplier: 8 },
  { name: 'Elmas', emoji: '💎', weight: 12, tripleMultiplier: 15 },
  { name: 'Yedi', emoji: '7️⃣', weight: 8, tripleMultiplier: 30 },
];

function spinReel(): SlotSymbol {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const s of SYMBOLS) {
    if (rand < s.weight) return s;
    rand -= s.weight;
  }
  return SYMBOLS[0];
}

export const slotCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('slot')
    .setDescription('Las Vegas tarzı 3 çarklı slot makinesinde şansını dene!')
    .addIntegerOption((opt) =>
      opt
        .setName('bahis')
        .setDescription('Koymak istediğin bahis miktarı (En az: 50 Coin)')
        .setRequired(true)
        .setMinValue(50)
        .setMaxValue(50000)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda geçerlidir.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const bet = interaction.options.getInteger('bahis', true);

    const balance = await economyService.getBalance(guildId, userId);
    if (balance.coins < bet) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Yetersiz Bakiye',
            `Cüzdanında bu bahis için yeterli coin bulunmuyor!\n\n` +
            `• Gerekli Bahis: **${formatCurrency(bet)} Coin**\n` +
            `• Mevcut Bakiyen: **${formatCurrency(balance.coins)} Coin**`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // Bahsi baştan düş
    await economyService.modifyBalance(guildId, userId, bet, 'REMOVE', `Slot bahsi (${bet} Coin)`);

    // 1. Dönen Çark Animasyonu
    const spinningEmbed = createEmbed({
      title: '🎰 VIP Metro Casino — Slot Makinesi 🎰',
      description:
        `╔═════════════════════╗\n` +
        `║     🔄  |  🔄  |  🔄     ║\n` +
        `╚═════════════════════╝\n\n` +
        `🎲 **Bahis:** \`${formatCurrency(bet)} Coin\`\n` +
        `✨ *Çarklar dönüyor, nefesler tutuldu...*`,
      color: 0xf1c40f,
    });

    await interaction.reply({ embeds: [spinningEmbed] });

    // 2. 1.8 saniye bekle
    await new Promise((resolve) => setTimeout(resolve, 1800));

    // 3. Sonuçları çek
    const r1 = spinReel();
    const r2 = spinReel();
    const r3 = spinReel();

    let winMultiplier = 0;
    let winTitle = '';

    if (r1.emoji === r2.emoji && r2.emoji === r3.emoji) {
      // 3'ü aynı (Büyük Ödül)
      winMultiplier = r1.tripleMultiplier;
      if (r1.emoji === '7️⃣') {
        winTitle = '💥 MEGA JACKPOT! (30x)';
      } else if (r1.emoji === '💎') {
        winTitle = '💎 ELMAS VURGUNU! (15x)';
      } else {
        winTitle = `🎉 ${r1.name.toUpperCase()} KAZANCI! (${winMultiplier}x)`;
      }
    } else if (r1.emoji === r2.emoji || r2.emoji === r3.emoji || r1.emoji === r3.emoji) {
      // 2'si aynı (Teselli Ödülü)
      winMultiplier = 1.5;
      winTitle = '✨ 2 Eşleşme! (1.5x)';
    }

    const wonCoins = Math.floor(bet * winMultiplier);

    // Kazanç varsa cüzdana aktar
    if (wonCoins > 0) {
      await economyService.modifyBalance(guildId, userId, wonCoins, 'ADD', `Slot kazancı (${winTitle})`);
    }

    await questService.incrementProgress(guildId, userId, 'PLAY_GAME', 1).catch(() => {});

    // 4. Sonuç Ekranı
    const netProfit = wonCoins - bet;
    let statusText = '';
    let resultColor: number = DEFAULT_COLORS.DANGER;

    if (wonCoins > 0) {
      resultColor = winMultiplier >= 15 ? 0x00ffff : DEFAULT_COLORS.SUCCESS;
      statusText =
        `🎉 **${winTitle}**\n\n` +
        `• **Kazandığın Toplam:** **+${formatCurrency(wonCoins)} Coin** 🪙\n` +
        `• **Net Kar:** **+${formatCurrency(netProfit)} Coin**`;
    } else {
      statusText =
        `😢 **Kaybettin...**\n\n` +
        `Şans bu sefer yanında değildi! **${formatCurrency(bet)} Coin** kasaya gitti.`;
    }

    const resultEmbed = createEmbed({
      title: '🎰 VIP Metro Casino — Slot Makinesi 🎰',
      description:
        `╔═════════════════════╗\n` +
        `║     ${r1.emoji}  |  ${r2.emoji}  |  ${r3.emoji}     ║\n` +
        `╚═════════════════════╝\n\n` +
        `🎲 **Bahis:** \`${formatCurrency(bet)} Coin\`\n\n` +
        statusText,
      color: resultColor,
    });

    await interaction.editReply({ embeds: [resultEmbed] }).catch(() => {});
  },
};
