import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { SlashCommand } from './types/command';

// Sosyal Komutlar
import { profilCommand } from './commands/social/profil';
import { seviyeCommand } from './commands/social/seviye';
import { streakCommand } from './commands/social/streak';
import { basarimlarCommand } from './commands/social/basarimlar';
import { hafizaCommand } from './commands/social/hafiza';
import { yilozetiCommand } from './commands/social/yilozeti';
import { verilerimCommand } from './commands/social/verilerim';
import { verilerimiSilCommand } from './commands/social/verilerimi-sil';
import { zenginCommand } from './commands/social/zengin';

// Ekonomi Komutları
import { bakiyeCommand } from './commands/economy/bakiye';
import { gunlukCommand } from './commands/economy/gunluk';
import { calisCommand } from './commands/economy/calis';
import { gonderCommand } from './commands/economy/gonder';
import { marketCommand } from './commands/economy/market';
import { envanterCommand } from './commands/economy/envanter';
import { gorevCommand } from './commands/economy/gorev';

// Oyun Komutları
import { oyunCommand } from './commands/games/oyun';
import { shipCommand } from './commands/games/ship';

// Araç Komutları
import { yardimCommand } from './commands/utility/yardim';
import { sunucuCommand } from './commands/utility/sunucu';
import { siralamaCommand } from './commands/utility/siralama';
import { itirafCommand } from './commands/utility/itiraf';
import { anketCommand } from './commands/utility/anket';
import { dogumgunuCommand } from './commands/utility/dogumgunu';
import { hatirlatCommand } from './commands/utility/hatirlat';

// Ses Komutları
import { voiceCommand } from './commands/voice/voice';

// Moderasyon Komutları
import { uyarCommand } from './commands/moderation/uyar';
import { timeoutCommand } from './commands/moderation/timeout';
import { susturCommand } from './commands/moderation/sustur';
import { atCommand } from './commands/moderation/at';
import { yasaklaCommand } from './commands/moderation/yasakla';
import { temizleCommand } from './commands/moderation/temizle';
import { kilitleCommand } from './commands/moderation/kilitle';
import { acCommand } from './commands/moderation/ac';

// Yönetici Komutları
import { kurulumCommand } from './commands/admin/kurulum';
import { ayarlarCommand } from './commands/admin/ayarlar';

// Eventler
import { onReady } from './events/ready';
import { onInteractionCreate } from './events/interactionCreate';
import { onMessageCreate } from './events/messageCreate';
import { onVoiceStateUpdate } from './events/voiceStateUpdate';
import { onGuildMemberAdd } from './events/guildMemberAdd';
import { onGuildMemberRemove } from './events/guildMemberRemove';
import { onGuildMemberUpdate } from './events/guildMemberUpdate';
import { onUserUpdate } from './events/userUpdate';
import { onMessageDelete } from './events/messageDelete';
import { onMessageUpdate } from './events/messageUpdate';

export const commands = new Collection<string, SlashCommand>();

const allCommands: SlashCommand[] = [
  profilCommand,
  seviyeCommand,
  streakCommand,
  basarimlarCommand,
  hafizaCommand,
  yilozetiCommand,
  verilerimCommand,
  verilerimiSilCommand,
  zenginCommand,
  bakiyeCommand,
  gunlukCommand,
  calisCommand,
  gonderCommand,
  marketCommand,
  envanterCommand,
  gorevCommand,
  oyunCommand,
  shipCommand,
  yardimCommand,
  sunucuCommand,
  siralamaCommand,
  itirafCommand,
  anketCommand,
  dogumgunuCommand,
  hatirlatCommand,
  voiceCommand,
  uyarCommand,
  timeoutCommand,
  susturCommand,
  atCommand,
  yasaklaCommand,
  temizleCommand,
  kilitleCommand,
  acCommand,
  kurulumCommand,
  ayarlarCommand,
];

for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}

export function createDiscordClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User],
  });

  client.once('ready', () => onReady(client));
  client.on('interactionCreate', onInteractionCreate);
  client.on('messageCreate', onMessageCreate);
  client.on('voiceStateUpdate', onVoiceStateUpdate);
  client.on('guildMemberAdd', onGuildMemberAdd);
  client.on('guildMemberRemove', onGuildMemberRemove);
  client.on('guildMemberUpdate', onGuildMemberUpdate);
  client.on('userUpdate', onUserUpdate);
  client.on('messageDelete', onMessageDelete);
  client.on('messageUpdate', onMessageUpdate);

  return client;
}
