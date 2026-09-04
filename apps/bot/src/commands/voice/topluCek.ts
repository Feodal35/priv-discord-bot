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

export const topluCekCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('topluçek')
    .setDescription('Yetkililer için: Bir veya tüm ses kanallarındaki üyeleri bulunduğun odaya topluca çeker.')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addChannelOption((opt) =>
      opt
        .setName('kaynak-kanal')
        .setDescription('Üyelerin çekileceği ses kanalı (Seçilmezse tüm ses kanallarındaki üyeler çekilir)')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('botlar-dahil')
        .setDescription('Botlar da çekilsin mi? (Varsayılan: Hayır)')
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

    const targetVoice = member.voice.channel as VoiceBasedChannel | null;
    if (!targetVoice) {
      await interaction.reply({
        embeds: [createErrorEmbed('Seste Değilsin', 'Toplu çekme yapabilmek için önce bir ses kanalında bulunmalısın!')],
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

    await interaction.deferReply({ ephemeral: true });

    const sourceChannel = interaction.options.getChannel('kaynak-kanal') as VoiceBasedChannel | null;
    const includeBots = interaction.options.getBoolean('botlar-dahil') || false;

    let membersToMove: GuildMember[] = [];

    if (sourceChannel) {
      if (sourceChannel.id === targetVoice.id) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Geçersiz İşlem', 'Kaynak kanal ile bulunduğunuz kanal aynı olamaz!')],
        });
        return;
      }

      membersToMove = Array.from(sourceChannel.members.values());
    } else {
      // Tüm ses kanallarından topla (hedef kanal hariç)
      for (const [, ch] of interaction.guild.channels.cache) {
        if (ch.isVoiceBased() && ch.id !== targetVoice.id) {
          for (const [, m] of ch.members) {
            membersToMove.push(m);
          }
        }
      }
    }

    // Filtreleme: botlar ve kendisi
    membersToMove = membersToMove.filter((m) => {
      if (m.id === member.id) return false;
      if (m.id === botMember.id) return false;
      if (!includeBots && m.user.bot) return false;
      return true;
    });

    if (membersToMove.length === 0) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Üye Bulunamadı', 'Çekilecek herhangi bir uygun üye bulunamadı.')],
      });
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const m of membersToMove) {
      try {
        await m.voice.setChannel(targetVoice);
        successCount++;
      } catch {
        failCount++;
      }
    }

    const embed = createEmbed({
      title: '🔊 Toplu Çekme Tamamlandı',
      description:
        `👑 <@${member.id}> tarafından toplu çekme işlemi uygulandı.\n\n` +
        `🎯 **Hedef Kanal:** <#${targetVoice.id}> (${targetVoice.name})\n` +
        (sourceChannel ? `📍 **Kaynak Kanal:** <#${sourceChannel.id}>\n` : `🌐 **Kapsam:** Tüm ses kanalları\n`) +
        `✅ **Taşınan Üye Sayısı:** \`${successCount}\`\n` +
        (failCount > 0 ? `⚠️ **Taşınamayan / Hata:** \`${failCount}\`\n` : '') +
        `🤖 **Botlar:** \`${includeBots ? 'Dahil edildi' : 'Hariç tutuldu'}\``,
      color: DEFAULT_COLORS.SUCCESS,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
