import { prisma } from '@priv/database';
import { VoiceState, ChannelType, PermissionFlagsBits, Client, VoiceChannel } from 'discord.js';
import { guildService } from './guild.service';
import { xpService } from './xp.service';

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
    } catch (error) {
      console.error('[HATA] Geçici ses kanalı oluşturulamadı:', error);
    }
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
