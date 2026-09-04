import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { registerService } from '../../services/register.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const kayitKurulumCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kayıt-kurulum')
    .setDescription('Kayıt sistemini tek adımda kolayca kurup aktif eder.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('kayıt_kanalı')
        .setDescription('Yeni gelenlerin karşılanacağı kayıt kanalı')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption((opt) =>
      opt.setName('kayıtsız_rol').setDescription('Yeni gelenlere verilecek kayıtsız rolü').setRequired(true)
    )
    .addRoleOption((opt) =>
      opt.setName('erkek_rol').setDescription('Erkek üyelere verilecek rol').setRequired(true)
    )
    .addRoleOption((opt) =>
      opt.setName('kız_rol').setDescription('Kız üyelere verilecek rol').setRequired(true)
    )
    .addRoleOption((opt) =>
      opt.setName('yetkili_rol').setDescription('Kayıt yetkililerine ait rol').setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('sohbet_kanalı')
        .setDescription('Kayıttan sonra tebrik mesajı atılacak sohbet kanalı')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('tag').setDescription('İsteğe bağlı sunucu tagı/sembolü (Örn: ✰)').setRequired(false)
    ) as SlashCommandBuilder,
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const registerChannel = interaction.options.getChannel('kayıt_kanalı', true);
    const unregisteredRole = interaction.options.getRole('kayıtsız_rol', true);
    const maleRole = interaction.options.getRole('erkek_rol', true);
    const femaleRole = interaction.options.getRole('kız_rol', true);
    const staffRole = interaction.options.getRole('yetkili_rol', true);
    const chatChannel = interaction.options.getChannel('sohbet_kanalı');
    const tag = interaction.options.getString('tag');

    const updated = registerService.updateSettings(interaction.guild.id, {
      enabled: true,
      registerChannelId: registerChannel.id,
      unregisteredRoleId: unregisteredRole.id,
      maleRoleId: maleRole.id,
      femaleRoleId: femaleRole.id,
      staffRoleId: staffRole.id,
      chatChannelId: chatChannel ? chatChannel.id : registerService.getSettings(interaction.guild.id).chatChannelId,
      tag: tag || null,
      tagEnabled: !!tag,
    });

    const embed = createEmbed({
      title: '✅ Kayıt Sistemi Başarıyla Kuruldu & Aktifleştirildi!',
      description:
        `Kayıt sistemi yapılandırıldı ve sunucunuzda devreye alındı.\n\n` +
        `**⚙️ Yapılandırma Detayları:**\n` +
        `• **Kayıt Kanalı:** <#${updated.registerChannelId}>\n` +
        `• **Tebrik Sohbet Kanalı:** ${updated.chatChannelId ? `<#${updated.chatChannelId}>` : '*Ayarlanmadı*'}\n` +
        `• **Kayıtsız Rolü:** <@&${updated.unregisteredRoleId}>\n` +
        `• **Erkek Rolü:** <@&${updated.maleRoleId}>\n` +
        `• **Kız Rolü:** <@&${updated.femaleRoleId}>\n` +
        `• **Yetkili Rolü:** <@&${updated.staffRoleId}>\n` +
        `• **Tag:** ${updated.tag ? `\`${updated.tag}\` (Aktif)` : '*Kullanılmıyor*'}\n\n` +
        `*Artık yeni bir üye katıldığında kayıt kanalına Nors tarzı karşılama embed'i ve butonlar düşecek.*`,
      color: DEFAULT_COLORS.SUCCESS,
      footer: { text: 'Ayarları değiştirmek için /kayıt-ayar komutunu kullanabilirsiniz.' },
    });

    await interaction.reply({ embeds: [embed] });
  },
};
