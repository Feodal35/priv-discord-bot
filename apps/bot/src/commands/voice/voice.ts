import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, VoiceChannel } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { prisma } from '@priv/database';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const voiceCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Sana ait geçici ses odasını yönetir.')
    .addSubcommand((sub) => sub.setName('kilitle').setDescription('Odayı kilitler, yabancıların girmesini engeller.'))
    .addSubcommand((sub) => sub.setName('aç').setDescription('Oda kilidini açar, herkesin girişine izin verir.'))
    .addSubcommand((sub) =>
      sub
        .setName('limit')
        .setDescription('Oda kullanıcı limitini ayarlar (0 sınırsızdır).')
        .addIntegerOption((opt) => opt.setName('sayı').setDescription('Kişi sayısı (0-99)').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('isim')
        .setDescription('Odanın adını değiştirir.')
        .addStringOption((opt) => opt.setName('yeni_isim').setDescription('Yeni oda adı').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('at')
        .setDescription('Odadaki istenmeyen bir kullanıcıyı odadan çıkarır.')
        .addUserOption((opt) => opt.setName('üye').setDescription('Odadan atılacak üye').setRequired(true))
    ),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel as VoiceChannel | null;

    if (!voiceChannel) {
      await interaction.reply({
        embeds: [createErrorEmbed('Ses Kanalında Değilsin', 'Bu komutu kullanmak için kendi geçici ses odanda olmalısın.')],
        ephemeral: true,
      });
      return;
    }

    const tempRecord = await prisma.temporaryVoiceChannel.findUnique({
      where: { channelId: voiceChannel.id },
    });

    if (!tempRecord || tempRecord.ownerId !== member.id) {
      await interaction.reply({
        embeds: [createErrorEmbed('Oda Sahibi Değilsin', 'Sadece kendi oluşturduğun geçici ses odasını yönetebilirsin.')],
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'kilitle') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        Connect: false,
      });
      await prisma.temporaryVoiceChannel.update({
        where: { channelId: voiceChannel.id },
        data: { isLocked: true },
      });
      await interaction.reply({
        embeds: [createSuccessEmbed('Oda Kilitlendi', '🔒 Odan kilitlendi! Artık sadece senin izin verdiğin üyeler katılabilir.')],
      });
    } else if (subcommand === 'aç') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        Connect: null,
      });
      await prisma.temporaryVoiceChannel.update({
        where: { channelId: voiceChannel.id },
        data: { isLocked: false },
      });
      await interaction.reply({
        embeds: [createSuccessEmbed('Oda Kilidi Açıldı', '🔓 Odanın kilidi açıldı! Artık herkes odaya katılabilir.')],
      });
    } else if (subcommand === 'limit') {
      const limit = interaction.options.getInteger('sayı', true);
      if (limit < 0 || limit > 99) {
        await interaction.reply({
          embeds: [createErrorEmbed('Geçersiz Limit', 'Kullanıcı limiti 0 ile 99 arasında olmalıdır.')],
          ephemeral: true,
        });
        return;
      }
      await voiceChannel.setUserLimit(limit);
      await prisma.temporaryVoiceChannel.update({
        where: { channelId: voiceChannel.id },
        data: { userLimit: limit },
      });
      await interaction.reply({
        embeds: [createSuccessEmbed('Limit Güncellendi', `👥 Oda kullanıcı sayısı limiti **${limit === 0 ? 'Sınırsız' : limit}** olarak ayarlandı.`)],
      });
    } else if (subcommand === 'isim') {
      const newName = interaction.options.getString('yeni_isim', true).slice(0, 32);
      await voiceChannel.setName(`🎤 ${newName}`);
      await interaction.reply({
        embeds: [createSuccessEmbed('Oda Adı Değiştirildi', `Odanın adı başarıyla **🎤 ${newName}** olarak güncellendi.`)],
      });
    } else if (subcommand === 'at') {
      const targetUser = interaction.options.getUser('üye', true);
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember || targetMember.voice.channelId !== voiceChannel.id) {
        await interaction.reply({
          embeds: [createErrorEmbed('Kullanıcı Odada Yok', 'Bu kullanıcı senin ses odanda bulunmuyor.')],
          ephemeral: true,
        });
        return;
      }

      await targetMember.voice.disconnect('Oda sahibi tarafından odadan atıldı.');
      // Odaya tekrar girmesini engelle
      await voiceChannel.permissionOverwrites.edit(targetMember.id, {
        Connect: false,
      });

      await interaction.reply({
        embeds: [createSuccessEmbed('Kullanıcı Atıldı', `<@${targetUser.id}> odadan çıkarıldı ve odaya girişi engellendi.`)],
      });
    }
  },
};
