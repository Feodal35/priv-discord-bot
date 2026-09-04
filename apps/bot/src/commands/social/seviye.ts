import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { userService } from '../../services/user.service';
import { createEmbed } from '../../utils/embed';
import { formatCurrency, DEFAULT_COLORS, EMOJIS } from '@priv/shared';
import { createLevelCard } from '../../utils/canvas';

export const seviyeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('seviye')
    .setDescription('Seviye ve XP ilerlemeni görüntüler.')
    .addUserOption((option) =>
      option.setName('üye').setDescription('Seviyesini görmek istediğin üye').setRequired(false)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser('üye') || interaction.user;
    const profile = await userService.getUserProfile(targetUser.id, interaction.guild.id, interaction.client);

    // ── Canvas level card ──
    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createLevelCard(
        profile.avatarUrl,
        profile.displayName,
        profile.level,
        profile.xp,
        profile.xpNeeded,
        profile.rank
      );
    } catch (err) {
      console.error('[SEVİYE] Canvas oluşturma hatası:', err);
    }

    const embed = createEmbed({
      title: `${EMOJIS.LEVEL} ${profile.displayName} — Seviye Durumu`,
      description: `**Seviye ${profile.level}** · **#${profile.rank}** Sırada\n**${formatCurrency(profile.xp)}** / **${formatCurrency(profile.xpNeeded)}** XP\n\n_Mesaj yazarak ve ses kanalında vakit geçirerek XP kazan!_`,
      color: DEFAULT_COLORS.PRIMARY as any,
      thumbnail: imageBuffer ? undefined : profile.avatarUrl,
      footer: { text: `Priv Bot • ${profile.displayName}` },
      timestamp: false,
    });

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'level.png' });
      embed.setImage('attachment://level.png');
      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
