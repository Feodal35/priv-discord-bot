import { prisma } from '@priv/database';
import {
  VoiceState,
  ChannelType,
  PermissionFlagsBits,
  Client,
  VoiceChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { guildService } from './guild.service';
import { xpService } from './xp.service';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export class VoiceService {
  // Aktif ses oturumları (guildId-userId -> { channelId, joinedAt })
  private activeSessions = new Map<string, { channelId: string; joinedAt: number }>();

  public async handleVoiceState(oldState: VoiceState, newState: VoiceState, client: Client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = member.guild.id;
    const userId = member.id;
    const cacheKey = `${guildId}:${userId}`;
    const settings = await guildService.getGuildSettings(guildId);

    // 1. DİNAMİK GEÇİCİ SES ODASI OLUŞTURMA (Join-to-create)
    if (
      settings.voiceEnabled &&
      settings.tempVoiceCreateChannelId &&
      newState.channelId === settings.tempVoiceCreateChannelId
    ) {
      await this.createTempVoiceChannel(newState, settings.tempVoiceCategoryId);
    }

    // 2. BOŞALAN GEÇİCİ KANALI SİLME
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const tempChannel = await prisma.temporaryVoiceChannel.findUnique({
        where: { channelId: oldState.channelId },
      });

      if (tempChannel) {
        const channel = oldState.channel;
        if (channel && channel.members.filter((m) => !m.user.bot).size === 0) {
          try {
            await channel.delete('Geçici oda boşaldığı için otomatik silindi.');
          } catch (e) {
            console.error('[HATA] Boş geçici kanal silinemedi:', e);
          }
          await prisma.temporaryVoiceChannel.delete({
            where: { channelId: oldState.channelId },
          }).catch(() => {});
        }
      }
    }

    // 3. SES İSTATİSTİĞİ & XP TAKİBİ
    // Kanaldan çıktı veya kanal değiştirdi
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const session = this.activeSessions.get(cacheKey);
      if (session) {
        const durationSeconds = Math.floor((Date.now() - session.joinedAt) / 1000);
        this.activeSessions.delete(cacheKey);

        // AFK kanalı veya 15 saniyeden kısa süreleri (spam bağlantı) sayma
        const afkChannelId = oldState.guild.afkChannelId;
        if (oldState.channelId !== afkChannelId && durationSeconds >= 15) {
          await prisma.voiceSession.create({
            data: {
              guildId,
              userId,
              channelId: oldState.channelId,
              joinedAt: new Date(session.joinedAt),
              leftAt: new Date(),
              durationSeconds,
            },
          });

          await xpService.addVoiceXp(guildId, userId, durationSeconds, client);
        }
      }
    }

    // Yeni bir ses kanalına bağlandı (AFK kanalı değilse)
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      const afkChannelId = newState.guild.afkChannelId;
      if (newState.channelId !== afkChannelId) {
        this.activeSessions.set(cacheKey, {
          channelId: newState.channelId,
          joinedAt: Date.now(),
        });
      }
    }
  }

  private async createTempVoiceChannel(voiceState: VoiceState, categoryId?: string | null) {
    const member = voiceState.member!;
    const guild = voiceState.guild;

    const channelName = `🎤 ${member.displayName}'in Odası`;

    try {
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: categoryId || undefined,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.MuteMembers,
              PermissionFlagsBits.DeafenMembers,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
            ],
          },
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
          },
        ],
      });

      // Kullanıcıyı yeni odaya taşı
      await member.voice.setChannel(channel);

      // Veritabanına kaydet
      await prisma.temporaryVoiceChannel.create({
        data: {
          guildId: guild.id,
          channelId: channel.id,
          ownerId: member.id,
        },
      });

      // Ses kanalının dahili metin sohbetine oda yönetim panelini gönder
      const embed = createEmbed({
        title: `🎛️ Özel Ses Odası Yönetim Paneli`,
        description:
          `Hoş geldin <@${member.id}>! Sana özel ses odan başarıyla oluşturuldu.\n\n` +
          `Aşağıdaki butonları kullanarak odanı dilediğin gibi yönetebilirsin:\n` +
          `• **🔒 Kilitle / Aç:** Odayı kilitleyerek başkalarının girişini engeller.\n` +
          `• **👥 Kişi Limiti:** Odaya girebilecek maksimum kişi sayısını ayarlar.\n` +
          `• **✏️ İsim Değiştir:** Odanın görünen adını günceller.\n` +
          `• **🚫 Odadan At:** İstemediğin bir kullanıcıyı odadan atar.\n` +
          `• **👑 Odayı Devret:** Odanın yöneticiliğini odadaki başka bir üyeye aktarır.`,
        color: 0x9b59b6,
      });
      embed.setFooter({ text: 'Vip Metro • Özel Ses Yöneticisi' });

      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`tempvoice_lock_${channel.id}`)
          .setLabel('Kilitle / Aç')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`tempvoice_limit_${channel.id}`)
          .setLabel('Kişi Limiti')
          .setEmoji('👥')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`tempvoice_rename_${channel.id}`)
          .setLabel('İsim Değiştir')
          .setEmoji('✏️')
          .setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`tempvoice_kick_${channel.id}`)
          .setLabel('Odadan At')
          .setEmoji('🚫')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`tempvoice_transfer_${channel.id}`)
          .setLabel('Odayı Devret')
          .setEmoji('👑')
          .setStyle(ButtonStyle.Primary)
      );

      await channel.send({
        content: `<@${member.id}>`,
        embeds: [embed],
        components: [row1, row2],
      }).catch(() => {});
    } catch (error) {
      console.error('[HATA] Geçici ses kanalı oluşturulamadı:', error);
    }
  }

  public async getTempChannel(channelId: string) {
    return prisma.temporaryVoiceChannel.findUnique({
      where: { channelId },
    });
  }

  public async updateTempChannel(channelId: string, data: { ownerId?: string; isLocked?: boolean; userLimit?: number }) {
    return prisma.temporaryVoiceChannel.update({
      where: { channelId },
      data,
    });
  }


  public async cleanStaleTempChannels(client: Client) {
    const channels = await prisma.temporaryVoiceChannel.findMany();
    for (const record of channels) {
      try {
        const guild = await client.guilds.fetch(record.guildId).catch(() => null);
        if (!guild) {
          await prisma.temporaryVoiceChannel.delete({ where: { id: record.id } });
          continue;
        }

        const channel = (await guild.channels.fetch(record.channelId).catch(() => null)) as VoiceChannel | null;
        if (!channel || channel.members.filter((m) => !m.user.bot).size === 0) {
          if (channel) {
            await channel.delete('Bot yeniden başladığında asılı kalan boş oda temizlendi.').catch(() => {});
          }
          await prisma.temporaryVoiceChannel.delete({ where: { id: record.id } }).catch(() => {});
        }
      } catch (err) {
        console.error('[HATA] Asılı kalan oda temizleme hatası:', err);
      }
    }
  }
}

export const voiceService = new VoiceService();
