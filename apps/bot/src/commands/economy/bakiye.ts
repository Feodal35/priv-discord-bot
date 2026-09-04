import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { guildService } from '../../services/guild.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';
import { createBalanceCard } from '../../utils/canvas';

export const bakiyeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('bakiye')
    .setDescription('Cüzdan ve banka bakiyesini görüntüler.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Bakiyesini görmek istediğin üye').setRequired(false)),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const target = interaction.options.getUser('üye') || interaction.user;
    const balance = await economyService.getBalance(interaction.guild.id, target.id);
    const settings = await guildService.getGuildSettings(interaction.guild.id);

    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createBalanceCard({
        avatarUrl:    target.displayAvatarURL({ extension: 'png', size: 256 }),
        username:     target.username,
        coins:        balance.coins,
        bankCoins:    balance.bankCoins,
        total:        balance.total,
        currencyName: settings.currencyName,
        currencyEmoji: settings.currencyEmoji,
      });
    } catch (err) {
      console.error('[BAKİYE] Canvas hatası:', err);
    }

    const embed = createEmbed({
      title: `${settings.currencyEmoji} ${target.username} — Bakiye Durumu`,
      description:
        `**Cüzdan:** ${formatCurrency(balance.coins)} ${settings.currencyName}\n` +
        `**Banka:** ${formatCurrency(balance.bankCoins)} ${settings.currencyName}\n` +
        `**Toplam:** ${formatCurrency(balance.total)} ${settings.currencyName}`,
      color: DEFAULT_COLORS.GOLD as any,
      footer: { text: '/günlük ve /çalış komutlarıyla para kazanabilirsin!' },
      timestamp: false,
    });

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'bakiye.png' });
      embed.setImage('attachment://bakiye.png');
      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
