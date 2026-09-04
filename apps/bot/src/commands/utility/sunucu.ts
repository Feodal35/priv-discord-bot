import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { prisma } from '@priv/database';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency, formatHours } from '@priv/shared';
import { createServerStatsCard } from '../../utils/canvas';

export const sunucuCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('sunucu')
    .setDescription('Sunucunun detaylı istatistiklerini, üye ve ekonomi durumunu görüntüler.'),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const guild = interaction.guild;
    await guild.members.fetch();

    const memberCount  = guild.memberCount;
    const botCount     = guild.members.cache.filter((m) => m.user.bot).size;
    const humanCount   = memberCount - botCount;
    const onlineCount  = guild.members.cache.filter(
      (m) => m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd'
    ).size;
    const voiceCount   = guild.members.cache.filter((m) => !!m.voice.channelId).size;

    const stats = await prisma.userGuild.aggregate({
      where: { guildId: guild.id },
      _sum: { messageCount: true, voiceSeconds: true, coins: true },
    });

    const topChatter = await prisma.userGuild.findFirst({
      where: { guildId: guild.id },
      orderBy: { messageCount: 'desc' },
      include: { user: true },
    });

    const topVoice = await prisma.userGuild.findFirst({
      where: { guildId: guild.id },
      orderBy: { voiceSeconds: 'desc' },
      include: { user: true },
    });

    const totalAchievements = await prisma.userAchievement.count({ where: { guildId: guild.id } });

    const totalVoiceHours = (stats._sum.voiceSeconds || 0) / 3600;

    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createServerStatsCard({
        guildName:       guild.name,
        guildIconUrl:    guild.iconURL({ extension: 'png', size: 128 }) || undefined,
        memberCount,
        humanCount,
        onlineCount,
        voiceCount,
        totalMessages:   stats._sum.messageCount || 0,
        totalVoiceHours,
        totalCoins:      stats._sum.coins || 0,
        totalAchievements,
        topChatter:      topChatter?.user.username,
        topVoice:        topVoice?.user.username,
      });
    } catch (err) {
      console.error('[SUNUCU] Canvas hatası:', err);
    }

    const embed = createEmbed({
      title: `📊 ${guild.name} — Sunucu İstatistikleri`,
      thumbnail: imageBuffer ? undefined : (guild.iconURL() || undefined),
      color: DEFAULT_COLORS.PRIMARY as any,
      fields: [
        {
          name: '👥 Üye Sayısı',
          value: `Toplam: **${memberCount}**\nÜyeler: **${humanCount}** | Botlar: **${botCount}**\nÇevrimiçi: **${onlineCount}** | Seste: **${voiceCount}**`,
          inline: true,
        },
        {
          name: '💬 Aktivite',
          value: `Mesaj: **${formatCurrency(stats._sum.messageCount || 0)}**\nSes: **${formatHours(totalVoiceHours)}**`,
          inline: true,
        },
        {
          name: '🪙 Ekonomi',
          value: `Para: **${formatCurrency(stats._sum.coins || 0)} Coin**\nBaşarım: **${totalAchievements} Adet**`,
          inline: true,
        },
      ],
      footer: { text: `Sunucu ID: ${guild.id}` },
      timestamp: false,
    });

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'sunucu.png' });
      embed.setImage('attachment://sunucu.png');
      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
