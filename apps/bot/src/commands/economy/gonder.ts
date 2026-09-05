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
import { economyService } from '../../services/economy.service';
import { guildService } from '../../services/guild.service';
import { createErrorEmbed } from '../../utils/embed';
import { formatCurrency } from '@priv/shared';

export const gonderCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('gönder')
    .setDescription('Başka bir kullanıcıya güvenli şekilde coin transfer eder.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Coin göndereceğin kullanıcı').setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName('miktar')
        .setDescription('Gönderilecek miktar')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((opt) =>
      opt.setName('sebep').setDescription('Transfer açıklaması').setRequired(false).setMaxLength(100)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', flags: MessageFlags.Ephemeral });
      return;
    }

    const targetUser = interaction.options.getUser('üye', true);
    const amount = interaction.options.getInteger('miktar', true);
    const reason = interaction.options.getString('sebep') || undefined;
    const settings = await guildService.getGuildSettings(interaction.guild.id);

    if (targetUser.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Hedef', 'Botlara coin gönderemezsin.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Hedef', 'Kendine coin gönderemezsin.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Bakiye kontrolü
    const balance = await economyService.getBalance(interaction.guild.id, interaction.user.id);
    if (balance.coins < amount) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          'Yetersiz Bakiye',
          `Cüzdanında yalnızca **${formatCurrency(balance.coins)} ${settings.currencyName}** var.\n**${formatCurrency(amount)} ${settings.currencyName}** göndermek için yeterli bakiyen bulunmuyor.`
        )],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Onay embed'i
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('💸 Transfer Onayı')
      .setDescription(
        `**${interaction.user.username}**, aşağıdaki transferi onaylıyor musun?\n\n` +
        `👤 **Gönderen:** ${interaction.user} (\`${formatCurrency(balance.coins)} ${settings.currencyName}\`)\n` +
        `👤 **Alıcı:** ${targetUser}\n` +
        `💰 **Miktar:** \`${formatCurrency(amount)} ${settings.currencyName}\`\n` +
        (reason ? `📝 **Sebep:** *${reason}*\n` : '') +
        `\n⚠️ *Bu işlem geri alınamaz! Onaylamak için ✅ butonuna bas.*`
      )
      .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
      .setFooter({ text: 'Bu onay 30 saniye sonra geçersiz olur.' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('transfer_confirm')
        .setLabel('✅ Onayla')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('transfer_cancel')
        .setLabel('❌ İptal')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [confirmEmbed], components: [row], flags: MessageFlags.Ephemeral });

    // Buton collector (30s)
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ time: 30_000 });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({ content: '❌ Bu işlem sana ait değil!', flags: MessageFlags.Ephemeral });
        return;
      }

      collector.stop();

      if (btn.customId === 'transfer_cancel') {
        const cancelEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('❌ Transfer İptal Edildi')
          .setDescription('Coin transferi iptal edildi. Bakiyende herhangi bir değişiklik yapılmadı.');
        await btn.update({ embeds: [cancelEmbed], components: [] });
        return;
      }

      // Onayla
      await btn.deferUpdate();

      const result = await economyService.transferCoins(
        interaction.guild!.id,
        interaction.user.id,
        targetUser.id,
        amount,
        reason
      );

      if (!result.success) {
        const failEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('❌ Transfer Başarısız')
          .setDescription(result.message);
        await btn.editReply({ embeds: [failEmbed], components: [] });
        return;
      }

      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Transfer Tamamlandı!')
        .setDescription(
          `💸 **${formatCurrency(amount)} ${settings.currencyName}** başarıyla gönderildi!\n\n` +
          `👤 **Alıcı:** ${targetUser}\n` +
          `💰 **Transfer Miktarı:** \`${formatCurrency(amount)} ${settings.currencyName}\`` +
          (reason ? `\n📝 **Sebep:** *${reason}*` : '')
        )
        .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
        .setTimestamp();

      await btn.editReply({ embeds: [successEmbed], components: [] });
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        const expiredEmbed = new EmbedBuilder()
          .setColor(0x95a5a6)
          .setTitle('⏰ Transfer Süresi Doldu')
          .setDescription('30 saniye içinde onaylanmadığı için transfer otomatik olarak iptal edildi.');
        await interaction.editReply({ embeds: [expiredEmbed], components: [] }).catch(() => {});
      }
    });
  },
};
