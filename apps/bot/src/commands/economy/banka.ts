import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { guildService } from '../../services/guild.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

export const bankaCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('banka')
    .setDescription('Banka hesabına para yatırır veya bankadan para çeker.')
    .addSubcommand((sub) =>
      sub
        .setName('yatır')
        .setDescription('Cüzdanındaki parayı güvenli banka kasasına aktarır (Soygunlara karşı korur).')
        .addStringOption((opt) =>
          opt
            .setName('miktar')
            .setDescription('Yatırmak istediğin miktar veya "hepsi"')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('çek')
        .setDescription('Banka kasandaki parayı cüzdanına çeker.')
        .addStringOption((opt) =>
          opt
            .setName('miktar')
            .setDescription('Çekmek istediğin miktar veya "hepsi"')
            .setRequired(true)
        )
    ),
  cooldown: 3,
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
    const subcommand = interaction.options.getSubcommand();
    const rawAmount = interaction.options.getString('miktar', true).trim().toLowerCase();
    const settings = await guildService.getGuildSettings(guildId);

    if (!settings.economyEnabled) {
      await interaction.reply({
        embeds: [createErrorEmbed('Ekonomi Devre Dışı', 'Bu sunucuda ekonomi sistemi kapalı.')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const isAll = rawAmount === 'hepsi' || rawAmount === 'all' || rawAmount === 'tümü';
    let numericAmount = 0;

    if (!isAll) {
      numericAmount = parseInt(rawAmount.replace(/[.,]/g, ''), 10);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              'Geçersiz Miktar',
              'Lütfen geçerli bir sayı girin ya da tüm paranız için `hepsi` yazın.\nÖrn: `/banka yatır 1000` veya `/banka yatır hepsi`'
            ),
          ],
        });
        return;
      }
    }

    if (subcommand === 'yatır') {
      const res = await economyService.depositToBank(guildId, userId, isAll ? 'all' : numericAmount);
      if (!res.success) {
        await interaction.editReply({
          embeds: [createErrorEmbed('İşlem Başarısız', res.message)],
        });
        return;
      }

      const embed = createEmbed({
        title: '🏦 Bankaya Para Yatırıldı!',
        description:
          `Başarıyla **${formatCurrency(res.deposited!)} ${settings.currencyName}** banka kasana aktarıldı!\n\n` +
          `🔒 **Banka Bakiyen:** ${formatCurrency(res.bankCoins!)} ${settings.currencyName}\n` +
          `👛 **Kalan Cüzdan:** ${formatCurrency(res.coins!)} ${settings.currencyName}\n\n` +
          `💡 *Bankadaki paranız diğer üyeler tarafından \`/soy\` komutuyla ASLA çalınamaz!*`,
        color: DEFAULT_COLORS.SUCCESS as any,
        footer: { text: 'Priv Metro Bankası • Güvenli Yatırım' },
      });

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'çek') {
      const res = await economyService.withdrawFromBank(guildId, userId, isAll ? 'all' : numericAmount);
      if (!res.success) {
        await interaction.editReply({
          embeds: [createErrorEmbed('İşlem Başarısız', res.message)],
        });
        return;
      }

      const embed = createEmbed({
        title: '💳 Bankadan Para Çekildi!',
        description:
          `Başarıyla bankadan **${formatCurrency(res.withdrawn!)} ${settings.currencyName}** çektin!\n\n` +
          `👛 **Güncel Cüzdan:** ${formatCurrency(res.coins!)} ${settings.currencyName}\n` +
          `🔒 **Kalan Banka:** ${formatCurrency(res.bankCoins!)} ${settings.currencyName}\n\n` +
          `⚠️ *Dikkat: Cüzdandaki paranız diğer üyeler tarafından soyulma riskine açıktır!*`,
        color: DEFAULT_COLORS.PRIMARY as any,
        footer: { text: 'Priv Metro Bankası • Hızlı Çekim' },
      });

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
