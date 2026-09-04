import {
  Message,
  GuildMember,
  AuditLogEvent,
  Guild,
  PermissionFlagsBits,
  Client,
  TextChannel,
} from 'discord.js';
import { logService } from './log.service';
import { logger } from '../utils/logger';

// Kullanıcının belirttiği güvenli kişiler listesi (Asla dokunulmaz!)
export const GUARD_WHITELIST = new Set([
  '144365539257483264',
  '823405461201354804',
  '1082089212473512046',
  '1192427670319939678',
  '1334824098479734856',
]);

const INVITE_REGEX = /(discord\.(gg|io|me|li)\/.+|discordapp\.com\/invite\/.+|discord\.com\/invite\/.+)/i;

interface UserMessageHistory {
  timestamps: number[];
}

interface ModActionHistory {
  timestamps: number[];
}

export class GuardService {
  // Anti-spam mesaj geçmişi: "${guildId}:${userId}" -> timestamps
  private spamHistory = new Map<string, UserMessageHistory>();

  // Sağ tık guard geçmişi: "${guildId}:${userId}" -> timestamps
  private modHistory = new Map<string, ModActionHistory>();

  /**
   * Kullanıcı güvenli listede mi veya sunucu sahibi mi denetler
   */
  public isWhitelisted(member: GuildMember): boolean {
    if (member.id === member.guild.ownerId) return true;
    if (member.user.bot) return true;
    if (GUARD_WHITELIST.has(member.id)) return true;
    return false;
  }

  /**
   * Anti-Spam / Flood Denetimi:
   * 3 saniyede 5'ten fazla mesaj atanları 5 dakika timeout'a atar
   */
  public async handleSpamCheck(message: Message): Promise<boolean> {
    if (!message.guild || !message.member || message.author.bot) return false;
    if (this.isWhitelisted(message.member)) return false;

    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();

    let userHist = this.spamHistory.get(key);
    if (!userHist) {
      userHist = { timestamps: [] };
      this.spamHistory.set(key, userHist);
    }

    // Son 3 saniyedeki mesajları filtrele
    userHist.timestamps = userHist.timestamps.filter((t) => now - t < 3000);
    userHist.timestamps.push(now);

    if (userHist.timestamps.length >= 5) {
      // Spam eşiği aşıldı!
      userHist.timestamps = []; // sıfırla

      try {
        if (message.member.moderatable) {
          await message.member.timeout(5 * 60 * 1000, 'Anti-Spam / Çok hızlı mesaj gönderme (Flood)');

          const textChannel = message.channel as TextChannel;
          const warnMsg = await textChannel.send({
            content: `⚠️ <@${message.author.id}>, aşırı hızlı mesaj gönderdiğin için **5 dakika** süreyle susturuldun!`,
          }).catch(() => null);

          if (warnMsg) {
            setTimeout(() => warnMsg.delete().catch(() => {}), 6000);
          }

          await logService.logEvent(
            message.guild.id,
            'MODERATION',
            '🚨 Anti-Spam / Flood Koruması Tetiklendi',
            `**Kullanıcı:** <@${message.author.id}> (\`${message.author.tag}\`)\n` +
            `**Kanal:** <#${message.channelId}>\n` +
            `**İşlem:** 3 saniyede 5+ mesaj attığı için **5 dakika** zamanaşımı uygulandı.\n` +
            `**Zaman:** <t:${Math.floor(now / 1000)}:T> (<t:${Math.floor(now / 1000)}:R>)`,
            message.client,
            undefined,
            { thumbnailUrl: message.author.displayAvatarURL({ size: 128 }), color: 0xe74c3c }
          );

          return true; // Mesaj engellendi
        }
      } catch (err) {
        logger.error('[GUARD] Spam engelleme hatası:', err);
      }
    }

    return false;
  }

  /**
   * Reklam & Discord Davet Link Koruması:
   * Yetkisiz davet linki atanların mesajını siler ve loglar
   */
  public async handleLinkCheck(message: Message): Promise<boolean> {
    if (!message.guild || !message.member || message.author.bot) return false;
    if (this.isWhitelisted(message.member)) return false;
    if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

    if (INVITE_REGEX.test(message.content)) {
      try {
        await message.delete().catch(() => {});

        const textChannel = message.channel as TextChannel;
        const warnMsg = await textChannel.send({
          content: `🚫 <@${message.author.id}>, sunucumuzda Discord davet linki paylaşmak yasaktır!`,
        }).catch(() => null);

        if (warnMsg) {
          setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
        }

        await logService.logEvent(
          message.guild.id,
          'MODERATION',
          '🛡️ Reklam / Davet Linki Engellendi',
          `**Kullanıcı:** <@${message.author.id}> (\`${message.author.tag}\`)\n` +
          `**Kanal:** <#${message.channelId}>\n` +
          `**Silinen İçerik:**\n>>> ${message.content.substring(0, 500)}\n` +
          `**Zaman:** <t:${Math.floor(Date.now() / 1000)}:T> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
          message.client,
          undefined,
          { thumbnailUrl: message.author.displayAvatarURL({ size: 128 }), color: 0xe67e22 }
        );

        return true;
      } catch (err) {
        logger.error('[GUARD] Link silme hatası:', err);
      }
    }

    return false;
  }

  /**
   * Sağ Tık Guard (Toplu Ban/Kick/Rol Silme Eylemleri):
   * Bir yetkili 10 saniyede 3'ten fazla kritik moderasyon eylemi yaparsa yetkileri alınır
   */
  public async handleMassActionGuard(guild: Guild, executorId: string, actionName: string, client: Client) {
    if (GUARD_WHITELIST.has(executorId) || executorId === guild.ownerId || executorId === client.user?.id) {
      return; // Güvenli kişi, muaf!
    }

    const key = `${guild.id}:${executorId}`;
    const now = Date.now();

    let hist = this.modHistory.get(key);
    if (!hist) {
      hist = { timestamps: [] };
      this.modHistory.set(key, hist);
    }

    // Son 10 saniyedeki eylemleri filtrele
    hist.timestamps = hist.timestamps.filter((t) => now - t < 10000);
    hist.timestamps.push(now);

    if (hist.timestamps.length >= 3) {
      hist.timestamps = []; // sıfırla

      try {
        const rogueMember = await guild.members.fetch(executorId).catch(() => null);
        if (rogueMember && rogueMember.manageable) {
          // Yetkilinin tüm rollerini al
          await rogueMember.roles.set([], 'Guard: 10 saniyede 3+ moderasyon eylemi (Şüpheli aktivite)');

          // Log kanalına acil durum alarmı
          await logService.logEvent(
            guild.id,
            'MODERATION',
            '🚨🚨 ACİL DURUM: SAĞ TIK GUARD TETİKLENDİ!',
            `**Şüpheli Yetkili:** <@${executorId}> (\`${rogueMember.user.tag}\`)\n` +
            `**Sebep:** 10 saniye içinde 3 kez kritik işlem (**${actionName}**) gerçekleştirdi.\n` +
            `**Alınan Önlem:** Yetkilinin tüm rolleri sıfırlandı ve yetkileri geri alındı.\n` +
            `**Zaman:** <t:${Math.floor(now / 1000)}:f> (<t:${Math.floor(now / 1000)}:R>)`,
            client,
            undefined,
            { thumbnailUrl: rogueMember.displayAvatarURL({ size: 128 }), color: 0xff0000 }
          );

          // Sunucu sahibine doğrudan DM at
          const owner = await guild.fetchOwner().catch(() => null);
          if (owner) {
            await owner.send({
              content: `🚨 **DİKKAT!** Sunucunda (<#${guild.name}>) **Guard Koruması** devreye girdi!\n<@${executorId}> (\`${rogueMember.user.tag}\`) 10 saniye içinde çok sayıda ${actionName} işlemi yaptığı için tüm rolleri bot tarafından çekildi!`,
            }).catch(() => {});
          }
        }
      } catch (err) {
        logger.error('[GUARD] Yetkili rolleri sıfırlama hatası:', err);
      }
    }
  }
}

export const guardService = new GuardService();
