import { GuildMember, PartialGuildMember } from 'discord.js';
import { clanRoleService } from '../services/clanRole.service';

export async function onGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
) {
  // Üye güncellendiğinde klan / guild durumu değişti mi denetle
  await clanRoleService.checkAndSyncMember(newMember).catch(() => {});
}
