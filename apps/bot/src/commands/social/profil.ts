import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { userService } from '../../services/user.service';
import { guildService } from '../../services/guild.service';
import { createProfileEmbed } from '../../utils/embed';

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

    const embed = createProfileEmbed(profile, settings.currencyName, settings.currencyEmoji);

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

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
