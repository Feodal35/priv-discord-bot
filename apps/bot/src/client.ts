import { Client, GatewayIntentBits, Collection, Partials, AuditLogEvent } from 'discord.js';
import { SlashCommand } from './types/command';
import { guardService } from './services/guard.service';

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
import { evlenCommand } from './commands/social/evlen';
import { evlilikCommand } from './commands/social/evlilik';
import { bosanCommand } from './commands/social/bosan';

// Ekonomi Komutları
import { bakiyeCommand } from './commands/economy/bakiye';
import { gunlukCommand } from './commands/economy/gunluk';
import { calisCommand } from './commands/economy/calis';
import { gonderCommand } from './commands/economy/gonder';
import { marketCommand } from './commands/economy/market';
import { envanterCommand } from './commands/economy/envanter';
import { gorevCommand } from './commands/economy/gorev';
import { bankaCommand } from './commands/economy/banka';
import { soyCommand } from './commands/economy/soy';
import { kasaCommand } from './commands/economy/kasa';

// Oyun Komutları
import { oyunCommand } from './commands/games/oyun';
import { shipCommand } from './commands/games/ship';
import { blackjackCommand } from './commands/games/blackjack';
import { ruletCommand } from './commands/games/rulet';
import { kelimeOyunCommand } from './commands/games/kelimeOyun';
import { balikTutCommand } from './commands/games/balikTut';
import { slotCommand } from './commands/games/slot';
import { duelloCommand } from './commands/games/duello';


// Araç Komutları
import { yardimCommand } from './commands/utility/yardim';
import { sunucuCommand } from './commands/utility/sunucu';
import { siralamaCommand } from './commands/utility/siralama';
import { itirafCommand } from './commands/utility/itiraf';
import { anketCommand } from './commands/utility/anket';
import { dogumgunuCommand } from './commands/utility/dogumgunu';
import { hatirlatCommand } from './commands/utility/hatirlat';
import { sayCommand } from './commands/utility/say';
import { rolPanelCommand } from './commands/utility/rolPanel';
import { cekilisCommand } from './commands/utility/cekilis';
import { boosterRenkCommand } from './commands/utility/boosterRenk';

// Ses Komutları
import { voiceCommand } from './commands/voice/voice';
import { gitCommand } from './commands/voice/git';
import { cekCommand } from './commands/voice/cek';
import { topluCekCommand } from './commands/voice/topluCek';
import { topluTasiCommand } from './commands/voice/topluTasi';

// Moderasyon Komutları
import { uyarCommand } from './commands/moderation/uyar';
import { timeoutCommand } from './commands/moderation/timeout';
import { susturCommand } from './commands/moderation/sustur';
import { atCommand } from './commands/moderation/at';
import { yasaklaCommand } from './commands/moderation/yasakla';
import { temizleCommand } from './commands/moderation/temizle';
import { kilitleCommand } from './commands/moderation/kilitle';
import { acCommand } from './commands/moderation/ac';
import { sesgecCommand } from './commands/moderation/sesgec';

// Yönetici Komutları
import { kurulumCommand } from './commands/admin/kurulum';
import { ayarlarCommand } from './commands/admin/ayarlar';
import { guildMuafiyetCommand } from './commands/admin/guildMuafiyet';

// Kayıt Komutları
import { kayitCommand } from './commands/register/kayit';
import { kayitsizCommand } from './commands/register/kayitsiz';
import { kayitKurulumCommand } from './commands/register/kayitKurulum';
import { kayitAyarCommand } from './commands/register/kayitAyar';
import { kayitGecmisCommand } from './commands/register/kayitGecmis';
import { kayitIstatistikCommand } from './commands/register/kayitIstatistik';

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
  evlenCommand,
  evlilikCommand,
  bosanCommand,
  bakiyeCommand,
  bankaCommand,
  soyCommand,
  gunlukCommand,
  calisCommand,
  gonderCommand,
  marketCommand,
  envanterCommand,
  kasaCommand,
  gorevCommand,
  duelloCommand,
  oyunCommand,
  shipCommand,
  blackjackCommand,
  ruletCommand,
  kelimeOyunCommand,
  balikTutCommand,
  slotCommand,
  yardimCommand,
  sunucuCommand,
  siralamaCommand,
  itirafCommand,
  anketCommand,
  dogumgunuCommand,
  hatirlatCommand,
  sayCommand,
  rolPanelCommand,
  cekilisCommand,
  boosterRenkCommand,
  voiceCommand,
  gitCommand,
  cekCommand,
  topluCekCommand,
  topluTasiCommand,
  uyarCommand,
  timeoutCommand,
  susturCommand,
  atCommand,
  yasaklaCommand,
  temizleCommand,
  kilitleCommand,
  acCommand,
  sesgecCommand,
  kurulumCommand,
  ayarlarCommand,
  guildMuafiyetCommand,
  kayitCommand,
  kayitsizCommand,
  kayitKurulumCommand,
  kayitAyarCommand,
  kayitGecmisCommand,
  kayitIstatistikCommand,
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
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.GuildMember,
      Partials.User,
      Partials.Reaction,
    ],
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

  // Sağ Tık Toplu Moderasyon (Mass Action) Guard Koruması
  client.on('guildAuditLogEntryCreate', async (entry, guild) => {
    if (!entry.executorId) return;
    if (
      entry.action === AuditLogEvent.MemberBanAdd ||
      entry.action === AuditLogEvent.MemberKick ||
      entry.action === AuditLogEvent.RoleDelete ||
      entry.action === AuditLogEvent.ChannelDelete
    ) {
      let actionName = 'Moderasyon Eylemi';
      if (entry.action === AuditLogEvent.MemberBanAdd) actionName = 'Yasaklama (Ban)';
      else if (entry.action === AuditLogEvent.MemberKick) actionName = 'Sunucudan Atma (Kick)';
      else if (entry.action === AuditLogEvent.RoleDelete) actionName = 'Rol Silme';
      else if (entry.action === AuditLogEvent.ChannelDelete) actionName = 'Kanal Silme';

      await guardService.handleMassActionGuard(guild, entry.executorId, actionName, client);
    }
  });

  return client;
}

