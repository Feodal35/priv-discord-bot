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

export const atCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('at')
    .setDescription('Bir üyeyi sunucudan atar (Kick). Kullanıcıya DM ile bildirir.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Atılacak üye').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('sebep')
        .setDescription('Atılma sebebi')
        .setRequired(false)
        .setMaxLength(200)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser('üye', true);
    const reason = interaction.options.getString('sebep') || 'Yetkili tarafından atıldı';

    const moderatorMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Kullanıcı Bulunamadı', 'Kullanıcı sunucuda bulunamadı.')],
      });
      return;
    }

    // Önce DM gönder (kick öncesi — sonra ulaşamayabiliriz)
    const dmEmbed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle('🚪 Sunucudan Atıldın')
      .setDescription(
        `**${interaction.guild.name}** sunucusundan atıldın.\n\n` +
        `📋 **Sebep:** ${reason}\n` +
        `👮 **Yetkili:** ${interaction.user.username}\n\n` +
        `_Sunucu davet linki ile tekrar katılabilirsin._`
      )
      .setThumbnail(interaction.guild.iconURL({ extension: 'png', size: 128 }) || null)
      .setTimestamp();

    await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

    const res = await moderationService.kickUser(moderatorMember, targetMember, reason, interaction.client);

    if (!res.success) {
      await interaction.editReply({ embeds: [createErrorEmbed('Hata', res.message)] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle('🚪 Üye Atıldı')
      .setDescription(`${targetUser} kullanıcısı sunucudan atıldı.`)
      .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
      .addFields(
        { name: '👤 Kullanıcı', value: `${targetUser} (\`${targetUser.tag}\`)`, inline: true },
        { name: '👮 Yetkili', value: `${interaction.user}`, inline: true },
        { name: '📋 Sebep', value: reason, inline: false },
        { name: '📩 DM Bildirimi', value: '✅ Gönderildi', inline: true },
        { name: '🔄 Yeniden Katılım', value: 'Davet linki ile katılabilir', inline: true },
      )
      .setFooter({ text: `Kullanıcı ID: ${targetUser.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
