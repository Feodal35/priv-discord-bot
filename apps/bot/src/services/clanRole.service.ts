import fs from 'fs';
import path from 'path';
import { Guild, GuildMember, Client, PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger';
import { logService } from './log.service';

// Kullanıcının belirttiği güncel klan / guild rolü ID'si
export const CLAN_ROLE_ID = '1543392872504762498';

// Ana sunucu ID'si (VİP METRO)
export const MAIN_GUILD_ID = '1542620110034829449';

// Kalıcı muafiyet dosyası yolu
const EXEMPTIONS_FILE = path.join(process.cwd(), 'guild_exemptions.json');

export interface UserClanInfo {
  guildId: string;
  tag?: string;
  isEnabled: boolean;
}

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
   * Kullanıcının veya üyenin tüm Discord nesnelerinden (User, Member, Raw) klan bilgisini eksiksiz çeker.
   */
  public extractClanInfo(member: GuildMember, freshUser?: any): UserClanInfo | null {
    const userAny = (freshUser || member.user) as any;
    const memberAny = member as any;

    const sources = [
      userAny?.primaryGuild,
      userAny?.primary_guild,
      userAny?.clan,
      freshUser?.primaryGuild,
      freshUser?.primary_guild,
      freshUser?.clan,
      memberAny?.clan,
      memberAny?.primaryGuild,
      memberAny?.primary_guild,
      memberAny?._raw?.clan,
      userAny?._raw?.primary_guild,
      userAny?._raw?.clan,
    ];

    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;

      const gId = src.identityGuildId || src.identity_guild_id || src.guild_id || src.guildId;
      if (gId) {
        const isEnabled = src.identityEnabled !== false && src.identity_enabled !== false;
        return {
          guildId: String(gId),
          tag: src.tag ? String(src.tag) : undefined,
          isEnabled,
        };
      }
    }

    return null;
  }

  /**
   * Bir kullanıcının bu sunucunun resmi Guild / Clan rozetine sahip olup olmadığını kontrol eder.
   */
  async hasGuildOrClan(member: GuildMember): Promise<boolean> {
    if (member.user.bot) return false;

    try {
      const freshUser = await member.user.fetch(true).catch(() => member.user);
      const clanInfo = this.extractClanInfo(member, freshUser);
      if (!clanInfo) return false;

      // Bu sunucunun ID'si ile eşleşiyor mu?
      const isThisGuild = clanInfo.guildId === member.guild.id || clanInfo.guildId === MAIN_GUILD_ID;
      return isThisGuild && clanInfo.isEnabled;
    } catch (err) {
      logger.error(`[CLAN_ROLE] Üye kontrol edilirken hata (${member.id}):`, err);
      return false;
    }
  }

  /**
   * Tek bir üye için rol durumunu %100 güvenilir şekilde denetler:
   * 1. Kullanıcı BAŞKA BİR SUNUCUNUN klanını taşıyorsa: ROL ASLA VERİLMEZ! Üzerinde varsa DERHAL ALINIR!
   * 2. Kullanıcı BU SUNUCUNUN resmi klanına sahipse ve rozeti aktifse: ROL VERİLİR.
   * 3. Kullanıcının klanı yoksa veya rozeti kapalıysa:
   *    - Yönetici/Sunucu Sahibi ise veya manuel muafiyette (/guild-muafiyet) ise rol korunur.
   *    - Aksi takdirde rol geri alınır.
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

    const hasRole = member.roles.cache.has(CLAN_ROLE_ID);

    // Güncel kullanıcı verisini API'den çek
    let freshUser: any = null;
    try {
      freshUser = await member.user.fetch(true).catch(() => member.user);
    } catch {
      freshUser = member.user;
    }

    const clanInfo = this.extractClanInfo(member, freshUser);

    // DURUM 1: KULLANICININ BAŞKA BİR SUNUCUNUN GUİLDİ / KLANI VAR
    // identityGuildId bizim sunucunun ID'si değilse kesinlikle başka bir sunucuya aittir.
    const isThisGuild = clanInfo && (clanInfo.guildId === guild.id || clanInfo.guildId === MAIN_GUILD_ID);

    if (clanInfo && !isThisGuild) {
      // Başka sunucunun klanı varken bu sunucunun klan rolü KESİNLİKLE verilemez!
      if (hasRole) {
        await member.roles.remove(role).catch((err) => {
          logger.error(`[CLAN_ROLE] Başka klanı olan üyeden rol kaldırılamadı (${member.user.tag}):`, err);
        });
        logger.warn(`❌ [CLAN_ROLE] ${member.user.tag} başka sunucunun klanını taşıdığı için klan rolü kaldırıldı! (Klan Sunucu ID: ${clanInfo.guildId})`);
        await logService.logEvent(
          guild.id,
          'CLAN',
          'Klan / Guild Rolü Geri Alındı',
          `**Kullanıcı:** <@${member.id}> (${member.user.tag})\n**Rol:** <@&${role.id}>\n**Sebep:** Kullanıcı başka bir sunucunun klanını/guildini taşıyor (\`${clanInfo.tag || clanInfo.guildId}\`).`,
          member.client
        ).catch(() => {});
        return 'REMOVED';
      }
      return 'NONE';
    }

    // DURUM 2: KULLANICI BU SUNUCUNUN RESMİ KLANINA SAHİP VE ROZETİ AKTİF
    if (isThisGuild && clanInfo.isEnabled) {
      if (!hasRole) {
        await member.roles.add(role).catch((err) => {
          logger.error(`[CLAN_ROLE] Rol eklenemedi (${member.user.tag}):`, err);
        });
        logger.info(`✅ [CLAN_ROLE] ${member.user.tag} resmi sunucu klanına sahip olduğu için rol verildi.`);
        await logService.logEvent(
          guild.id,
          'CLAN',
          'Klan / Guild Rolü Verildi',
          `**Kullanıcı:** <@${member.id}> (${member.user.tag})\n**Rol:** <@&${role.id}>\n**Durum:** Resmi sunucu klanı profilde aktif.`,
          member.client
        ).catch(() => {});
        return 'ADDED';
      }
      return 'NONE';
    }

    // DURUM 3: KULLANICININ KLANI YOK VEYA ROZETİ KAPATMIŞ
    if (hasRole) {
      // A) Sunucu Sahibi veya Yönetici ise dokunma
      if (member.id === guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator)) {
        return 'NONE';
      }

      // B) Manuel muafiyet listesinde (/guild-muafiyet) ise dokunma
      if (this.isExempt(guild.id, member.id)) {
        return 'NONE';
      }

      // Normal üye klanı salmış/bırakmış -> Rolü geri al!
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
