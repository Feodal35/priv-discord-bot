import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { moderationService } from '../../services/moderation.service';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const uyarCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('uyar')
    .setDescription('Bir kullanıcıyı kural ihlali nedeniyle uyarır.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Uyarılacak üye').setRequired(true))
    .addStringOption((opt) => opt.setName('sebep').setDescription('Uyarı sebebi').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('üye', true);
    const reason = interaction.options.getString('sebep', true);

    const moderatorMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.reply({
        embeds: [createErrorEmbed('Kullanıcı Bulunamadı', 'Belirtilen kullanıcı bu sunucuda bulunmuyor.')],
        ephemeral: true,
      });
      return;
    }

    const result = await moderationService.warnUser(moderatorMember, targetMember, reason, interaction.client);

    if (!result.success) {
      await interaction.reply({
        embeds: [createErrorEmbed('İşlem Başarısız', result.message)],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [createSuccessEmbed('Kullanıcı Uyarıldı', result.message)],
    });
  },
};
