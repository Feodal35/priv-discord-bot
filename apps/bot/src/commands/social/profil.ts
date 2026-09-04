import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { userService } from '../../services/user.service';
import { guildService } from '../../services/guild.service';
import { createProfileEmbed } from '../../utils/embed';
import { createProfileCard } from '../../utils/canvas';

export const profilCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Kendinin veya bir üyenin sunucu profil kartını görüntüler.')
    .addUserOption((option) =>
      option.setName('üye').setDescription('Profilini görmek istediğin üye').setRequired(false)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const targetUser = interaction.options.getUser('üye') || interaction.user;
    const guildId = interaction.guild.id;

    const profile = await userService.getUserProfile(targetUser.id, guildId, interaction.client);
    const settings = await guildService.getGuildSettings(guildId);

    // Canvas profil kartı
    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createProfileCard({
        avatarUrl:    profile.avatarUrl,
        username:     profile.displayName,
        title:        profile.title,
        bio:          profile.bio,
        level:        profile.level,
        xp:           profile.xp,
        xpNeeded:     profile.xpNeeded,
        coins:        profile.coins,
        streak:       profile.streak,
        rank:         profile.rank,
        messageCount: profile.messageCount,
        badges:       profile.badges,
      });
    } catch (err) {
      console.error('[PROFİL] Canvas hatası:', err);
    }

    const embed = createProfileEmbed(profile, settings.currencyName, settings.currencyEmoji);
    if (imageBuffer) embed.setImage('attachment://profile.png');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`profile_achievements_${targetUser.id}`)
        .setLabel('🏆 Başarımlar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`profile_stats_${targetUser.id}`)
        .setLabel('📊 İstatistik')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`profile_inventory_${targetUser.id}`)
        .setLabel('💰 Envanter')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`profile_streak_${targetUser.id}`)
        .setLabel('🔥 Streak')
        .setStyle(ButtonStyle.Secondary)
    );

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile.png' });
      await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [row] });
    }
  },
};
