import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, EMOJIS } from '@priv/shared';

export const yardimCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('yardım')
    .setDescription('Priv Bot komutlarını ve özelliklerini kategoriler halinde listeler.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = createEmbed({
      title: `${EMOJIS.SETTINGS} Priv Bot — Yardım ve Komut Rehberi`,
      description:
        'Sunucumuzun sosyal ekosistemine hoş geldin! Priv, arkadaş topluluğumuz için özel olarak geliştirilmiş modern bir Discord botudur.\n\nİncelemek istediğin kategoriyi aşağıdaki menüden seçebilirsin:',
      color: DEFAULT_COLORS.PRIMARY,
      fields: [
        { name: '👤 Sosyal & Profil', value: '`/profil`, `/seviye`, `/streak`, `/başarımlar`, `/hafıza`, `/yılözeti`, `/verilerim`', inline: false },
        { name: '💰 Ekonomi & Market', value: '`/bakiye`, `/günlük`, `/çalış`, `/gönder`, `/market`, `/envanter`, `/görev`', inline: false },
        { name: '🎮 Mini Oyunlar & Eğlence', value: '`/oyun xox`, `/oyun tkm`, `/oyun yazı-tura`, `/oyun zar`, `/ship`', inline: false },
        { name: '🎤 Ses & Dinamik Odalar', value: '`/voice kilitle`, `/voice aç`, `/voice limit`, `/voice isim`', inline: false },
        { name: '🛡️ Moderasyon & Güvenlik', value: '`/uyar`, `/sustur`, `/timeout`, `/at`, `/yasakla`, `/temizle`, `/kilitle`, `/aç`', inline: false },
        { name: '⚙️ Sunucu & Araçlar', value: '`/kurulum`, `/ayarlar`, `/sunucu`, `/sıralama`, `/itiraf`, `/anket`, `/doğumgünü`, `/hatırlat`', inline: false },
      ],
      footer: { text: 'Detaylı komut açıklamaları için aşağıdaki menüyü kullanabilirsin.' },
    });

    const select = new StringSelectMenuBuilder()
      .setCustomId('help_category_select')
      .setPlaceholder('Bir kategori seçerek komutları incele...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Sosyal & Profil').setValue('social').setEmoji('👤'),
        new StringSelectMenuOptionBuilder().setLabel('Ekonomi & Market').setValue('economy').setEmoji('💰'),
        new StringSelectMenuOptionBuilder().setLabel('Mini Oyunlar').setValue('games').setEmoji('🎮'),
        new StringSelectMenuOptionBuilder().setLabel('Ses & Odalar').setValue('voice').setEmoji('🎤'),
        new StringSelectMenuOptionBuilder().setLabel('Moderasyon').setValue('moderation').setEmoji('🛡️'),
        new StringSelectMenuOptionBuilder().setLabel('Sunucu & Araçlar').setValue('utility').setEmoji('⚙️')
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
