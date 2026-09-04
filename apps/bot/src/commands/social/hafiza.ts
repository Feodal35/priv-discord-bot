import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { memoryService } from '../../services/memory.service';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const hafizaCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('hafıza')
    .setDescription('Sunucunun tarihi anlarını ve hatıra defterini yönetir.')
    .addSubcommand((sub) =>
      sub.setName('liste').setDescription('Sunucuda kaydedilmiş önemli hatıraları listeler.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('ekle')
        .setDescription('Sunucu hatıra defterine yeni bir anı ekler (Yetkili).')
        .addStringOption((opt) => opt.setName('başlık').setDescription('Anının başlığı').setRequired(true))
        .addStringOption((opt) => opt.setName('açıklama').setDescription('Anının açıklaması').setRequired(true))
        .addStringOption((opt) => opt.setName('tarih').setDescription('Tarih (GG.AA.YYYY)').setRequired(false))
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'liste') {
      const memories = await memoryService.getMemories(interaction.guild.id);
      if (memories.length === 0) {
        await interaction.reply({
          content: '📜 Henüz sunucu hafızasına kaydedilmiş bir anı bulunmuyor.',
          ephemeral: true,
        });
        return;
      }

      const fields = memories.map((m) => ({
        name: `📌 ${m.title} — ${m.eventDate.toLocaleDateString('tr-TR')}`,
        value: `*${m.description}*\n*Ekleyen:* <@${m.createdBy}>`,
        inline: false,
      }));

      const embed = createEmbed({
        title: '📖 Sunucu Hatıra Defteri',
        description: 'Sunucumuzun unutulmaz dönüm noktaları ve özel anları:',
        color: DEFAULT_COLORS.GOLD,
        fields,
      });

      await interaction.reply({ embeds: [embed] });
    } else if (subcommand === 'ekle') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          embeds: [createErrorEmbed('Yetki Yetersiz', 'Bu komutu kullanmak için `Sunucuyu Yönet` yetkisine sahip olmalısın.')],
          ephemeral: true,
        });
        return;
      }

      const title = interaction.options.getString('başlık', true);
      const description = interaction.options.getString('açıklama', true);
      const dateStr = interaction.options.getString('tarih');

      let eventDate = new Date();
      if (dateStr) {
        const parts = dateStr.split('.');
        if (parts.length === 3) {
          eventDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }

      await memoryService.addMemory(
        interaction.guild.id,
        title,
        eventDate,
        description,
        interaction.user.id
      );

      await interaction.reply({
        embeds: [createSuccessEmbed('Hafızaya Eklendi', `**${title}** hatırası başarıyla sunucu defterine kaydedildi.`)],
      });
    }
  },
};
