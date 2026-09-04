import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { boosterColorService, BOOSTER_COLOR_CHANNEL_ID } from '../../services/boosterColor.service';
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embed';

export const boosterRenkCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('booster-renk')
    .setDescription('Booster özel renk seçim panelini gönderir veya günceller.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Booster özel renk seçim panelini belirtilen kanala gönderir.')
        .addChannelOption((opt) =>
          opt
            .setName('kanal')
            .setDescription('Panelin gönderileceği kanal (Seçilmezse varsayılan booster renk kanalına gönderilir)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut yalnızca sunucuda kullanılabilir.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'panel') {
      const channelOption = interaction.options.getChannel('kanal') as TextChannel | null;
      let targetChannel: TextChannel | null = channelOption;

      if (!targetChannel) {
        targetChannel =
          (interaction.guild.channels.cache.get(BOOSTER_COLOR_CHANNEL_ID) as TextChannel) ||
          (interaction.channel as TextChannel);
      }

      if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.reply({
          embeds: [createErrorEmbed('Hata', 'Hedef metin kanalı bulunamadı.')],
          ephemeral: true,
        });
        return;
      }

      try {
        const payload = boosterColorService.createPanelPayload();
        await targetChannel.send(payload);

        await interaction.reply({
          embeds: [
            createSuccessEmbed(
              'Başarılı',
              `💎 Booster Özel Renk Paneli başarıyla <#${targetChannel.id}> kanalına gönderildi!`
            ),
          ],
          ephemeral: true,
        });
      } catch (error) {
        await interaction.reply({
          embeds: [createErrorEmbed('Hata', 'Panel gönderilirken bir hata oluştu. Botun kanalda mesaj yazma yetkisi olduğundan emin olun.')],
          ephemeral: true,
        });
      }
    }
  },
};
