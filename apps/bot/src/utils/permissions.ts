import { GuildMember, PermissionResolvable, PermissionsBitField } from 'discord.js';

export function checkPermissions(
  member: GuildMember,
  requiredPermissions: PermissionResolvable[]
): { hasPermission: boolean; missing: string[] } {
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return { hasPermission: true, missing: [] };
  }

  const missing: string[] = [];
  for (const perm of requiredPermissions) {
    if (!member.permissions.has(perm)) {
      missing.push(String(perm));
    }
  }

  return {
    hasPermission: missing.length === 0,
    missing,
  };
}

export function checkRoleHierarchy(
  moderator: GuildMember,
  target: GuildMember,
  botMember: GuildMember
): { canModerate: boolean; reason?: string } {
  // Sunucu sahibi dokunulmazdır
  if (target.id === moderator.guild.ownerId) {
    return { canModerate: false, reason: 'Sunucu sahibine işlem uygulayamazsın.' };
  }

  // Kendine işlem yapamaz
  if (target.id === moderator.id) {
    return { canModerate: false, reason: 'Kendine karşı moderasyon işlemi uygulayamazsın.' };
  }

  // Yetkili sunucu sahibi değilse hiyerarşi kontrolü
  if (moderator.id !== moderator.guild.ownerId) {
    if (target.roles.highest.position >= moderator.roles.highest.position) {
      return {
        canModerate: false,
        reason: 'Bu kullanıcının en yüksek rolü senin rolüne eşit veya daha yüksek.',
      };
    }
  }

  // Botun rolü hedef kullanıcının rolünden yüksek olmalı
  if (target.roles.highest.position >= botMember.roles.highest.position) {
    return {
      canModerate: false,
      reason: 'Botun en yüksek rolü bu kullanıcının rolünden daha düşük olduğu için işlem yapılamaz.',
    };
  }

  return { canModerate: true };
}
