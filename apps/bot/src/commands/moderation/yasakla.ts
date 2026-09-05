import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { moderationService } from '../../services/moderation.service';
import { createErrorEmbed } from '../../utils/embed';

export const yasaklaCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('yasakla')
    .setDescription('Bir üyeyi sunucudan kalıcı olarak yasaklar (Ban). Kullanıcıya DM ile bildirir.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Yasaklanacak üye').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('sebep')
        .setDescription('Yasaklama gerekçesi')
        .setRequired(false)
        .setMaxLength(200)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('mesaj_sil')
        .setDescription('Yasaklanan kişinin kaç günlük mesajları silinsin? (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser('üye', true);
    const reason = interaction.options.getString('sebep') || 'Kurallara aykırı davranış nedeniyle yasaklandı';
    const deleteDays = interaction.options.getInteger('mesaj_sil') ?? 0;

    const moderatorMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Kullanıcı Bulunamadı', 'Kullanıcı sunucuda bulunamadı.')],
      });
      return;
    }

    // Önce DM gönder (ban öncesi — sonra ulaşamayabiliriz)
    const dmEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🔨 Sunucudan Yasaklandın')
      .setDescription(
        `**${interaction.guild.name}** sunucusundan kalıcı olarak yasaklandın.\n\n` +
        `📋 **Sebep:** ${reason}\n` +
        `👮 **Yetkili:** ${interaction.user.username}\n\n` +
        `_Bu yasak kalıcıdır. İtiraz için sunucu yöneticileriyle iletişime geç._`
      )
      .setThumbnail(interaction.guild.iconURL({ extension: 'png', size: 128 }) || null)
      .setTimestamp();

    await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

    const res = await moderationService.banUser(moderatorMember, targetMember, reason, interaction.client);

    if (!res.success) {
      await interaction.editReply({ embeds: [createErrorEmbed('Hata', res.message)] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🔨 Üye Yasaklandı')
      .setDescription(`${targetUser} kullanıcısı sunucudan kalıcı olarak yasaklandı.`)
      .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
      .addFields(
        { name: '👤 Kullanıcı', value: `${targetUser} (\`${targetUser.tag}\`)`, inline: true },
        { name: '👮 Yetkili', value: `${interaction.user}`, inline: true },
        { name: '📋 Sebep', value: reason, inline: false },
        { name: '🗑️ Silinen Mesajlar', value: deleteDays > 0 ? `Son ${deleteDays} günlük mesajlar` : 'Silinmedi', inline: true },
        { name: '📩 DM Bildirimi', value: '✅ Gönderildi', inline: true },
        { name: '🚫 Durum', value: '🔴 Kalıcı Ban', inline: true },
      )
      .setFooter({ text: `Kullanıcı ID: ${targetUser.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
