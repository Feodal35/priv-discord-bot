import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  GuildMember,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';
import { logger } from '../utils/logger';

export const BOOSTER_ROLE_ID = '1543261484145053727';
export const BOOSTER_COLOR_CHANNEL_ID = '1545558510568480859';

export interface BoosterColorDef {
  id: string;
  name: string;
  emoji: string;
  buttonStyle: ButtonStyle;
}

export const BOOSTER_COLORS: BoosterColorDef[] = [
  { id: '1545556910516740149', name: 'Siyah', emoji: '⚫', buttonStyle: ButtonStyle.Secondary },
  { id: '1545557292223692911', name: 'Yeşil', emoji: '🟢', buttonStyle: ButtonStyle.Success },
  { id: '1545557443369771038', name: 'Bordo', emoji: '🍷', buttonStyle: ButtonStyle.Danger },
  { id: '1545557804465520740', name: 'Turuncu', emoji: '🟠', buttonStyle: ButtonStyle.Primary },
];

export const ALL_BOOSTER_COLOR_IDS = BOOSTER_COLORS.map((c) => c.id);

export class BoosterColorService {
  /**
   * Booster renk seçim panelinin embed ve butonlarını oluşturur.
   */
  public createPanelPayload() {
    const embed = createEmbed({
      title: '💎 VIP Metro — Booster Özel Renk Seçim Paneli',
      description:
        `Sunucumuza takviye (Boost) basarak ailemizi destekleyen <@&${BOOSTER_ROLE_ID}> üyelerimize teşekkür ederiz! 🎉\n\n` +
        `Discord isminizin rengini dilediğiniz gibi özelleştirebilirsiniz. Aşağıdaki butonlara tıklayarak istediğiniz rengi alabilir veya değiştirebilirsiniz.\n\n` +
        `**Mevcut Özel Renkler:**\n` +
        `• ⚫ <@&1545556910516740149> — Gece Siyahı\n` +
        `• 🟢 <@&1545557292223692911> — Neon Yeşil\n` +
        `• 🍷 <@&1545557443369771038> — Asil Bordo\n` +
        `• 🟠 <@&1545557804465520740> — Ateş Turuncusu\n\n` +
        `ℹ️ *Aynı anda yalnızca **1 adet** renk rolü alabilirsiniz. Yeni bir renk seçtiğinizde önceki renginiz otomatik olarak kaldırılır. Rengi temizlemek için kırmızı butonu kullanabilirsiniz.*`,
      color: 0xf47fff, // Discord Nitro / Boost Rengi
    });

    embed.setFooter({ text: 'Vip Metro • Booster Ayrıcalıkları' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('booster_color_1545556910516740149')
        .setLabel('Siyah')
        .setEmoji('⚫')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('booster_color_1545557292223692911')
        .setLabel('Yeşil')
        .setEmoji('🟢')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('booster_color_1545557443369771038')
        .setLabel('Bordo')
        .setEmoji('🍷')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('booster_color_1545557804465520740')
        .setLabel('Turuncu')
        .setEmoji('🟠')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('booster_color_reset')
        .setLabel('Rengi Sıfırla')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
  }

  /**
   * Buton tıklamalarını işler.
   */
  public async handleButton(interaction: ButtonInteraction): Promise<boolean> {
    const customId = interaction.customId;
    if (!customId.startsWith('booster_color_')) return false;

    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu işlem yalnızca sunucuda geçerlidir.', ephemeral: true });
      return true;
    }

    const member =
      (interaction.member as GuildMember) ||
      (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

    if (!member) {
      await interaction.reply({ content: '❌ Kullanıcı bilgisi alınamadı.', ephemeral: true });
      return true;
    }

    // 1. Yetki Kontrolü: Yalnızca Booster rolü olanlar veya Discord Premium Booster'lar alabilir
    const isBooster = member.roles.cache.has(BOOSTER_ROLE_ID) || Boolean(member.premiumSince);
    if (!isBooster) {
      const warningEmbed = createEmbed({
        title: '🔒 Booster Özel Ayrıcalığı',
        description:
          `❌ Bu renk paneli yalnızca sunucumuza takviye (Boost) basmış <@&${BOOSTER_ROLE_ID}> üyelerimize özeldir!\n\n` +
          `Sunucumuza Discord Boost basarak bu özel renklere ve diğer tüm VIP ayrıcalıklara anında sahip olabilirsiniz.`,
        color: DEFAULT_COLORS.DANGER,
      });
      await interaction.reply({ embeds: [warningEmbed], ephemeral: true });
      return true;
    }

    // Botun rol yetkisi kontrolü
    const botMember = interaction.guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content: '❌ Botun rolleri yönetme yetkisi bulunmuyor. Lütfen yetkiliye bildirin.',
        ephemeral: true,
      });
      return true;
    }

    // 2. Rengi Sıfırla / Kaldır
    if (customId === 'booster_color_reset') {
      const activeRoles = member.roles.cache.filter((r) => ALL_BOOSTER_COLOR_IDS.includes(r.id));
      if (activeRoles.size === 0) {
        await interaction.reply({
          content: 'ℹ️ Üzerinizde zaten aktif bir booster renk rolü bulunmuyor.',
          ephemeral: true,
        });
        return true;
      }

      await member.roles.remove(activeRoles.map((r) => r.id)).catch((err) => {
        logger.error('[BOOSTER_COLOR] Rol kaldırma hatası:', err);
      });

      const embed = createEmbed({
        title: '🗑️ Renk Temizlendi',
        description: `Üzerinizdeki tüm booster renk rolleri başarıyla kaldırıldı. Dilediğiniz zaman panelden tekrar renk seçebilirsiniz.`,
        color: DEFAULT_COLORS.WARNING,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return true;
    }

    // 3. Belirli bir Renk Rolü Seçimi
    const targetRoleId = customId.replace('booster_color_', '');
    const targetRole =
      interaction.guild.roles.cache.get(targetRoleId) ||
      (await interaction.guild.roles.fetch(targetRoleId).catch(() => null));

    if (!targetRole) {
      await interaction.reply({ content: '❌ Seçilen renk rolü sunucuda bulunamadı!', ephemeral: true });
      return true;
    }

    // Bot hiyerarşi kontrolü
    if (botMember.roles.highest.position <= targetRole.position) {
      await interaction.reply({
        content: `❌ Botun rol yetkisi **${targetRole.name}** rolünü yönetmek için yetersiz! Botun rolü sunucu ayarlarında bu rolün üzerinde olmalıdır.`,
        ephemeral: true,
      });
      return true;
    }

    // Eğer kullanıcı zaten bu renge sahipse: Rengi kaldır (Toggle)
    if (member.roles.cache.has(targetRole.id)) {
      await member.roles.remove(targetRole.id).catch(() => {});
      const embed = createEmbed({
        title: '🗑️ Renk Kaldırıldı',
        description: `<@&${targetRole.id}> (**${targetRole.name}**) rengi üzerinizden kaldırıldı.`,
        color: DEFAULT_COLORS.WARNING,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return true;
    }

    // Kullanıcının üzerindeki DİĞER tüm renk rollerini kaldır (Sadece TEK BİR TANE olabilir!)
    const otherColorRoleIds = ALL_BOOSTER_COLOR_IDS.filter((id) => id !== targetRole.id);
    const rolesToRemove = member.roles.cache.filter((r) => otherColorRoleIds.includes(r.id)).map((r) => r.id);

    try {
      if (rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove);
      }
      await member.roles.add(targetRole.id);

      const colorDef = BOOSTER_COLORS.find((c) => c.id === targetRole.id);
      const embed = createEmbed({
        title: '🎨 Yeni Renk Rolü Verildi!',
        description:
          `Tebrikler! ${colorDef?.emoji || '💎'} <@&${targetRole.id}> (**${targetRole.name}**) rengi başarıyla üzerinize verildi.\n\n` +
          `*(Varsa eski renk rolünüz otomatik olarak temizlendi).*`,
        color: targetRole.color || 0xf47fff,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      logger.error('[BOOSTER_COLOR] Rol verme hatası:', err);
      await interaction.reply({ content: '❌ Rol verilirken bir hata oluştu.', ephemeral: true });
    }

    return true;
  }

  /**
   * Bot açıldığında 1545558510568480859 kanalına renk panelini otomatik olarak gönderir
   * (Eğer kanalda panel zaten mevcutsa tekrar mesaj atıp spam yapmaz).
   */
  public async autoDeployPanel(client: Client) {
    try {
      for (const [, guild] of client.guilds.cache) {
        const channel = guild.channels.cache.get(BOOSTER_COLOR_CHANNEL_ID) as TextChannel | undefined;
        if (!channel || !channel.isTextBased()) continue;

        // Son 15 mesajı kontrol et
        const messages = await channel.messages.fetch({ limit: 15 }).catch(() => null);
        let hasPanel = false;

        if (messages) {
          for (const [, msg] of messages) {
            if (msg.author.id === client.user?.id) {
              const hasColorButton = (msg.components as any[])?.some((row: any) =>
                row.components?.some((c: any) => c.customId?.startsWith('booster_color_'))
              );
              if (hasColorButton) {
                hasPanel = true;
                // Paneli en güncel haliyle güncelle
                await msg.edit(this.createPanelPayload()).catch(() => {});
                logger.info(`[BOOSTER_COLOR] "${guild.name}" sunucusunda mevcut renk paneli güncellendi.`);
                break;
              }
            }
          }
        }

        // Eğer kanalda panel yoksa yeni gönder
        if (!hasPanel) {
          await channel.send(this.createPanelPayload()).catch((err) => {
            logger.error(`[BOOSTER_COLOR] Panel gönderilemedi (${channel.id}):`, err);
          });
          logger.info(`[BOOSTER_COLOR] "${guild.name}" sunucusunda (${channel.name}) renk paneli ilk kez kuruldu!`);
        }
      }
    } catch (err) {
      logger.error('[BOOSTER_COLOR] autoDeployPanel hatası:', err);
    }
  }
}

export const boosterColorService = new BoosterColorService();
