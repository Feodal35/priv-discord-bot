import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { registerService } from '../../services/register.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const kayitGecmisCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kayıt-geçmiş')
    .setDescription('Bir üyenin önceki kayıt bilgilerini listeler.')
    .addUserOption((opt) =>
      opt.setName('üye').setDescription('Kayıt geçmişine bakılacak kullanıcı').setRequired(true)
    ) as SlashCommandBuilder,
  cooldown: 5,
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
    const history = registerService.getHistory(interaction.guild.id, targetUser.id);

    if (history.length === 0) {
      await interaction.reply({
        embeds: [
          createEmbed({
            title: `📜 Kayıt Geçmişi: ${targetUser.username}`,
            description: `<@${targetUser.id}> kullanıcısına ait herhangi bir eski kayıt verisi bulunamadı.`,
            color: DEFAULT_COLORS.PRIMARY,
          }),
        ],
      });
      return;
    }

    const fields = history.slice(0, 10).map((h, idx) => {
      const genderText = h.gender === 'MALE' ? '♂️ Erkek' : '♀️ Kız';
      const timeUnix = Math.floor(new Date(h.registeredAt).getTime() / 1000);
      return {
        name: `#${idx + 1} — ${h.name} (${genderText})`,
        value: `**Kayıt Eden Yetkili:** <@${h.staffId}>\n**Tarih:** <t:${timeUnix}:f> (<t:${timeUnix}:R>)`,
        inline: false,
      };
    });

    const embed = createEmbed({
      title: `📜 Kayıt Geçmişi: ${targetUser.username}`,
      description: `<@${targetUser.id}> kullanıcısının sunucudaki son **${fields.length}** kaydı aşağıda listelenmiştir:`,
      color: DEFAULT_COLORS.PRIMARY,
      fields,
      thumbnail: targetUser.displayAvatarURL({ extension: 'png', size: 128 }),
    });

    await interaction.reply({ embeds: [embed] });
  },
};
