import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Role,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

// Varsayılan Etkinlikçi Rol ID'si
export const ETKINLIK_ROLE_ID = '1545521553326874694';

export const rolPanelCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rol-panel')
    .setDescription('Kullanıcıların butonla rol alıp bırakabileceği paneller oluşturur.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName('etkinlik')
        .setDescription('Etkinlikçi & Çekiliş bildirim rolü alma panelini gönderir.')
        .addChannelOption((opt) =>
          opt
            .setName('kanal')
            .setDescription('Paneli göndermek istediğiniz kanal (Seçilmezse bu kanala gönderilir)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('özel')
        .setDescription('İstediğiniz herhangi bir rol için butonlu seçim paneli gönderir.')
        .addRoleOption((opt) =>
          opt
            .setName('rol')
            .setDescription('Kullanıcıların alabileceği rol')
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('kanal')
            .setDescription('Paneli göndermek istediğiniz kanal (Seçilmezse bu kanala gönderilir)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('baslik')
            .setDescription('Panelin embed başlığı')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('aciklama')
            .setDescription('Panelin embed açıklama metni')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('buton_yazisi')
            .setDescription('Buton üzerinde yazacak metin (Örn: Rolü Al / Bırak)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('buton_emoji')
            .setDescription('Butonun solunda görünecek emoji (Örn: 🎭, 🔔, 🎮)')
            .setRequired(false)
        )
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut yalnızca sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'etkinlik') {
      const channel = (interaction.options.getChannel('kanal') as TextChannel) || (interaction.channel as TextChannel);

      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: '❌ Geçerli bir metin kanalı bulunamadı!', ephemeral: true });
        return;
      }

      const role = interaction.guild.roles.cache.get(ETKINLIK_ROLE_ID);

      const embed = createEmbed({
        title: '🎉 Etkinlik & Çekiliş Bildirim Rolü',
        description:
          `Sunucumuzda gerçekleştirilen oyun geceleri, ödüllü turnuvalar, çekilişler ve topluluk etkinliklerinden anında haberdar olmak ister misiniz?\n\n` +
          `Aşağıdaki butona tıklayarak ${role ? `<@&${role.id}>` : '**Etkinlikçi**'} rolünü üzerinize alabilir, istediğiniz zaman tekrar tıklayarak çıkarabilirsiniz.\n\n` +
          `> 🔔 *Rolü aldığınızda yalnızca önemli etkinlik ve çekiliş duyurularında bildirim alırsınız.*`,
        color: 0x9B59B6,
      });

      embed.setFooter({ text: 'Vip Metro • Otomatik Rol Paneli' });
      embed.setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId(`self_role_${ETKINLIK_ROLE_ID}`)
        .setLabel('Etkinlikçi Rolü Al / Bırak')
        .setEmoji('🎉')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      try {
        await channel.send({
          embeds: [embed],
          components: [row],
        });

        await interaction.reply({
          content: `✅ Etkinlik rol alma paneli başarıyla <#${channel.id}> kanalına gönderildi!`,
          ephemeral: true,
        });
      } catch (err: any) {
        await interaction.reply({
          content: `❌ Panel kanala gönderilemedi! Botun o kanalda mesaj gönderme yetkisi olduğundan emin olun. Hata: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }

    if (subcommand === 'özel') {
      const targetRole = interaction.options.getRole('rol', true) as Role;
      const channel = (interaction.options.getChannel('kanal') as TextChannel) || (interaction.channel as TextChannel);
      const title = interaction.options.getString('baslik') || `🎭 ${targetRole.name} Rolü`;
      const desc = interaction.options.getString('aciklama') ||
        `Aşağıdaki butona tıklayarak **${targetRole.name}** (<@&${targetRole.id}>) rolünü üzerinize alabilir veya çıkarabilirsiniz.`;
      const buttonLabel = interaction.options.getString('buton_yazisi') || `${targetRole.name} Al / Bırak`;
      const buttonEmoji = interaction.options.getString('buton_emoji') || '✨';

      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: '❌ Geçerli bir metin kanalı bulunamadı!', ephemeral: true });
        return;
      }

      // Güvenlik: Yönetici yetkili roller self-role yapılamaz
      if (targetRole.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ **Yönetici** yetkisine sahip roller güvenlik nedeniyle panel üzerinden verilemez!',
          ephemeral: true,
        });
        return;
      }

      const embed = createEmbed({
        title: title,
        description: `${desc}\n\n> 💡 *Rolü almak veya üzerinizden kaldırmak için aşağıdaki butonu kullanabilirsiniz.*`,
        color: targetRole.color || DEFAULT_COLORS.PRIMARY,
      });

      embed.setFooter({ text: 'Vip Metro • Otomatik Rol Paneli' });
      embed.setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId(`self_role_${targetRole.id}`)
        .setLabel(buttonLabel)
        .setStyle(ButtonStyle.Secondary);

      if (buttonEmoji) {
        try {
          button.setEmoji(buttonEmoji);
        } catch {
          // Emoji geçersizse emojiyi atla
        }
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      try {
        await channel.send({
          embeds: [embed],
          components: [row],
        });

        await interaction.reply({
          content: `✅ Özel rol paneli (<@&${targetRole.id}>) başarıyla <#${channel.id}> kanalına gönderildi!`,
          ephemeral: true,
        });
      } catch (err: any) {
        await interaction.reply({
          content: `❌ Panel kanala gönderilemedi! Hata: ${err.message}`,
          ephemeral: true,
        });
      }
      return;
    }
  },
};
