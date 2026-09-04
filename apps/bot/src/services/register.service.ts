import fs from 'fs';
import path from 'path';
import {
  Guild,
  GuildMember,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  Client,
  PermissionFlagsBits,
} from 'discord.js';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';
import { logger } from '../utils/logger';
import { logService } from './log.service';

export interface RegisterSettings {
  enabled: boolean;
  registerChannelId: string | null;
  chatChannelId: string | null;
  unregisteredRoleId: string | null;
  maleRoleId: string | null;
  femaleRoleId: string | null;
  staffRoleId: string | null;
  tag: string | null;
  tagEnabled: boolean;
}

export interface RegisterRecord {
  id: string;
  guildId: string;
  userId: string;
  staffId: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
  registeredAt: string;
}

export interface StaffStat {
  staffId: string;
  total: number;
  male: number;
  female: number;
}

const DATA_FILE = path.join(process.cwd(), 'register_data.json');

class RegisterService {
  private settings: Map<string, RegisterSettings> = new Map();
  private records: RegisterRecord[] = [];

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.settings) {
          for (const [guildId, val] of Object.entries(parsed.settings)) {
            this.settings.set(guildId, val as RegisterSettings);
          }
        }
        if (Array.isArray(parsed.records)) {
          this.records = parsed.records;
        }
      }
    } catch (e) {
      logger.error('[REGISTER] Veriler yüklenirken hata:', e);
    }
  }

  private saveData() {
    try {
      const obj = {
        settings: Object.fromEntries(this.settings.entries()),
        records: this.records,
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      logger.error('[REGISTER] Veriler kaydedilirken hata:', e);
    }
  }

  public getSettings(guildId: string): RegisterSettings {
    const existing = this.settings.get(guildId);
    if (existing) {
      // Eğer daha önce kaydedilmişse ama enabled tanımsızsa true yap
      if (existing.enabled === undefined) existing.enabled = true;
      return existing;
    }

    const def: RegisterSettings = {
      enabled: true, // Varsayılan olarak aktif!
      registerChannelId: null,
      chatChannelId: '1542620110882349162', // Sunucunun ana sohbeti varsayılan
      unregisteredRoleId: null,
      maleRoleId: null,
      femaleRoleId: null,
      staffRoleId: null,
      tag: null,
      tagEnabled: false,
    };
    this.settings.set(guildId, def);
    this.saveData();
    return def;
  }

  public updateSettings(guildId: string, updates: Partial<RegisterSettings>): RegisterSettings {
    const curr = this.getSettings(guildId);
    const updated = { ...curr, ...updates };
    this.settings.set(guildId, updated);
    this.saveData();
    return updated;
  }

  /**
   * Sunucudaki kayıt kanalını ve rollerini otomatik keşfeder (eğer henüz ayarlanmadıysa)
   */
  public autoConfigure(guild: Guild): RegisterSettings {
    const settings = this.getSettings(guild.id);
    let changed = false;

    // 1. Kayıt kanalı keşfi
    if (!settings.registerChannelId) {
      const foundChannel = guild.channels.cache.find(
        (ch) =>
          ch.isTextBased() &&
          ['kayıt', 'kayit', 'register', 'hoş-geldin', 'hosgeldin', 'giris-cikis', 'giriş-çıkış'].some((k) =>
            ch.name.toLowerCase().includes(k)
          )
      ) as TextChannel | null;
      if (foundChannel) {
        settings.registerChannelId = foundChannel.id;
        changed = true;
        logger.info(`[REGISTER] Kayıt kanalı otomatik eşleştirildi: #${foundChannel.name} (${foundChannel.id})`);
      }
    }

    // 2. Rollerin otomatik keşfi
    if (!settings.unregisteredRoleId) {
      const r = guild.roles.cache.find((role) =>
        ['kayıtsız', 'kayitsiz', 'unregistered', 'üye olmayan'].some((k) => role.name.toLowerCase().includes(k))
      );
      if (r) {
        settings.unregisteredRoleId = r.id;
        changed = true;
        logger.info(`[REGISTER] Kayıtsız rolü otomatik eşleştirildi: @${r.name} (${r.id})`);
      }
    }

    if (!settings.maleRoleId) {
      const r = guild.roles.cache.find((role) =>
        ['erkek', 'boy', 'man'].some((k) => role.name.toLowerCase().includes(k))
      );
      if (r) {
        settings.maleRoleId = r.id;
        changed = true;
        logger.info(`[REGISTER] Erkek rolü otomatik eşleştirildi: @${r.name} (${r.id})`);
      }
    }

    if (!settings.femaleRoleId) {
      const r = guild.roles.cache.find((role) =>
        ['kadın', 'kadin', 'kız', 'kiz', 'girl', 'woman'].some((k) => role.name.toLowerCase().includes(k))
      );
      if (r) {
        settings.femaleRoleId = r.id;
        changed = true;
        logger.info(`[REGISTER] Kadın/Kız rolü otomatik eşleştirildi: @${r.name} (${r.id})`);
      }
    }

    if (!settings.staffRoleId) {
      const r = guild.roles.cache.find((role) =>
        ['kayıt yetkilisi', 'kayit yetkilisi', 'register', 'staff', 'yetkili', 'bot com'].some((k) =>
          role.name.toLowerCase().includes(k)
        )
      );
      if (r) {
        settings.staffRoleId = r.id;
        changed = true;
        logger.info(`[REGISTER] Kayıt yetkili rolü otomatik eşleştirildi: @${r.name} (${r.id})`);
      }
    }

    if (changed) {
      this.updateSettings(guild.id, settings);
    }
    return settings;
  }

  public isStaff(member: GuildMember): boolean {
    if (!member) return false;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageNicknames)) return true;

    const settings = this.getSettings(member.guild.id);
    if (settings.staffRoleId && member.roles.cache.has(settings.staffRoleId)) {
      return true;
    }
    return false;
  }

  /**
   * Karşılama ve kayıt mesajı payload'unu oluşturur
   * isRegistered = false -> 2 buton (Erkek Kayıt, Kız Kayıt)
   * isRegistered = true  -> 4 buton (Erkek Kayıt, Kız Kayıt, Kayıt Bilgisi, Yeniden Kaydet)
   */
  public buildWelcomeCardPayload(params: {
    guild: Guild;
    member: GuildMember;
    isRegistered?: boolean;
  }) {
    const { guild, member, isRegistered } = params;
    const settings = this.getSettings(guild.id);
    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    const isSuspicious = accountAgeDays < 7;
    const trustStatus = isSuspicious ? 'Şüpheli (Hesap Yeni)' : 'Güvenilir';

    const staffMention = settings.staffRoleId ? `<@&${settings.staffRoleId}>` : 'Yetkili';

    const embed = createEmbed({
      title: `👋 Yeni Bir Kullanıcı Katıldı, @${member.user.username}!`,
      description:
        `**${guild.name}** sunucumuza hoş geldin <@${member.id}>!\n` +
        `Seninle birlikte **${guild.memberCount}** kişiyiz. Kayıt olmak için ${staffMention} rolündeki yetkililerimizi beklemen yeterlidir.\n\n` +
        `• **Kullanıcı ID:** \`${member.id}\`\n` +
        `• **Hesap Oluşturulma Tarihi:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:f>\n` +
        `• **Güvenilirlik Durumu:** \`${trustStatus}\``,
      color: isSuspicious ? DEFAULT_COLORS.WARNING : DEFAULT_COLORS.PRIMARY,
      thumbnail: member.displayAvatarURL({ extension: 'png', size: 256 }),
      timestamp: false,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`reg_male_${member.id}`)
        .setLabel('♂ Erkek Kayıt')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`reg_female_${member.id}`)
        .setLabel('♀ Kız Kayıt')
        .setStyle(ButtonStyle.Danger)
    );

    // Kayıt olmuş birinin mesajına ek 2 buton eklenir (Kayıt Bilgisi & Yeniden Kaydet)
    if (isRegistered) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`reg_info_${member.id}`)
          .setLabel('📋 Kayıt Bilgisi')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`reg_redo_${member.id}`)
          .setLabel('🔄 Yeniden Kaydet')
          .setStyle(ButtonStyle.Success)
      );
    }

    return {
      content: `<@${member.id}> ${settings.staffRoleId ? `<@&${settings.staffRoleId}>` : ''}`,
      embeds: [embed],
      components: [row],
    };
  }

  /**
   * Yeni üye katıldığında kayıt kanalına Nors tarzı karşılama kartını gönderir
   */
  public async sendWelcomeCard(member: GuildMember): Promise<boolean> {
    const guild = member.guild;
    const settings = this.getSettings(guild.id);

    if (!settings.enabled || !settings.registerChannelId) {
      return false;
    }

    const channel = (await guild.channels.fetch(settings.registerChannelId).catch(() => null)) as TextChannel | null;
    if (!channel || !channel.isTextBased()) {
      return false;
    }

    // Kayıtsız rolünü otomatik ver (ayarlıysa)
    if (settings.unregisteredRoleId) {
      try {
        await member.roles.add(settings.unregisteredRoleId).catch(() => {});
      } catch {
        /* sessiz devam */
      }
    }

    const payload = this.buildWelcomeCardPayload({
      guild,
      member,
      isRegistered: false,
    });

    try {
      await channel.send(payload);
      return true;
    } catch (err) {
      logger.error('[REGISTER] Karşılama mesajı gönderilemedi:', err);
      return false;
    }
  }

  /**
   * Üyeyi kaydeder (Erkek veya Kız)
   * KESİNLİKLE YAŞ YOK, SADECE İSİM!
   */
  public async registerMember(params: {
    guild: Guild;
    targetMember: GuildMember;
    staffMember: GuildMember;
    name: string;
    gender: 'MALE' | 'FEMALE';
    originalMessage?: Message | null;
  }): Promise<{ success: boolean; message: string }> {
    const { guild, targetMember, staffMember, name, gender, originalMessage } = params;
    const settings = this.getSettings(guild.id);

    // İsim formatı: Tag açıksa "Tag İsim", değilse "İsim"
    const cleanName = name.trim();
    let finalNick = cleanName;
    if (settings.tagEnabled && settings.tag) {
      finalNick = `${settings.tag} ${cleanName}`;
    }

    if (finalNick.length > 32) {
      finalNick = finalNick.substring(0, 32);
    }

    // 1. Nickname güncelle
    try {
      await targetMember.setNickname(finalNick).catch((err) => {
        logger.error(`[REGISTER] Nickname güncellenemedi (${targetMember.id}):`, err);
      });
    } catch {
      /* devam */
    }

    // 2. Rolleri düzenle
    const rolesToAdd: string[] = [];
    const rolesToRemove: string[] = [];

    if (gender === 'MALE' && settings.maleRoleId) {
      rolesToAdd.push(settings.maleRoleId);
    } else if (gender === 'FEMALE' && settings.femaleRoleId) {
      rolesToAdd.push(settings.femaleRoleId);
    }

    if (settings.unregisteredRoleId && targetMember.roles.cache.has(settings.unregisteredRoleId)) {
      rolesToRemove.push(settings.unregisteredRoleId);
    }

    try {
      if (rolesToRemove.length > 0) {
        await targetMember.roles.remove(rolesToRemove).catch(() => {});
      }
      if (rolesToAdd.length > 0) {
        await targetMember.roles.add(rolesToAdd).catch(() => {});
      }
    } catch (roleErr) {
      logger.error('[REGISTER] Rol işlemleri sırasında hata:', roleErr);
    }

    // 3. Kayıt geçmişi & İstatistik ekle
    const record: RegisterRecord = {
      id: `${Date.now()}_${targetMember.id}`,
      guildId: guild.id,
      userId: targetMember.id,
      staffId: staffMember.id,
      name: cleanName,
      gender,
      registeredAt: new Date().toISOString(),
    };
    this.records.push(record);
    this.saveData();

    // 4. Orijinal karşılama mesajı varsa 4 butonlu yapıya dönüştür (Erkek, Kız, Kayıt Bilgisi, Yeniden Kaydet)
    if (originalMessage && originalMessage.editable) {
      try {
        const payload = this.buildWelcomeCardPayload({
          guild,
          member: targetMember,
          isRegistered: true,
        });

        await originalMessage.edit(payload);
      } catch (editErr) {
        logger.error('[REGISTER] Karşılama mesajı düzenlenemedi:', editErr);
      }
    }

    // 4.1. "Kayıt Yapıldı!" Embed'i ve Butonları (İsim Değiştir, Kayıtsız Ver)
    try {
      let targetChannel: TextChannel | null = null;
      if (originalMessage && originalMessage.channel && originalMessage.channel.isTextBased()) {
        targetChannel = originalMessage.channel as TextChannel;
      } else if (settings.registerChannelId) {
        targetChannel = (await guild.channels.fetch(settings.registerChannelId).catch(() => null)) as TextChannel | null;
      }

      if (targetChannel && targetChannel.isTextBased()) {
        const staffStats = this.getStaffStats(guild.id, staffMember.id);
        const staffGenderCount = gender === 'MALE' ? staffStats.male : staffStats.female;
        const genderTitle = gender === 'MALE' ? 'Erkek' : 'Kız';
        const roleMention =
          gender === 'MALE'
            ? (settings.maleRoleId ? `<@&${settings.maleRoleId}>` : 'Erkek')
            : (settings.femaleRoleId ? `<@&${settings.femaleRoleId}>` : 'Kadın');

        const successEmbed = createEmbed({
          title: 'Kayıt Yapıldı!',
          description:
            `**Kayıt Edilen:** <@${targetMember.id}>\n` +
            `**Kayıt Eden:** <@${staffMember.id}>\n` +
            `**Verilen Roller:** ${roleMention}\n` +
            `**Yeni İsim:** \`${finalNick}\`\n` +
            `**Kayıt Türü:** \`${genderTitle}\``,
          color: DEFAULT_COLORS.SUCCESS,
          thumbnail: targetMember.displayAvatarURL({ extension: 'png', size: 256 }),
          footer: {
            text: `${staffMember.user.username} • ${genderTitle} kayıt sayın: ${staffGenderCount}`,
          },
          timestamp: false,
        });

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`reg_change_name_${targetMember.id}`)
            .setLabel('İsim Değiştir')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`reg_to_unreg_${targetMember.id}`)
            .setLabel('Kayıtsız Ver')
            .setStyle(ButtonStyle.Danger)
        );

        await targetChannel.send({ embeds: [successEmbed], components: [actionRow] }).catch(() => {});
      }
    } catch (sendErr) {
      logger.error('[REGISTER] Kayıt yapıldı onay mesajı gönderilemedi:', sendErr);
    }

    // 5. Sohbet kanalına hoş geldin tebrik mesajı
    if (settings.chatChannelId) {
      try {
        const chatChannel = (await guild.channels.fetch(settings.chatChannelId).catch(() => null)) as TextChannel | null;
        if (chatChannel && chatChannel.isTextBased()) {
          const chatEmbed = createEmbed({
            title: `🎉 Aramıza Yeni Bir Üye Katıldı!`,
            description: `Hoş geldin <@${targetMember.id}>! Kaydın tamamlandı, sunucuda keyifli sohbetler dileriz! ✨`,
            color: DEFAULT_COLORS.PRIMARY,
            thumbnail: targetMember.displayAvatarURL({ extension: 'png', size: 128 }),
            timestamp: false,
          });
          await chatChannel.send({ content: `<@${targetMember.id}>`, embeds: [chatEmbed] }).catch(() => {});
        }
      } catch {
        /* devam */
      }
    }

    // 6. Denetim logu
    try {
      await logService.logEvent(
        guild.id,
        'MODERATION',
        'Kayıt Yapıldı',
        `**Üye:** <@${targetMember.id}> (\`${finalNick}\`)\n**Yetkili:** <@${staffMember.id}>\n**Cinsiyet:** ${gender === 'MALE' ? 'Erkek' : 'Kız'}`,
        guild.client
      );
    } catch {
      /* sessiz */
    }

    return {
      success: true,
      message: `<@${targetMember.id}> kullanıcısı **${gender === 'MALE' ? 'Erkek' : 'Kız'}** olarak başarıyla kaydedildi! (Yeni İsim: \`${finalNick}\`)`,
    };
  }

  /**
   * Üyeyi kayıtsıza atar
   */
  public async unregisterMember(params: {
    guild: Guild;
    targetMember: GuildMember;
    staffMember: GuildMember;
  }): Promise<{ success: boolean; message: string }> {
    const { guild, targetMember, staffMember } = params;
    const settings = this.getSettings(guild.id);

    const rolesToRemove: string[] = [];
    if (settings.maleRoleId && targetMember.roles.cache.has(settings.maleRoleId)) {
      rolesToRemove.push(settings.maleRoleId);
    }
    if (settings.femaleRoleId && targetMember.roles.cache.has(settings.femaleRoleId)) {
      rolesToRemove.push(settings.femaleRoleId);
    }

    try {
      if (rolesToRemove.length > 0) {
        await targetMember.roles.remove(rolesToRemove).catch(() => {});
      }
      if (settings.unregisteredRoleId) {
        await targetMember.roles.add(settings.unregisteredRoleId).catch(() => {});
      }
      // İsmini Kayıtsız yap
      await targetMember.setNickname('Kayıtsız').catch(() => {});
    } catch (e) {
      logger.error('[REGISTER] Kayıtsıza alma hatası:', e);
    }

    // Log
    try {
      await logService.logEvent(
        guild.id,
        'MODERATION',
        'Kayıtsıza Atıldı',
        `**Üye:** <@${targetMember.id}>\n**Yetkili:** <@${staffMember.id}>`,
        guild.client
      );
    } catch {
      /* sessiz */
    }

    return {
      success: true,
      message: `<@${targetMember.id}> kullanıcısı başarıyla kayıtsıza atıldı. Kayıtlı rolleri alındı ve ismi \`Kayıtsız\` olarak güncellendi.`,
    };
  }

  /**
   * Üyenin sunucudaki kayıt geçmişini döner
   */
  public getHistory(guildId: string, userId: string): RegisterRecord[] {
    return this.records
      .filter((r) => r.guildId === guildId && r.userId === userId)
      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
  }

  /**
   * Yetkilinin kayıt istatistiklerini döner
   */
  public getStaffStats(guildId: string, staffId: string): StaffStat {
    const staffRecords = this.records.filter((r) => r.guildId === guildId && r.staffId === staffId);
    let male = 0;
    let female = 0;
    for (const r of staffRecords) {
      if (r.gender === 'MALE') male++;
      else if (r.gender === 'FEMALE') female++;
    }
    return {
      staffId,
      total: staffRecords.length,
      male,
      female,
    };
  }

  /**
   * Sunucunun en çok kayıt yapan yetkililerini sıralar (Top 10)
   */
  public getTopStaff(guildId: string, limit: number = 10): StaffStat[] {
    const map = new Map<string, { total: number; male: number; female: number }>();
    const guildRecords = this.records.filter((r) => r.guildId === guildId);

    for (const r of guildRecords) {
      const existing = map.get(r.staffId) || { total: 0, male: 0, female: 0 };
      existing.total++;
      if (r.gender === 'MALE') existing.male++;
      else if (r.gender === 'FEMALE') existing.female++;
      map.set(r.staffId, existing);
    }

    const list: StaffStat[] = [];
    for (const [staffId, stat] of map.entries()) {
      list.push({ staffId, ...stat });
    }

    return list.sort((a, b) => b.total - a.total).slice(0, limit);
  }
}

export const registerService = new RegisterService();
