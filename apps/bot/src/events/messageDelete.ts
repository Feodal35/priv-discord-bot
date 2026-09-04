import { Message, PartialMessage } from 'discord.js';
import { logService } from '../services/log.service';

export async function onMessageDelete(message: Message | PartialMessage) {
  if (!message.guild || message.author?.bot) return;

  await logService.logEvent(
    message.guild.id,
    'MESSAGE_DELETE',
    'Mesaj Silindi',
    `**Yazar:** <@${message.author?.id}> (${message.author?.tag})\n**Kanal:** <#${message.channelId}>\n**İçerik:** ${message.content?.slice(0, 800) || '*İçerik önbellekte bulunamadı*'}`,
    message.client
  );
}
