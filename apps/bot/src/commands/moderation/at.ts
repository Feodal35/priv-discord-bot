import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { moderationService } from '../../services/moderation.service';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const atCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('at')
    .setDescription('Bir üyeyi sunucudan atar (Kick).')
    .addUserOption((opt) => opt.setName('üye').setDescription('Atılacak üye').setRequired(true))
    .addStringOption((opt) => opt.setName('sebep').setDescription('Atılma sebebi').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('üye', true);
    const reason = interaction.options.getString('sebep') || 'Yetkili tarafından atıldı';

    const moderatorMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.reply({
        embeds: [createErrorEmbed('Kullanıcı Bulunamadı', 'Kullanıcı sunucuda bulunamadı.')],
        ephemeral: true,
      });
      return;
    }

    const res = await moderationService.kickUser(moderatorMember, targetMember, reason, interaction.client);

    if (!res.success) {
      await interaction.reply({ embeds: [createErrorEmbed('Hata', res.message)], ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [createSuccessEmbed('Üye Atıldı', res.message)] });
  },
};
