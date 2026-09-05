import { prisma } from '@priv/database';
import { getLevelFromXp, DEFAULT_LEVEL_ROLES, formatCurrency } from '@priv/shared';
import { Client, TextChannel } from 'discord.js';
import { guildService } from './guild.service';
import { userService } from './user.service';
import { achievementService } from './achievement.service';
import { questService } from './quest.service';
import { logger } from '../utils/logger';

// Kullanıcının belirttiği ana sohbet kanalı
export const MAIN_CHAT_CHANNEL_ID = '1542620110882349162';

export class XpService {
  // Anti-spam için son mesaj önbelleği (userId-guildId -> { content, timestamp })
  private lastMessages = new Map<string, { content: string; timestamp: number }>();

  /**
   * Sunucuda atılan HER geçerli mesajı anında veritabanına işler (Bekleme süresi olmadan!)
   */
  public async recordMessage(
    guildId: string,
    userId: string,
    channel?: TextChannel,
    client?: Client,
    authorInfo?: { username?: string; avatar?: string | null }
  ) {
    try {
      await userService.ensureUserAndGuild(userId, guildId, authorInfo?.username, authorInfo?.avatar);

      const userGuild = await prisma.userGuild.upsert({
        where: { userId_guildId: { userId, guildId } },
        update: {
          messageCount: { increment: 1 },
        },
        create: {
          userId,
          guildId,
          messageCount: 1,
        },
      });

      // Görev ilerlemesini güncelle
      await questService.incrementProgress(guildId, userId, 'MESSAGE_COUNT', 1).catch(() => {});

      // Başarım kontrolleri
      if (client && channel) {
        if (userGuild.messageCount >= 100) {
          await achievementService.checkAndUnlock(guildId, userId, 'CHATTERBOX', client, channel).catch(() => {});
        }
        if (userGuild.messageCount >= 1000) {
          await achievementService.checkAndUnlock(guildId, userId, 'MESSAGE_MASTER', client, channel).catch(() => {});
        }

        // Gece kuşu kontrolü (02:00 - 05:00 arası)
        const hour = new Date().getHours();
        if (hour >= 2 && hour < 5) {
          await achievementService.checkAndUnlock(guildId, userId, 'NIGHT_OWL', client, channel).catch(() => {});
        }
      }

      return userGuild;
    } catch (err) {
      logger.error(`[XP] recordMessage hatası (User: ${userId}, Guild: ${guildId}):`, err);
      return null;
    }
  }

  public async addMessageXp(
    guildId: string,
    userId: string,
    messageContent: string,
    channel: TextChannel,
    client: Client,
    authorInfo?: { username?: string; avatar?: string | null }
  ) {
    try {
      const settings = await guildService.getGuildSettings(guildId);
      if (!settings.levelEnabled) return;

      const cacheKey = `${guildId}:${userId}`;
      const now = Date.now();
      const last = this.lastMessages.get(cacheKey);

      // 45 saniye XP bekleme süresi (Sadece XP için geçerlidir, mesaj sayısını etkilemez)
      if (last && now - last.timestamp < 45000) {
        return;
      }

      // Aynı mesajın tekrar tekrar atılması (spam/flood) kontrolü
      if (last && last.content.toLowerCase() === messageContent.toLowerCase()) {
        return;
      }

      this.lastMessages.set(cacheKey, { content: messageContent, timestamp: now });

      // 15 - 25 arası rastgele XP
      const gainedXp = Math.floor(Math.random() * 11) + 15;

      await userService.ensureUserAndGuild(userId, guildId, authorInfo?.username, authorInfo?.avatar);

      const userGuild = await prisma.userGuild.upsert({
        where: { userId_guildId: { userId, guildId } },
        update: {
          xp: { increment: gainedXp },
        },
        create: {
          userId,
          guildId,
          xp: gainedXp,
        },
      });

      // Seviye atlama kontrolü
      const newLevel = getLevelFromXp(userGuild.xp);
      if (newLevel > userGuild.level) {
        await this.handleLevelUp(guildId, userId, newLevel, userGuild.level, channel, client);
      }
    } catch (err) {
      logger.error(`[XP] addMessageXp hatası (User: ${userId}, Guild: ${guildId}):`, err);
    }
  }

  public async addVoiceXp(guildId: string, userId: string, durationSeconds: number, client: Client) {
    try {
      const settings = await guildService.getGuildSettings(guildId);
      if (!settings.levelEnabled || durationSeconds < 60) return;

      // Her 1 dakika ses için 5 XP
      const minutes = Math.floor(durationSeconds / 60);
      const gainedXp = minutes * 5;

      await userService.ensureUserAndGuild(userId, guildId);

      const userGuild = await prisma.userGuild.upsert({
        where: { userId_guildId: { userId, guildId } },
        update: {
          xp: { increment: gainedXp },
          voiceSeconds: { increment: durationSeconds },
        },
        create: {
          userId,
          guildId,
          xp: gainedXp,
          voiceSeconds: durationSeconds,
        },
      });

      // Görev ilerlemesini güncelle
      await questService.incrementProgress(guildId, userId, 'VOICE_TIME', durationSeconds);

      // Başarım kontrolleri
      if (userGuild.voiceSeconds >= 36000) { // 10 saat
        await achievementService.checkAndUnlock(guildId, userId, 'VOICE_BEAST', client);
      }
      if (userGuild.voiceSeconds >= 360000) { // 100 saat
        await achievementService.checkAndUnlock(guildId, userId, 'VOICE_LEGEND', client);
      }

      const newLevel = getLevelFromXp(userGuild.xp);
      if (newLevel > userGuild.level) {
        await this.handleLevelUp(guildId, userId, newLevel, userGuild.level, undefined, client);
      }
    } catch (err) {
      logger.error(`[XP] addVoiceXp hatası:`, err);
    }
  }

  private async handleLevelUp(
    guildId: string,
    userId: string,
    newLevel: number,
    oldLevel: number,
    channel?: TextChannel,
    client?: Client
  ) {
    // Seviye ödülü belirleme (Sessizce bakiyeye eklenir, mesaj atılmaz)
    const levelConfig = DEFAULT_LEVEL_ROLES.find((r) => r.level === newLevel);
    const coinReward = levelConfig?.rewardCoins || newLevel * 50;

    await prisma.$transaction([
      prisma.userGuild.update({
        where: { userId_guildId: { userId, guildId } },
        data: {
          level: newLevel,
          coins: { increment: coinReward },
        },
      }),
      prisma.economyTransaction.create({
        data: {
          guildId,
          toUserId: userId,
          amount: coinReward,
          type: 'REWARD',
          reason: `Seviye ${newLevel} ödülü`,
        },
      }),
    ]);

    // Rol verme kontrolü (Sessizce verilir)
    if (levelConfig) {
      try {
        const guild = channel?.guild || client?.guilds.cache.get(guildId);
        if (guild) {
          const role = guild.roles.cache.find((r) => r.name.toLowerCase() === levelConfig.name.toLowerCase());
          const member = await guild.members.fetch(userId).catch(() => null);

          if (
            member &&
            role &&
            guild.members.me?.permissions.has('ManageRoles') &&
            guild.members.me.roles.highest.position > role.position
          ) {
            await member.roles.add(role).catch(() => {});
          }
        }
      } catch (err) {
        logger.error('[XP] Seviye rolü verilemedi:', err);
      }
    }

    // KULLANICI TALEBİ: Seviye atlayınca hiçbir bildirim mesajı atılmaz ve etiketleme yapılmaz.
  }
}

export const xpService = new XpService();
