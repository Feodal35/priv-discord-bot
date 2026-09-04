import { Message, TextChannel } from 'discord.js';
import { autoModService } from '../services/automod.service';
import { xpService } from '../services/xp.service';
import { messageCacheService } from '../services/messageCache.service';
import { guardService } from '../services/guard.service';
import { wordGameService } from '../services/wordGame.service';

// Kullanıcının belirttiği fotoğraf kanalı ID'si
export const PHOTO_CHANNEL_ID = '1543271245779566703';

export async function onMessageCreate(message: Message) {
  if (!message.guild || message.author.bot) return;

  // Mesajı silinme ve düzenlenme logları için önbelleğe al
  messageCacheService.set(message);

  // 1. Fotoğraf Kanalı Otomatik Kalp Reaksiyonu (1543271245779566703)
  if (message.channelId === PHOTO_CHANNEL_ID) {
    const hasImageAttachment = message.attachments.some((att) => {
      const isImageMime = att.contentType?.startsWith('image/');
      const hasImageExt = /\.(png|jpe?g|gif|webp|bmp)$/i.test(att.name || '');
      return Boolean(isImageMime || hasImageExt);
    });

    const hasImageUrlInContent = /(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|bmp))/i.test(message.content);

    // Eğer mesaja fotoğraf/görsel iliştirilmişse otomatik kalp koy
    if (hasImageAttachment || hasImageUrlInContent) {
      await message.react('❤️').catch(() => {});
    }
  }

  // 1.5. Guard Koruması (Anti-Spam / Flood & Reklam / Link Engelleme)
  const isSpam = await guardService.handleSpamCheck(message);
  if (isSpam) return;

  const isLink = await guardService.handleLinkCheck(message);
  if (isLink) return;

  // 1.8. Kelime Türetmece Oyunu Kanalı
  const isWordGame = await wordGameService.handleMessage(message);
  if (isWordGame) {
    // Kelime oyunu mesajı işlendi, normal akışa devam et (XP alabilir)
  }

  // 2. AutoMod Denetimi
  const violated = await autoModService.processMessage(message);
  if (violated) return;

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
