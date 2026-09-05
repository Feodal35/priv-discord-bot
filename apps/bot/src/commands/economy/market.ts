import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { shopService } from '../../services/shop.service';
import { guildService } from '../../services/guild.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

const PAGE_SIZE = 5;

function buildMarketEmbed(
  items: Awaited<ReturnType<typeof shopService.getShopItems>>,
  page: number,
  guildName: string,
  currencyName: string,
  currencyEmoji: string
): EmbedBuilder {
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  const ITEM_EMOJIS: Record<string, string> = {
    ROLE: '🎭',
    XP_BOOST: '⚡',
    BADGE: '🏅',
    RING: '💍',
    CUSTOM: '🎁',
  };

  const STOCK_COLORS = (stock: number) => {
    if (stock === -1) return '🟢'; // Sınırsız
    if (stock > 10) return '🟢';
    if (stock > 0) return '🟡';
    return '🔴';
  };

  const description = pageItems.map((item, idx) => {
    const globalIdx = start + idx + 1;
    const stockText = item.stock === -1 ? 'Sınırsız' : `${item.stock} Adet`;
    const stockColor = STOCK_COLORS(item.stock);
    const typeEmoji = ITEM_EMOJIS[item.type] || '📦';

    return (
      `**${globalIdx}. ${typeEmoji} ${item.name}**\n` +
      `> ${item.description}\n` +
      `> 💰 **Fiyat:** \`${formatCurrency(item.price)} ${currencyName}\`\n` +
      `> ${stockColor} **Stok:** \`${stockText}\``
    );
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🛒 ${guildName} — Sunucu Marketi`)
    .setDescription(description || 'Bu sayfada ürün yok.')
    .setFooter({ text: `Sayfa ${page + 1}/${totalPages} • Toplam ${items.length} ürün • ${currencyEmoji} ${currencyName}` })
    .setTimestamp();
}

function buildMarketButtons(
  items: Awaited<ReturnType<typeof shopService.getShopItems>>,
  page: number
): ActionRowBuilder<ButtonBuilder>[] {
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // Satın alma butonları
  const buyRow = new ActionRowBuilder<ButtonBuilder>();
  pageItems.forEach((item) => {
    buyRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_buy_${item.id}`)
        .setLabel(`Satın Al`)
        .setEmoji('🛍️')
        .setStyle(item.stock === 0 ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(item.stock === 0)
    );
  });

  // Pad butonlar (max 5)
  while (buyRow.components.length < pageItems.length) {
    // already added in forEach
  }

  if (buyRow.components.length > 0) rows.push(buyRow);

  // Navigasyon satırı
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`market_prev_${page - 1}`)
      .setLabel('◀ Önceki')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`market_page_${page}`)
      .setLabel(`📄 ${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`market_next_${page + 1}`)
      .setLabel('Sonraki ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );

  rows.push(navRow);
  return rows;
}

export const marketCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Sunucu mağazasını görüntüler ve ürün satın alma seçenekleri sunar.'),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const items = await shopService.getShopItems(interaction.guild.id);
    const settings = await guildService.getGuildSettings(interaction.guild.id);

    if (items.length === 0) {
      const embed = createEmbed({
        title: '🛒 Sunucu Marketi',
        description:
          '> Henüz markete bir ürün eklenmemiş.\n\nSunucu yöneticisi dashboard üzerinden veya `/ayarlar` ile ürün ekleyebilir.',
        color: DEFAULT_COLORS.WARNING,
      });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = buildMarketEmbed(items, 0, interaction.guild.name, settings.currencyName, settings.currencyEmoji);
    const rows = buildMarketButtons(items, 0);

    await interaction.editReply({ embeds: [embed], components: rows });
  },
};
