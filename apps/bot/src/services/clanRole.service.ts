import { Guild, GuildMember, Client } from 'discord.js';
import { logger } from '../utils/logger';

// Kullanıcının belirttiği klan / guild rolü ID'si
export const CLAN_ROLE_ID = '1543033008318316654';

export class ClanRoleService {
  /**
   * Bir kullanıcının bu sunucunun resmi Guild / Clan rozetine sahip olup olmadığını kontrol eder.
   * Kullanıcı klandan çıkmışsa, rozeti kapatmışsa veya başka bir klandaysa false döner.
   */
  async hasGuildOrClan(member: GuildMember): Promise<boolean> {
    if (member.user.bot) return false;

    try {
      // 1. Kullanıcının güncel Discord API profilini çek
      const freshUser = await member.user.fetch(true).catch(() => member.user);
      const userAny = freshUser as any;
      const memberAny = member as any;
      const guildAny = member.guild as any;

      // Discord Primary Guild (Guilds / Clans) verisi
      const pg = userAny.primaryGuild || userAny.primary_guild;
      const clan = userAny.clan || memberAny.clan;

      // A) primaryGuild kontrolü: Sunucu ID'si eşleşiyor mu ve rozet açık mı?
      if (pg) {
        const idGuild = pg.identityGuildId || pg.identity_guild_id;
        const isEnabled = pg.identityEnabled !== false && pg.identity_enabled !== false;
        if (idGuild === member.guild.id && isEnabled) {
          return true;
        }
      }

      // B) clan objesi kontrolü
      if (clan) {
        const clanGuildId = clan.identityGuildId || clan.identity_guild_id;
        const isEnabled = clan.identityEnabled !== false && clan.identity_enabled !== false;
        if (clanGuildId === member.guild.id && isEnabled) {
          return true;
        }
      }

      // C) Sunucunun kendi klan tagı varsa ve kullanıcının klan tagı ile örtüşüyorsa
      const serverClanTag = guildAny.clan?.tag;
      if (serverClanTag && (pg?.tag === serverClanTag || clan?.tag === serverClanTag)) {
        return true;
      }

      // Kullanıcı klan almamış veya önceden alıp salmış
      return false;
    } catch (err) {
      logger.error(`[CLAN_ROLE] Üye kontrol edilirken hata (${member.id}):`, err);
      return false;
    }
  }

  /**
   * Tek bir üye için rol durumunu denetler:
   * - Klanı varsa ve rol yoksa: ROL VERİR.
   * - Klanı yoksa (salmışsa) ve rol varsa: ROLÜ GERİ ALIR.
   */
  async checkAndSyncMember(member: GuildMember): Promise<'ADDED' | 'REMOVED' | 'NONE'> {
    if (member.user.bot) return 'NONE';

    const guild = member.guild;
    let role = guild.roles.cache.get(CLAN_ROLE_ID);
    if (!role) {
      role = (await guild.roles.fetch(CLAN_ROLE_ID).catch(() => null)) || undefined;
    }

    if (!role) {
      logger.warn(`⚠️ [CLAN_ROLE] Hedef rol bulunamadı: ${CLAN_ROLE_ID}`);
      return 'NONE';
    }

    const botMember = guild.members.me;
    if (!botMember?.permissions.has('ManageRoles') || botMember.roles.highest.position <= role.position) {
      logger.warn(`⚠️ [CLAN_ROLE] Botun rol verme/alma yetkisi yetersiz! Bot rolü ${role.name} rolünün üstünde olmalıdır.`);
      return 'NONE';
    }

    const hasClan = await this.hasGuildOrClan(member);
    const hasRole = member.roles.cache.has(CLAN_ROLE_ID);

    if (hasClan && !hasRole) {
      // Klanı var ama rolü yok -> Rolü ver
      await member.roles.add(role).catch((err) => {
        logger.error(`[CLAN_ROLE] Rol eklenemedi (${member.user.tag}):`, err);
      });
      logger.info(`✅ [CLAN_ROLE] ${member.user.tag} klan rozetine sahip olduğu için rol verildi.`);
      return 'ADDED';
    } else if (!hasClan && hasRole) {
      // Klanı yok ama rolü var (önceden alıp salmış) -> Rolü geri al!
      await member.roles.remove(role).catch((err) => {
        logger.error(`[CLAN_ROLE] Rol kaldırılamadı (${member.user.tag}):`, err);
      });
      logger.warn(`❌ [CLAN_ROLE] ${member.user.tag} klan rozetini saldığı/bıraktığı için rolü kaldırıldı!`);
      return 'REMOVED';
    }

    return 'NONE';
  }

  /**
   * Sunucudaki TÜM üyeleri baştan sona tarar:
   * Klanı olmayan herkesten rolü geri alır, klanı olanlara rolü verir.
   */
  async syncAllMembers(guild: Guild): Promise<{ added: number; removed: number; total: number }> {
    logger.info(`🔍 [CLAN_ROLE] ${guild.name} sunucusu için tüm üyelerin klan/guild durumu taranıyor...`);

    let role = guild.roles.cache.get(CLAN_ROLE_ID);
    if (!role) {
      role = (await guild.roles.fetch(CLAN_ROLE_ID).catch(() => null)) || undefined;
    }

    if (!role) {
      logger.warn(`⚠️ [CLAN_ROLE] Hedef rol sunucuda bulunamadı: ${CLAN_ROLE_ID}`);
      return { added: 0, removed: 0, total: 0 };
    }

    const members = await guild.members.fetch().catch((err) => {
      logger.error('[CLAN_ROLE] Üyeler fetch edilirken hata:', err);
      return null;
    });

    if (!members) return { added: 0, removed: 0, total: 0 };

    let added = 0;
    let removed = 0;

    for (const [, member] of members) {
      if (member.user.bot) continue;

      const result = await this.checkAndSyncMember(member);
      if (result === 'ADDED') added++;
      if (result === 'REMOVED') removed++;
    }

    logger.info(`🏁 [CLAN_ROLE] ${guild.name} taraması tamamlandı: ${removed} üyeden rol geri alındı, ${added} üyeye rol verildi.`);
    return { added, removed, total: members.size };
  }

  /**
   * Botun bağlı olduğu tüm sunucularda tarama başlatır.
   */
  async syncAllGuilds(client: Client) {
    for (const [, guild] of client.guilds.cache) {
      await this.syncAllMembers(guild).catch(() => {});
    }
  }
}

export const clanRoleService = new ClanRoleService();
