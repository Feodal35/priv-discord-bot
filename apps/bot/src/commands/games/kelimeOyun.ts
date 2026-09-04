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
    )
    .addSubcommand((sub) =>
      sub
        .setName('sifirla')
        .setDescription('Kelime oyununu yeni bir kelimeyle sıfırlayıp baştan başlatır.')
        .addStringOption((opt) =>
          opt
            .setName('ilk-kelime')
            .setDescription('Başlangıç kelimesi (Varsayılan: elma)')
            .setRequired(false)
        )
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
          `**Oyun Kuralları:**\n` +
          `• 🎯 **Kural 1:** Her kelime bir önceki kelimenin **son harfiyle** başlamalıdır.\n` +
          `• ⏳ **Kural 2:** Aynı kişi **üst üste 2 kez** yazamaz (sırayla oynanır).\n` +
          `• 🔁 **Kural 3:** Bu turda daha önce kullanılmış kelimeler **tekrar yazılamaz**.\n` +
          `• 📕 **Kural 4:** Sadece gerçek ve geçerli **Türkçe kelimeler** kabul edilir (76.000+ TDK Sözlük).\n` +
          `• 🚫 **Kural 5:** Bu kanalda **sohbet etmek kesinlikle yasaktır!** Sadece sıradaki kelime yazılabilir, hatalı veya sohbet mesajları otomatik silinir.\n` +
          `• 💰 **Ödül:** Her doğru kelime için anında **+5 Coin** hediye edilir!\n\n` +
          `👉 **İlk Kelime:** \`${state.lastWord}\`\n` +
          `🎯 **Sıradaki Harf:** **"${state.lastLetter.toLocaleUpperCase('tr-TR')}"**`,
        color: DEFAULT_COLORS.SUCCESS,
      });
      embed.setFooter({ text: 'Vip Metro • Kelime Türetmece' });

      await channel.send({ embeds: [embed] }).catch(() => {});

      await interaction.reply({
        content: `✅ Kelime oyunu kanalı <#${channel.id}> olarak ayarlandı ve kurallar gönderildi!`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'sifirla') {
      const startWord = interaction.options.getString('ilk-kelime') || 'elma';
      const state = wordGameService.resetGame(interaction.guild.id, startWord);
      if (!state || !state.channelId) {
        await interaction.reply({
          content: '⚠️ Önce `/kelime-oyun ayarla` ile bir kanal belirlemelisiniz.',
          ephemeral: true,
        });
        return;
      }

      const channel = (await interaction.guild.channels.fetch(state.channelId).catch(() => null)) as TextChannel | null;
      if (channel) {
        const embed = createEmbed({
          title: '🔄 Kelime Oyunu Sıfırlandı & Yeniden Başlatıldı!',
          description:
            `Oyun yetkili tarafından sıfırlandı ve yeni bir tur başladı!\n\n` +
            `👉 **Yeni İlk Kelime:** \`${state.lastWord}\`\n` +
            `🎯 **Başlanacak Harf:** **"${state.lastLetter.toLocaleUpperCase('tr-TR')}"**\n` +
            `💰 **Ödül:** Her doğru kelimeye **+5 Coin**!`,
          color: DEFAULT_COLORS.PRIMARY,
        });
        embed.setFooter({ text: 'Vip Metro • Kelime Türetmece' });
        await channel.send({ embeds: [embed] }).catch(() => {});
      }

      await interaction.reply({
        content: `✅ Kelime oyunu sıfırlandı! Yeni başlangıç kelimesi: \`${state.lastWord}\``,
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
          `• **Kullanılan Toplam Kelime:** \`${state.usedWords.length}\`\n` +
          `• **Sözlük Kütüphanesi:** \`76,000+ TDK Kelimesi Aktif\``,
        color: DEFAULT_COLORS.PRIMARY,
      });
      embed.setFooter({ text: 'Vip Metro • Kelime Türetmece' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  },
};
