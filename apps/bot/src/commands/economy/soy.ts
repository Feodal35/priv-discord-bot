import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { guildService } from '../../services/guild.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

export const soyCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('soy')
    .setDescription('Başka bir üyenin cüzdanını gizlice soymaya çalışırsın.')
    .addUserOption((opt) =>
      opt
        .setName('üye')
        .setDescription('Cüzdanını soymak istediğin kullanıcı')
        .setRequired(true)
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
    const robber = interaction.user;
    const targetUser = interaction.options.getUser('üye', true);

    if (targetUser.id === robber.id) {
      await interaction.reply({
        embeds: [createErrorEmbed('Hata', 'Kendi kendini soyamazsın!')],
        ephemeral: true,
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed('Hata', 'Botların cüzdanı bulunmuyor, onları soyamazsın!')],
        ephemeral: true,
      });
      return;
    }

    const settings = await guildService.getGuildSettings(guildId);
    if (!settings.economyEnabled) {
      await interaction.reply({
        embeds: [createErrorEmbed('Ekonomi Devre Dışı', 'Bu sunucuda ekonomi sistemi kapalı.')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const result = await economyService.robUser(guildId, robber.id, targetUser.id);

    if (result.outcome === 'COOLDOWN') {
      const embed = createEmbed({
        title: '🕒 Polisler Hala Peşinde!',
        description: result.message,
        color: DEFAULT_COLORS.WARNING as any,
      });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (result.outcome === 'NOT_ENOUGH_ROBBER' || result.outcome === 'NOT_ENOUGH_VICTIM') {
      await interaction.editReply({
        embeds: [createErrorEmbed('Soygun Başarısız', result.message)],
      });
      return;
    }

    if (result.outcome === 'BLOCKED_SAFE') {
      const embed = createEmbed({
        title: '🛡️ Çelik Kasa Koruması!',
        description: result.message,
        color: DEFAULT_COLORS.PRIMARY as any,
        footer: { text: 'Marketteki Çelik Kasa soygunlara karşı %100 koruma sağlar.' },
      });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (result.outcome === 'BITTEN_DOG') {
      const embed = createEmbed({
        title: '🐕 Bekçi Köpeği Saldırısı!',
        description: result.message,
        color: DEFAULT_COLORS.DANGER as any,
        footer: { text: 'Marketteki Bekçi Köpeği hırsızları ısırır ve sahibine tazminat kazandırır.' },
      });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (result.outcome === 'SUCCESS') {
      const embed = createEmbed({
        title: '🥷 Başarılı Soygun!',
        description: result.message,
        color: DEFAULT_COLORS.SUCCESS as any,
        footer: { text: 'Paranızı korumak için /banka yatır komutunu veya marketten Çelik Kasa kullanın.' },
      });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (result.outcome === 'CAUGHT') {
      const embed = createEmbed({
        title: '🚨 Suçüstü Yakalandın!',
        description: result.message,
        color: DEFAULT_COLORS.DANGER as any,
        footer: { text: 'Soygun riski yüksektir! Yakalanırsan hedefe doğrudan tazminat ödersin.' },
      });
      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
};
