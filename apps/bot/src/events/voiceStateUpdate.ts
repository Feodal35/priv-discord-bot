import { VoiceState } from 'discord.js';
import { voiceService } from '../services/voice.service';

export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  await voiceService.handleVoiceState(oldState, newState, newState.client);
}
