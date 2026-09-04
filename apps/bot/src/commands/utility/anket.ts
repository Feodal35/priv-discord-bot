import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { pollService } from '../../services/poll.service';
import { createErrorEmbed } from '../../utils/embed';

export const anketCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('anket')
    .setDescription('Buton tabanlı interaktif bir anket başlatır.')
    .addStringOption((opt) => opt.setName('soru').setDescription('Anket sorusu').setRequired(true))
    .addStringOption((opt) => opt.setName('seçenek1').setDescription('1. Seçenek').setRequired(true))
    .addStringOption((opt) => opt.setName('seçenek2').setDescription('2. Seçenek').setRequired(true))
    .addStringOption((opt) => opt.setName('seçenek3').setDescription('3. Seçenek').setRequired(false))
    .addStringOption((opt) => opt.setName('seçenek4').setDescription('4. Seçenek').setRequired(false))
    .addStringOption((opt) => opt.setName('seçenek5').setDescription('5. Seçenek').setRequired(false))
    .addBooleanOption((opt) => opt.setName('anonim').setDescription('Oylar anonim olsun mu?').setRequired(false)),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({ content: 'Bu komut sadece sunucu kanallarında kullanılabilir.', ephemeral: true });
      return;
    }

    const question = interaction.options.getString('soru', true);
    const opt1 = interaction.options.getString('seçenek1', true);
    const opt2 = interaction.options.getString('seçenek2', true);
    const opt3 = interaction.options.getString('seçenek3');
    const opt4 = interaction.options.getString('seçenek4');
    const opt5 = interaction.options.getString('seçenek5');
    const isAnonymous = interaction.options.getBoolean('anonim') || false;

    const options = [opt1, opt2, opt3, opt4, opt5].filter(Boolean) as string[];

    await interaction.deferReply();

    // Geçici bir mesaj oluşturup ID'sini alacağız
    const initialMsg = await interaction.editReply({ content: '📊 Anket hazırlanıyor...' });

    const poll = await pollService.createPoll(
      interaction.guild.id,
      interaction.channel.id,
      initialMsg.id,
      question,
      options,
      isAnonymous
    );

    const display = await pollService.getPollDisplay(poll.id);
    if (!display) {
      await interaction.editReply({ embeds: [createErrorEmbed('Hata', 'Anket oluşturulamadı.')] });
      return;
    }

    await interaction.editReply({
      content: '',
      embeds: [display.embed],
      components: display.components,
    });
  },
};
