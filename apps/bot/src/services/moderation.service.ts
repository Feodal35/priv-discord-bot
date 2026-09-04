import { prisma } from '@priv/database';
import { GuildMember, TextChannel, Client } from 'discord.js';
import { checkRoleHierarchy } from '../utils/permissions';
import { logService } from './log.service';

export class ModerationService {
  public async warnUser(
    moderator: GuildMember,
    target: GuildMember,
    reason: string,
    client: Client
  ): Promise<{ success: boolean; message: string }> {
    const hierarchy = checkRoleHierarchy(moderator, target, moderator.guild.members.me!);
    if (!hierarchy.canModerate) {
      return { success: false, message: hierarchy.reason! };
    }

    await prisma.moderationLog.create({
      data: {
        guildId: moderator.guild.id,
        targetUserId: target.id,
        moderatorId: moderator.id,
        action: 'WARN',
        reason,
      },
    });

    await logService.logEvent(
      moderator.guild.id,
      'MODERATION',
      'Kullanıcı Uyarıldı',
      `**Hedef:** <@${target.id}> (${target.user.tag})\n**Yetkili:** <@${moderator.id}>\n**Sebep:** ${reason}`,
      client
    );

    return {
      success: true,
      message: `<@${target.id}> kullanıcısı **${reason}** sebebiyle uyarıldı.`,
    };
  }

  public async timeoutUser(
    moderator: GuildMember,
    target: GuildMember,
    durationSeconds: number,
    reason: string,
    client: Client
  ): Promise<{ success: boolean; message: string }> {
    const hierarchy = checkRoleHierarchy(moderator, target, moderator.guild.members.me!);
    if (!hierarchy.canModerate) {
      return { success: false, message: hierarchy.reason! };
    }

    try {
      await target.timeout(durationSeconds * 1000, reason);

      await prisma.moderationLog.create({
        data: {
          guildId: moderator.guild.id,
          targetUserId: target.id,
          moderatorId: moderator.id,
          action: 'TIMEOUT',
          reason,
          durationSeconds,
        },
      });

      const minutes = Math.ceil(durationSeconds / 60);
      await logService.logEvent(
        moderator.guild.id,
        'MODERATION',
        'Kullanıcı Susturuldu (Timeout)',
        `**Hedef:** <@${target.id}> (${target.user.tag})\n**Yetkili:** <@${moderator.id}>\n**Süre:** ${minutes} dakika\n**Sebep:** ${reason}`,
        client
      );

      return {
        success: true,
        message: `<@${target.id}> kullanıcısına **${minutes} dakika** boyunca timeout uygulandı. Sebep: ${reason}`,
      };
    } catch (err) {
      return { success: false, message: 'Kullanıcıya timeout uygulanırken bir hata oluştu.' };
    }
  }

  public async kickUser(
    moderator: GuildMember,
    target: GuildMember,
    reason: string,
    client: Client
  ): Promise<{ success: boolean; message: string }> {
    const hierarchy = checkRoleHierarchy(moderator, target, moderator.guild.members.me!);
    if (!hierarchy.canModerate) {
      return { success: false, message: hierarchy.reason! };
    }

    try {
      await target.kick(reason);

      await prisma.moderationLog.create({
        data: {
          guildId: moderator.guild.id,
          targetUserId: target.id,
          moderatorId: moderator.id,
          action: 'KICK',
          reason,
        },
      });

      await logService.logEvent(
        moderator.guild.id,
        'MODERATION',
        'Kullanıcı Sunucudan Atıldı',
        `**Hedef:** <@${target.id}> (${target.user.tag})\n**Yetkili:** <@${moderator.id}>\n**Sebep:** ${reason}`,
        client
      );

      return {
        success: true,
        message: `<@${target.id}> kullanıcısı sunucudan atıldı. Sebep: ${reason}`,
      };
    } catch (err) {
      return { success: false, message: 'Kullanıcı atılırken bir hata oluştu.' };
    }
  }

  public async banUser(
    moderator: GuildMember,
    target: GuildMember,
    reason: string,
    client: Client
  ): Promise<{ success: boolean; message: string }> {
    const hierarchy = checkRoleHierarchy(moderator, target, moderator.guild.members.me!);
    if (!hierarchy.canModerate) {
      return { success: false, message: hierarchy.reason! };
    }

    try {
      await target.ban({ reason });

      await prisma.moderationLog.create({
        data: {
          guildId: moderator.guild.id,
          targetUserId: target.id,
          moderatorId: moderator.id,
          action: 'BAN',
          reason,
        },
      });

      await logService.logEvent(
        moderator.guild.id,
        'MODERATION',
        'Kullanıcı Yasaklandı (Ban)',
        `**Hedef:** <@${target.id}> (${target.user.tag})\n**Yetkili:** <@${moderator.id}>\n**Sebep:** ${reason}`,
        client
      );

      return {
        success: true,
        message: `<@${target.id}> kullanıcısı sunucudan yasaklandı. Sebep: ${reason}`,
      };
    } catch (err) {
      return { success: false, message: 'Kullanıcı yasaklanırken bir hata oluştu.' };
    }
  }

  public async clearMessages(channel: TextChannel, amount: number) {
    const deleted = await channel.bulkDelete(amount, true);
    return deleted.size;
  }
}

export const moderationService = new ModerationService();
