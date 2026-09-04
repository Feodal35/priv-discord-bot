import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { prisma } from '@priv/database';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency, formatHours } from '@priv/shared';

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

    const guild = interaction.guild;
    await guild.members.fetch();

    const memberCount = guild.memberCount;
    const botCount = guild.members.cache.filter((m) => m.user.bot).size;
    const humanCount = memberCount - botCount;
    const onlineCount = guild.members.cache.filter((m) => m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd').size;
    const voiceCount = guild.members.cache.filter((m) => !!m.voice.channelId).size;

    const stats = await prisma.userGuild.aggregate({
      where: { guildId: guild.id },
      _sum: {
        messageCount: true,
        voiceSeconds: true,
        coins: true,
      },
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

    const totalAchievements = await prisma.userAchievement.count({
      where: { guildId: guild.id },
    });

    const embed = createEmbed({
      title: `📊 ${guild.name} — Sunucu İstatistikleri`,
      thumbnail: guild.iconURL() || undefined,
      color: DEFAULT_COLORS.PRIMARY,
      fields: [
        {
          name: '👥 Üye Sayısı',
          value: `Toplam: **${memberCount}**\nÜyeler: **${humanCount}** | Botlar: **${botCount}**\nÇevrimiçi: **${onlineCount}** | Seste: **${voiceCount}**`,
          inline: true,
        },
        {
          name: '💬 Sohbet & Ses Aktivitesi',
          value: `Toplam Mesaj: **${formatCurrency(stats._sum.messageCount || 0)}**\nToplam Ses: **${formatHours((stats._sum.voiceSeconds || 0) / 3600)}**`,
          inline: true,
        },
        {
          name: '🪙 Ekonomi & Başarım',
          value: `Toplam Para: **${formatCurrency(stats._sum.coins || 0)} Coin**\nAçılan Başarım: **${totalAchievements} Adet**`,
          inline: true,
        },
        {
          name: '🗣️ En Çok Konuşan',
          value: topChatter ? `<@${topChatter.userId}> (${formatCurrency(topChatter.messageCount)} mesaj)` : 'Henüz veri yok',
          inline: true,
        },
        {
          name: '🎧 En Çok Seste Kalan',
          value: topVoice ? `<@${topVoice.userId}> (${formatHours(topVoice.voiceSeconds / 3600)})` : 'Henüz veri yok',
          inline: true,
        },
        {
          name: '📅 Sunucu Kuruluşu',
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
          inline: true,
        },
      ],
      footer: { text: `Sunucu ID: ${guild.id}` },
    });

    await interaction.reply({ embeds: [embed] });
  },
};
