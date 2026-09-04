import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { calculateShipPercentage, DEFAULT_COLORS } from '@priv/shared';
import { createEmbed } from '../../utils/embed';
import { createShipImage } from '../../utils/canvas';

export function getShipComment(percent: number): { comment: string; emoji: string; color: number } {
  if (percent >= 90)
    return { comment: 'Bu işte bir şeyler var! Ruh ikizleri kesinlikle sizsiniz, hemen nikah masası ayarlansın! 💍✨', emoji: '💖', color: 0xff6b9d };
  if (percent >= 75)
    return { comment: 'Aralarında muazzam bir kimya ve çekim var. Bu aşk kesinlikle tutar! 🔥', emoji: '💕', color: 0xe74c3c };
  if (percent >= 50)
    return { comment: 'Fena değil, güzel bir sohbetle her şey başlayabilir. Şans verilebilir! 😉', emoji: '💛', color: 0xf39c12 };
  if (percent >= 25)
    return { comment: 'Arkadaş olarak kalsanız sanki iki taraf için de daha hayırlı olur gibi... 😅', emoji: '💔', color: 0x3498db };
  return { comment: 'Birbirinize elektrik çarpmış gibi kaçın! Uyum sıfırın altında kutuplarda! 🥶❌', emoji: '🖤', color: 0x636e72 };
}

export function generateShipName(a: string, b: string): string {
  const h1 = a.substring(0, Math.ceil(a.length / 2));
  const h2 = b.substring(Math.floor(b.length / 2));
  return (h1 + h2).toLowerCase().slice(0, 20);
}

export const shipCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('İki kullanıcı arasındaki aşk ve uyum yüzdesini hesaplar.')
    .addUserOption((opt) =>
      opt.setName('üye').setDescription('Uyumuna bakacağın üye').setRequired(true)
    )
    .addUserOption((opt) =>
      opt.setName('ikinci_üye').setDescription('İkinci üye (Boş bırakırsan sen olursun)').setRequired(false)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const hasSecond = !!interaction.options.getUser('ikinci_üye');
    const firstUser  = hasSecond ? interaction.options.getUser('üye', true) : interaction.user;
    const secondUser = hasSecond
      ? interaction.options.getUser('ikinci_üye', true)
      : interaction.options.getUser('üye', true);

    const percent  = calculateShipPercentage(firstUser.id, secondUser.id);
    const { comment, emoji, color } = getShipComment(percent);
    const shipName = generateShipName(firstUser.username, secondUser.username);

    const avatar1 = firstUser.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar2 = secondUser.displayAvatarURL({ extension: 'png', size: 256 });

    // ── Canvas image ──
    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createShipImage(avatar1, avatar2, percent);
    } catch (err) {
      console.error('[SHIP] Canvas oluşturma hatası:', err);
    }

    const embed = createEmbed({
      title: `${emoji}  [ ${firstUser.username}  &  ${secondUser.username} ]  —  #${shipName}`,
      description: `> *${comment}*`,
      color: color as any,
      timestamp: false,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ship_retry_${firstUser.id}_${secondUser.id}`)
        .setLabel('🔄 Yeniden Dene')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`ship_swap_${secondUser.id}_${firstUser.id}`)
        .setLabel('🔀 Yer Değiştir')
        .setStyle(ButtonStyle.Secondary)
    );

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'ship.png' });
      embed.setImage('attachment://ship.png');
      await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [row] });
    }
  },
};
