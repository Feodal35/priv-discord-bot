import fs from 'fs';
import path from 'path';
import { Guild, GuildMember, Client, PermissionFlagsBits, AuditLogEvent } from 'discord.js';
import { logger } from '../utils/logger';
import { logService } from './log.service';

// Kullanıcının belirttiği güncel klan / guild rolü ID'si
export const CLAN_ROLE_ID = '1543392872504762498';
// Önceki yanlış rol ID'si (artık temizlenir)
export const OLD_CLAN_ROLE_ID = '1543033008318316654';

// Kalıcı muafiyet dosyası yolu
const EXEMPTIONS_FILE = path.join(process.cwd(), 'guild_exemptions.json');

export class ClanRoleService {
  // Bellek içi muafiyet listesi (guildId:userId)
  private exemptions = new Set<string>();

  constructor() {
    this.loadExemptions();
  }

  private loadExemptions() {
    try {
      if (fs.existsSync(EXEMPTIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(EXEMPTIONS_FILE, 'utf-8'));
        if (Array.isArray(data)) {
          this.exemptions = new Set(data);
        }
      }
    } catch (e) {
      logger.error('[CLAN_ROLE] Muafiyet listesi yüklenemedi:', e);
    }
  }

  private saveExemptions() {
    try {
      fs.writeFileSync(EXEMPTIONS_FILE, JSON.stringify(Array.from(this.exemptions), null, 2), 'utf-8');
    } catch (e) {
      logger.error('[CLAN_ROLE] Muafiyet listesi kaydedilemedi:', e);
    }
  }

  public isExempt(guildId: string, userId: string): boolean {
    return this.exemptions.has(`${guildId}:${userId}`);
  }

  public addExemption(guildId: string, userId: string): boolean {
    const key = `${guildId}:${userId}`;
    if (this.exemptions.has(key)) return false;
    this.exemptions.add(key);
    this.saveExemptions();
    return true;
  }

  public removeExemption(guildId: string, userId: string): boolean {
    const key = `${guildId}:${userId}`;
    if (!this.exemptions.has(key)) return false;
    this.exemptions.delete(key);
    this.saveExemptions();
    return true;
  }

  public getExemptions(guildId: string): string[] {
    const list: string[] = [];
    for (const item of this.exemptions) {
      const [gId, uId] = item.split(':');
      if (gId === guildId && uId) {
        list.push(uId);
      }
    }
    return list;
  }

  /**
   * Bir kullanıcının bu sunucunun resmi Guild / Clan rozetine sahip olup olmadığını kontrol eder.
   */
  async hasGuildOrClan(member: GuildMember): Promise<boolean> {
    if (member.user.bot) return false;

    try {
      const freshUser = await member.user.fetch(true).catch(() => member.user);
      const userAny = freshUser as any;
      const memberAny = member as any;
      const guildAny = member.guild as any;

      const pg = userAny.primaryGuild || userAny.primary_guild;
      const clan = userAny.clan || memberAny.clan;

      // primaryGuild kontrolü
      if (pg) {
        const idGuild = pg.identityGuildId || pg.identity_guild_id;
        const isEnabled = pg.identityEnabled !== false && pg.identity_enabled !== false;
        if (idGuild === member.guild.id && isEnabled) {
          return true;
        }
      }

      // clan objesi kontrolü
      if (clan) {
        const clanGuildId = clan.identityGuildId || clan.identity_guild_id;
        const isEnabled = clan.identityEnabled !== false && clan.identity_enabled !== false;
        if (clanGuildId === member.guild.id && isEnabled) {
          return true;
        }
      }

      // Sunucu klan tagı kontrolü
      const serverClanTag = guildAny.clan?.tag;
      if (serverClanTag && (pg?.tag === serverClanTag || clan?.tag === serverClanTag)) {
        return true;
      }

      return false;
    } catch (err) {
      logger.error(`[CLAN_ROLE] Üye kontrol edilirken hata (${member.id}):`, err);
      return false;
    }
  }

  /**
   * Rolün bir yetkili (insan) tarafından elle verilip verilmediğini Discord Denetim Kaydından inceler.
   */
  async wasRoleGivenManuallyByStaff(member: GuildMember): Promise<boolean> {
    try {
      const guild = member.guild;
      const botMember = guild.members.me;
      if (!botMember?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
        return false;
      }

      const logs = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 10,
      }).catch(() => null);

      if (!logs) return false;

      for (const entry of logs.entries.values()) {
        if (entry.targetId === member.id && entry.executor && !entry.executor.bot) {
          // Bu rolu eklemiş mi?
          const addedRole = entry.changes.find(
            (c) => c.key === '$add' && Array.isArray(c.new) && c.new.some((r: any) => r.id === CLAN_ROLE_ID)
          );
          if (addedRole) {
            return true;
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Tek bir üye için rol durumunu denetler:
   * - Muafiyet listesinde veya yetkili ise rol asla geri alınmaz.
   * - Yetkili elle vermişse otomatik muafiyete alınır.
   * - Klanı varsa ve rol yoksa: ROL VERİR.
   * - Klanı yoksa ve rol varsa: ROLÜ GERİ ALIR.
   */
  async checkAndSyncMember(member: GuildMember): Promise<'ADDED' | 'REMOVED' | 'NONE'> {
    if (member.user.bot) return 'NONE';

    const guild = member.guild;
    let role = guild.roles.cache.get(CLAN_ROLE_ID);
    if (!role) {
      role = (await guild.roles.fetch(CLAN_ROLE_ID).catch(() => null)) || undefined;
    }

    if (!role) return 'NONE';

    const botMember = guild.members.me;
    if (!botMember?.permissions.has('ManageRoles') || botMember.roles.highest.position <= role.position) {
      return 'NONE';
    }

    // Eski yanlış rol (1543033008318316654) kalmışsa temizle
    if (member.roles.cache.has(OLD_CLAN_ROLE_ID)) {
      await member.roles.remove(OLD_CLAN_ROLE_ID).catch(() => {});
    }

    const hasRole = member.roles.cache.has(CLAN_ROLE_ID);
    const hasClan = await this.hasGuildOrClan(member);

    // 1. Muafiyet Kontrolleri:
    // A) Manuel muafiyet listesinde mi?
    if (this.isExempt(guild.id, member.id)) {
      if (!hasRole) {
        await member.roles.add(role).catch(() => {});
        return 'ADDED';
      }
      return 'NONE'; // Elle muaf tutulmuş, rolü geri alınamaz!
    }

    // B) Sunucu Sahibi veya Yönetici mi?
    if (member.id === guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator)) {
      if (hasRole) return 'NONE'; // Yöneticilerin rolüne asla dokunma
    }

    // 2. Eğer klanı var ama rolü yoksa -> Rolü ver
    if (hasClan && !hasRole) {
      await member.roles.add(role).catch((err) => {
        logger.error(`[CLAN_ROLE] Rol eklenemedi (${member.user.tag}):`, err);
      });
      logger.info(`✅ [CLAN_ROLE] ${member.user.tag} klan rozetine sahip olduğu için rol verildi.`);
      await logService.logEvent(
        guild.id,
        'CLAN',
        'Klan / Guild Rolü Verildi',
        `**Kullanıcı:** <@${member.id}> (${member.user.tag})\n**Rol:** <@&${role.id}>\n**Durum:** Resmi sunucu klanı profilde aktif.`,
        member.client
      ).catch(() => {});
      return 'ADDED';
    }

    // 3. Eğer klanı yok ama rolü varsa:
    if (!hasClan && hasRole) {
      // Önce Denetim Kaydına bak: Bir yetkili mi verdi?
      const manualByStaff = await this.wasRoleGivenManuallyByStaff(member);
      if (manualByStaff) {
        // Yetkili elle vermiş! Otomatik muafiyete ekle ve rolü koru!
        this.addExemption(guild.id, member.id);
        logger.info(`🛡️ [CLAN_ROLE] ${member.user.tag} yetkili tarafından elle rol verildiği için muafiyete alındı (Rol silinmedi).`);
        return 'NONE';
      }

      // Normal kullanıcı salmış/bırakmış -> Rolü geri al!
      await member.roles.remove(role).catch((err) => {
        logger.error(`[CLAN_ROLE] Rol kaldırılamadı (${member.user.tag}):`, err);
      });
      logger.warn(`❌ [CLAN_ROLE] ${member.user.tag} klan rozetini saldığı/bıraktığı için rolü kaldırıldı!`);
      await logService.logEvent(
        guild.id,
        'CLAN',
        'Klan / Guild Rolü Geri Alındı',
        `**Kullanıcı:** <@${member.id}> (${member.user.tag})\n**Rol:** <@&${role.id}>\n**Sebep:** Kullanıcı sunucu klanını profilinden kaldırdı/salmış.`,
        member.client
      ).catch(() => {});
      return 'REMOVED';
    }

    return 'NONE';
  }

  /**
   * Sunucudaki TÜM üyeleri baştan sona tarar.
   */
  async syncAllMembers(guild: Guild): Promise<{ added: number; removed: number; total: number }> {
    logger.info(`🔍 [CLAN_ROLE] ${guild.name} klan/guild denetimi yapılıyor...`);

    let role = guild.roles.cache.get(CLAN_ROLE_ID);
    if (!role) {
      role = (await guild.roles.fetch(CLAN_ROLE_ID).catch(() => null)) || undefined;
    }
    if (!role) return { added: 0, removed: 0, total: 0 };

    const members = await guild.members.fetch().catch(() => null);
    if (!members) return { added: 0, removed: 0, total: 0 };

    let added = 0;
    let removed = 0;

    for (const [, member] of members) {
      if (member.user.bot) continue;
      const result = await this.checkAndSyncMember(member);
      if (result === 'ADDED') added++;
      if (result === 'REMOVED') removed++;
    }

    logger.info(`🏁 [CLAN_ROLE] ${guild.name} denetimi bitti: ${removed} üyeden rol alındı, ${added} üyeye verildi.`);
    return { added, removed, total: members.size };
  }

  async syncAllGuilds(client: Client) {
    for (const [, guild] of client.guilds.cache) {
      await this.syncAllMembers(guild).catch(() => {});
    }
  }
}

export const clanRoleService = new ClanRoleService();
