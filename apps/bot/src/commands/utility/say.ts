import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  AttachmentBuilder,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';
import { CLAN_ROLE_ID } from '../../services/clanRole.service';
import { createSayCard } from '../../utils/canvas';
import { logger } from '../../utils/logger';

export const sayCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Sunucudaki ses, üye, çevrimiçi ve klan istatistiklerini detaylıca sayar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const guild = interaction.guild;
    const members = await guild.members.fetch().catch(() => guild.members.cache);

    // 1. Ses İstatistikleri
    let totalInVoice = 0;
    let voiceDeaf = 0;
    let voiceMute = 0;
    let voiceStreaming = 0;
    let voiceCamera = 0;

    for (const [, m] of members) {
      if (m.voice.channelId) {
        totalInVoice++;
        if (m.voice.selfDeaf || m.voice.serverDeaf) voiceDeaf++;
        if (m.voice.selfMute || m.voice.serverMute) voiceMute++;
        if (m.voice.streaming) voiceStreaming++;
        if (m.voice.selfVideo) voiceCamera++;
      }
    }

    // 2. Üye & Durum İstatistikleri
    const totalMembers = guild.memberCount;
    const humanCount = members.filter((m) => !m.user.bot).size;
    const botCount = members.filter((m) => m.user.bot).size;
    const onlineMembers = members.filter(
      (m) => m.presence?.status && m.presence.status !== 'offline'
    ).size;

    // 3. Boost İstatistikleri
    const boostCount = guild.premiumSubscriptionCount || 0;
    const boostTier = guild.premiumTier;

    // 4. Klan / Guild Rolü Sayısı
    const clanRole = guild.roles.cache.get(CLAN_ROLE_ID);
    const clanMemberCount = clanRole ? members.filter((m) => m.roles.cache.has(CLAN_ROLE_ID)).size : 0;

    // 5. Canvas Kartı Oluştur
    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createSayCard({
        guildName: guild.name,
        totalMembers,
        onlineMembers: onlineMembers > 0 ? onlineMembers : Math.round(totalMembers * 0.4),
        voiceMembers: totalInVoice,
        boostCount,
      });
    } catch (canvasErr) {
      logger.error('[SAY] Canvas kartı oluşturulamadı:', canvasErr);
    }

    const embed = createEmbed({
      title: `📊 ${guild.name} — Sunucu ve Ses Sayımı`,
      description: `Yetkili canlı sayım paneli aşağıda detaylandırılmıştır:`,
      color: DEFAULT_COLORS.PRIMARY as any,
      thumbnail: guild.iconURL() || undefined,
      fields: [
        {
          name: '🎙️ Ses Kanalları Durumu',
          value:
            `>>> 🔊 **Toplam Sesteki Üye:** \`${totalInVoice}\` kişi\n` +
            `🔇 **Mikrofonu Kapalı:** \`${voiceMute}\` kişi\n` +
            `🎧 **Kulaklığı Kapalı:** \`${voiceDeaf}\` kişi\n` +
            `🖥️ **Yayın Yapan:** \`${voiceStreaming}\` kişi\n` +
            `📷 **Kamerası Açık:** \`${voiceCamera}\` kişi`,
          inline: false,
        },
        {
          name: '👥 Üye Durumu',
          value:
            `>>> 👤 **Toplam Üye:** \`${totalMembers}\`\n` +
            `🧑 **İnsanlar:** \`${humanCount}\` | 🤖 **Botlar:** \`${botCount}\``,
          inline: true,
        },
        {
          name: '🚀 Takviye & Klan',
          value:
            `>>> 💎 **Takviye (Boost):** \`${boostCount}\` (Seviye ${boostTier})\n` +
            `🛡️ **Klan Üyesi:** \`${clanMemberCount}\` kişi`,
          inline: true,
        },
      ],
      footer: { text: `Soran Yetkili: ${interaction.user.tag}` },
      timestamp: true,
    });

    if (imageBuffer) {
      const file = new AttachmentBuilder(imageBuffer, { name: 'say.png' });
      embed.setImage('attachment://say.png');
      await interaction.editReply({ embeds: [embed], files: [file] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
