import fs from 'fs';
import path from 'path';
import {
  Client,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
} from 'discord.js';
import { createEmbed } from '../utils/embed';
import { userService } from './user.service';
import { logger } from '../utils/logger';

export interface Giveaway {
  id: string; // messageId
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  winnersCount: number;
  endsAt: number;
  hostedBy: string;
  requiredRoleId?: string | null;
  minLevel?: number | null;
  participants: string[];
  winners: string[];
  isEnded: boolean;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'giveaways.json');

export class GiveawayService {
  private giveaways: Map<string, Giveaway> = new Map();
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const list: Giveaway[] = JSON.parse(raw);
        for (const g of list) {
          this.giveaways.set(g.id, g);
        }
      }
    } catch (e) {
      logger.error('[GIVEAWAY] Yükleme hatası:', e);
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const list = Array.from(this.giveaways.values());
      fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      logger.error('[GIVEAWAY] Kaydetme hatası:', e);
    }
  }

  public startWorker(client: Client) {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.checkEndedGiveaways(client);
    }, 5000);
  }

  private async checkEndedGiveaways(client: Client) {
    const now = Date.now();
    for (const [, g] of this.giveaways) {
      if (!g.isEnded && g.endsAt <= now) {
        await this.endGiveaway(g.id, client).catch((err) => {
          logger.error(`[GIVEAWAY] Çekiliş sonlandırma hatası (${g.id}):`, err);
        });
      }
    }
  }

  public getGiveaway(id: string): Giveaway | undefined {
    return this.giveaways.get(id);
  }

  public getActiveGiveaways(guildId: string): Giveaway[] {
    return Array.from(this.giveaways.values()).filter(
      (g) => g.guildId === guildId && !g.isEnded
    );
  }

  public async createGiveaway(opts: {
    guildId: string;
    channel: TextChannel;
    prize: string;
    winnersCount: number;
    durationMs: number;
    hostedBy: string;
    requiredRoleId?: string | null;
    minLevel?: number | null;
  }): Promise<Giveaway> {
    const endsAt = Date.now() + opts.durationMs;
    const endsUnix = Math.floor(endsAt / 1000);

    let reqs = '';
    if (opts.requiredRoleId) {
      reqs += `\n• **Rol Şartı:** <@&${opts.requiredRoleId}>`;
    }
    if (opts.minLevel) {
      reqs += `\n• **Seviye Şartı:** En az \`Seviye ${opts.minLevel}\``;
    }

    const embed = createEmbed({
      title: `🎉 ÇEKİLİŞ: ${opts.prize}`,
      description:
        `Aşağıdaki butona tıklayarak çekilişe katılabilirsiniz!\n\n` +
        `• **Ödül:** 🎁 **${opts.prize}**\n` +
        `• **Kazanan Sayısı:** \`${opts.winnersCount}\` Kişi\n` +
        `• **Düzenleyen:** <@${opts.hostedBy}>\n` +
        `• **Kalan Süre:** <t:${endsUnix}:R> (<t:${endsUnix}:f>)` +
        reqs,
      color: 0x9b59b6,
    });
    embed.setFooter({ text: 'Vip Metro • Çekiliş Sistemi' });

    const btn = new ButtonBuilder()
      .setCustomId(`giveaway_join_temp`)
      .setLabel('🎉 Katıl (0)')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);

    const msg = await opts.channel.send({ embeds: [embed], components: [row] });

    // ID'yi message ID ile güncelle
    const realBtn = new ButtonBuilder()
      .setCustomId(`giveaway_join_${msg.id}`)
      .setLabel('🎉 Katıl (0)')
      .setStyle(ButtonStyle.Primary);
    const realRow = new ActionRowBuilder<ButtonBuilder>().addComponents(realBtn);
    await msg.edit({ components: [realRow] });

    const giveaway: Giveaway = {
      id: msg.id,
      guildId: opts.guildId,
      channelId: opts.channel.id,
      messageId: msg.id,
      prize: opts.prize,
      winnersCount: opts.winnersCount,
      endsAt,
      hostedBy: opts.hostedBy,
      requiredRoleId: opts.requiredRoleId,
      minLevel: opts.minLevel,
      participants: [],
      winners: [],
      isEnded: false,
    };

    this.giveaways.set(giveaway.id, giveaway);
    this.save();
    return giveaway;
  }

  public async toggleJoin(
    giveawayId: string,
    member: GuildMember,
    client: Client
  ): Promise<{ success: boolean; message: string; joined: boolean }> {
    const g = this.giveaways.get(giveawayId);
    if (!g) {
      return { success: false, message: 'Çekiliş bulunamadı.', joined: false };
    }
    if (g.isEnded) {
      return { success: false, message: 'Bu çekiliş zaten sona erdi!', joined: false };
    }

    // Rol şartı kontrolü
    if (g.requiredRoleId && !member.roles.cache.has(g.requiredRoleId)) {
      return {
        success: false,
        message: `❌ Bu çekilişe katılabilmek için <@&${g.requiredRoleId}> rolüne sahip olmalısınız!`,
        joined: false,
      };
    }

    // Seviye şartı kontrolü
    if (g.minLevel) {
      const profile = await userService.getUserProfile(member.id, member.guild.id, client);
      if (profile.level < g.minLevel) {
        return {
          success: false,
          message: `❌ Bu çekilişe katılabilmek için en az **Seviye ${g.minLevel}** olmalısınız! (Mevcut Seviyeniz: \`${profile.level}\`)`,
          joined: false,
        };
      }
    }

    const index = g.participants.indexOf(member.id);
    let joined = false;

    if (index >= 0) {
      g.participants.splice(index, 1);
      joined = false;
    } else {
      g.participants.push(member.id);
      joined = true;
    }

    this.save();

    // Butondaki katılımcı sayısını güncelle
    const channel = (await client.channels.fetch(g.channelId).catch(() => null)) as TextChannel | null;
    if (channel) {
      const msg = await channel.messages.fetch(g.messageId).catch(() => null);
      if (msg) {
        const btn = new ButtonBuilder()
          .setCustomId(`giveaway_join_${g.id}`)
          .setLabel(`🎉 Katıl (${g.participants.length})`)
          .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);
        await msg.edit({ components: [row] }).catch(() => {});
      }
    }

    return {
      success: true,
      joined,
      message: joined
        ? `✅ **${g.prize}** çekilişine başarıyla katıldınız! (Toplam: \`${g.participants.length}\` katılımcı)`
        : `🗑️ **${g.prize}** çekilişinden katılımınızı çektiniz.`,
    };
  }

  public async endGiveaway(
    giveawayId: string,
    client: Client
  ): Promise<{ success: boolean; winners: string[]; message: string }> {
    const g = this.giveaways.get(giveawayId);
    if (!g) return { success: false, winners: [], message: 'Çekiliş bulunamadı.' };
    if (g.isEnded) return { success: false, winners: g.winners, message: 'Çekiliş zaten sonlanmış.' };

    g.isEnded = true;

    // Kazananları seç
    const winners: string[] = [];
    const pool = [...g.participants];

    const toPick = Math.min(g.winnersCount, pool.length);
    for (let i = 0; i < toPick; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      winners.push(pool[randomIndex]);
      pool.splice(randomIndex, 1);
    }

    g.winners = winners;
    this.save();

    const channel = (await client.channels.fetch(g.channelId).catch(() => null)) as TextChannel | null;
    if (channel) {
      const msg = await channel.messages.fetch(g.messageId).catch(() => null);

      const winnersText =
        winners.length > 0
          ? winners.map((w) => `<@${w}>`).join(', ')
          : '*Yeterli katılımcı olmadığı için kazanan belirlenemedi.*';

      if (msg) {
        const embed = createEmbed({
          title: `🎉 ÇEKİLİŞ SONA ERDİ: ${g.prize}`,
          description:
            `• **Ödül:** 🎁 **${g.prize}**\n` +
            `• **Düzenleyen:** <@${g.hostedBy}>\n` +
            `• **Kazanan(lar):** ${winnersText}\n` +
            `• **Toplam Katılımcı:** \`${g.participants.length}\``,
          color: 0x2ecc71,
        });
        embed.setFooter({ text: 'Vip Metro • Çekiliş Sona Erdi' });

        const btn = new ButtonBuilder()
          .setCustomId(`giveaway_ended_${g.id}`)
          .setLabel(`🎉 Katılım Kapandı (${g.participants.length})`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);
        await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
      }

      if (winners.length > 0) {
        await channel.send({
          content: `🎉 Tebrikler ${winnersText}! **${g.prize}** çekilişini kazandınız! 🎁`,
        }).catch(() => {});
      }
    }

    return { success: true, winners, message: 'Çekiliş başarıyla sonlandırıldı.' };
  }

  public async reroll(
    giveawayId: string,
    client: Client
  ): Promise<{ success: boolean; newWinners: string[]; message: string }> {
    const g = this.giveaways.get(giveawayId);
    if (!g) return { success: false, newWinners: [], message: 'Çekiliş bulunamadı.' };
    if (!g.isEnded) return { success: false, newWinners: [], message: 'Çekiliş henüz sonlanmamış!' };

    if (g.participants.length === 0) {
      return { success: false, newWinners: [], message: 'Katılımcı olmadığı için yeniden çekilemez.' };
    }

    const newWinners: string[] = [];
    const pool = [...g.participants];

    const toPick = Math.min(g.winnersCount, pool.length);
    for (let i = 0; i < toPick; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      newWinners.push(pool[randomIndex]);
      pool.splice(randomIndex, 1);
    }

    g.winners = newWinners;
    this.save();

    const channel = (await client.channels.fetch(g.channelId).catch(() => null)) as TextChannel | null;
    if (channel) {
      const winnersText = newWinners.map((w) => `<@${w}>`).join(', ');
      await channel.send({
        content: `🔄 **Yeniden Çekiliş Sonucu:** Tebrikler ${winnersText}! **${g.prize}** ödülünün yeni kazananı oldunuz! 🎉`,
      }).catch(() => {});
    }

    return { success: true, newWinners, message: 'Çekiliş yeniden çekildi!' };
  }
}

export const giveawayService = new GiveawayService();
