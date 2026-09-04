import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { moderationService } from '../../services/moderation.service';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const yasaklaCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('yasakla')
    .setDescription('Bir üyeyi sunucudan kalıcı olarak yasaklar (Ban).')
    .addUserOption((opt) => opt.setName('üye').setDescription('Yasaklanacak üye').setRequired(true))
    .addStringOption((opt) => opt.setName('sebep').setDescription('Yasaklama gerekçesi').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('üye', true);
    const reason = interaction.options.getString('sebep') || 'Kurallara aykırı davranış nedeniyle yasaklandı';

    const moderatorMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.reply({
        embeds: [createErrorEmbed('Kullanıcı Bulunamadı', 'Kullanıcı sunucuda bulunamadı.')],
        ephemeral: true,
      });
      return;
    }

    const res = await moderationService.banUser(moderatorMember, targetMember, reason, interaction.client);

    if (!res.success) {
      await interaction.reply({ embeds: [createErrorEmbed('Hata', res.message)], ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [createSuccessEmbed('Üye Yasaklandı', res.message)] });
  },
};
