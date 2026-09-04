import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { calculateShipPercentage, createProgressBar, DEFAULT_COLORS } from '@priv/shared';
import { createEmbed } from '../../utils/embed';

export const shipCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('İki kullanıcı arasındaki aşk ve uyum yüzdesini hesaplar.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Uyumuna bakacağın üye').setRequired(true))
    .addUserOption((opt) => opt.setName('ikinci_üye').setDescription('İkinci üye (Boş bırakırsan sen olursun)').setRequired(false)),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const firstUser = interaction.options.getUser('ikinci_üye') ? interaction.options.getUser('üye', true) : interaction.user;
    const secondUser = interaction.options.getUser('ikinci_üye') || interaction.options.getUser('üye', true);

    const percent = calculateShipPercentage(firstUser.id, secondUser.id);
    const bar = createProgressBar(percent, 10);

    let comment = '';
    let emoji = '❤️';

    if (percent >= 90) {
      comment = 'Bu işte bir şeyler var! Ruh ikizleri kesinlikle sizsiniz, hemen nikah masası ayarlansın! 💍✨';
      emoji = '💖';
    } else if (percent >= 75) {
      comment = 'Aralarında muazzam bir kimya ve çekim var. Bu aşk tutar! 🔥';
      emoji = '💕';
    } else if (percent >= 50) {
      comment = 'Fena değil, güzel bir sohbetle her şey başlayabilir. Şans verilebilir! 😉';
      emoji = '💛';
    } else if (percent >= 25) {
      comment = 'Arkadaş olarak kalsanız sanki iki taraf için de daha hayırlı olur gibi... 😅';
      emoji = '💔';
    } else {
      comment = 'Birbirinize elektrik çarpmış gibi kaçın! Uyum sıfırın altında kutuplarda! 🥶❌';
      emoji = '🖤';
    }

    const embed = createEmbed({
      title: `${emoji} Priv Aşk Uyumu (Ship)`,
      description: `### ${firstUser.username} × ${secondUser.username}\n\n**Uyum Yüzdesi:**\n\`${bar}\`\n\n> *"${comment}"*`,
      color: percent >= 50 ? DEFAULT_COLORS.DANGER : DEFAULT_COLORS.SECONDARY,
    });

    await interaction.reply({ embeds: [embed] });
  },
};
