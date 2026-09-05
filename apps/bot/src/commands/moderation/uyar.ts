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

export const uyarCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('uyar')
    .setDescription('Bir kullanıcıyı kural ihlali nedeniyle uyarır ve DM ile bildirir.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Uyarılacak üye').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('sebep')
        .setDescription('Uyarı sebebi')
        .setRequired(true)
        .setMaxLength(200)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser('üye', true);
    const reason = interaction.options.getString('sebep', true);

    const moderatorMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Kullanıcı Bulunamadı', 'Belirtilen kullanıcı bu sunucuda bulunmuyor.')],
      });
      return;
    }

    const result = await moderationService.warnUser(moderatorMember, targetMember, reason, interaction.client);

    if (!result.success) {
      await interaction.editReply({
        embeds: [createErrorEmbed('İşlem Başarısız', result.message)],
      });
      return;
    }

    // Hedef kullanıcıya DM bildirimi
    const dmEmbed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('⚠️ Sunucu Uyarısı Aldın')
      .setDescription(
        `**${interaction.guild.name}** sunucusunda bir uyarı aldın.\n\n` +
        `📋 **Sebep:** ${reason}\n` +
        `👮 **Yetkili:** ${interaction.user.username}\n\n` +
        `_Lütfen sunucu kurallarına uymaya özen göster._`
      )
      .setThumbnail(interaction.guild.iconURL({ extension: 'png', size: 128 }) || null)
      .setTimestamp();

    await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

    // Yetkili kanalı için zengin embed
    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('⚠️ Kullanıcı Uyarıldı')
      .setDescription(`${targetUser} kullanıcısı başarıyla uyarıldı.`)
      .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
      .addFields(
        { name: '👤 Kullanıcı', value: `${targetUser} (\`${targetUser.tag}\`)`, inline: true },
        { name: '👮 Yetkili', value: `${interaction.user}`, inline: true },
        { name: '📋 Sebep', value: reason, inline: false },
        { name: '📩 DM Bildirimi', value: '✅ Gönderildi', inline: true },
      )
      .setFooter({ text: `Kullanıcı ID: ${targetUser.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
