import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { guildService } from '../../services/guild.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, EMOJIS } from '@priv/shared';

export const ayarlarCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ayarlar')
    .setDescription('Sunucu yapılandırma ve yönetim panelini açar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const settings = await guildService.getGuildSettings(interaction.guild.id);

    const embed = createEmbed({
      title: `${EMOJIS.SETTINGS} Sunucu Ayarları — Yönetim Paneli`,
      description:
        `Aşağıdaki butonları kullanarak sunucunun aktif modüllerini, kanallarını ve özelliklerini anlık olarak yönetebilirsin.\n\n` +
        `**Mevcut Durum:**\n` +
        `• Bot Adı: **${settings.botName}**\n` +
        `• Para Birimi: **${settings.currencyEmoji} ${settings.currencyName}**\n` +
        `• Karşılama Kanalı: ${settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : '`Ayarlanmamış`'}\n` +
        `• Log Kanalı: ${settings.logChannelId ? `<#${settings.logChannelId}>` : '`Ayarlanmamış`'}\n` +
        `• İtiraf Kanalı: ${settings.confessionChannelId ? `<#${settings.confessionChannelId}>` : '`Ayarlanmamış`'}\n` +
        `• Doğum Günü Kanalı: ${settings.birthdayChannelId ? `<#${settings.birthdayChannelId}>` : '`Ayarlanmamış`'}\n` +
        `• Dinamik Ses Kategorisi: ${settings.tempVoiceCategoryId ? `<#${settings.tempVoiceCategoryId}>` : '`Ayarlanmamış`'}\n`,
      color: DEFAULT_COLORS.PRIMARY,
      footer: { text: 'Ayrıntılı ayar sekmesini seçmek için aşağıdaki butonlara tıklayın.' },
    });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('settings_tab_welcome').setLabel('👋 Karşılama').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('settings_tab_moderation').setLabel('🛡️ Moderasyon').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('settings_tab_economy').setLabel('💰 Ekonomi').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('settings_tab_level').setLabel('⭐ Level').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('settings_tab_streak').setLabel('🔥 Streak').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('settings_tab_voice').setLabel('🎤 Voice').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('settings_tab_birthday').setLabel('🎂 Doğum Günü').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('settings_tab_log').setLabel('📋 Log').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('settings_tab_games').setLabel('🎮 Oyunlar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('settings_tab_ai').setLabel('🤖 AI').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2] });
  },
};
