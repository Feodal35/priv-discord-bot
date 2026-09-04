import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { userService } from '../../services/user.service';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const verilerimCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('verilerim')
    .setDescription('KVKK / GDPR gereği sunucuda kayıtlı verilerinin özetini görüntüler.'),
  cooldown: 15,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const data = await userService.getUserDataExport(interaction.user.id, interaction.guild.id);

    const embed = createEmbed({
      title: '🔒 KVKK / Gizlilik: Kayıtlı Verilerin',
      description: 'Gizliliğine saygı duyuyoruz. Bu sunucuda seninle ilgili tutulan temel veriler aşağıdadır:',
      color: DEFAULT_COLORS.INFO,
      fields: [
        {
          name: 'Profil Bilgileri',
          value: `Seviye: ${data.userGuild?.level || 1}\nXP: ${data.userGuild?.xp || 0}\nMesaj Sayısı: ${data.userGuild?.messageCount || 0}\nSes Süresi: ${Math.round((data.userGuild?.voiceSeconds || 0) / 60)} dakika`,
          inline: true,
        },
        {
          name: 'Ekonomi',
          value: `Bakiye: ${data.userGuild?.coins || 0} Coin\nStreak: ${data.userGuild?.dailyStreak || 0} gün`,
          inline: true,
        },
        {
          name: 'Başarımlar & Envanter',
          value: `${data.achievements.length} başarım\n${data.inventory.length} envanter eşyası`,
          inline: true,
        },
      ],
      footer: {
        text: 'Verilerini tamamen temizlemek istersen /verilerimi-sil komutunu kullanabilirsin.',
      },
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
