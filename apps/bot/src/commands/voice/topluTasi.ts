import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  VoiceBasedChannel,
  GuildMember,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const topluTasiCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('toplutaşı')
    .setDescription('Yetkililer için: Bir ses kanalındaki tüm üyeleri hedef ses odasına topluca taşır.')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addChannelOption((opt) =>
      opt
        .setName('hedef-kanal')
        .setDescription('Üyelerin taşınacağı hedef ses odası')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('kaynak-kanal')
        .setDescription('Üyelerin alınacağı kaynak ses odası (Seçilmezse bulunduğun odadaki herkes taşınır)')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('kendin-de-gec')
        .setDescription('Sen de hedef odaya geçmek istiyor musun? (Varsayılan: Evet)')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('botlar-dahil')
        .setDescription('Botlar da taşınsın mı? (Varsayılan: Hayır)')
        .setRequired(false)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const member =
      (interaction.member as GuildMember) ||
      (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
    if (!member) {
      await interaction.reply({ content: 'Kullanıcı bilgisi alınamadı.', ephemeral: true });
      return;
    }

    // Yetki kontrolü
    if (!member.permissions.has(PermissionFlagsBits.MoveMembers)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Yetki Yetersiz', 'Bu komutu kullanmak için `Üyeleri Taşı` yetkisine sahip olmalısın!')],
        ephemeral: true,
      });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.MoveMembers)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Bot Yetkisi Yetersiz', 'Botun sunucuda `Üyeleri Taşı` yetkisi bulunmuyor!')],
        ephemeral: true,
      });
      return;
    }

    const targetChannel = interaction.options.getChannel('hedef-kanal', true) as VoiceBasedChannel;
    const sourceChannelOption = interaction.options.getChannel('kaynak-kanal') as VoiceBasedChannel | null;
    const moveSelf = interaction.options.getBoolean('kendin-de-gec') ?? true;
    const includeBots = interaction.options.getBoolean('botlar-dahil') || false;

    // Kaynak odayı belirle
    let sourceChannel: VoiceBasedChannel | null = sourceChannelOption;
    if (!sourceChannel) {
      if (!member.voice.channel) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Oda Belirtilmedi',
              'Şu anda bir ses kanalında değilsin! Lütfen bir ses odasına katıl veya `kaynak-kanal` seçeneğini kullan.'
            ),
          ],
          ephemeral: true,
        });
        return;
      }
      sourceChannel = member.voice.channel as VoiceBasedChannel;
    }

    if (sourceChannel.id === targetChannel.id) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz İşlem', 'Kaynak ses odası ile hedef ses odası aynı olamaz!')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    let membersToMove = Array.from(sourceChannel.members.values());

    membersToMove = membersToMove.filter((m) => {
      if (m.id === botMember.id) return false;
      if (!moveSelf && m.id === member.id) return false;
      if (!includeBots && m.user.bot) return false;
      return true;
    });

    if (membersToMove.length === 0) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Üye Bulunamadı', `<#${sourceChannel.id}> odasında taşınacak uygun üye bulunmuyor.`)],
      });
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const m of membersToMove) {
      try {
        await m.voice.setChannel(targetChannel);
        successCount++;
      } catch {
        failCount++;
      }
    }

    const embed = createEmbed({
      title: '🚀 Toplu Taşıma Tamamlandı',
      description:
        `👑 <@${member.id}> tarafından toplu taşıma işlemi gerçekleştirildi.\n\n` +
        `📍 **Kaynak Kanal:** <#${sourceChannel.id}> (${sourceChannel.name})\n` +
        `🎯 **Hedef Kanal:** <#${targetChannel.id}> (${targetChannel.name})\n` +
        `✅ **Taşınan Üye Sayısı:** \`${successCount}\`\n` +
        (failCount > 0 ? `⚠️ **Taşınamayan / Hata:** \`${failCount}\`\n` : '') +
        `🤖 **Botlar:** \`${includeBots ? 'Dahil edildi' : 'Hariç tutuldu'}\``,
      color: DEFAULT_COLORS.SUCCESS,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
