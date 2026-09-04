import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { shopService } from '../../services/shop.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, EMOJIS } from '@priv/shared';

export const envanterCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('envanter')
    .setDescription('Sahip olduğun eşyaları ve rolleri listeler.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Envanterini görmek istediğin üye').setRequired(false)),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('üye') || interaction.user;
    const inventory = await shopService.getInventory(interaction.guild.id, targetUser.id);

    if (inventory.length === 0) {
      const embed = createEmbed({
        title: `${EMOJIS.INVENTORY} ${targetUser.username} — Envanter`,
        description: 'Envanterin şu an boş. `/market` komutunu kullanarak sunucu mağazasından ürün alabilirsin!',
        color: DEFAULT_COLORS.SECONDARY,
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const fields = inventory.map((inv, idx) => ({
      name: `${idx + 1}. ${inv.item.name} (x${inv.quantity})`,
      value: `*${inv.item.description}*\nSatın Alma: ${inv.purchasedAt.toLocaleDateString('tr-TR')}`,
      inline: false,
    }));

    const embed = createEmbed({
      title: `${EMOJIS.INVENTORY} ${targetUser.username} — Envanter`,
      description: `Toplam ${inventory.length} farklı eşyaya sahipsin:`,
      color: DEFAULT_COLORS.PRIMARY,
      fields,
    });

    await interaction.reply({ embeds: [embed] });
  },
};
