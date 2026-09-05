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
import { userService } from './user.service';
import { marriageService } from './marriage.service';
import { xpService } from './xp.service';
import { questService } from './quest.service';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS, getLevelFromXp } from '@priv/shared';
import { logger } from '../utils/logger';

export const DEFAULT_TEMP_VOICE_CHANNEL_ID = '1545543780818755626';

export interface ActiveVoiceSession {
  channelId: string;
  joinedAt: number;
  lastFlushedAt: number;
}

export class VoiceService {
  // Aktif ses oturumları (guildId:userId -> { channelId, joinedAt, lastFlushedAt })
  private activeSessions = new Map<string, ActiveVoiceSession>();
  private trackerInterval: NodeJS.Timeout | null = null;

  /**
   * Bot başladığında seste olan tüm kullanıcıları hafızaya alır.
   * guild.voiceStates.cache kullanarak hiçbir kullanıcıyı atlamaz.
   */
  public initVoiceSessions(client: Client) {
    const now = Date.now();
    let count = 0;
    for (const [, guild] of client.guilds.cache) {
      const afkId = guild.afkChannelId;
      for (const [userId, voiceState] of guild.voiceStates.cache) {
        if (voiceState.channelId && voiceState.channelId !== afkId) {
          const member = voiceState.member;
          if (!member?.user.bot) {
            const key = `${guild.id}:${userId}`;
            if (!this.activeSessions.has(key)) {
              this.activeSessions.set(key, {
                channelId: voiceState.channelId,
                joinedAt: now,
                lastFlushedAt: now,
              });
              count++;
            }
          }
        }
      }
    }
    logger.info(`[VOICE] ${count} aktif ses oturumu hafızaya alındı.`);
  }

  /**
   * Her 60 saniyede bir seste olan tüm kullanıcıların sürelerini ve XP'lerini veritabanına kaydeder.
   * lastFlushedAt SADECE veritabanı yazımı başarılı olduğunda ilerletilir.
   */
  public startVoiceTracker(client: Client) {
    if (this.trackerInterval) return;

    this.trackerInterval = setInterval(async () => {
      const now = Date.now();
      for (const [cacheKey, session] of this.activeSessions.entries()) {
        const [guildId, userId] = cacheKey.split(':');
        const elapsedSecs = Math.floor((now - session.lastFlushedAt) / 1000);

        if (elapsedSecs >= 60) {
          const minutes = Math.floor(elapsedSecs / 60);
          const flushSeconds = minutes * 60;

          try {
            await userService.ensureUserAndGuild(userId, guildId);

            // Evli Çiftler Aynı Ses Odasındaysa +%50 XP Boost & Aşk Puanı
            let xpMultiplier = 1;
            try {
              const marriage = await marriageService.getMarriage(guildId, userId);
              if (marriage) {
                const partnerId = marriage.user1Id === userId ? marriage.user2Id : marriage.user1Id;
                const partnerSession = this.activeSessions.get(`${guildId}:${partnerId}`);
                if (partnerSession && partnerSession.channelId === session.channelId) {
                  xpMultiplier = 1.5;
                  await marriageService.addLovePoints(marriage.id, minutes);
                }
              }
            } catch {
              /* sessiz */
            }

            const earnedXp = Math.floor(minutes * 5 * xpMultiplier);

            const userGuild = await prisma.userGuild.upsert({
              where: { userId_guildId: { userId, guildId } },
              update: {
                voiceSeconds: { increment: flushSeconds },
                xp: { increment: earnedXp },
              },
              create: {
                userId,
                guildId,
                voiceSeconds: flushSeconds,
                xp: earnedXp,
              },
            });

            // Seviyeyi anında senkronize et
            const newLevel = getLevelFromXp(userGuild.xp);
            if (newLevel !== userGuild.level) {
              await prisma.userGuild.update({
                where: { userId_guildId: { userId, guildId } },
                data: { level: newLevel },
              }).catch(() => {});
            }

            // SADECE DB yazımı başarılıysa ilerlet
            session.lastFlushedAt += flushSeconds * 1000;

            await questService.incrementProgress(guildId, userId, 'VOICE_TIME', flushSeconds).catch(() => {});
          } catch (e) {
            logger.warn(`[VOICE] Tracker DB yazma hatası (${cacheKey}), bir sonraki döngüde tekrar denenecek: ${e}`);
          }
        }
      }
    }, 60000);
  }

  /**
   * Bot kapatılırken (restart / deploy) hafızadaki TÜM aktif ses
   * sürelerini ve kazanılan XP'leri veritabanına eksiksiz yazar.
   * Böylece bot res yediğinde kullanıcıların 1 saniyesi bile kaybolmaz!
   */
  public async flushAllSessions(): Promise<number> {
    const now = Date.now();
    let flushedCount = 0;

    for (const [cacheKey, session] of this.activeSessions.entries()) {
      const [guildId, userId] = cacheKey.split(':');
      const elapsedSecs = Math.floor((now - session.lastFlushedAt) / 1000);

      if (elapsedSecs >= 2) {
        try {
          await userService.ensureUserAndGuild(userId, guildId);

          let xpMultiplier = 1;
          try {
            const marriage = await marriageService.getMarriage(guildId, userId);
            if (marriage) {
              const partnerId = marriage.user1Id === userId ? marriage.user2Id : marriage.user1Id;
              const partnerSession = this.activeSessions.get(`${guildId}:${partnerId}`);
              if (partnerSession && partnerSession.channelId === session.channelId) {
                xpMultiplier = 1.5;
                const mins = Math.floor(elapsedSecs / 60);
                if (mins > 0) {
                  await marriageService.addLovePoints(marriage.id, mins).catch(() => {});
                }
              }
            }
          } catch {}

          const earnedXp = Math.floor((elapsedSecs / 60) * 5 * xpMultiplier);

          const ug = await prisma.userGuild.upsert({
            where: { userId_guildId: { userId, guildId } },
            update: {
              voiceSeconds: { increment: elapsedSecs },
              xp: { increment: earnedXp },
            },
            create: {
              userId,
              guildId,
              voiceSeconds: elapsedSecs,
              xp: earnedXp,
            },
          });

          const newLevel = getLevelFromXp(ug.xp);
          if (newLevel !== ug.level) {
            await prisma.userGuild.update({
              where: { userId_guildId: { userId, guildId } },
              data: { level: newLevel },
            }).catch(() => {});
          }

          session.lastFlushedAt = now;
          flushedCount++;
        } catch (err) {
          logger.error(`[VOICE] flushAllSessions hata (${cacheKey}): ${err}`);
        }
      }
    }

    logger.info(`[VOICE] Güvenli Kapatma: ${flushedCount} aktif ses oturumu veritabanına kalıcı kaydedildi.`);
    return flushedCount;
  }

  /**
   * Profil komutu için saniyeye kadar anlık canlı ses süresi
   */
  public getLiveVoiceSeconds(guildId: string, userId: string, dbVoiceSeconds: number): number {
    const session = this.activeSessions.get(`${guildId}:${userId}`);
    if (session) {
      const pendingSeconds = Math.floor((Date.now() - session.lastFlushedAt) / 1000);
      return dbVoiceSeconds + Math.max(0, pendingSeconds);
    }
    return dbVoiceSeconds;
  }

  public async handleVoiceState(oldState: VoiceState, newState: VoiceState, client: Client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = member.guild.id;
    const userId = member.id;
    const cacheKey = `${guildId}:${userId}`;
    const settings = await guildService.getGuildSettings(guildId);

    // 1. DİNAMİK GEÇİCİ SES ODASI OLUŞTURMA (Join-to-create)
    const isJoinToCreate =
      newState.channelId === DEFAULT_TEMP_VOICE_CHANNEL_ID ||
      (settings.voiceEnabled &&
        settings.tempVoiceCreateChannelId &&
        newState.channelId === settings.tempVoiceCreateChannelId);

    if (isJoinToCreate) {
      const categoryId = newState.channel?.parentId || settings.tempVoiceCategoryId;
      await this.createTempVoiceChannel(newState, categoryId);
    }

    // 2. BOŞALAN GEÇİCİ KANALI SİLME
    if (
      oldState.channelId &&
      oldState.channelId !== newState.channelId &&
      oldState.channelId !== DEFAULT_TEMP_VOICE_CHANNEL_ID &&
      oldState.channelId !== settings.tempVoiceCreateChannelId
    ) {
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
        const now = Date.now();
        const unFlushedSeconds = Math.floor((now - session.lastFlushedAt) / 1000);
        const totalDurationSeconds = Math.floor((now - session.joinedAt) / 1000);
        this.activeSessions.delete(cacheKey);

        const afkChannelId = oldState.guild.afkChannelId;
        if (oldState.channelId !== afkChannelId) {
          // Kalan saniyeleri veritabanına işle
          if (unFlushedSeconds >= 2) {
            await userService.ensureUserAndGuild(userId, guildId).catch(() => {});
            const earnedXp = Math.floor(unFlushedSeconds / 60) * 5;
            const ug = await prisma.userGuild.upsert({
              where: { userId_guildId: { userId, guildId } },
              update: {
                voiceSeconds: { increment: unFlushedSeconds },
                xp: { increment: earnedXp },
              },
              create: {
                userId,
                guildId,
                voiceSeconds: unFlushedSeconds,
                xp: earnedXp,
              },
            }).catch(() => null);

            if (ug) {
              const newLvl = getLevelFromXp(ug.xp);
              if (newLvl !== ug.level) {
                await prisma.userGuild.update({
                  where: { userId_guildId: { userId, guildId } },
                  data: { level: newLvl },
                }).catch(() => {});
              }
            }

            await questService.incrementProgress(guildId, userId, 'VOICE_TIME', unFlushedSeconds).catch(() => {});
          }

          if (totalDurationSeconds >= 10) {
            await prisma.voiceSession.create({
              data: {
                guildId,
                userId,
                channelId: oldState.channelId,
                joinedAt: new Date(session.joinedAt),
                leftAt: new Date(now),
                durationSeconds: totalDurationSeconds,
              },
            }).catch(() => {});
          }
        }
      }
    }

    // Yeni bir ses kanalına bağlandı (AFK kanalı değilse)
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      const afkChannelId = newState.guild.afkChannelId;
      if (newState.channelId !== afkChannelId) {
        const now = Date.now();
        this.activeSessions.set(cacheKey, {
          channelId: newState.channelId,
          joinedAt: now,
          lastFlushedAt: now,
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
        if (!channel) {
          await prisma.temporaryVoiceChannel.delete({ where: { id: record.id } }).catch(() => {});
          continue;
        }

        // Hem channel.members hem de guild.voiceStates.cache denetlenerek kullanıcı olan oda asla silinmez
        const hasActiveMembers =
          channel.members.filter((m) => !m.user.bot).size > 0 ||
          guild.voiceStates.cache.some((vs) => vs.channelId === channel.id && !vs.member?.user.bot);

        if (!hasActiveMembers) {
          await channel.delete('Bot yeniden başladığında asılı kalan boş oda temizlendi.').catch(() => {});
          await prisma.temporaryVoiceChannel.delete({ where: { id: record.id } }).catch(() => {});
        }
      } catch (err) {
        console.error('[HATA] Asılı kalan oda temizleme hatası:', err);
      }
    }
  }
}

export const voiceService = new VoiceService();
