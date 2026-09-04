import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { achievementService } from '../../services/achievement.service';
import { createEmbed } from '../../utils/embed';
import { RARITY, RarityType, DEFAULT_COLORS } from '@priv/shared';

export const basarimlarCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('başarımlar')
    .setDescription('Kazanılan sunucu başarımlarını listeler.')
    .addUserOption((option) =>
      option.setName('üye').setDescription('Başarımlarını görmek istediğin üye').setRequired(false)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('üye') || interaction.user;
    const userAchievements = await achievementService.getUserAchievements(interaction.guild.id, targetUser.id);
    const allAchievements = await achievementService.getAllAchievements();

    const unlockedIds = new Set(userAchievements.map((ua) => ua.achievementId));

    const fields = allAchievements.map((ach) => {
      const isUnlocked = unlockedIds.has(ach.id);
      const rarityData = RARITY[ach.rarity as RarityType] || RARITY.COMMON;
      const status = isUnlocked ? '✅ Açıldı' : '🔒 Kilitli';

      return {
        name: `${ach.icon} ${ach.name} (${rarityData.emoji} ${rarityData.name}) — ${status}`,
        value: `*${ach.description}*\nŞart: \`${ach.requirement}\` | Ödül: \`${ach.rewardCoins} Coin\``,
        inline: false,
      };
    });

    const embed = createEmbed({
      title: `🏆 ${targetUser.username} — Başarımlar (${userAchievements.length}/${allAchievements.length})`,
      description: userAchievements.length === 0 ? 'Henüz herhangi bir başarım kazanmadın. Sohbete katılarak ilk başarımını açabilirsin!' : undefined,
      color: DEFAULT_COLORS.PURPLE,
      thumbnail: targetUser.displayAvatarURL(),
      fields: fields.slice(0, 15),
      footer: { text: 'Tüm başarımları toplayarak sunucunun efsanesi ol!' },
    });

    await interaction.reply({ embeds: [embed] });
  },
};
