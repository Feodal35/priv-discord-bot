import { Message, TextChannel } from 'discord.js';
import { autoModService } from '../services/automod.service';
import { xpService } from '../services/xp.service';

export async function onMessageCreate(message: Message) {
  if (!message.guild || message.author.bot) return;

  // 1. AutoMod Denetimi
  const violated = await autoModService.processMessage(message);
  if (violated) return;

  // 2. XP & Seviye Kazanımı
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
