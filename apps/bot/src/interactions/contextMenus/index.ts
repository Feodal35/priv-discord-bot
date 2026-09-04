import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
  PermissionFlagsBits,
  ContextMenuCommandInteraction,
} from 'discord.js';
import { userService } from '../../services/user.service';
import { guildService } from '../../services/guild.service';
import { createProfileEmbed, createEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embed';
import { calculateShipPercentage, createProgressBar, DEFAULT_COLORS, formatCurrency, formatHours } from '@priv/shared';
import { moderationService } from '../../services/moderation.service';

export const userContextMenus = [
  // 1. PROFİLİ GÖR
  {
    data: new ContextMenuCommandBuilder()
      .setName('Profili Gör')
      .setType(ApplicationCommandType.User),
    async execute(interaction: UserContextMenuCommandInteraction) {
      if (!interaction.guild) return;
      await interaction.deferReply();
      const profile = await userService.getUserProfile(interaction.targetUser.id, interaction.guild.id, interaction.client);
      const settings = await guildService.getGuildSettings(interaction.guild.id);
      const embed = createProfileEmbed(profile, settings.currencyName, settings.currencyEmoji);
      await interaction.editReply({ embeds: [embed] });
    },
  },

  // 2. İSTATİSTİK
  {
    data: new ContextMenuCommandBuilder()
      .setName('İstatistiklerini Gör')
      .setType(ApplicationCommandType.User),
    async execute(interaction: UserContextMenuCommandInteraction) {
      if (!interaction.guild) return;
      const profile = await userService.getUserProfile(interaction.targetUser.id, interaction.guild.id, interaction.client);
      const embed = createEmbed({
        title: `📊 ${profile.displayName} — Detaylı İstatistikler`,
        thumbnail: profile.avatarUrl,
        color: DEFAULT_COLORS.INFO,
        fields: [
          { name: 'Seviye & XP', value: `Seviye: ${profile.level} (${formatCurrency(profile.xp)} XP)`, inline: true },
          { name: 'Mesaj Sayısı', value: `${formatCurrency(profile.messageCount)} adet`, inline: true },
          { name: 'Ses Süresi', value: `${formatHours(profile.voiceHours)}`, inline: true },
          { name: 'Günlük Streak', value: `${profile.streak} Gün`, inline: true },
          { name: 'Cüzdan', value: `${formatCurrency(profile.coins)} Coin`, inline: true },
          { name: 'Sıralama', value: `#${profile.rank}`, inline: true },
        ],
      });
      await interaction.reply({ embeds: [embed] });
    },
  },

  // 3. SHIP
  {
    data: new ContextMenuCommandBuilder()
      .setName('Ship')
      .setType(ApplicationCommandType.User),
    async execute(interaction: UserContextMenuCommandInteraction) {
      if (!interaction.guild) return;
      const percent = calculateShipPercentage(interaction.user.id, interaction.targetUser.id);
      const bar = createProgressBar(percent, 10);
      const embed = createEmbed({
        title: `❤️ Priv Aşk Uyumu: ${interaction.user.username} × ${interaction.targetUser.username}`,
        description: `**Uyum Yüzdesi:**\n\`${bar}\``,
        color: percent >= 50 ? DEFAULT_COLORS.DANGER : DEFAULT_COLORS.SECONDARY,
      });
      await interaction.reply({ embeds: [embed] });
    },
  },

  // 4. PARA GÖNDER
  {
    data: new ContextMenuCommandBuilder()
      .setName('100 Coin Gönder')
      .setType(ApplicationCommandType.User),
    async execute(interaction: UserContextMenuCommandInteraction) {
      if (!interaction.guild) return;
      const result = await (await import('../../services/economy.service')).economyService.transferCoins(
        interaction.guild.id,
        interaction.user.id,
        interaction.targetUser.id,
        100,
        'Hızlı Transfer (Context Menu)'
      );
      if (!result.success) {
        await interaction.reply({ embeds: [createErrorEmbed('Hata', result.message)], ephemeral: true });
        return;
      }
      await interaction.reply({ embeds: [createSuccessEmbed('Gönderildi', result.message)] });
    },
  },

  // 5. UYAR (Moderasyon)
  {
    data: new ContextMenuCommandBuilder()
      .setName('Uyar')
      .setType(ApplicationCommandType.User)
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction: UserContextMenuCommandInteraction) {
      if (!interaction.guild) return;
      const mod = await interaction.guild.members.fetch(interaction.user.id);
      const target = await interaction.guild.members.fetch(interaction.targetUser.id);
      const res = await moderationService.warnUser(mod, target, 'Context menu üzerinden uyarıldı', interaction.client);
      if (!res.success) {
        await interaction.reply({ embeds: [createErrorEmbed('Hata', res.message)], ephemeral: true });
        return;
      }
      await interaction.reply({ embeds: [createSuccessEmbed('Uyarıldı', res.message)] });
    },
  },

  // 6. TIMEOUT (Moderasyon)
  {
    data: new ContextMenuCommandBuilder()
      .setName('10 Dakika Timeout')
      .setType(ApplicationCommandType.User)
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction: UserContextMenuCommandInteraction) {
      if (!interaction.guild) return;
      const mod = await interaction.guild.members.fetch(interaction.user.id);
      const target = await interaction.guild.members.fetch(interaction.targetUser.id);
      const res = await moderationService.timeoutUser(mod, target, 600, 'Context menu hızlı timeout (10 dk)', interaction.client);
      if (!res.success) {
        await interaction.reply({ embeds: [createErrorEmbed('Hata', res.message)], ephemeral: true });
        return;
      }
      await interaction.reply({ embeds: [createSuccessEmbed('Timeout', res.message)] });
    },
  },
];

export const messageContextMenus = [
  // 1. MESAJ BİLGİSİ
  {
    data: new ContextMenuCommandBuilder()
      .setName('Mesaj Bilgisi')
      .setType(ApplicationCommandType.Message),
    async execute(interaction: MessageContextMenuCommandInteraction) {
      const msg = interaction.targetMessage;
      const embed = createEmbed({
        title: 'ℹ️ Mesaj Detayları',
        color: DEFAULT_COLORS.INFO,
        fields: [
          { name: 'Yazar', value: `<@${msg.author.id}> (${msg.author.tag})`, inline: true },
          { name: 'Kanal', value: `<#${msg.channelId}>`, inline: true },
          { name: 'Mesaj ID', value: `\`${msg.id}\``, inline: true },
          { name: 'Tarih', value: `<t:${Math.floor(msg.createdTimestamp / 1000)}:F>`, inline: false },
          { name: 'İçerik Uzunluğu', value: `${msg.content.length} karakter`, inline: true },
          { name: 'Ek Dosya Sayısı', value: `${msg.attachments.size} adet`, inline: true },
        ],
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  },

  // 2. MESAJI RAPORLA
  {
    data: new ContextMenuCommandBuilder()
      .setName('Mesajı Raporla')
      .setType(ApplicationCommandType.Message),
    async execute(interaction: MessageContextMenuCommandInteraction) {
      if (!interaction.guild) return;
      const msg = interaction.targetMessage;
      const { logService } = await import('../../services/log.service');
      await logService.logEvent(
        interaction.guild.id,
        'MODERATION',
        'Kullanıcı Tarafından Mesaj Raporlandı',
        `**Raporlayan:** <@${interaction.user.id}>\n**Mesaj Yazarı:** <@${msg.author.id}>\n**Kanal:** <#${msg.channelId}>\n**İçerik:** ${msg.content.slice(0, 500) || '[Metin yok]'}\n[Mesaja Git](${msg.url})`,
        interaction.client
      );
      await interaction.reply({
        embeds: [createSuccessEmbed('Rapor İletildi', 'Mesaj incelenmek üzere sunucu yetkililerine ve log kanalına iletildi.')],
        ephemeral: true,
      });
    },
  },
];
