import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { moderationService } from '../../services/moderation.service';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const timeoutCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Bir kullanıcıya geçici susturma (timeout) uygular.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Susturulacak üye').setRequired(true))
    .addIntegerOption((opt) => opt.setName('dakika').setDescription('Süre (dakika)').setRequired(true))
    .addStringOption((opt) => opt.setName('sebep').setDescription('Susturma sebebi').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('üye', true);
    const minutes = interaction.options.getInteger('dakika', true);
    const reason = interaction.options.getString('sebep') || 'Kural ihlali';

    if (minutes <= 0 || minutes > 40320) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Süre', 'Süre 1 ile 40320 dakika (28 gün) arasında olmalıdır.')],
        ephemeral: true,
      });
      return;
    }

    const moderatorMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.reply({
        embeds: [createErrorEmbed('Kullanıcı Bulunamadı', 'Belirtilen üye sunucuda bulunamadı.')],
        ephemeral: true,
      });
      return;
    }

    const result = await moderationService.timeoutUser(
      moderatorMember,
      targetMember,
      minutes * 60,
      reason,
      interaction.client
    );

    if (!result.success) {
      await interaction.reply({
        embeds: [createErrorEmbed('İşlem Başarısız', result.message)],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [createSuccessEmbed('Timeout Uygulandı', result.message)],
    });
  },
};
