import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { registerService } from '../../services/register.service';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embed';

export const kayitCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kayıt')
    .setDescription('Yeni bir üyeyi sunucuya kaydeder (Erkek / Kız).')
    .addUserOption((opt) =>
      opt.setName('üye').setDescription('Kaydedilecek kullanıcı').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('cinsiyet')
        .setDescription('Kayıt edilecek cinsiyet')
        .setRequired(true)
        .addChoices(
          { name: '♂️ Erkek', value: 'erkek' },
          { name: '♀️ Kız', value: 'kiz' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('isim')
        .setDescription('Kullanıcının adı/rumuzu (Yaş girilmez)')
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(30)
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
    const genderChoice = interaction.options.getString('cinsiyet', true);
    const name = interaction.options.getString('isim', true);

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
        embeds: [createErrorEmbed('Hata', 'Botlar kayıt edilemez!')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const gender = genderChoice === 'erkek' ? 'MALE' : 'FEMALE';
    const result = await registerService.registerMember({
      guild: interaction.guild,
      targetMember,
      staffMember,
      name,
      gender,
    });

    if (result.success) {
      await interaction.editReply({
        embeds: [createSuccessEmbed('Kayıt Başarılı', result.message)],
      });
    } else {
      await interaction.editReply({
        embeds: [createErrorEmbed('Kayıt Başarısız', result.message)],
      });
    }
  },
};
