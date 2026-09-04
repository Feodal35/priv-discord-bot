import { VoiceState } from 'discord.js';
import { voiceService } from '../services/voice.service';
import { AUTO_JOIN_CHANNEL_ID, connectToPersistentVoice } from './ready';

export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  // 1. Botun kendisi ses kanalından çıkarılmışsa otomatik olarak geri bağlan
  if (newState.member?.id === newState.client.user?.id) {
    if (!newState.channelId || newState.channelId !== AUTO_JOIN_CHANNEL_ID) {
      setTimeout(() => {
        connectToPersistentVoice(newState.client).catch(() => {});
      }, 2000);
    }
  }

  // 2. Dinamik ses kanalı ve XP / ses süresi takibi
  await voiceService.handleVoiceState(oldState, newState, newState.client);
}
