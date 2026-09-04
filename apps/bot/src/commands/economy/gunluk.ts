import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { streakService } from '../../services/streak.service';
import { guildService } from '../../services/guild.service';
import { createSuccessEmbed, createWarningEmbed } from '../../utils/embed';
import { formatCurrency } from '@priv/shared';

export const gunlukCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('günlük')
    .setDescription('Günlük coin ödülünü toplar ve aktiflik streakini artırır.'),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const settings = await guildService.getGuildSettings(interaction.guild.id);
    if (!settings.economyEnabled) {
      await interaction.reply({
        content: '⚠️ Bu sunucuda ekonomi sistemi devre dışı bırakılmış.',
        ephemeral: true,
      });
      return;
    }

    const res = await streakService.claimDaily(
      interaction.guild.id,
      interaction.user.id,
      interaction.channel as TextChannel,
      interaction.client
    );

    if (!res.success) {
      const embed = createWarningEmbed('Günlük Ödül Beklemede', res.message);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    let extraText = '';
    if (res.streakReset) {
      extraText = '\n⚠️ *Son ödülün üzerinden 48 saatten fazla geçtiği için serin sıfırlandı.*';
    }
    if (res.milestoneBonus > 0) {
      extraText += `\n\n🎉 **KİLOMETRE TAŞI ULAŞILDI!**\n**${res.milestoneTitle}** ünvanı ve fazladan **+${formatCurrency(res.milestoneBonus)} ${settings.currencyName}** kazandın!`;
    }

    const embed = createSuccessEmbed(
      'Günlük Ödül Toplandı!',
      `💰 Hesabına **+${formatCurrency(res.rewardCoins)} ${settings.currencyName}** eklendi!\n🔥 **Günlük Streak:** ${res.streak} Gün${extraText}\n\nSerini kaybetmemek için yarın tekrar gelmeyi unutma!`
    );

    await interaction.reply({ embeds: [embed] });
  },
};
