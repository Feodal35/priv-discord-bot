export type RarityType = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

export type ShopItemType = 'ROLE' | 'CUSTOM_ROLE' | 'BADGE' | 'TITLE' | 'COSMETIC' | 'ITEM';

export type TransactionType = 'DAILY' | 'WORK' | 'TRANSFER' | 'SHOP' | 'QUEST' | 'GAME' | 'ADMIN' | 'REWARD';

export type QuestFrequency = 'DAILY' | 'WEEKLY';

export type QuestType = 'MESSAGE_COUNT' | 'VOICE_TIME' | 'PLAY_GAME' | 'TRANSFER_COIN' | 'GIVE_REACTION';

export type ModerationAction = 'WARN' | 'MUTE' | 'TIMEOUT' | 'KICK' | 'BAN' | 'CLEAR' | 'LOCK' | 'UNLOCK';

export type AutoModAction = 'WARN' | 'TIMEOUT' | 'DELETE' | 'KICK' | 'BAN';

export interface UserProfileDto {
  userId: string;
  guildId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  xp: number;
  xpNeeded: number;
  progressPercent: number;
  coins: number;
  bankCoins: number;
  streak: number;
  messageCount: number;
  voiceHours: number;
  achievementCount: number;
  rank: number;
  joinedAt: Date | string;
  title: string;
  bio: string;
  badges: string[];
}

export interface GuildSettingsDto {
  guildId: string;
  botName: string;
  embedColor: string;
  currencyName: string;
  currencyEmoji: string;
  welcomeChannelId?: string | null;
  leaveChannelId?: string | null;
  logChannelId?: string | null;
  confessionChannelId?: string | null;
  birthdayChannelId?: string | null;
  tempVoiceCategoryId?: string | null;
  tempVoiceCreateChannelId?: string | null;
  autoRoleId?: string | null;
  birthdayRoleId?: string | null;
  muteRoleId?: string | null;
  welcomeMessage: string;
  leaveMessage: string;
  economyEnabled: boolean;
  levelEnabled: boolean;
  gamesEnabled: boolean;
  voiceEnabled: boolean;
  aiEnabled: boolean;
  confessionEnabled: boolean;
  autoModEnabled: boolean;
  dailyReward: number;
  workMinReward: number;
  workMaxReward: number;
  workCooldownMinutes: number;
  dailyStreakBonus: number;
  maxTransferAmount: number;
}

export interface LeaderboardEntryDto {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  value: number;
  formattedValue: string;
  rank: number;
}

export interface AutoModConfigDto {
  spamFilter: boolean;
  floodFilter: boolean;
  mentionSpamLimit: number;
  linkFilter: boolean;
  inviteFilter: boolean;
  capsLimitPercent: number;
  emojiLimit: number;
  bannedWords: string[];
  action: AutoModAction;
  timeoutDurationSeconds: number;
}

export interface ServerStatsSummaryDto {
  memberCount: number;
  onlineCount: number;
  voiceCount: number;
  totalMessages: number;
  totalVoiceHours: number;
  totalCoinsInEconomy: number;
  activeUsersCount: number;
  topChatter?: { userId: string; username: string; messageCount: number } | null;
  topVoice?: { userId: string; username: string; voiceHours: number } | null;
}
