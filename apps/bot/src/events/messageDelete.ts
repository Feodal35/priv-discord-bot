import { Message, PartialMessage, AuditLogEvent } from 'discord.js';
import { logService } from '../services/log.service';
import { messageCacheService } from '../services/messageCache.service';

export async function onMessageDelete(message: Message | PartialMessage) {
  if (!message.guild) return;

  // Bot mesajlarını loglama
  if (message.author?.bot) return;

  const cached = messageCacheService.get(message.id);

  const authorId = message.author?.id || cached?.authorId;
  const authorTag = message.author?.tag || cached?.authorTag || 'Bilinmeyen Kullanıcı';
  const content = message.content || cached?.content;
  const attachments = cached?.attachments || [];

  // Eğer mesaj içeriği yoksa ve ek de yoksa devam et
  const displayContent = content ? (content.length > 900 ? content.substring(0, 900) + '...' : content) : '*Mesaj içeriği metin içermiyor (sadece medya veya sistem mesajı)*';

  let desc = `**Yazar:** ${authorId ? `<@${authorId}>` : 'Bilinmiyor'} (\`${authorTag}\`)\n` +
    `**Kanal:** <#${message.channelId}>\n\n` +
    `**Silinen İçerik:**\n>>> ${displayContent}`;

  if (attachments.length > 0) {
    desc += `\n\n📎 **Ekler / Medya (${attachments.length}):**\n${attachments.map((u, i) => `[Ek ${i + 1}](${u})`).join(' • ')}`;
  }

  // Denetim kaydı kontrolü (Moderatör mü sildi?)
  try {
    const auditLogs = await message.guild.fetchAuditLogs({
      type: AuditLogEvent.MessageDelete,
      limit: 1,
    }).catch(() => null);

    const logEntry = auditLogs?.entries.first();
    if (logEntry && logEntry.targetId === authorId && Date.now() - logEntry.createdTimestamp < 4000) {
      desc += `\n\n🛡️ **Silen Yetkili:** <@${logEntry.executorId}>`;
    }
  } catch {
    /* sessiz */
  }

  const avatarUrl = message.author ? message.author.displayAvatarURL({ size: 128 }) : undefined;

  await logService.logEvent(
    message.guild.id,
    'MESSAGE_DELETE',
    'Mesaj Silindi',
    desc,
    message.client,
    undefined,
    { thumbnailUrl: avatarUrl, color: 0xe74c3c }
  );

  // İşlem bitince cache'den temizle
  messageCacheService.delete(message.id);
}
