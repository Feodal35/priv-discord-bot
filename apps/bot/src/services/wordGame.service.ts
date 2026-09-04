import fs from 'fs';
import path from 'path';
import { Message, TextChannel } from 'discord.js';
import { economyService } from './economy.service';
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

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'wordgame.json');

export class WordGameService {
  private games = new Map<string, WordGameState>(); // guildId -> state

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const list: WordGameState[] = JSON.parse(raw);
        for (const g of list) {
          this.games.set(g.guildId, g);
        }
      }
    } catch (e) {
      logger.error('[WORD_GAME] Yükleme hatası:', e);
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const list = Array.from(this.games.values());
      fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      logger.error('[WORD_GAME] Kaydetme hatası:', e);
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
    this.save();
    return state;
  }

  public getState(guildId: string): WordGameState | undefined {
    return this.games.get(guildId);
  }

  public getChannelId(guildId: string): string | undefined {
    return this.games.get(guildId)?.channelId;
  }

  public async handleMessage(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false;
    const state = this.games.get(message.guild.id);
    if (!state || message.channelId !== state.channelId) return false;

    const rawContent = message.content.trim();
    // Tek bir kelime olmalı (boşluk içermemeli)
    if (rawContent.includes(' ')) {
      return false; // Sohbet mesajı olabilir
    }

    const word = rawContent.toLocaleLowerCase('tr-TR');

    // Sadece Türkçe harfler ve en az 2 harfli olmalı
    if (!/^[a-zçğıöşü]+$/i.test(word) || word.length < 2) {
      return false;
    }

    // Kural 1: Üst üste aynı kullanıcı yazamaz
    if (state.lastUserId === message.author.id) {
      await message.react('⏳').catch(() => {});
      const reply = await message.reply({
        content: '⚠️ **Sıranı bekle!** Başka bir üye kelime yazana kadar tekrar yazamazsın.',
      }).catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), 4000);
      return true;
    }

    // Kural 2: İlk harf son harfle eşleşmeli
    const firstLetter = word.charAt(0);
    if (state.lastLetter && firstLetter !== state.lastLetter) {
      await message.react('❌').catch(() => {});
      const reply = await message.reply({
        content: `❌ Hatalı Harf! Yazacağın kelime **"${state.lastLetter.toLocaleUpperCase('tr-TR')}"** harfiyle başlamalıdır. (Son kelime: \`${state.lastWord}\`)`,
      }).catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
      return true;
    }

    // Kural 3: Daha önce kullanılmamış olmalı
    if (state.usedWords.includes(word)) {
      await message.react('🔁').catch(() => {});
      const reply = await message.reply({
        content: `❌ **"${word}"** kelimesi bu turda zaten daha önce kullanıldı! Başka bir kelime türet.`,
      }).catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
      return true;
    }

    // Doğru kelime!
    state.usedWords.push(word);
    state.lastWord = word;
    state.lastUserId = message.author.id;
    state.streak++;

    // Son harf kuralı (Türkçe'de ğ ile kelime başlamadığı için önceki harfi al)
    let nextLetter = word.charAt(word.length - 1);
    if (nextLetter === 'ğ' && word.length > 2) {
      nextLetter = word.charAt(word.length - 2);
    }
    state.lastLetter = nextLetter;
    this.save();

    // Ödül: +5 Coin
    await economyService.modifyBalance(message.guild.id, message.author.id, 5, 'ADD', 'Kelime Oyunu').catch(() => {});

    await message.react('✅').catch(() => {});

    // Kilometre taşı serilerinde tebrik mesajı
    if (state.streak % 25 === 0) {
      const textChannel = message.channel as TextChannel;
      await textChannel.send({
        content: `🔥 **Harika Gidiyorsunuz!** Kelime türetme serisi **${state.streak}** kelimeye ulaştı! 🎉`,
      }).catch(() => {});
    }

    return true;
  }
}

export const wordGameService = new WordGameService();
