import { Message, PartialMessage } from 'discord.js';
import { logService } from '../services/log.service';
import { messageCacheService } from '../services/messageCache.service';

export async function onMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage
) {
  if (!newMessage.guild || newMessage.author?.bot) return;

  const cached = messageCacheService.get(oldMessage.id);
  const oldContent = oldMessage.content || cached?.content;
  const newContent = newMessage.content;

  // İçerik değişmediyse (örneğin sadece embed yüklendiyse) loglama
  if (oldContent === newContent) return;

  const authorId = newMessage.author?.id || cached?.authorId;
  const authorTag = newMessage.author?.tag || cached?.authorTag || 'Bilinmeyen Kullanıcı';

  const displayOld = oldContent ? (oldContent.length > 450 ? oldContent.substring(0, 450) + '...' : oldContent) : '*Önceki içerik kaydedilmemiş*';
  const displayNew = newContent ? (newContent.length > 450 ? newContent.substring(0, 450) + '...' : newContent) : '*Boş*';

  const desc =
    `**Yazar:** ${authorId ? `<@${authorId}>` : 'Bilinmiyor'} (\`${authorTag}\`)\n` +
    `**Kanal:** <#${newMessage.channelId}>\n\n` +
    `**Eski Hali:**\n>>> ${displayOld}\n\n` +
    `**Yeni Hali:**\n>>> ${displayNew}\n\n` +
    `🔗 [Mesaja Git](${newMessage.url})`;

  await logService.logEvent(
    newMessage.guild.id,
    'MESSAGE_UPDATE',
    'Mesaj Düzenlendi',
    desc,
    newMessage.client
  );

  // Güncel mesajı önbelleğe kaydet
  messageCacheService.set(newMessage as Message);
}
