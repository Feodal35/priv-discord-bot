import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embed';
import { logService } from '../../services/log.service';
import { DEFAULT_COLORS } from '@priv/shared';

// Booster / Zengin Rolü ID'si
export const BOOSTER_ROLE_ID = '1543261484145053727';

export const zenginCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('zengin')
    .setDescription('Sunucu takviyecilerine (Booster) özel ismini değiştirme komutu.')
    .addStringOption((opt) =>
      opt
        .setName('isim')
        .setDescription('Sunucuda kullanmak istediğin yeni takma ad (Boş bırakırsan sıfırlanır)')
        .setRequired(false)
        .setMaxLength(32)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'Üye bilgisi alınamadı.', ephemeral: true });
      return;
    }

    // 1. Yetki Kontrolü: 1543261484145053727 rolü veya Sunucu Takviyesi (Boost)
    const hasBoosterRole = member.roles.cache.has(BOOSTER_ROLE_ID);
    const isServerBooster = Boolean(member.premiumSince);

    if (!hasBoosterRole && !isServerBooster) {
      const errorEmbed = createErrorEmbed(
        'Erişim Engellendi',
        `Bu ayrıcalıklı komutu yalnızca sunucumuza **Takviye (Boost)** basmış veya <@&${BOOSTER_ROLE_ID}> rolüne sahip üyelerimiz kullanabilir! 💎🚀\n\n_Sunucumuza takviye basarak bu ve daha birçok özel avantaja anında sahip olabilirsin._`
      );
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // 2. Bot Yetkisi Kontrolü
    const botMember = interaction.guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Yetki Hatası', 'Botun sunucuda `Kullanıcı Adlarını Yönet` yetkisi bulunmuyor.')],
        ephemeral: true,
      });
      return;
    }

    // Discord Hiyerarşi Kontrolü: Sunucu sahibi veya botun rolünden yüksek üyeler
    if (member.id === interaction.guild.ownerId) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Hiyerarşi Kısıtlaması',
            'Discord güvenlik kuralları gereği botlar sunucu sahibinin ismini değiştiremez.'
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (botMember.roles.highest.position <= member.roles.highest.position) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Hiyerarşi Kısıtlaması',
            'Senin en yüksek rolün botun rolünden daha üstte veya eşit olduğu için ismini değiştiremiyorum. Lütfen botun rolünü daha yukarı taşıyın.'
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const newNickname = interaction.options.getString('isim');
    const oldNickname = member.displayName;

    try {
      // Eğer yeni isim verilmişse ayarla, verilmemişse orijinal adına sıfırla
      await member.setNickname(newNickname || null);

      const embed = createEmbed({
        title: '💎 Zengin Ayrıcalığı — İsim Değiştirildi!',
        description: newNickname
          ? `Harika! Sunucudaki takma adın başarıyla **\`${newNickname}\`** olarak güncellendi.`
          : 'Sunucudaki takma adın başarıyla orijinal kullanıcı adına sıfırlandı.',
        color: 0xf47fff as any, // Discord Nitro / Booster Pembe rengi
        thumbnail: member.displayAvatarURL(),
        fields: [
          { name: 'Önceki İsim', value: `\`${oldNickname}\``, inline: true },
          { name: 'Yeni İsim', value: `\`${newNickname || member.user.username}\``, inline: true },
          { name: 'Durum', value: '🚀 Takviyeci Avantajı', inline: true },
        ],
        footer: { text: 'Sunucumuza verdiğin takviye ve destek için teşekkür ederiz! 💜' },
        timestamp: false,
      });

      await interaction.reply({ embeds: [embed] });

      // Log servisine bildir
      await logService.logEvent(
        interaction.guild.id,
        'SYSTEM',
        'Zengin / Boost İsim Değişikliği',
        `**Kullanıcı:** <@${member.id}> (${member.user.tag})\n**Önceki:** \`${oldNickname}\`\n**Yeni:** \`${newNickname || member.user.username}\``,
        interaction.client
      );
    } catch (err: any) {
      await interaction.reply({
        embeds: [createErrorEmbed('İşlem Başarısız', `İsmin değiştirilirken bir hata oluştu: ${err.message}`)],
        ephemeral: true,
      });
    }
  },
};
