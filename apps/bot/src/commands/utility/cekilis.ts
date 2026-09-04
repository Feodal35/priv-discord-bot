import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  Role,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { giveawayService } from '../../services/giveaway.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';

function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return num * 1000;
    case 'm':
      return num * 60 * 1000;
    case 'h':
      return num * 60 * 60 * 1000;
    case 'd':
      return num * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export const cekilisCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('çekiliş')
    .setDescription('Sunucuda profesyonel çekilişler düzenler.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('başlat')
        .setDescription('Yeni bir çekiliş başlatır.')
        .addStringOption((opt) =>
          opt
            .setName('süre')
            .setDescription('Çekiliş süresi (Örn: 10m, 1h, 1d, 30s)')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('kazanan')
            .setDescription('Kazanan kişi sayısı (Varsayılan: 1)')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('ödül')
            .setDescription('Çekiliş ödülü (Örn: Discord Nitro, 10.000 Coin)')
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('kanal')
            .setDescription('Çekilişin yapılacağı kanal (Seçilmezse bu kanal)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName('rol_şartı')
            .setDescription('Sadece bu role sahip üyeler katılabilir (Örn: Etkinlikçi)')
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('seviye_şartı')
            .setDescription('En az bu seviyeye sahip üyeler katılabilir (Örn: 5)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('bitir')
        .setDescription('Devam eden bir çekilişi anında sonlandırır.')
        .addStringOption((opt) =>
          opt
            .setName('mesaj_id')
            .setDescription('Çekiliş mesajının ID si')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('yeniden-çek')
        .setDescription('Bitmiş bir çekiliş için yeni kazanan(lar) seçer.')
        .addStringOption((opt) =>
          opt
            .setName('mesaj_id')
            .setDescription('Çekiliş mesajının ID si')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('liste').setDescription('Sunucuda devam eden aktif çekilişleri listeler.')
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut yalnızca sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'başlat') {
      const durationStr = interaction.options.getString('süre', true);
      const winnersCount = interaction.options.getInteger('kazanan', true);
      const prize = interaction.options.getString('ödül', true);
      const targetChannel =
        (interaction.options.getChannel('kanal') as TextChannel) || (interaction.channel as TextChannel);
      const requiredRole = interaction.options.getRole('rol_şartı') as Role | null;
      const minLevel = interaction.options.getInteger('seviye_şartı');

      const durationMs = parseDuration(durationStr);
      if (!durationMs || durationMs < 10000 || durationMs > 30 * 24 * 60 * 60 * 1000) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Geçersiz Süre Formatı',
              'Lütfen geçerli bir süre girin! (Minimum: `10s`, Maksimum: `30d`)\nÖrnekler: `10m`, `2h`, `1d`'
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const giveaway = await giveawayService.createGiveaway({
          guildId: interaction.guild.id,
          channel: targetChannel,
          prize,
          winnersCount,
          durationMs,
          hostedBy: interaction.user.id,
          requiredRoleId: requiredRole?.id,
          minLevel: minLevel || undefined,
        });

        await interaction.editReply({
          content: `✅ Çekiliş başarıyla <#${targetChannel.id}> kanalında başlatıldı! (ID: \`${giveaway.id}\`)`,
        });
      } catch (err: any) {
        await interaction.editReply({
          content: `❌ Çekiliş başlatılırken hata oluştu: ${err.message}`,
        });
      }
      return;
    }

    if (sub === 'bitir') {
      const messageId = interaction.options.getString('mesaj_id', true).trim();
      await interaction.deferReply({ ephemeral: true });

      const res = await giveawayService.endGiveaway(messageId, interaction.client);
      if (!res.success) {
        await interaction.editReply({ content: `❌ ${res.message}` });
        return;
      }

      await interaction.editReply({ content: `✅ Çekiliş sonlandırıldı! Kazananlar: ${res.winners.map(w => `<@${w}>`).join(', ') || 'Yok'}` });
      return;
    }

    if (sub === 'yeniden-çek') {
      const messageId = interaction.options.getString('mesaj_id', true).trim();
      await interaction.deferReply({ ephemeral: true });

      const res = await giveawayService.reroll(messageId, interaction.client);
      if (!res.success) {
        await interaction.editReply({ content: `❌ ${res.message}` });
        return;
      }

      await interaction.editReply({ content: `✅ Çekiliş yeniden çekildi! Yeni Kazananlar: ${res.newWinners.map(w => `<@${w}>`).join(', ')}` });
      return;
    }

    if (sub === 'liste') {
      const active = giveawayService.getActiveGiveaways(interaction.guild.id);
      if (active.length === 0) {
        await interaction.reply({
          content: 'ℹ️ Sunucuda şu anda devam eden aktif bir çekiliş bulunmuyor.',
          ephemeral: true,
        });
        return;
      }

      const desc = active
        .map(
          (g, i) =>
            `**${i + 1}. [${g.prize}](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})**\n` +
            `• Kanal: <#${g.channelId}>\n` +
            `• Kazanan: \`${g.winnersCount}\` kişi\n` +
            `• Katılımcı: \`${g.participants.length}\`\n` +
            `• Bitiş: <t:${Math.floor(g.endsAt / 1000)}:R>`
        )
        .join('\n\n');

      const embed = createEmbed({
        title: '🎉 Devam Eden Çekilişler',
        description: desc,
        color: 0x9b59b6,
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  },
};
