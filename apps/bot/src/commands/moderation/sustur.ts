import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { moderationService } from '../../services/moderation.service';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const susturCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('sustur')
    .setDescription('Bir kullanıcıyı metin ve ses kanallarında susturur.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Susturulacak üye').setRequired(true))
    .addIntegerOption((opt) => opt.setName('dakika').setDescription('Süre (dakika)').setRequired(true))
    .addStringOption((opt) => opt.setName('sebep').setDescription('Susturma gerekçesi').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('üye', true);
    const minutes = interaction.options.getInteger('dakika', true);
    const reason = interaction.options.getString('sebep') || 'Kural ihlali gerekçesiyle susturuldu';

    const moderatorMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.reply({
        embeds: [createErrorEmbed('Kullanıcı Bulunamadı', 'Kullanıcı bu sunucuda bulunamadı.')],
        ephemeral: true,
      });
      return;
    }

    const res = await moderationService.timeoutUser(moderatorMember, targetMember, minutes * 60, reason, interaction.client);

    if (!res.success) {
      await interaction.reply({ embeds: [createErrorEmbed('Hata', res.message)], ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [createSuccessEmbed('Susturuldu', res.message)] });
  },
};
