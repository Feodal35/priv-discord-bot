import { User, PartialUser } from 'discord.js';
import { clanRoleService } from '../services/clanRole.service';

export async function onUserUpdate(oldUser: User | PartialUser, newUser: User) {
  // Kullanıcının profilinde klan rozeti veya primary_guild değiştiğinde
  for (const [, guild] of newUser.client.guilds.cache) {
    const member = guild.members.cache.get(newUser.id);
    if (member) {
      await clanRoleService.checkAndSyncMember(member).catch(() => {});
    }
  }
}
