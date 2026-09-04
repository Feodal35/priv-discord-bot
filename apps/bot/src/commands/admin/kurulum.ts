import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, EMOJIS } from '@priv/shared';
import { guildService } from '../../services/guild.service';

export const kurulumCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kurulum')
    .setDescription('Priv Bot sunucu kurulum sihirbazını başlatır.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    await guildService.getOrCreateGuild(
      interaction.guild.id,
      interaction.guild.name,
      interaction.guild.ownerId,
      interaction.guild.iconURL()
    );

    const embed = createEmbed({
      title: `${EMOJIS.TADA} Priv Bot Kurulum Sihirbazı — Adım 1 / 4`,
      description:
        `🎉 **${interaction.guild.name}** sunucusuna hoş geldiniz!\n\nPriv, sunucunuza özel tam teşekküllü bir sosyal ekosistem sunar. Şimdi temel ayarları yapılandıralım.\n\n` +
        `**Kurulacak Sistemler:**\n` +
        `• 👋 Karşılama & Hoş Geldin Mesajları\n` +
        `• 📋 Denetim & Olay Log Kanalı\n` +
        `• 🪙 Sunucu Para Birimi & Seviye Sistemi\n` +
        `• 🎤 Dinamik Geçici Ses Odaları\n\n` +
        `Hazırsanız aşağıdaki butona tıklayarak devam edin:`,
      color: DEFAULT_COLORS.PRIMARY,
      footer: { text: 'Adım 1: Genel Bilgilendirme' },
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('setup_step_2')
        .setLabel('Başla ve Kanalları Ayarla ➔')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('setup_auto_channels')
        .setLabel('Otomatik Priv Kanallarını Oluştur 🛠️')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
