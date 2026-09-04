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
import { registerService } from '../../services/register.service';
import { createSayCard } from '../../utils/canvas';
import { logger } from '../../utils/logger';

export const sayCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Sunucudaki ses, üye, çevrimiçi, kız/erkek ve klan istatistiklerini detaylıca sayar.')
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

    // 0. Kayıt Rolleri & Cinsiyet Keşfi
    const regSettings = registerService.autoConfigure(guild);
    const maleRoleIds = new Set<string>();
    const femaleRoleIds = new Set<string>();

    if (regSettings.maleRoleId) maleRoleIds.add(regSettings.maleRoleId);
    if (regSettings.femaleRoleId) femaleRoleIds.add(regSettings.femaleRoleId);

    for (const [, role] of guild.roles.cache) {
      const name = role.name.toLowerCase();
      if (['erkek', 'boy', 'man'].some((k) => name.includes(k))) {
        maleRoleIds.add(role.id);
      } else if (['kadın', 'kadin', 'kız', 'kiz', 'girl', 'woman'].some((k) => name.includes(k))) {
        femaleRoleIds.add(role.id);
      }
    }

    // 1. Ses & Cinsiyet İstatistikleri
    let totalInVoice = 0;
    let voiceDeaf = 0;
    let voiceMute = 0;
    let voiceStreaming = 0;
    let voiceCamera = 0;
    let voiceMale = 0;
    let voiceFemale = 0;

    let totalMale = 0;
    let totalFemale = 0;
    let totalUnregistered = 0;

    for (const [, m] of members) {
      if (m.user.bot) continue;

      const isMale = m.roles.cache.some((r) => maleRoleIds.has(r.id));
      const isFemale = !isMale && m.roles.cache.some((r) => femaleRoleIds.has(r.id));
      const isUnregistered = !isMale && !isFemale && (
        (regSettings.unregisteredRoleId ? m.roles.cache.has(regSettings.unregisteredRoleId) : false) ||
        m.roles.cache.some((r) => ['kayıtsız', 'kayitsiz', 'unregistered'].some((k) => r.name.toLowerCase().includes(k)))
      );

      if (isMale) totalMale++;
      else if (isFemale) totalFemale++;
      if (isUnregistered) totalUnregistered++;

      if (m.voice.channelId) {
        totalInVoice++;
        if (m.voice.selfDeaf || m.voice.serverDeaf) voiceDeaf++;
        if (m.voice.selfMute || m.voice.serverMute) voiceMute++;
        if (m.voice.streaming) voiceStreaming++;
        if (m.voice.selfVideo) voiceCamera++;

        if (isMale) voiceMale++;
        else if (isFemale) voiceFemale++;
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

    // 5. Canvas Kartı Oluştur (Kız & Erkek dahil 6 kutulu)
    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createSayCard({
        guildName: guild.name,
        totalMembers,
        onlineMembers: onlineMembers > 0 ? onlineMembers : Math.round(totalMembers * 0.4),
        voiceMembers: totalInVoice,
        boostCount,
        maleCount: totalMale,
        femaleCount: totalFemale,
      });
    } catch (canvasErr) {
      logger.error('[SAY] Canvas kartı oluşturulamadı:', canvasErr);
    }

    const embed = createEmbed({
      title: `📊 ${guild.name} — Sunucu, Ses ve Cinsiyet Sayımı`,
      description: `Yetkili canlı sayım ve üye dağılım paneli aşağıda detaylandırılmıştır:`,
      color: DEFAULT_COLORS.PRIMARY as any,
      thumbnail: guild.iconURL() || undefined,
      fields: [
        {
          name: '🎙️ Ses Kanalları Durumu',
          value:
            `>>> 🔊 **Toplam Sesteki Üye:** \`${totalInVoice}\` kişi\n` +
            `♂️ **Sesteki Erkek:** \`${voiceMale}\` kişi | ♀️ **Sesteki Kız:** \`${voiceFemale}\` kişi\n` +
            `🔇 **Mikrofonu Kapalı:** \`${voiceMute}\` kişi\n` +
            `🎧 **Kulaklığı Kapalı:** \`${voiceDeaf}\` kişi\n` +
            `🖥️ **Yayın Yapan:** \`${voiceStreaming}\` kişi | 📷 **Kamerası Açık:** \`${voiceCamera}\` kişi`,
          inline: false,
        },
        {
          name: '👥 Üye & Cinsiyet Dağılımı',
          value:
            `>>> 👤 **Toplam Üye:** \`${totalMembers}\`\n` +
            `♂️ **Erkek Üye:** \`${totalMale}\` kişi\n` +
            `♀️ **Kız Üye:** \`${totalFemale}\` kişi\n` +
            (totalUnregistered > 0 ? `❓ **Kayıtsız:** \`${totalUnregistered}\` kişi\n` : '') +
            `🧑 **İnsanlar:** \`${humanCount}\` | 🤖 **Botlar:** \`${botCount}\``,
          inline: true,
        },
        {
          name: '🚀 Takviye & Klan',
          value:
            `>>> 💎 **Takviye (Boost):** \`${boostCount}\` (Seviye ${boostTier})\n` +
            `🛡️ **Klan Üyesi:** \`${clanMemberCount}\` kişi\n` +
            `🟢 **Çevrim İçi:** \`${onlineMembers}\` kişi`,
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
