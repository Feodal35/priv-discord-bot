import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { questService } from '../../services/quest.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, createProgressBar, formatCurrency } from '@priv/shared';

export const gorevCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('görev')
    .setDescription('Aktif günlük ve haftalık görevlerini ve ilerlemeni listeler.'),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const userQuests = await questService.getUserQuests(interaction.guild.id, interaction.user.id);

    const claimableButtons: ButtonBuilder[] = [];

    const fields = userQuests.map((uq) => {
      const percent = Math.min(100, Math.round((uq.currentAmount / uq.quest.targetAmount) * 100));
      const bar = createProgressBar(percent, 8);
      let status = `${bar} (${uq.currentAmount}/${uq.quest.targetAmount})`;

      if (uq.isClaimed) {
        status = '✅ **Ödül Toplandı**';
      } else if (uq.isCompleted) {
        status = '🎁 **Ödül Hazır! Toplamak için aşağıdaki butona tıkla.**';
        claimableButtons.push(
          new ButtonBuilder()
            .setCustomId(`quest_claim_${uq.id}`)
            .setLabel(`Ödülü Al: ${uq.quest.title.slice(0, 15)}`)
            .setStyle(ButtonStyle.Success)
        );
      }

      return {
        name: `📋 [${uq.quest.frequency === 'DAILY' ? 'GÜNLÜK' : 'HAFTALIK'}] ${uq.quest.title}`,
        value: `*${uq.quest.description}*\n${status}\nÖdül: **${formatCurrency(uq.quest.rewardCoins)} Coin** & **${formatCurrency(uq.quest.rewardXp)} XP**`,
        inline: false,
      };
    });

    const embed = createEmbed({
      title: '🎯 Görev Merkezi',
      description: 'Görevleri tamamlayarak ekstra Coin ve XP kazanabilirsin!',
      color: DEFAULT_COLORS.INFO,
      fields,
    });

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    if (claimableButtons.length > 0) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimableButtons.slice(0, 5));
      rows.push(row);
    }

    await interaction.reply({ embeds: [embed], components: rows });
  },
};
