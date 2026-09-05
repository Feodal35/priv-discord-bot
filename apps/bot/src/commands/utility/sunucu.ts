import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
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
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', flags: MessageFlags.Ephemeral });
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
    const boosterCount = guild.premiumSubscriptionCount || 0;
    const boostTier    = guild.premiumTier;
    const channelCount = guild.channels.cache.size;
    const roleCount    = guild.roles.cache.size;
    const emojiCount   = guild.emojis.cache.size;

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
    const totalMarriages = await prisma.marriage.count({ where: { guildId: guild.id } }).catch(() => 0);

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

    const createdAt = Math.floor(guild.createdTimestamp / 1000);
    const boostTierName = ['Tier Yok', '🥉 Tier 1', '🥈 Tier 2', '🥇 Tier 3'][boostTier] || 'Bilinmiyor';

    const embed = new EmbedBuilder()
      .setColor(DEFAULT_COLORS.PRIMARY as any)
      .setTitle(`📊 ${guild.name} — Sunucu İstatistikleri`)
      .setThumbnail(imageBuffer ? null : (guild.iconURL() || null))
      .addFields(
        {
          name: '👥 Üye Durumu',
          value:
            `👤 Toplam: **${memberCount}**\n` +
            `🧑 Üyeler: **${humanCount}** | 🤖 Botlar: **${botCount}**\n` +
            `🟢 Çevrimiçi: **${onlineCount}** | 🎤 Seste: **${voiceCount}**`,
          inline: true,
        },
        {
          name: '📈 Aktivite',
          value:
            `💬 Mesaj: **${formatCurrency(stats._sum.messageCount || 0)}**\n` +
            `🎤 Ses: **${formatHours(totalVoiceHours)}**\n` +
            `💬 En Aktif: **${topChatter?.user.username || '—'}**`,
          inline: true,
        },
        {
          name: '💰 Ekonomi & Sosyal',
          value:
            `🪙 Toplam Coin: **${formatCurrency(stats._sum.coins || 0)}**\n` +
            `🏆 Başarım: **${totalAchievements}**\n` +
            `💍 Evli Çift: **${totalMarriages}**`,
          inline: true,
        },
        {
          name: '🏗️ Sunucu Yapısı',
          value:
            `📁 Kanal: **${channelCount}**\n` +
            `🎭 Rol: **${roleCount}**\n` +
            `😀 Emoji: **${emojiCount}**`,
          inline: true,
        },
        {
          name: '🚀 Boost Durumu',
          value:
            `${boostTierName}\n` +
            `💜 Boost Sayısı: **${boosterCount}**`,
          inline: true,
        },
        {
          name: '📅 Kuruluş Tarihi',
          value: `<t:${createdAt}:D> (<t:${createdAt}:R>)`,
          inline: true,
        },
      )
      .setFooter({ text: `Sunucu ID: ${guild.id}` })
      .setTimestamp();

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'sunucu.png' });
      embed.setImage('attachment://sunucu.png');
      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
