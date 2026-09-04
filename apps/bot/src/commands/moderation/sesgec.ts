import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Role,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const sesgecCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('sesgec')
    .setDescription('Seste olmayan yetkilileri tek bir mesajda etiketleyerek ses odalarına davet eder.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addRoleOption((opt) =>
      opt.setName('rol').setDescription('Taranacak yetkili rolü (Belirtilmezse tüm yetkililer taranır)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('mesaj').setDescription('Yetkililere iletmek istediğin özel not').setRequired(false).setMaxLength(250)
    ),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const guild = interaction.guild;
    const targetRole = interaction.options.getRole('rol') as Role | null;
    const customNote = interaction.options.getString('mesaj');

    const allMembers = await guild.members.fetch().catch(() => guild.members.cache);

    // Taranacak yetkilileri belirle
    let targetMembers = allMembers.filter((m) => !m.user.bot);

    if (targetRole) {
      targetMembers = targetMembers.filter((m) => m.roles.cache.has(targetRole.id));
    } else {
      // Rol seçilmemişse sunucudaki yetkilileri filtrele (Yönetici, Ban, Kick, Mute yetkisi olanlar)
      targetMembers = targetMembers.filter(
        (m) =>
          m.id === guild.ownerId ||
          m.permissions.has(PermissionFlagsBits.Administrator) ||
          m.permissions.has(PermissionFlagsBits.ManageRoles) ||
          m.permissions.has(PermissionFlagsBits.ManageGuild) ||
          m.permissions.has(PermissionFlagsBits.ModerateMembers) ||
          m.permissions.has(PermissionFlagsBits.ManageMessages)
      );
    }

    if (targetMembers.size === 0) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Yetkili Bulunamadı', 'Belirtilen kriterde herhangi bir üye bulunamadı.')],
      });
      return;
    }

    const inVoiceMembers: string[] = [];
    const notInVoiceMembers: string[] = [];

    for (const [, m] of targetMembers) {
      if (m.voice.channelId) {
        inVoiceMembers.push(`<@${m.id}>`);
      } else {
        notInVoiceMembers.push(`<@${m.id}>`);
      }
    }

    // Herkes seste mi?
    if (notInVoiceMembers.length === 0) {
      const allGoodEmbed = createSuccessEmbed(
        'Harika! Tüm Yetkililer Seste! 🎉',
        `Taranan **${targetMembers.size}** yetkilinin tamamı şu anda ses kanallarında aktif durumda. Tebrikler!`
      );
      await interaction.editReply({ embeds: [allGoodEmbed] });
      return;
    }

    // Seste olmayanları etiketleyip çağır
    const mentionsText = notInVoiceMembers.join(' ');
    // Discord mesaj sınırı 2000 karakterdir, etiket metnini güvenli kırpalım
    const safeMentions = mentionsText.length > 1800 ? mentionsText.substring(0, 1800) + '...' : mentionsText;

    const embed = createEmbed({
      title: '📢 Yetkili Ses Odası Çağrısı!',
      description:
        `Saygıdeğer yetkililerimiz, sunucu düzeni ve iletişimi için ses kanallarında aktif olmanız beklenmektedir.\n` +
        (customNote ? `\n💬 **Yetkili Notu:** *"${customNote}"*\n` : '\n') +
        `Lütfen müsait olan yetkililerimiz **en kısa sürede ses odalarına geçiş yapsın.**`,
      color: DEFAULT_COLORS.WARNING as any,
      fields: [
        {
          name: `❌ Seste Olmayan Yetkililer (${notInVoiceMembers.length})`,
          value: notInVoiceMembers.length > 30 ? notInVoiceMembers.slice(0, 30).join(' ') + ` ve ${notInVoiceMembers.length - 30} kişi daha` : notInVoiceMembers.join(' '),
          inline: false,
        },
        {
          name: `✅ Seste Olan Yetkililer (${inVoiceMembers.length})`,
          value: inVoiceMembers.length > 0 ? (inVoiceMembers.length > 15 ? inVoiceMembers.slice(0, 15).join(' ') + ` ve ${inVoiceMembers.length - 15} kişi daha` : inVoiceMembers.join(' ')) : '_Şu an seste yetkili yok._',
          inline: false,
        },
      ],
      footer: { text: `Çağrıyı Yapan: ${interaction.user.tag} • Priv Yetkili Sistemi` },
      timestamp: true,
    });

    // Mesajda etiketleyerek bildirim düşmesini sağla
    await interaction.editReply({
      content: `🔔 **Ses Çağrısı:** ${safeMentions}`,
      embeds: [embed],
    });
  },
};
