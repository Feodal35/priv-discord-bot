import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { registerService } from '../../services/register.service';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embed';

export const kayitsizCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kayıtsız')
    .setDescription('Bir üyeyi kayıtlı rollerinden çıkarıp tekrar kayıtsıza atar.')
    .addUserOption((opt) =>
      opt.setName('üye').setDescription('Kayıtsıza atılacak kullanıcı').setRequired(true)
    ) as SlashCommandBuilder,
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const staffMember = interaction.member as GuildMember;
    if (!registerService.isStaff(staffMember)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Yetki Yetersiz', 'Bu komutu kullanmak için **Kayıt Yetkilisi** olmalısınız!')],
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser('üye', true);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({
        embeds: [createErrorEmbed('Hata', 'Kullanıcı bu sunucuda bulunamadı!')],
        ephemeral: true,
      });
      return;
    }

    if (targetMember.user.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed('Hata', 'Botlar kayıtsıza atılamaz!')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const result = await registerService.unregisterMember({
      guild: interaction.guild,
      targetMember,
      staffMember,
    });

    if (result.success) {
      await interaction.editReply({
        embeds: [createSuccessEmbed('İşlem Başarılı', result.message)],
      });
    } else {
      await interaction.editReply({
        embeds: [createErrorEmbed('İşlem Başarısız', result.message)],
      });
    }
  },
};
