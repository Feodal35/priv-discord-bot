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
import { DEFAULT_COLORS } from '@priv/shared';

const PAGE_SIZE = 8;

const ITEM_EMOJIS: Record<string, string> = {
  ROLE: '🎭',
  XP_BOOST: '⚡',
  BADGE: '🏅',
  RING: '💍',
  CUSTOM: '🎁',
};

export const envanterCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('envanter')
    .setDescription('Sahip olduğun eşyaları ve rolleri listeler.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Envanterini görmek istediğin üye').setRequired(false)),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser('üye') || interaction.user;
    const inventory = await shopService.getInventory(interaction.guild.id, targetUser.id);

    if (inventory.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(DEFAULT_COLORS.SECONDARY as any)
        .setTitle(`🎒 ${targetUser.username} — Envanter`)
        .setDescription(
          targetUser.id === interaction.user.id
            ? '> Envantern şu an boş.\n\n💡 `/market` komutunu kullanarak sunucu mağazasından ürün alabilirsin!'
            : `> **${targetUser.username}** henüz hiçbir eşyaya sahip değil.`
        )
        .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const totalPages = Math.ceil(inventory.length / PAGE_SIZE);
    const page = 0;

    const buildEmbed = (p: number) => {
      const start = p * PAGE_SIZE;
      const pageItems = inventory.slice(start, start + PAGE_SIZE);

      const lines = pageItems.map((inv, idx) => {
        const globalIdx = start + idx + 1;
        const typeEmoji = ITEM_EMOJIS[inv.item.type] || '📦';
        const dateStr = inv.purchasedAt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
        const qty = inv.quantity > 1 ? ` **(x${inv.quantity})**` : '';
        return (
          `**${globalIdx}. ${typeEmoji} ${inv.item.name}**${qty}\n` +
          `> ${inv.item.description}\n` +
          `> 📅 *Satın alındı: ${dateStr}*`
        );
      });

      return new EmbedBuilder()
        .setColor(DEFAULT_COLORS.PRIMARY as any)
        .setTitle(`🎒 ${targetUser.username} — Envanter`)
        .setDescription(lines.join('\n\n'))
        .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
        .setFooter({
          text: `Sayfa ${p + 1}/${totalPages} • Toplam ${inventory.length} eşya`,
        });
    };

    const buildNav = (p: number) => {
      const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`inv_prev_${targetUser.id}_${p - 1}`)
          .setLabel('◀ Önceki')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(p === 0),
        new ButtonBuilder()
          .setCustomId(`inv_page_${p}`)
          .setLabel(`📦 ${p + 1} / ${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`inv_next_${targetUser.id}_${p + 1}`)
          .setLabel('Sonraki ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(p >= totalPages - 1)
      );
      return [navRow];
    };

    await interaction.editReply({
      embeds: [buildEmbed(page)],
      components: totalPages > 1 ? buildNav(page) : [],
    });
  },
};
