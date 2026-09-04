import { Message, TextChannel, PermissionFlagsBits } from 'discord.js';
import { autoModService } from '../services/automod.service';
import { xpService } from '../services/xp.service';
import { messageCacheService } from '../services/messageCache.service';
import { guardService } from '../services/guard.service';
import { wordGameService } from '../services/wordGame.service';
import { banterService } from '../services/banter.service';
import { logger } from '../utils/logger';

// Kullanıcının belirttiği fotoğraf & selfie kanalı ID'si
export const PHOTO_CHANNEL_ID = '1543271245779566703';

export async function onMessageCreate(message: Message) {
  if (!message.guild || message.author.bot) return;

  // Mesajı silinme ve düzenlenme logları için önbelleğe al
  messageCacheService.set(message);

  // 1. Selfie & Fotoğraf Kanalı Kuralı (1543271245779566703)
  if (message.channelId === PHOTO_CHANNEL_ID) {
    const hasAttachment = message.attachments.size > 0;
    const hasMediaUrl =
      /(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|bmp|heic|mp4|mov|webm))/i.test(message.content) ||
      message.content.includes('tenor.com') ||
      message.content.includes('giphy.com') ||
      message.content.includes('cdn.discordapp.com') ||
      message.content.includes('media.discordapp.net');

    const hasMedia = hasAttachment || hasMediaUrl;

    if (hasMedia) {
      // Fotoğraf / medya varsa otomatik kalp koy
      try {
        await message.react('❤️');
      } catch (err) {
        logger.error(`[SELFIE] ${message.id} mesajına kalp reaksiyonu eklenemedi:`, err);
      }
    } else {
      // Fotoğraf / medya yoksa: Bu kanalda mesaj yazmak yasak!
      const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
      if (!isAdmin) {
        try {
          await message.delete().catch(() => {});
          const textChannel = message.channel as TextChannel;
          const warnMsg = await textChannel.send({
            content: `📸 <@${message.author.id}>, bu kanal **Selfie & Fotoğraf** kanalıdır! Yalnızca fotoğraf veya video paylaşabilirsiniz. Sohbet etmek ve düz metin yazmak yasaktır.`,
          }).catch(() => null);

          if (warnMsg) {
            setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
          }
        } catch (err) {
          logger.error('[SELFIE] Metin mesajı silinemedi:', err);
        }
        return; // İşlemi burada sonlandır
      }
    }
  }

  // 1.5. Guard Koruması (Anti-Spam / Flood & Reklam / Link Engelleme)
  const isSpam = await guardService.handleSpamCheck(message);
  if (isSpam) return;

  const isLink = await guardService.handleLinkCheck(message);
  if (isLink) return;

  // 1.8. Kelime Türetmece Oyunu Kanalı (Sohbet ve diğer işlemler engellenir)
  const isWordGame = await wordGameService.handleMessage(message);
  if (isWordGame) {
    return;
  }

  // 1.9. Ana Sohbet (1542620110882349162) Şakacı & Laf Sokucu Bot Yanıtları (Nadiren)
  await banterService.handleMessage(message).catch((err) => {
    logger.error('[BANTER] Hata:', err);
  });

  // 2. AutoMod Denetimi
  const violated = await autoModService.processMessage(message);
  if (violated) return;

  // 2.5. Mesaj Sayısını Say (45 saniye XP beklemesinden bağımsız olarak her mesaj anında kaydedilir!)
  await xpService.recordMessage(
    message.guild.id,
    message.author.id,
    message.channel instanceof TextChannel ? message.channel : undefined,
    message.client
  );

  // 3. XP & Seviye Kazanımı
  if (message.channel instanceof TextChannel) {
    await xpService.addMessageXp(
      message.guild.id,
      message.author.id,
      message.content,
      message.channel,
      message.client
    );
  }
}
