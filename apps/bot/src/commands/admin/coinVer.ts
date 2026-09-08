import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService, isBotOwner } from '../../services/economy.service';
import { guildService } from '../../services/guild.service';
import { createErrorEmbed } from '../../utils/embed';
import { formatCurrency } from '@priv/shared';

export const coinVerCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('coin-ver')
    .setDescription('Bir kullanıcıya veya kendine anında coin ekler (Kurucu / Yönetici).')
    .addUserOption((opt) =>
      opt.setName('üye').setDescription('Coin verilecek kullanıcı (kendin dahil)').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('miktar')
        .setDescription('Eklenecek coin miktarı')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1_000_000_000)
    )
    .addStringOption((opt) =>
      opt.setName('sebep').setDescription('Coin verme gerekçesi').setRequired(false).setMaxLength(100)
    ),
  cooldown: 2,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Bu komut yalnızca sunucularda kullanılabilir.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const isOwner = isBotOwner(interaction.user.id);
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Yetkisiz İşlem',
            'Bu komutu yalnızca botun kurucu sahibi veya sunucu yöneticileri kullanabilir.'
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetUser = interaction.options.getUser('üye', true);
    const amount = interaction.options.getInteger('miktar', true);
    const reason = interaction.options.getString('sebep') || undefined;
    const settings = await guildService.getGuildSettings(interaction.guild.id);

    if (targetUser.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Hedef', 'Botlara coin verilemez.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const opReason = reason || `${isOwner ? 'Kurucu Sahip' : 'Yönetici'} (${interaction.user.tag}) tarafından coin eklendi`;

    await economyService.modifyBalance(
      interaction.guild.id,
      targetUser.id,
      amount,
      'ADD',
      opReason
    );

    const balance = await economyService.getBalance(interaction.guild.id, targetUser.id);
    const isSelf = targetUser.id === interaction.user.id;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🪙 Coin Başarıyla Eklendi!')
      .setDescription(
        `**${interaction.user.username}**, hedef kullanıcının cüzdanına başarıyla coin tanımladı!\n\n` +
        `👤 **Hedef Kullanıcı:** ${targetUser}${isSelf ? ' *(Kendin)*' : ''} (\`${targetUser.id}\`)\n` +
        `💰 **Eklenen Tutar:** \`${formatCurrency(amount)} ${settings.currencyName}\`\n` +
        `💳 **Güncel Cüzdan:** \`${formatCurrency(balance.coins)} ${settings.currencyName}\`\n` +
        `🏦 **Güncel Banka:** \`${formatCurrency(balance.bankCoins)} ${settings.currencyName}\`\n` +
        (reason ? `📝 **Sebep:** *${reason}*\n` : '') +
        (isOwner ? `\n👑 *Kurucu Sahip Sınırsız Bakiye Yetkisiyle İşlem Yapıldı.*` : '')
      )
      .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
      .setFooter({ text: `${interaction.guild.name} • Ekonomi Yönetimi` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
