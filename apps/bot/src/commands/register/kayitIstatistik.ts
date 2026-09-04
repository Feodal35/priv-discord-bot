import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { registerService } from '../../services/register.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const kayitIstatistikCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kayıt-istatistik')
    .setDescription('Yetkililerin kayıt sayılarını veya genel sıralamayı gösterir.')
    .addUserOption((opt) =>
      opt.setName('yetkili').setDescription('İstatistiklerine bakılacak yetkili (İsteğe bağlı)').setRequired(false)
    ) as SlashCommandBuilder,
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('yetkili');
    const guildId = interaction.guild.id;

    // 1. Belirli bir yetkili seçildiyse onun istatistiği
    if (targetUser) {
      const stats = registerService.getStaffStats(guildId, targetUser.id);
      const embed = createEmbed({
        title: `📊 Kayıt İstatistikleri: ${targetUser.username}`,
        description:
          `**Yetkili:** <@${targetUser.id}>\n\n` +
          `• **Toplam Kayıt:** \`${stats.total}\` üye\n` +
          `• **Erkek Kayıt:** \`${stats.male}\` üye (♂️)\n` +
          `• **Kız Kayıt:** \`${stats.female}\` üye (♀️)`,
        color: DEFAULT_COLORS.PRIMARY,
        thumbnail: targetUser.displayAvatarURL({ extension: 'png', size: 128 }),
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 2. Yetkili seçilmediyse Sunucu Liderlik Tablosu (Top 10)
    const topStaff = registerService.getTopStaff(guildId, 10);
    if (topStaff.length === 0) {
      await interaction.reply({
        embeds: [
          createEmbed({
            title: '🏆 Kayıt Yetkilisi Sıralaması',
            description: 'Bu sunucuda henüz hiç kayıt yapılmamış.',
            color: DEFAULT_COLORS.PRIMARY,
          }),
        ],
      });
      return;
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const desc = topStaff
      .map((s, idx) => {
        const medal = medals[idx] || `${idx + 1}.`;
        return `${medal} <@${s.staffId}> — **${s.total}** Kayıt (♂️ ${s.male} | ♀️ ${s.female})`;
      })
      .join('\n');

    const embed = createEmbed({
      title: '🏆 En Çok Kayıt Yapan Yetkililer',
      description: desc,
      color: DEFAULT_COLORS.PRIMARY,
      footer: { text: 'Detaylı bireysel sorgu için: /kayıt-istatistik @yetkili' },
    });

    await interaction.reply({ embeds: [embed] });
  },
};
