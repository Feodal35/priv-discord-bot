import { GuildMember, PartialGuildMember, AuditLogEvent } from 'discord.js';
import { clanRoleService } from '../services/clanRole.service';
import { logService } from '../services/log.service';

export async function onGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
) {
  // 1. Klan / guild durumu değişti mi denetle
  await clanRoleService.checkAndSyncMember(newMember).catch(() => {});

  const guild = newMember.guild;
  const client = newMember.client;
  const avatarUrl = newMember.displayAvatarURL({ size: 128 });
  const nowUnix = Math.floor(Date.now() / 1000);

  try {
    // 2. İSİM (NICKNAME) DEĞİŞİKLİĞİ
    if (oldMember.nickname !== newMember.nickname) {
      const oldNick = oldMember.nickname || oldMember.user?.username || 'Varsayılan İsim';
      const newNick = newMember.nickname || newMember.user.username;

      // Audit Log: Kim değiştirdi?
      let executorStr = '';
      try {
        const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 }).catch(() => null);
        const logEntry = auditLogs?.entries.first();
        if (logEntry && logEntry.targetId === newMember.id && Date.now() - logEntry.createdTimestamp < 3500) {
          if (logEntry.executorId === newMember.id) {
            executorStr = '\n👤 **İşlemi Yapan:** Kendisi';
          } else {
            executorStr = `\n🛡️ **Değiştiren Yetkili:** <@${logEntry.executorId}>`;
          }
        }
      } catch {}

      const desc =
        `**Kullanıcı:** <@${newMember.id}> (\`${newMember.user.tag}\`)\n` +
        `**Eski İsim:** \`${oldNick}\`\n` +
        `**Yeni İsim:** \`${newNick}\`` +
        executorStr +
        `\n**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`;

      await logService.logEvent(
        guild.id,
        'MEMBER_UPDATE',
        'Kullanıcı İsmi Değiştirildi',
        desc,
        client,
        undefined,
        { thumbnailUrl: avatarUrl, color: 0x3498db }
      );
    }

    // 3. ROL DEĞİŞİKLİKLERİ (Eklenen & Alınan Roller)
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter((r) => !oldRoles.has(r.id));
    const removedRoles = oldRoles.filter((r) => !newRoles.has(r.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      // Audit log: Rolleri kim verdi/aldı?
      let executorStr = '';
      try {
        const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 1 }).catch(() => null);
        const logEntry = auditLogs?.entries.first();
        if (logEntry && logEntry.targetId === newMember.id && Date.now() - logEntry.createdTimestamp < 3500) {
          executorStr = `\n🛡️ **İşlemi Yapan Yetkili:** <@${logEntry.executorId}>`;
        }
      } catch {}

      let roleDetails = '';
      if (addedRoles.size > 0) {
        roleDetails += `\n**Verilen Roller (+):**\n${addedRoles.map((r) => `• <@&${r.id}> (\`${r.name}\`)`).join('\n')}\n`;
      }
      if (removedRoles.size > 0) {
        roleDetails += `\n**Alınan Roller (-):**\n${removedRoles.map((r) => `• <@&${r.id}> (\`${r.name}\`)`).join('\n')}\n`;
      }

      const desc =
        `**Kullanıcı:** <@${newMember.id}> (\`${newMember.user.tag}\`)\n` +
        roleDetails +
        executorStr +
        `\n**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`;

      await logService.logEvent(
        guild.id,
        'ROLE_UPDATE',
        'Kullanıcı Rolleri Güncellendi',
        desc,
        client,
        undefined,
        {
          thumbnailUrl: avatarUrl,
          color: addedRoles.size > 0 ? 0x2ecc71 : 0xe67e22,
        }
      );
    }

    // 4. ZAMANAŞIMI (TIMEOUT / SUSTURMA)
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;

    if (oldTimeout !== newTimeout) {
      // Zamanaşımı uygulandı mı yoksa kaldırıldı mı?
      const isMuted = newMember.isCommunicationDisabled();

      let executorStr = '';
      let reasonStr = '';
      try {
        const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 }).catch(() => null);
        const logEntry = auditLogs?.entries.first();
        if (logEntry && logEntry.targetId === newMember.id && Date.now() - logEntry.createdTimestamp < 3500) {
          executorStr = `\n🛡️ **Yetkili:** <@${logEntry.executorId}>`;
          if (logEntry.reason) reasonStr = `\n📝 **Sebep:** ${logEntry.reason}`;
        }
      } catch {}

      if (isMuted && newTimeout) {
        const timeoutUnix = Math.floor(newTimeout / 1000);
        const desc =
          `**Kullanıcı:** <@${newMember.id}> (\`${newMember.user.tag}\`)\n` +
          `**Ceza Türü:** ⏳ Metin / İletişim Zamanaşımı (Timeout)\n` +
          `**Bitiş Zamanı:** <t:${timeoutUnix}:f> (<t:${timeoutUnix}:R>)` +
          executorStr +
          reasonStr +
          `\n**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`;

        await logService.logEvent(
          guild.id,
          'MODERATION',
          'Kullanıcıya Zamanaşımı Uygulandı',
          desc,
          client,
          undefined,
          { thumbnailUrl: avatarUrl, color: 0xe74c3c }
        );
      } else if (!isMuted && oldTimeout) {
        const desc =
          `**Kullanıcı:** <@${newMember.id}> (\`${newMember.user.tag}\`)\n` +
          `**Durum:** 🟢 Zamanaşımı kaldırıldı (Cezası bitti veya yetkili kaldırdı).` +
          executorStr +
          `\n**Zaman:** <t:${nowUnix}:T> (<t:${nowUnix}:R>)`;

        await logService.logEvent(
          guild.id,
          'MODERATION',
          'Zamanaşımı Kaldırıldı',
          desc,
          client,
          undefined,
          { thumbnailUrl: avatarUrl, color: 0x2ecc71 }
        );
      }
    }
  } catch (err) {
    console.error('[ÜYE GÜNCELLEME LOG HATASI]:', err);
  }
}

