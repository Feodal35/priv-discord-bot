import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { reminderService } from '../../services/reminder.service';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const hatirlatCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('hatırlat')
    .setDescription('Belirlediğin bir süre sonra sana bir not hatırlatır.')
    .addStringOption((opt) =>
      opt.setName('süre').setDescription('Örnek: 10dk, 2saat, 1gün, 30sn').setRequired(true)
    )
    .addStringOption((opt) => opt.setName('not').setDescription('Hatırlatılacak mesaj').setRequired(true))
    .addBooleanOption((opt) => opt.setName('dm').setDescription('DM üzerinden mi hatırlatılsın?').setRequired(false)),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const durationStr = interaction.options.getString('süre', true).toLowerCase().trim();
    const note = interaction.options.getString('not', true);
    const isDm = interaction.options.getBoolean('dm') || false;

    // Süre ayrıştırıcı (Regex)
    const match = durationStr.match(/^(\d+)\s*(s|sn|saniye|m|dk|dakika|h|sa|saat|d|g|gün)$/);
    if (!match) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Geçersiz Süre Formatı',
            'Lütfen geçerli bir süre formatı girin!\nÖrnekler: `30sn`, `15dk`, `2saat`, `1gün`'
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    let multiplierSeconds = 60;
    if (['s', 'sn', 'saniye'].includes(unit)) multiplierSeconds = 1;
    else if (['m', 'dk', 'dakika'].includes(unit)) multiplierSeconds = 60;
    else if (['h', 'sa', 'saat'].includes(unit)) multiplierSeconds = 3600;
    else if (['d', 'g', 'gün'].includes(unit)) multiplierSeconds = 86400;

    const totalSeconds = value * multiplierSeconds;
    if (totalSeconds < 10) {
      await interaction.reply({
        embeds: [createErrorEmbed('Süre Çok Kısa', 'Hatırlatıcı süresi en az 10 saniye olmalıdır.')],
        ephemeral: true,
      });
      return;
    }

    const remindAt = new Date(Date.now() + totalSeconds * 1000);

    await reminderService.createReminder(
      interaction.guild.id,
      interaction.user.id,
      interaction.channelId,
      remindAt,
      note,
      isDm
    );

    const timestampCode = `<t:${Math.floor(remindAt.getTime() / 1000)}:R>`;

    const embed = createSuccessEmbed(
      'Hatırlatıcı Kuruldu!',
      `⏰ Notun kaydedildi! ${timestampCode} sana (${isDm ? 'DM ile' : 'bu kanaldan'}) hatırlatacağım:\n\n> **${note}**`
    );

    await interaction.reply({ embeds: [embed] });
  },
};
