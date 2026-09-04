import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { wordGameService } from '../../services/wordGame.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const kelimeOyunCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('kelime-oyun')
    .setDescription('Kelime türetmece oyunu kanalını ayarlar veya oyun durumunu gösterir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((sub) =>
      sub
        .setName('ayarla')
        .setDescription('Kelime oyununun oynanacağı kanalı belirler.')
        .addChannelOption((opt) =>
          opt
            .setName('kanal')
            .setDescription('Kelime oyunu kanalı')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('durum').setDescription('Mevcut kelime oyunu durumunu ve son harfi gösterir.')
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut yalnızca sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'ayarla') {
      const channel = interaction.options.getChannel('kanal', true) as TextChannel;
      const state = wordGameService.setChannel(interaction.guild.id, channel.id);

      const embed = createEmbed({
        title: '🔤 Kelime Türetmece Oyunu Başlatıldı!',
        description:
          `Kelime oyunu kanalı başarıyla <#${channel.id}> olarak ayarlandı!\n\n` +
          `**Kurallar:**\n` +
          `1. Her kelime bir önceki kelimenin **son harfiyle** başlamalıdır.\n` +
          `2. Aynı kullanıcı **üst üste 2 kez** kelime yazamaz.\n` +
          `3. Bu turda daha önce kullanılmış bir kelime **tekrar yazılamaz**.\n` +
          `4. Her doğru kelime için kullanıcıya **+5 Coin** hediye edilir!\n\n` +
          `👉 **İlk Kelime:** \`${state.lastWord}\`\n` +
          `🎯 **Başlanacak Harf:** **"${state.lastLetter.toLocaleUpperCase('tr-TR')}"**`,
        color: DEFAULT_COLORS.SUCCESS,
      });
      embed.setFooter({ text: 'Vip Metro • Kelime Oyunu' });

      await channel.send({ embeds: [embed] }).catch(() => {});

      await interaction.reply({
        content: `✅ Kelime oyunu kanalı <#${channel.id}> olarak ayarlandı ve ilk kelime gönderildi!`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'durum') {
      const state = wordGameService.getState(interaction.guild.id);
      if (!state) {
        await interaction.reply({
          content: '⚠️ Sunucuda henüz ayarlanmış bir kelime oyunu kanalı bulunmuyor. `/kelime-oyun ayarla` ile başlatabilirsiniz.',
          ephemeral: true,
        });
        return;
      }

      const embed = createEmbed({
        title: '🔤 Kelime Oyunu Durumu',
        description:
          `• **Oyun Kanalı:** <#${state.channelId}>\n` +
          `• **Son Yazılan Kelime:** \`${state.lastWord}\`\n` +
          `• **Sıradaki Harf:** **"${state.lastLetter.toLocaleUpperCase('tr-TR')}"**\n` +
          `• **Son Yazan:** ${state.lastUserId ? `<@${state.lastUserId}>` : 'Yok'}\n` +
          `• **Mevcut Seri:** \`${state.streak}\` kelime\n` +
          `• **Kullanılan Toplam Kelime:** \`${state.usedWords.length}\``,
        color: DEFAULT_COLORS.PRIMARY,
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  },
};
