import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { marriageService } from '../../services/marriage.service';
import { createMarriageCard } from '../../utils/marriageCard';
import { createEmbed, createErrorEmbed, createSuccessEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const evlilikCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('evlilik')
    .setDescription('Evlilik cüzdanınızı görüntüler ve ortak kasayı yönetir.')
    .addSubcommand((sub) =>
      sub
        .setName('cüzdan')
        .setDescription('Kendinin veya bir üyenin HD Evlilik Cüzdanını görüntüler.')
        .addUserOption((opt) =>
          opt
            .setName('üye')
            .setDescription('Evlilik cüzdanını görmek istediğin kullanıcı (Varsayılan: Sen)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('kasa-yatır')
        .setDescription('Ortak evlilik kasasına coin yatırır.')
        .addIntegerOption((opt) =>
          opt
            .setName('miktar')
            .setDescription('Kasaya yatırmak istediğin coin miktarı')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('kasa-çek')
        .setDescription('Ortak evlilik kasasından coin çeker.')
        .addIntegerOption((opt) =>
          opt
            .setName('miktar')
            .setDescription('Kasadan çekmek istediğin coin miktarı')
            .setRequired(true)
            .setMinValue(1)
        )
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda geçerlidir.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'cüzdan') {
      const targetUser = interaction.options.getUser('üye') || interaction.user;

      await interaction.deferReply();

      const marriage = await marriageService.getMarriage(guildId, targetUser.id);
      if (!marriage) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              'Evli Değil',
              targetUser.id === interaction.user.id
                ? 'Henüz bir evliliğin bulunmuyor! `/evlen @üye` ile sevdiğin birine teklif edebilirsin.'
                : `<@${targetUser.id}> şu anda evli değil.`
            ),
          ],
        });
        return;
      }

      const user1 = await interaction.client.users.fetch(marriage.user1Id).catch(() => null);
      const user2 = await interaction.client.users.fetch(marriage.user2Id).catch(() => null);

      const user1Name = user1?.username || marriage.user1?.username || 'Eş 1';
      const user2Name = user2?.username || marriage.user2?.username || 'Eş 2';
      const user1Avatar = user1?.displayAvatarURL({ extension: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
      const user2Avatar = user2?.displayAvatarURL({ extension: 'png', size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/1.png';

      // HD Canvas Cüzdan Kartını Üret
      const buffer = await createMarriageCard({
        user1Name,
        user1Avatar,
        user2Name,
        user2Avatar,
        ringType: marriage.ringType as 'SILVER' | 'GOLD' | 'DIAMOND',
        lovePoints: marriage.lovePoints,
        jointCoins: marriage.jointCoins,
        marriedAt: marriage.marriedAt,
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'evlilik-cuzdani.png' });

      const embed = createEmbed({
        title: `💍 ${user1Name} & ${user2Name} — Evlilik Cüzdanı`,
        description:
          `💞 <@${marriage.user1Id}> ile <@${marriage.user2Id}> çiftinin resmi aile cüzdanı.\n\n` +
          `• 💖 **Aşk Puanı:** \`${marriage.lovePoints}\`\n` +
          `• 🪙 **Ortak Kasa:** \`${marriage.jointCoins.toLocaleString('tr-TR')} Coin\`\n` +
          `• 🔊 **Ses Odası Aşk Boostu:** Aktif (Aynı odadayken +%50 XP & dakikada +1 Aşk Puanı)\n\n` +
          `*Ortak kasaya para yatırmak veya çekmek için \`/evlilik kasa-yatır\` ve \`/evlilik kasa-çek\` komutlarını kullanabilirsiniz.*`,
        image: 'attachment://evlilik-cuzdani.png',
        color: 0x990022,
      });

      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
      return;
    }

    if (subcommand === 'kasa-yatır') {
      const amount = interaction.options.getInteger('miktar', true);
      const result = await marriageService.depositJoint(guildId, interaction.user.id, amount);

      if (!result.success) {
        await interaction.reply({
          embeds: [createErrorEmbed('İşlem Başarısız', result.message)],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [createSuccessEmbed('Kasa Güncellendi', result.message)],
      });
      return;
    }

    if (subcommand === 'kasa-çek') {
      const amount = interaction.options.getInteger('miktar', true);
      const result = await marriageService.withdrawJoint(guildId, interaction.user.id, amount);

      if (!result.success) {
        await interaction.reply({
          embeds: [createErrorEmbed('İşlem Başarısız', result.message)],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [createSuccessEmbed('Para Çekildi', result.message)],
      });
      return;
    }
  },
};
