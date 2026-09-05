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

export const susturCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('sustur')
    .setDescription('Bir kullanıcıyı metin ve ses kanallarında susturur ve DM ile bildirir.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Susturulacak üye').setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName('dakika')
        .setDescription('Susturma süresi (1-43200 dakika / max 30 gün)')
        .setMinValue(1)
        .setMaxValue(43200)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('sebep')
        .setDescription('Susturma gerekçesi')
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
    const reason = interaction.options.getString('sebep') || 'Kural ihlali gerekçesiyle susturuldu';

    const moderatorMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Kullanıcı Bulunamadı', 'Kullanıcı bu sunucuda bulunamadı.')],
      });
      return;
    }

    const res = await moderationService.timeoutUser(moderatorMember, targetMember, minutes * 60, reason, interaction.client);

    if (!res.success) {
      await interaction.editReply({ embeds: [createErrorEmbed('Hata', res.message)] });
      return;
    }

    // Süreyi okunabilir hale getir
    const formatDuration = (mins: number) => {
      if (mins < 60) return `${mins} dakika`;
      if (mins < 1440) return `${Math.floor(mins / 60)} saat ${mins % 60 > 0 ? `${mins % 60} dakika` : ''}`.trim();
      return `${Math.floor(mins / 1440)} gün`;
    };

    const expiresAt = Math.floor((Date.now() + minutes * 60 * 1000) / 1000);

    // Hedef kullanıcıya DM bildirimi
    const dmEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🔇 Sunucuda Susturuldun')
      .setDescription(
        `**${interaction.guild.name}** sunucusunda susturuldun.\n\n` +
        `⏱️ **Süre:** ${formatDuration(minutes)}\n` +
        `📋 **Sebep:** ${reason}\n` +
        `👮 **Yetkili:** ${interaction.user.username}\n` +
        `🕐 **Bitiş:** <t:${expiresAt}:f>\n\n` +
        `_Kuralları okuduğundan emin ol ve süre bitince sağlıklı iletişim kur._`
      )
      .setThumbnail(interaction.guild.iconURL({ extension: 'png', size: 128 }) || null)
      .setTimestamp();

    await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🔇 Kullanıcı Susturuldu')
      .setDescription(`${targetUser} kullanıcısına timeout uygulandı.`)
      .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
      .addFields(
        { name: '👤 Kullanıcı', value: `${targetUser} (\`${targetUser.tag}\`)`, inline: true },
        { name: '👮 Yetkili', value: `${interaction.user}`, inline: true },
        { name: '⏱️ Süre', value: formatDuration(minutes), inline: true },
        { name: '🕐 Bitiş Zamanı', value: `<t:${expiresAt}:f>`, inline: false },
        { name: '📋 Sebep', value: reason, inline: false },
        { name: '📩 DM Bildirimi', value: '✅ Gönderildi', inline: true },
      )
      .setFooter({ text: `Kullanıcı ID: ${targetUser.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
