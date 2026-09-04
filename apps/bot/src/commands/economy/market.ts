import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { shopService } from '../../services/shop.service';
import { guildService } from '../../services/guild.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, EMOJIS, formatCurrency } from '@priv/shared';

export const marketCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Sunucu mağazasını görüntüler ve ürün satın alma seçenekleri sunar.'),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const items = await shopService.getShopItems(interaction.guild.id);
    const settings = await guildService.getGuildSettings(interaction.guild.id);

    if (items.length === 0) {
      const embed = createEmbed({
        title: `${EMOJIS.SHOP} Sunucu Marketi`,
        description: 'Henüz markete bir ürün eklenmemiş. Sunucu yöneticisi dashboard üzerinden veya `/ayarlar` ile ürün ekleyebilir.',
        color: DEFAULT_COLORS.WARNING,
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const fields = items.map((item, idx) => {
      const stockText = item.stock === -1 ? 'Sınırsız' : `${item.stock} Adet`;
      return {
        name: `${idx + 1}. ${item.name} — ${formatCurrency(item.price)} ${settings.currencyName}`,
        value: `*${item.description}*\nTür: \`${item.type}\` | Stok: \`${stockText}\``,
        inline: false,
      };
    });

    const embed = createEmbed({
      title: `${EMOJIS.SHOP} ${interaction.guild.name} — Sunucu Marketi`,
      description: 'Satın almak istediğin ürünün altındaki butona tıkla:',
      color: DEFAULT_COLORS.GOLD,
      fields,
      footer: { text: `Para birimi: ${settings.currencyName} (${settings.currencyEmoji})` },
    });

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();

    items.slice(0, 10).forEach((item, idx) => {
      if (idx > 0 && idx % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
      }

      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_buy_${item.id}`)
          .setLabel(`Satın Al: ${item.name.slice(0, 15)}`)
          .setStyle(ButtonStyle.Success)
      );
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    await interaction.reply({ embeds: [embed], components: rows });
  },
};
