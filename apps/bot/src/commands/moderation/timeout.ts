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

export const timeoutCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Bir kullanıcıya geçici susturma (timeout) uygular ve DM ile bildirir.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Susturulacak üye').setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName('dakika')
        .setDescription('Süre (1 - 40320 dakika / max 28 gün)')
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('sebep')
        .setDescription('Timeout sebebi')
        .setRequired(false)
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
    const minutes = interaction.options.getInteger('dakika', true);
    const reason = interaction.options.getString('sebep') || 'Kural ihlali';

    const moderatorMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Kullanıcı Bulunamadı', 'Belirtilen üye sunucuda bulunamadı.')],
      });
      return;
    }

    const formatDuration = (mins: number) => {
      if (mins < 60) return `${mins} dakika`;
      if (mins < 1440) return `${Math.floor(mins / 60)} saat`;
      return `${Math.floor(mins / 1440)} gün`;
    };

    const result = await moderationService.timeoutUser(
      moderatorMember,
      targetMember,
      minutes * 60,
      reason,
      interaction.client
    );

    if (!result.success) {
      await interaction.editReply({
        embeds: [createErrorEmbed('İşlem Başarısız', result.message)],
      });
      return;
    }

    const expiresAt = Math.floor((Date.now() + minutes * 60 * 1000) / 1000);

    // DM bildirimi
    const dmEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('⏱️ Timeout Uygulandı')
      .setDescription(
        `**${interaction.guild.name}** sunucusunda geçici olarak susturuldun.\n\n` +
        `⏱️ **Süre:** ${formatDuration(minutes)}\n` +
        `🕐 **Bitiş:** <t:${expiresAt}:f>\n` +
        `📋 **Sebep:** ${reason}\n` +
        `👮 **Yetkili:** ${interaction.user.username}\n\n` +
        `_Süre dolunca otomatik olarak aktif olacaksın._`
      )
      .setThumbnail(interaction.guild.iconURL({ extension: 'png', size: 128 }) || null)
      .setTimestamp();

    await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('⏱️ Timeout Uygulandı')
      .setDescription(`${targetUser} kullanıcısına geçici susturma uygulandı.`)
      .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
      .addFields(
        { name: '👤 Kullanıcı', value: `${targetUser} (\`${targetUser.tag}\`)`, inline: true },
        { name: '👮 Yetkili', value: `${interaction.user}`, inline: true },
        { name: '⏱️ Süre', value: formatDuration(minutes), inline: true },
        { name: '🕐 Bitiş Zamanı', value: `<t:${expiresAt}:f> (<t:${expiresAt}:R>)`, inline: false },
        { name: '📋 Sebep', value: reason, inline: false },
        { name: '📩 DM Bildirimi', value: '✅ Gönderildi', inline: true },
      )
      .setFooter({ text: `Kullanıcı ID: ${targetUser.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
