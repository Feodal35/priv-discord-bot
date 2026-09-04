import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { registerService } from '../../services/register.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';
import { createStaffRegisterCard, createRegisterLeaderboardCard, RegisterLeaderboardEntry } from '../../utils/canvas';
import { logger } from '../../utils/logger';

export const kayitIstatistikCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kayıt-istatistik')
    .setDescription('Yetkililerin kayıt sayılarını veya genel sıralamayı görsel Canvas kartıyla gösterir.')
    .addUserOption((opt) =>
      opt.setName('yetkili').setDescription('İstatistiklerine bakılacak yetkili (İsteğe bağlı)').setRequired(false)
    ) as SlashCommandBuilder,
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    await interaction.deferReply();
    const targetUser = interaction.options.getUser('yetkili');
    const guildId = interaction.guild.id;

    // 1. Belirli bir yetkili seçildiyse: Kişisel Canvas Kartı
    if (targetUser) {
      const stats = registerService.getStaffStats(guildId, targetUser.id);

      let imageBuffer: Buffer | null = null;
      try {
        imageBuffer = await createStaffRegisterCard({
          avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
          username: targetUser.username,
          guildName: interaction.guild.name,
          total: stats.total,
          male: stats.male,
          female: stats.female,
        });
      } catch (err) {
        logger.error('[REGISTER_STATS] Canvas kartı oluşturulamadı:', err);
      }

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

      if (imageBuffer) {
        const file = new AttachmentBuilder(imageBuffer, { name: 'stats.png' });
        embed.setImage('attachment://stats.png');
        await interaction.editReply({ embeds: [embed], files: [file] });
      } else {
        await interaction.editReply({ embeds: [embed] });
      }
      return;
    }

    // 2. Yetkili seçilmediyse: Sunucu Liderlik Tablosu (Canvas Kartı)
    const topStaff = registerService.getTopStaff(guildId, 5);
    if (topStaff.length === 0) {
      await interaction.editReply({
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

    const leaderboardEntries: RegisterLeaderboardEntry[] = [];
    for (let i = 0; i < topStaff.length; i++) {
      const s = topStaff[i];
      const u = await interaction.client.users.fetch(s.staffId).catch(() => null);
      leaderboardEntries.push({
        rank: i + 1,
        avatarUrl: u ? u.displayAvatarURL({ extension: 'png', size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png',
        username: u ? u.username : `Yetkili (${s.staffId.slice(-4)})`,
        total: s.total,
        male: s.male,
        female: s.female,
      });
    }

    let lbBuffer: Buffer | null = null;
    try {
      lbBuffer = await createRegisterLeaderboardCard({
        guildName: interaction.guild.name,
        entries: leaderboardEntries,
      });
    } catch (err) {
      logger.error('[REGISTER_LEADERBOARD] Canvas oluşturulamadı:', err);
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const desc = leaderboardEntries
      .map((e, idx) => {
        const medal = medals[idx] || `${idx + 1}.`;
        return `${medal} <@${topStaff[idx].staffId}> — **${e.total}** Kayıt (♂️ ${e.male} | ♀️ ${e.female})`;
      })
      .join('\n');

    const embed = createEmbed({
      title: `🏆 ${interaction.guild.name} — Kayıt Liderleri`,
      description: desc,
      color: DEFAULT_COLORS.PRIMARY,
      footer: { text: 'Bireysel sorgu için: /kayıt-istatistik @yetkili' },
    });

    if (lbBuffer) {
      const file = new AttachmentBuilder(lbBuffer, { name: 'leaderboard.png' });
      embed.setImage('attachment://leaderboard.png');
      await interaction.editReply({ embeds: [embed], files: [file] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
