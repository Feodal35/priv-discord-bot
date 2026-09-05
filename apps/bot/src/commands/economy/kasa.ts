import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { guildService } from '../../services/guild.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const kasaCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kasa-aç')
    .setDescription('Gizemli sandık ve kasaları açarak büyük ödüller kazanırsın.')
    .addStringOption((opt) =>
      opt
        .setName('kasa')
        .setDescription('Açmak istediğin kasa türü')
        .setRequired(true)
        .addChoices(
          { name: '🥉 Bronz Kasa (1.000 Coin)', value: 'BRONZE' },
          { name: '🥈 Gümüş Kasa (5.000 Coin)', value: 'SILVER' },
          { name: '💎 Elmas Kasa (25.000 Coin)', value: 'DIAMOND' }
        )
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Bu komut yalnızca sunucularda kullanılabilir.',
        ephemeral: true,
      });
      return;
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const boxType = interaction.options.getString('kasa', true) as 'BRONZE' | 'SILVER' | 'DIAMOND';
    const settings = await guildService.getGuildSettings(guildId);

    if (!settings.economyEnabled) {
      await interaction.reply({
        embeds: [createErrorEmbed('Ekonomi Devre Dışı', 'Bu sunucuda ekonomi sistemi kapalı.')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const boxMeta = {
      BRONZE: { name: 'Bronz Kasa', color: 0xcd7f32, emoji: '🥉' },
      SILVER: { name: 'Gümüş Kasa', color: 0xc0c0c0, emoji: '🥈' },
      DIAMOND: { name: 'Elmas Kasa', color: 0x00f0ff, emoji: '💎' },
    }[boxType];

    // 1. Aşama Animasyonu: Kilit zorlanıyor
    const step1 = createEmbed({
      title: `${boxMeta.emoji} ${boxMeta.name} Açılıyor...`,
      description:
        `\`[■■□□□□□□□□]\` **%20**\n\n` +
        `⚙️ *Anahtar yuvaya oturtuluyor ve mekanizma zorlanıyor...*`,
      color: boxMeta.color as any,
    });

    await interaction.editReply({ embeds: [step1] });
    await sleep(1000);

    // 2. Aşama Animasyonu: Menteşeler
    const step2 = createEmbed({
      title: `${boxMeta.emoji} ${boxMeta.name} Açılıyor...`,
      description:
        `\`[■■■■■■□□□□]\` **%60**\n\n` +
        `🔓 *Kilit mandalları attı, menteşeler gıcırdıyor...*`,
      color: boxMeta.color as any,
    });

    await interaction.editReply({ embeds: [step2] });
    await sleep(1000);

    // 3. Aşama Animasyonu: Işıklar yükseliyor
    const step3 = createEmbed({
      title: `${boxMeta.emoji} ${boxMeta.name} Açılıyor...`,
      description:
        `\`[■■■■■■■■■■]\` **%100**\n\n` +
        `✨ *Kasa kapağı aralandı! İçeriden göz kamaştırıcı ışıklar parlıyor...*`,
      color: boxMeta.color as any,
    });

    await interaction.editReply({ embeds: [step3] });
    await sleep(1000);

    // Ödülü aç ve sonuçlandır
    const result = await economyService.openLootbox(guildId, userId, boxType);

    if (!result.success) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Kasa Açılamadı', result.message)],
      });
      return;
    }

    let resultDescription =
      `🎉 <@${userId}>, **${result.boxName}** içerisinden harika bir ödül buldun!\n\n` +
      `📦 **Açılan Kasa:** ${boxMeta.emoji} ${result.boxName}\n` +
      (result.paidFromInventory ? `🎒 *Envanterindeki kasa kullanıldı.*\n\n` : `🪙 *Maliyet:* ${formatCurrency(result.cost)} ${settings.currencyName}\n\n`) +
      `🎁 **KAZANILAN ÖDÜL:**\n> ${result.rewardText}\n\n`;

    if (result.coinsWon > 0) {
      resultDescription += `🪙 **Kazanılan Para:** +${formatCurrency(result.coinsWon)} ${settings.currencyName}\n`;
    }
    if (result.xpWon > 0) {
      resultDescription += `⚡ **Kazanılan XP:** +${formatCurrency(result.xpWon)} XP\n`;
    }
    if (result.itemsWon.length > 0) {
      resultDescription += `🎒 **Kazanılan Eşyalar:** ${result.itemsWon.join(', ')} (Envanterine eklendi!)\n`;
    }

    const finalEmbed = createEmbed({
      title: result.isJackpot
        ? `🔥 JACKPOT PATLADI! — ${result.boxName}`
        : `✨ Kasa Başarıyla Açıldı! — ${result.boxName}`,
      description: resultDescription,
      color: result.isJackpot ? (DEFAULT_COLORS.GOLD as any) : (boxMeta.color as any),
      footer: { text: 'Kasaları /market üzerinden alabilir veya doğrudan açabilirsin!' },
    });

    await interaction.editReply({ embeds: [finalEmbed] });
  },
};
