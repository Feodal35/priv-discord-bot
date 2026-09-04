import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { marriageService } from '../../services/marriage.service';
import { createEmbed, createErrorEmbed, createSuccessEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const bosanCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('boşan')
    .setDescription('Mevcut evliliğini sonlandırmak için boşanma davası açar.'),
  cooldown: 10,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda geçerlidir.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const marriage = await marriageService.getMarriage(guildId, userId);
    if (!marriage) {
      await interaction.reply({
        embeds: [createErrorEmbed('Evli Değilsin', 'Şu anda boşanabileceğin bir evliliğin bulunmuyor.')],
        ephemeral: true,
      });
      return;
    }

    const partnerId = marriage.user1Id === userId ? marriage.user2Id : marriage.user1Id;

    const embed = createEmbed({
      title: '⚖️ Boşanma Davası Onayı',
      description:
        `💔 <@${partnerId}> ile olan evliliğini sonlandırmak istediğinden emin misin?\n\n` +
        `**Yasal Süreç Bilgilendirmesi:**\n` +
        `• Mahkeme & Avukat Masrafı: **1.000 Coin**\n` +
        `• Ortak Kasa Tasfiyesi: Mevcut **${marriage.jointCoins} Coin** iki tarafa eşit (%50 / %50) paylaştırılacaktır.\n` +
        `• Ses odası aşk XP boostu ve aşk puanları sıfırlanacaktır.\n\n` +
        `Bu işlem geri alınamaz!`,
      color: DEFAULT_COLORS.WARNING,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`divorce_confirm_${userId}`)
        .setLabel('Evet, Boşanmak İstiyorum')
        .setEmoji('💔')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`divorce_cancel_${userId}`)
        .setLabel('Vazgeç')
        .setEmoji('↩️')
        .setStyle(ButtonStyle.Secondary)
    );

    const replyMsg = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
      ephemeral: true,
    });

    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000,
    });

    collector.on('collect', async (btnInt) => {
      if (btnInt.user.id !== userId) return;

      if (btnInt.customId === `divorce_confirm_${userId}`) {
        const result = await marriageService.divorce(guildId, userId);

        if (!result.success) {
          await btnInt.update({
            embeds: [createErrorEmbed('Boşanma Başarısız', result.message)],
            components: [],
          });
          collector.stop('failed');
          return;
        }

        const successEmbed = createEmbed({
          title: '⚖️ Boşanma Gerçekleşti',
          description:
            `💔 Mahkeme kararıyla <@${userId}> ile <@${partnerId}> çiftinin evliliği resmen sonlandırılmıştır.\n\n` +
            `• Mahkeme masrafı tahsil edildi: **1.000 Coin**\n` +
            (result.splitCoins && result.splitCoins > 0
              ? `• Ortak kasadaki bakiye iki tarafa da **+${result.splitCoins} Coin** olarak aktarıldı.\n`
              : '') +
            `\n*Her iki tarafa da hayatında mutluluklar dileriz.*`,
          color: DEFAULT_COLORS.DANGER,
        });

        await btnInt.update({
          embeds: [successEmbed],
          components: [],
        });

        // Kanala genel duyuru gönder
        if (interaction.channel && 'send' in interaction.channel) {
          await interaction.channel.send({
            content: `📢 <@${userId}> ile <@${partnerId}> boşandı... 💔`,
          }).catch(() => {});
        }

        collector.stop('confirmed');
      } else {
        await btnInt.update({
          embeds: [createSuccessEmbed('İptal Edildi', 'Boşanma başvurusu iptal edildi. Evliliğiniz devam ediyor! 💕')],
          components: [],
        });
        collector.stop('cancelled');
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({
          content: '⏳ Boşanma onayı zaman aşımına uğradı.',
          components: [],
        }).catch(() => {});
      }
    });
  },
};
