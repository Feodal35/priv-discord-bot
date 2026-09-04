import fs from 'fs';
import path from 'path';
import { Message, TextChannel } from 'discord.js';
import { prisma } from '@priv/database';
import { economyService } from './economy.service';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';
import { logger } from '../utils/logger';

export interface WordGameState {
  guildId: string;
  channelId: string;
  lastWord: string;
  lastLetter: string;
  lastUserId: string;
  usedWords: string[];
  streak: number;
}

export class WordGameService {
  private games = new Map<string, WordGameState>(); // guildId -> state
  private dictionaryBuffer: Buffer | null = null;
  private wordOffsets: Uint32Array = new Uint32Array(0);
  private wordLengths: Uint8Array = new Uint8Array(0);
  private wordCount = 0;
  private fallbackDictionary = new Set<string>();
  private userCooldowns = new Map<string, number>();

  constructor() {
    this.loadDictionary();
    this.loadFromDatabase().catch(() => {});
  }

  private loadDictionary() {
    const candidatePaths = [
      path.join(process.cwd(), 'data', 'turkish_words.txt'),
      path.join(process.cwd(), 'apps', 'bot', 'src', 'assets', 'turkish_words.txt'),
      path.join(process.cwd(), 'apps', 'bot', 'dist', 'assets', 'turkish_words.txt'),
      path.join(__dirname, '..', 'assets', 'turkish_words.txt'),
      path.join(__dirname, '..', '..', 'src', 'assets', 'turkish_words.txt'),
      path.join(__dirname, '..', '..', '..', 'data', 'turkish_words.txt'),
    ];

    let loaded = false;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const fileBuf = fs.readFileSync(p);
          let lines = 0;
          for (let i = 0; i < fileBuf.length; i++) {
            if (fileBuf[i] === 10) lines++;
          }
          if (fileBuf.length > 0 && fileBuf[fileBuf.length - 1] !== 10) lines++;

          const offsets = new Uint32Array(lines);
          const lengths = new Uint8Array(lines);
          let count = 0;
          let start = 0;

          for (let i = 0; i < fileBuf.length; i++) {
            if (fileBuf[i] === 10 || fileBuf[i] === 13) {
              if (i > start) {
                offsets[count] = start;
                lengths[count] = i - start;
                count++;
              }
              start = i + 1;
            }
          }
          if (start < fileBuf.length) {
            offsets[count] = start;
            lengths[count] = fileBuf.length - start;
            count++;
          }

          this.dictionaryBuffer = fileBuf;
          this.wordOffsets = offsets.subarray(0, count);
          this.wordLengths = lengths.subarray(0, count);
          this.wordCount = count;

          logger.info(`[WORD_GAME] Devasa Türkçe sözlük yüklendi: ${count.toLocaleString('tr-TR')} kelime (${p})`);
          loaded = true;
          break;
        } catch (e) {
          logger.error(`[WORD_GAME] Sözlük okuma hatası (${p}):`, e);
        }
      }
    }

    if (!loaded || this.wordCount === 0) {
      logger.warn('[WORD_GAME] Sözlük dosyası bulunamadı, temel kelime listesi yükleniyor.');
      const fallback = [
        'elma', 'armut', 'araba', 'masa', 'kalem', 'kitap', 'bilgisayar', 'telefon', 'defter',
        'kedi', 'köpek', 'aslan', 'kaplan', 'tavşan', 'kuş', 'kartal', 'deniz', 'nehir',
        'göl', 'orman', 'ağaç', 'yaprak', 'çiçek', 'güneş', 'dünya', 'ay', 'yıldız',
      ];
      for (const w of fallback) this.fallbackDictionary.add(w);
    }
  }

  /**
   * PostgreSQL veritabanından kelime oyunu kanallarını ve durumlarını yükler.
   * Bot yeniden başlasa bile asla silinmez!
   */
  public async loadFromDatabase() {
    try {
      const records = await prisma.wordGame.findMany();
      for (const rec of records) {
        let used: string[] = [];
        try {
          used = JSON.parse(rec.usedWords);
        } catch {
          used = [rec.lastWord];
        }
        this.games.set(rec.guildId, {
          guildId: rec.guildId,
          channelId: rec.channelId,
          lastWord: rec.lastWord,
          lastLetter: rec.lastLetter,
          lastUserId: rec.lastUserId,
          usedWords: used,
          streak: rec.streak,
        });
      }
      logger.info(`[WORD_GAME] PostgreSQL'den ${records.length} sunucu için kelime oyunu yüklendi.`);
    } catch (e) {
      logger.error('[WORD_GAME] PostgreSQL yükleme hatası:', e);
    }
  }

  /**
   * Durumu hem hafızaya hem kalıcı PostgreSQL veritabanına kaydeder
   */
  private async persistState(state: WordGameState) {
    try {
      await prisma.wordGame.upsert({
        where: { guildId: state.guildId },
        update: {
          channelId: state.channelId,
          lastWord: state.lastWord,
          lastLetter: state.lastLetter,
          lastUserId: state.lastUserId,
          usedWords: JSON.stringify(state.usedWords),
          streak: state.streak,
        },
        create: {
          guildId: state.guildId,
          channelId: state.channelId,
          lastWord: state.lastWord,
          lastLetter: state.lastLetter,
          lastUserId: state.lastUserId,
          usedWords: JSON.stringify(state.usedWords),
          streak: state.streak,
        },
      });

      await prisma.guildSettings.update({
        where: { guildId: state.guildId },
        data: { wordGameChannelId: state.channelId },
      }).catch(() => {});
    } catch (e) {
      logger.error('[WORD_GAME] PostgreSQL kaydetme hatası:', e);
    }
  }

  public setChannel(guildId: string, channelId: string): WordGameState {
    let state = this.games.get(guildId);
    if (!state) {
      state = {
        guildId,
        channelId,
        lastWord: 'elma',
        lastLetter: 'a',
        lastUserId: '',
        usedWords: ['elma'],
        streak: 0,
      };
    } else {
      state.channelId = channelId;
    }
    this.games.set(guildId, state);
    this.persistState(state);
    return state;
  }

  public resetGame(guildId: string, startWord: string = 'elma'): WordGameState | null {
    const state = this.games.get(guildId);
    if (!state) return null;

    const normalized = startWord.trim().toLocaleLowerCase('tr-TR');
    const nextLetter = this.calculateNextLetter(normalized);

    state.lastWord = normalized;
    state.lastLetter = nextLetter;
    state.lastUserId = '';
    state.usedWords = [normalized];
    state.streak = 0;

    this.games.set(guildId, state);
    this.persistState(state);
    return state;
  }

  public getState(guildId: string): WordGameState | undefined {
    return this.games.get(guildId);
  }

  public isGameChannel(guildId: string, channelId: string): boolean {
    const state = this.games.get(guildId);
    return Boolean(state && state.channelId === channelId);
  }

  /**
   * Türkçe son harf kuralı:
   * Türkçe'de ğ ile başlayan kelime olmadığı için, eğer kelime ğ ile bitiyorsa
   * bir önceki harfi bir sonraki kelimenin başlama harfi yapar.
   */
  private calculateNextLetter(word: string): string {
    let last = word.slice(-1);
    if (last === 'ğ') {
      let idx = word.length - 2;
      while (idx >= 0 && word[idx] === 'ğ') {
        idx--;
      }
      last = idx >= 0 ? word[idx] : 'g';
    }
    return last;
  }

  private hasWordInDictionary(word: string): boolean {
    if (!this.dictionaryBuffer || this.wordCount === 0) return false;
    const target = Buffer.from(word, 'utf-8');
    let l = 0;
    let r = this.wordCount - 1;

    while (l <= r) {
      const m = (l + r) >> 1;
      const off = this.wordOffsets[m];
      const len = this.wordLengths[m];
      const slice = this.dictionaryBuffer.subarray(off, off + len);
      const cmp = Buffer.compare(slice, target);
      if (cmp === 0) return true;
      if (cmp < 0) l = m + 1;
      else r = m - 1;
    }

    return false;
  }

  /**
   * Türkçe kelime doğrulama: 1.17 milyon kelimelik TDK + Zemberek sözlük kontrolü,
   * ünsüz yumuşaması (p->b, ç->c, t->d, k->ğ/g) ve Türkçe morfoloji çözümlemesi
   */
  private isValidWord(word: string): boolean {
    if (this.hasWordInDictionary(word) || this.fallbackDictionary.has(word)) return true;

    // Yaygın Türkçe ekler ve ünsüz yumuşaması için gövde kontrolü
    const suffixes = [
      'lar', 'ler',
      'dan', 'den', 'tan', 'ten',
      'da', 'de', 'ta', 'te',
      'ya', 'ye', 'na', 'ne', 'a', 'e',
      'ın', 'in', 'un', 'ün', 'nın', 'nin', 'nun', 'nün',
      'ım', 'im', 'um', 'üm', 'mız', 'miz', 'muz', 'müz',
      'lık', 'lik', 'luk', 'lük', 'lığ', 'liğ', 'luğ', 'lüğ',
      'cı', 'ci', 'cu', 'cü', 'çı', 'çi', 'çu', 'çü',
      'sız', 'siz', 'suz', 'süz',
      'mak', 'mek', 'ma', 'me',
      'mış', 'miş', 'muş', 'müş',
      'ıyor', 'iyor', 'uyor', 'üyor', 'yor',
      'acak', 'ecek', 'acağ', 'eceğ',
      'dı', 'di', 'du', 'dü', 'tı', 'ti', 'tu', 'tü',
      'sa', 'se',
      'ken', 'ınca', 'ince', 'unca', 'ünce',
      'ıp', 'ip', 'up', 'üp',
      'erek', 'arak',
    ];

    for (const suf of suffixes) {
      if (word.endsWith(suf) && word.length - suf.length >= 2) {
        const stem = word.slice(0, -suf.length);
        if (this.hasWordInDictionary(stem) || this.fallbackDictionary.has(stem)) return true;

        // Ünsüz yumuşaması geri dönüşümü: ağac-a -> ağaç, kitab-a -> kitap, yurd-u -> yurt, reng-i -> renk
        if (stem.endsWith('b')) {
          const root = stem.slice(0, -1) + 'p';
          if (this.hasWordInDictionary(root) || this.fallbackDictionary.has(root)) return true;
        } else if (stem.endsWith('c')) {
          const root = stem.slice(0, -1) + 'ç';
          if (this.hasWordInDictionary(root) || this.fallbackDictionary.has(root)) return true;
        } else if (stem.endsWith('d')) {
          const root = stem.slice(0, -1) + 't';
          if (this.hasWordInDictionary(root) || this.fallbackDictionary.has(root)) return true;
        } else if (stem.endsWith('ğ') || stem.endsWith('g')) {
          const root = stem.slice(0, -1) + 'k';
          if (this.hasWordInDictionary(root) || this.fallbackDictionary.has(root)) return true;
        }
      }
    }

    return false;
  }

  private async sendTempWarning(channel: TextChannel, content: string, delayMs = 3500) {
    try {
      const msg = await channel.send({ content });
      setTimeout(() => {
        msg.delete().catch(() => {});
      }, delayMs);
    } catch (err) {
      logger.error('[WORD_GAME] Uyarı mesajı gönderilemedi:', err);
    }
  }

  /**
   * Kanalda gelen mesajı işler.
   * Kelime oyunu kanalı ise daima true döner (başka mesaj işleyicilerine sızmaz).
   */
  public async handleMessage(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false;

    const state = this.games.get(message.guild.id);
    if (!state || message.channelId !== state.channelId) return false;

    const textChannel = message.channel as TextChannel;
    const rawContent = message.content.trim();

    // 1. Flood / Hızlı Spam Koruması (Kullanıcı başına 1.2 saniye cooldown)
    const now = Date.now();
    const lastUserTime = this.userCooldowns.get(message.author.id) || 0;
    if (now - lastUserTime < 1200) {
      await message.delete().catch(() => {});
      await this.sendTempWarning(
        textChannel,
        `⚠️ <@${message.author.id}>, lütfen çok hızlı mesaj göndermeyin! (Spam engeli)`,
        3000
      );
      return true;
    }
    this.userCooldowns.set(message.author.id, now);

    // 2. Sohbet Engelleme: Boşluk, satır sonu veya cümle içeriyorsa
    if (rawContent.includes(' ') || rawContent.includes('\n')) {
      await message.delete().catch(() => {});
      await this.sendTempWarning(
        textChannel,
        `💬 <@${message.author.id}>, bu kanal **Kelime Türetmece** kanalıdır! Sohbet etmek yasaktır, yalnızca sıradaki kelimeyi yazabilirsiniz.`,
        3500
      );
      return true;
    }

    const word = rawContent.toLocaleLowerCase('tr-TR');

    // 3. Karakter Kontrolü: Sadece Türkçe harfler kabul edilir
    if (!/^[abcçdefgğhıijklmnoöprsştuüvyz]+$/.test(word)) {
      await message.delete().catch(() => {});
      await this.sendTempWarning(
        textChannel,
        `⚠️ <@${message.author.id}>, yalnızca Türkçe harflerden oluşan tek bir kelime yazabilirsiniz.`,
        3500
      );
      return true;
    }

    // 4. Uzunluk Kontrolü: En az 2 harfli olmalı
    if (word.length < 2) {
      await message.delete().catch(() => {});
      await this.sendTempWarning(
        textChannel,
        `⚠️ <@${message.author.id}>, kelime en az 2 harfli olmalıdır.`,
        3000
      );
      return true;
    }

    // 5. Sıranı Bekle Kuralı: Üst üste aynı kullanıcı yazamaz
    if (state.lastUserId === message.author.id) {
      await message.delete().catch(() => {});
      await this.sendTempWarning(
        textChannel,
        `⏳ <@${message.author.id}>, **sıranı bekle!** Başka bir üye kelime yazana kadar tekrar yazamazsın. (Son kelime: \`${state.lastWord}\`)`,
        3500
      );
      return true;
    }

    // 6. İlk Harf Eşleşmesi Kuralı
    const firstLetter = word.charAt(0);
    if (state.lastLetter && firstLetter !== state.lastLetter) {
      await message.delete().catch(() => {});
      await this.sendTempWarning(
        textChannel,
        `❌ <@${message.author.id}>, yazdığın kelime **"${state.lastLetter.toLocaleUpperCase('tr-TR')}"** harfiyle başlamalıdır! (Son kelime: \`${state.lastWord}\`)`,
        4000
      );
      return true;
    }

    // 7. Daha Önce Kullanılmış Kelime Kuralı
    if (state.usedWords.includes(word)) {
      await message.delete().catch(() => {});
      await this.sendTempWarning(
        textChannel,
        `🔁 <@${message.author.id}>, **"${word}"** kelimesi bu turda zaten daha önce kullanıldı! Başka bir kelime türet.`,
        4000
      );
      return true;
    }

    // 8. TDK / Türkçe Sözlük Kontrolü (Rastgele harf dizilimlerini engelle)
    if (!this.isValidWord(word)) {
      await message.delete().catch(() => {});
      await this.sendTempWarning(
        textChannel,
        `📕 <@${message.author.id}>, **"${word}"** geçerli bir Türkçe kelime olarak bulunamadı! Lütfen anlamlı bir kelime yazın.`,
        4000
      );
      return true;
    }

    // --- BAŞARILI KELİME KABULÜ ---
    state.usedWords.push(word);
    state.lastWord = word;
    state.lastUserId = message.author.id;
    state.streak++;
    state.lastLetter = this.calculateNextLetter(word);
    this.persistState(state);

    // 1. Olan kelimelere tik koy (✅)
    await message.react('✅').catch((err) => {
      logger.error(`[WORD_GAME] ${message.id} mesajına ✅ tepkisi eklenemedi:`, err);
    });

    // 2. Ödül: +5 Coin ekle
    await economyService.modifyBalance(message.guild.id, message.author.id, 5, 'ADD', 'Kelime Oyunu').catch(() => {});

    // 3. Kilometre Taşı Kutlaması (Her 10 kelimede bir özel bildirim)
    if (state.streak % 10 === 0) {
      await message.react('🔥').catch(() => {});
      const milestoneEmbed = createEmbed({
        title: '🔥 Kelime Türetme Serisi Devam Ediyor!',
        description:
          `Harika! Zincirleme serimiz **${state.streak}** kelimeye ulaştı! 🎉\n\n` +
          `• **Son Kelime:** \`${state.lastWord}\`\n` +
          `• **Sıradaki Harf:** **"${state.lastLetter.toLocaleUpperCase('tr-TR')}"**\n` +
          `• **Son Katkı:** <@${message.author.id}> (+5 Coin)`,
        color: DEFAULT_COLORS.SUCCESS,
      });
      milestoneEmbed.setFooter({ text: 'Vip Metro • Kelime Oyunu' });

      await textChannel.send({ embeds: [milestoneEmbed] }).catch(() => {});
    }

    return true;
  }
}

export const wordGameService = new WordGameService();
