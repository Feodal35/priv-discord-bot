import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { registerService } from '../../services/register.service';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const kayitAyarCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kayıt-ayar')
    .setDescription('Kayıt sistemi yapılandırmasını yönetir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName('görüntüle').setDescription('Mevcut kayıt sistemi ayarlarını listeler.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('durum')
        .setDescription('Kayıt sistemini açar veya kapatır.')
        .addBooleanOption((opt) =>
          opt.setName('aktif').setDescription('Açık mı kapalı mı?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('kanal')
        .setDescription('Kayıt kanalını ayarlar.')
        .addChannelOption((opt) =>
          opt
            .setName('kanal')
            .setDescription('Kayıt mesajlarının atılacağı kanal')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('sohbet')
        .setDescription('Kayıt sonrası tebrik mesajının atılacağı sohbet kanalını ayarlar.')
        .addChannelOption((opt) =>
          opt
            .setName('kanal')
            .setDescription('Tebrik mesajının gideceği kanal')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('tag')
        .setDescription('Sunucu tagını ve aktifliğini ayarlar.')
        .addStringOption((opt) =>
          opt.setName('tag').setDescription('Sunucu tagı veya sembolü (Örn: ✰)').setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt.setName('aktif').setDescription('Tag isimlerin başına eklensin mi?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('roller')
        .setDescription('Kayıt rollerini günceller.')
        .addRoleOption((opt) => opt.setName('erkek_rol').setDescription('Erkek üye rolü'))
        .addRoleOption((opt) => opt.setName('kız_rol').setDescription('Kız üye rolü'))
        .addRoleOption((opt) => opt.setName('kayıtsız_rol').setDescription('Kayıtsız üye rolü'))
        .addRoleOption((opt) => opt.setName('yetkili_rol').setDescription('Kayıt yetkilisi rolü'))
    ) as SlashCommandBuilder,
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'görüntüle') {
      const s = registerService.getSettings(guildId);
      const embed = createEmbed({
        title: '📋 Kayıt Sistemi Ayarları',
        description:
          `**Sistem Durumu:** ${s.enabled ? '🟢 Aktif' : '🔴 Devre Dışı'}\n\n` +
          `**📍 Kanallar:**\n` +
          `• Kayıt Kanalı: ${s.registerChannelId ? `<#${s.registerChannelId}>` : '*Ayarlanmadı*'}\n` +
          `• Tebrik Sohbet Kanalı: ${s.chatChannelId ? `<#${s.chatChannelId}>` : '*Ayarlanmadı*'}\n\n` +
          `**🎭 Roller:**\n` +
          `• Kayıtsız Rolü: ${s.unregisteredRoleId ? `<@&${s.unregisteredRoleId}>` : '*Ayarlanmadı*'}\n` +
          `• Erkek Rolü: ${s.maleRoleId ? `<@&${s.maleRoleId}>` : '*Ayarlanmadı*'}\n` +
          `• Kız Rolü: ${s.femaleRoleId ? `<@&${s.femaleRoleId}>` : '*Ayarlanmadı*'}\n` +
          `• Yetkili Rolü: ${s.staffRoleId ? `<@&${s.staffRoleId}>` : '*Ayarlanmadı*'}\n\n` +
          `**🏷️ Tag Sistemi:**\n` +
          `• Tag: ${s.tag ? `\`${s.tag}\`` : '*Yok*'}\n` +
          `• Tag Durumu: ${s.tagEnabled ? '✅ Açık' : '❌ Kapalı'}`,
        color: DEFAULT_COLORS.PRIMARY,
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'durum') {
      const aktif = interaction.options.getBoolean('aktif', true);
      registerService.updateSettings(guildId, { enabled: aktif });
      await interaction.reply({
        embeds: [createSuccessEmbed('Ayar Güncellendi', `Kayıt sistemi durumu: **${aktif ? 'Aktif 🟢' : 'Devre Dışı 🔴'}** olarak ayarlandı.`)],
      });
      return;
    }

    if (subcommand === 'kanal') {
      const ch = interaction.options.getChannel('kanal', true);
      registerService.updateSettings(guildId, { registerChannelId: ch.id });
      await interaction.reply({
        embeds: [createSuccessEmbed('Ayar Güncellendi', `Kayıt kanalı <#${ch.id}> olarak belirlendi.`)],
      });
      return;
    }

    if (subcommand === 'sohbet') {
      const ch = interaction.options.getChannel('kanal', true);
      registerService.updateSettings(guildId, { chatChannelId: ch.id });
      await interaction.reply({
        embeds: [createSuccessEmbed('Ayar Güncellendi', `Kayıt sonrası tebrik sohbet kanalı <#${ch.id}> olarak belirlendi.`)],
      });
      return;
    }

    if (subcommand === 'tag') {
      const tag = interaction.options.getString('tag', true);
      const aktif = interaction.options.getBoolean('aktif', true);
      registerService.updateSettings(guildId, { tag, tagEnabled: aktif });
      await interaction.reply({
        embeds: [createSuccessEmbed('Ayar Güncellendi', `Sunucu tagı \`${tag}\` ve tag durumu **${aktif ? 'Açık' : 'Kapalı'}** olarak güncellendi.`)],
      });
      return;
    }

    if (subcommand === 'roller') {
      const male = interaction.options.getRole('erkek_rol');
      const female = interaction.options.getRole('kız_rol');
      const unreg = interaction.options.getRole('kayıtsız_rol');
      const staff = interaction.options.getRole('yetkili_rol');

      const updates: any = {};
      if (male) updates.maleRoleId = male.id;
      if (female) updates.femaleRoleId = female.id;
      if (unreg) updates.unregisteredRoleId = unreg.id;
      if (staff) updates.staffRoleId = staff.id;

      if (Object.keys(updates).length === 0) {
        await interaction.reply({
          embeds: [createErrorEmbed('Hata', 'Lütfen güncellemek istediğiniz en az bir rolü seçin.')],
          ephemeral: true,
        });
        return;
      }

      registerService.updateSettings(guildId, updates);
      await interaction.reply({
        embeds: [createSuccessEmbed('Ayar Güncellendi', 'Kayıt rolleri başarıyla güncellendi.')],
      });
      return;
    }
  },
};
