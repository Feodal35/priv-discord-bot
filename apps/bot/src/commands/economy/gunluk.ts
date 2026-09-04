import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, AttachmentBuilder } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { streakService } from '../../services/streak.service';
import { guildService } from '../../services/guild.service';
import { createWarningEmbed } from '../../utils/embed';
import { formatCurrency } from '@priv/shared';
import { createDailyRewardCard } from '../../utils/canvas';

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

    await interaction.deferReply();

    const settings = await guildService.getGuildSettings(interaction.guild.id);
    if (!settings.economyEnabled) {
      await interaction.editReply({ content: '⚠️ Bu sunucuda ekonomi sistemi devre dışı bırakılmış.' });
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
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createDailyRewardCard({
        avatarUrl:      interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
        username:       interaction.user.username,
        coins:          res.rewardCoins,
        streak:         res.streak,
        currencyName:   settings.currencyName,
        milestoneBonus: res.milestoneBonus > 0 ? res.milestoneBonus : undefined,
        milestoneTitle: res.milestoneBonus > 0 ? res.milestoneTitle : undefined,
      });
    } catch (err) {
      console.error('[GÜNLÜK] Canvas hatası:', err);
    }

    let extraText = '';
    if (res.streakReset) {
      extraText = '\n⚠️ *Son ödülün üzerinden 48 saatten fazla geçtiği için serin sıfırlandı.*';
    }
    if (res.milestoneBonus > 0) {
      extraText += `\n\n🎉 **KİLOMETRE TAŞI ULAŞILDI!**\n**${res.milestoneTitle}** ünvanı ve fazladan **+${formatCurrency(res.milestoneBonus)} ${settings.currencyName}** kazandın!`;
    }

    // Build a clean embed to accompany the card
    const { EmbedBuilder } = await import('discord.js');
    const embed = new EmbedBuilder()
      .setColor(0x27ae60)
      .setTitle('✅ Günlük Ödül Toplandı!')
      .setDescription(
        `💰 Hesabına **+${formatCurrency(res.rewardCoins)} ${settings.currencyName}** eklendi!\n` +
        `🔥 **Günlük Streak:** ${res.streak} Gün${extraText}\n\n` +
        `_Serini kaybetmemek için yarın tekrar gelmeyi unutma!_`
      )
      .setTimestamp();

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'gunluk.png' });
      embed.setImage('attachment://gunluk.png');
      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
