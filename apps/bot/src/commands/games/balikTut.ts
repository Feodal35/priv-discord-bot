import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { questService } from '../../services/quest.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

interface CatchItem {
  name: string;
  emoji: string;
  reward: number;
  weight: number;
  rarityText: string;
  color: number;
}

const CATCH_TABLE: CatchItem[] = [
  { name: 'Hamsi', emoji: '🐟', reward: 50, weight: 35, rarityText: 'Yaygın', color: 0x3498db },
  { name: 'Palyaço Balığı', emoji: '🐠', reward: 200, weight: 25, rarityText: 'Sıradan', color: 0x2ecc71 },
  { name: 'Balon Balığı', emoji: '🐡', reward: 50, weight: 15, rarityText: 'Nadir', color: 0xf39c12 },
  { name: 'Kral Istakoz', emoji: '🦞', reward: 1000, weight: 10, rarityText: 'Epik', color: 0xe74c3c },
  { name: 'Büyük Beyaz Köpekbalığı', emoji: '🦈', reward: 2500, weight: 4, rarityText: 'Efsanevi', color: 0x9b59b6 },
  { name: 'Dev Mavi Balina', emoji: '🐳', reward: 10000, weight: 1, rarityText: 'JACKPOT / MİTİK', color: 0x00ffff },
  { name: 'Eski Çizme', emoji: '👢', reward: -10, weight: 8, rarityText: 'Çöp', color: 0x7f8c8d },
  { name: 'Paslı Konserve Kutusu', emoji: '🥫', reward: 0, weight: 7, rarityText: 'Çöp', color: 0x95a5a6 },
];

function getRandomCatch(): CatchItem {
  const totalWeight = CATCH_TABLE.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of CATCH_TABLE) {
    if (random < item.weight) {
      return item;
    }
    random -= item.weight;
  }

  return CATCH_TABLE[0];
}

export const balikTutCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('balık-tut')
    .setDescription('Oltanı denize fırlatarak şansına balık tut ve coin kazan!'),
  cooldown: 20,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda geçerlidir.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // 1. Olta fırlatma animasyon mesajı
    const castingEmbed = createEmbed({
      title: '🎣 Balık Avı Başladı!',
      description:
        `🌊 <@${userId}> oltasını denizin derin sularına fırlattı!\n\n` +
        `〰️〰️〰️〰️〰️〰️🎣〰️〰️〰️〰️〰️〰️\n\n` +
        `*Şamandıra hafifçe kıpırdıyor, bekleniyor...*`,
      color: 0x3498db,
    });

    await interaction.reply({ embeds: [castingEmbed] });

    // 2. 2.3 saniye heyecanlı bekleme
    await new Promise((resolve) => setTimeout(resolve, 2300));

    // 3. Rastgele avı belirle
    const caught = getRandomCatch();

    // Bakiye ve görev güncellemesi
    if (caught.reward > 0) {
      await economyService.modifyBalance(guildId, userId, caught.reward, 'ADD', `Balık tutma: ${caught.name}`);
    } else if (caught.reward < 0) {
      await economyService.modifyBalance(guildId, userId, Math.abs(caught.reward), 'REMOVE', 'Eski çizme temizleme masrafı');
    }

    await questService.incrementProgress(guildId, userId, 'PLAY_GAME', 1).catch(() => {});

    // 4. Sonuç Embed'i
    let resultDesc = '';
    if (caught.reward > 0) {
      resultDesc =
        `🎉 **Tebrikler!** Oltana harika bir av takıldı!\n\n` +
        `**Yakaladığın:** ${caught.emoji} **${caught.name}**\n` +
        `**Nadirlik:** \`${caught.rarityText}\`\n` +
        `**Kazanç:** **+${formatCurrency(caught.reward)} Coin** 🪙`;
    } else if (caught.reward < 0) {
      resultDesc =
        `😅 **Ah be!** Oltana balık yerine çöp takıldı!\n\n` +
        `**Yakaladığın:** ${caught.emoji} **${caught.name}**\n` +
        `**Sonuç:** Oltan yıprandı, **${formatCurrency(Math.abs(caught.reward))} Coin** masraf çıktı.`;
    } else {
      resultDesc =
        `🤔 **Boş Çıktı!**\n\n` +
        `**Yakaladığın:** ${caught.emoji} **${caught.name}**\n` +
        `**Sonuç:** Denizden paslı bir teneke kutu çektin. Ne kazandın ne kaybettin!`;
    }

    const resultEmbed = createEmbed({
      title: `${caught.emoji} Balık Avı Sonucu`,
      description: resultDesc,
      color: caught.color,
    });

    await interaction.editReply({ embeds: [resultEmbed] }).catch(() => {});
  },
};
