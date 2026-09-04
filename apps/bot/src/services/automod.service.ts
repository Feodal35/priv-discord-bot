import { prisma } from '@priv/database';
import { Message, PermissionsBitField } from 'discord.js';
import { guildService } from './guild.service';
import { logService } from './log.service';

export class AutoModService {
  // Flood tespiti için kullanıcı mesaj zamanları (guildId-userId -> number[])
  private messageTimestamps = new Map<string, number[]>();

  public async processMessage(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false;

    // Yönetici veya mesaj yönet yetkisi olanlar denetimden muaftır
    if (
      message.member?.permissions.has(PermissionsBitField.Flags.Administrator) ||
      message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)
    ) {
      return false;
    }

    const guildId = message.guild.id;
    const settings = await guildService.getGuildSettings(guildId);
    if (!settings.autoModEnabled) return false;

    let rule = await prisma.autoModRule.findUnique({
      where: { guildId },
    });

    if (!rule) {
      rule = await prisma.autoModRule.create({
        data: { guildId },
      });
    }

    const content = message.content;
    let violationReason: string | null = null;

    // 1. DAVET LİNKİ FİLTRESİ
    if (rule.inviteFilter) {
      const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/gi;
      if (inviteRegex.test(content)) {
        violationReason = 'Discord sunucu davet linki paylaşımı';
      }
    }

    // 2. DIŞ BAĞLANTI / LİNK FİLTRESİ
    if (!violationReason && rule.linkFilter) {
      const urlRegex = /(https?:\/\/[^\s]+)/gi;
      if (urlRegex.test(content)) {
        violationReason = 'İzinsiz bağlantı / link paylaşımı';
      }
    }

    // 3. ETİKET (MENTION) SPAMI
    if (!violationReason && rule.mentionSpamLimit > 0) {
      if (message.mentions.users.size > rule.mentionSpamLimit) {
        violationReason = `Aşırı etiket kullanımı (${message.mentions.users.size} etiket)`;
      }
    }

    // 4. BÜYÜK HARF (CAPS) SPAMI
    if (!violationReason && content.length >= 10 && rule.capsLimitPercent > 0) {
      const upperCount = content.replace(/[^A-ZÇĞİÖŞÜ]/g, '').length;
      const letterCount = content.replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ]/g, '').length;
      if (letterCount > 8 && (upperCount / letterCount) * 100 >= rule.capsLimitPercent) {
        violationReason = 'Aşırı büyük harf kullanımı (Caps Lock)';
      }
    }

    // 5. YASAKLI KELİME FİLTRESİ
    if (!violationReason) {
      try {
        const bannedWords: string[] = JSON.parse(rule.bannedWords || '[]');
        const lower = content.toLowerCase();
        for (const word of bannedWords) {
          if (word.trim() && lower.includes(word.trim().toLowerCase())) {
            violationReason = `Yasaklı kelime kullanımı ("${word.trim()}")`;
            break;
          }
        }
      } catch {
        // Devam et
      }
    }

    // 6. FLOOD / HIZLI MESAJ SPAMI
    if (!violationReason && rule.floodFilter) {
      const userKey = `${guildId}:${message.author.id}`;
      const now = Date.now();
      const timestamps = this.messageTimestamps.get(userKey) || [];
      const recent = timestamps.filter((t) => now - t < 5000); // son 5 saniye
      recent.push(now);
      this.messageTimestamps.set(userKey, recent);

      if (recent.length >= 5) {
        violationReason = 'Hızlı mesaj gönderme (Flood)';
      }
    }

    // İhlal tespit edildiyse işlem yap
    if (violationReason) {
      try {
        await message.delete();
      } catch {}

      // Ceza uygulama
      if (rule.action === 'TIMEOUT' && message.member?.moderatable) {
        try {
          await message.member.timeout(rule.timeoutDurationSeconds * 1000, `AutoMod: ${violationReason}`);
        } catch {}
      }

      await logService.logEvent(
        guildId,
        'MODERATION',
        'AutoMod İhlali Engellendi',
        `**Kullanıcı:** <@${message.author.id}> (${message.author.tag})\n**Kanal:** <#${message.channel.id}>\n**İhlal Nedeni:** ${violationReason}\n**Uygulanan İşlem:** Mesaj silindi ${rule.action === 'TIMEOUT' ? '+ Timeout uygulandı' : ''}`,
        message.client
      );

      return true;
    }

    return false;
  }
}

export const autoModService = new AutoModService();
