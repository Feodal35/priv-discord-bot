import { Message, PartialMessage } from 'discord.js';
import { logService } from '../services/log.service';

export async function onMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage
) {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  await logService.logEvent(
    newMessage.guild.id,
    'MESSAGE_UPDATE',
    'Mesaj Düzenlendi',
    `**Yazar:** <@${newMessage.author?.id}>\n**Kanal:** <#${newMessage.channelId}>\n\n**Eski:** ${oldMessage.content?.slice(0, 400) || '*Önbellekte yok*'}\n**Yeni:** ${newMessage.content?.slice(0, 400) || '*Boş*'}\n[Mesaja Git](${newMessage.url})`,
    newMessage.client
  );
}
