import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { memoryService } from '../../services/memory.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency, formatHours } from '@priv/shared';

export const yilozetiCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('yılözeti')
    .setDescription('Sunucunun yıllık aktivite ve anı özetini görüntüler.')
    .addIntegerOption((opt) => opt.setName('yıl').setDescription('Özeti görüntülenecek yıl').setRequired(false)),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const currentYear = new Date().getFullYear();
    const year = interaction.options.getInteger('yıl') || currentYear;

    await interaction.deferReply();

    const summary = await memoryService.generateYearSummary(interaction.guild.id, year);

    const topChatterText =
      summary.topChatters.length > 0
        ? summary.topChatters.map((c) => `${c.rank}. <@${c.userId}> (${formatCurrency(c.messages)} mesaj)`).join('\n')
        : 'Veri yok';

    const topVoiceText =
      summary.topVoice.length > 0
        ? summary.topVoice.map((v) => `${v.rank}. <@${v.userId}> (${formatHours(v.hours)})`).join('\n')
        : 'Veri yok';

    const embed = createEmbed({
      title: `✨ ${interaction.guild.name} — ${year} Yılı Özeti`,
      description: `Birlikte geçirdiğimiz muhteşem bir yılın istatistikleri ve anıları!`,
      color: DEFAULT_COLORS.GOLD,
      thumbnail: interaction.guild.iconURL() || undefined,
      fields: [
        {
          name: '💬 Toplam Mesaj',
          value: `**${formatCurrency(summary.totalMessages)}** mesaj gönderildi`,
          inline: true,
        },
        {
          name: '🎤 Toplam Ses Süresi',
          value: `**${formatHours(summary.totalVoiceHours)}** ses odalarında kalındı`,
          inline: true,
        },
        {
          name: '🪙 Dönen Ekonomi',
          value: `**${formatCurrency(summary.totalCoins)}** Coin hacmi`,
          inline: true,
        },
        {
          name: '🏆 En Çok Konuşanlar (Top 3)',
          value: topChatterText,
          inline: false,
        },
        {
          name: '🎧 En Çok Ses Odasında Kalanlar (Top 3)',
          value: topVoiceText,
          inline: false,
        },
        {
          name: '📌 Yılın Önemli Anları',
          value:
            summary.memories.length > 0
              ? summary.memories.map((m) => `• **${m.date}**: ${m.title} (*${m.description}*)`).join('\n')
              : 'Bu yıla ait kaydedilmiş bir anı bulunmuyor.',
          inline: false,
        },
      ],
      footer: {
        text: `Nice yıllara ${interaction.guild.name} tayfası! 🎉`,
      },
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
