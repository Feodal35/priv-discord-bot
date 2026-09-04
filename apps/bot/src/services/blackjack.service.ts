export interface Card {
  suit: '♠️' | '♥️' | '♦️' | '♣️';
  value: string;
  num: number;
}

export interface BlackjackGame {
  id: string;
  userId: string;
  guildId: string;
  bet: number;
  playerCards: Card[];
  dealerCards: Card[];
  isFinished: boolean;
  statusText: string;
  createdAt: number;
}

const SUITS: ('♠️' | '♥️' | '♦️' | '♣️')[] = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = [
  { value: '2', num: 2 },
  { value: '3', num: 3 },
  { value: '4', num: 4 },
  { value: '5', num: 5 },
  { value: '6', num: 6 },
  { value: '7', num: 7 },
  { value: '8', num: 8 },
  { value: '9', num: 9 },
  { value: '10', num: 10 },
  { value: 'J', num: 10 },
  { value: 'Q', num: 10 },
  { value: 'K', num: 10 },
  { value: 'A', num: 11 },
];

export class BlackjackService {
  private games = new Map<string, BlackjackGame>();

  private getRandomCard(): Card {
    const s = SUITS[Math.floor(Math.random() * SUITS.length)];
    const v = VALUES[Math.floor(Math.random() * VALUES.length)];
    return { suit: s, value: v.value, num: v.num };
  }

  public calculateScore(cards: Card[]): number {
    let score = 0;
    let aces = 0;

    for (const c of cards) {
      score += c.num;
      if (c.value === 'A') aces++;
    }

    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }

    return score;
  }

  public formatHand(cards: Card[], hideSecond: boolean = false): string {
    if (hideSecond && cards.length >= 2) {
      return `\`[ ${cards[0].suit} ${cards[0].value} ]\` \`[ 🎴 ?? ]\``;
    }
    return cards.map((c) => `\`[ ${c.suit} ${c.value} ]\``).join(' ');
  }

  public createGame(userId: string, guildId: string, bet: number): BlackjackGame {
    const id = `${userId}_${Date.now()}`;
    const pCards = [this.getRandomCard(), this.getRandomCard()];
    const dCards = [this.getRandomCard(), this.getRandomCard()];

    const game: BlackjackGame = {
      id,
      userId,
      guildId,
      bet,
      playerCards: pCards,
      dealerCards: dCards,
      isFinished: false,
      statusText: 'Oyun devam ediyor...',
      createdAt: Date.now(),
    };

    const pScore = this.calculateScore(pCards);
    if (pScore === 21) {
      game.isFinished = true;
      game.statusText = '💥 **BLACKJACK!** 21 yaparak doğal Blackjack kazandın! (2.5x)';
    }

    this.games.set(id, game);
    return game;
  }

  public getGame(id: string): BlackjackGame | undefined {
    return this.games.get(id);
  }

  public hit(gameId: string): { game: BlackjackGame; busted: boolean } {
    const game = this.games.get(gameId);
    if (!game || game.isFinished) throw new Error('Oyun bulunamadı veya bitti.');

    game.playerCards.push(this.getRandomCard());
    const pScore = this.calculateScore(game.playerCards);

    if (pScore > 21) {
      game.isFinished = true;
      game.statusText = '💣 **YANDIN (Bust)!** Toplam puanın 21\'i aştı, oyunu kaybettin.';
      return { game, busted: true };
    }

    if (pScore === 21) {
      return this.stand(gameId);
    }

    return { game, busted: false };
  }

  public stand(gameId: string): { game: BlackjackGame; busted: boolean } {
    const game = this.games.get(gameId);
    if (!game || game.isFinished) throw new Error('Oyun bulunamadı veya bitti.');

    // Krupiye (Dealer) 17 veya üstüne ulaşana kadar kart çeker
    while (this.calculateScore(game.dealerCards) < 17) {
      game.dealerCards.push(this.getRandomCard());
    }

    const pScore = this.calculateScore(game.playerCards);
    const dScore = this.calculateScore(game.dealerCards);

    game.isFinished = true;

    if (dScore > 21) {
      game.statusText = '🎉 **KAZANDIN!** Krupiye 21\'i aştı (Bust)!';
    } else if (pScore > dScore) {
      game.statusText = `🎉 **KAZANDIN!** Senin skorun: \`${pScore}\`, Krupiye: \`${dScore}\``;
    } else if (pScore === dScore) {
      game.statusText = `🤝 **BERABERE (Push)!** İki taraf da \`${pScore}\` yaptı. Bahis iade edildi.`;
    } else {
      game.statusText = `💀 **KAYBETTİN!** Krupiyenin skoru (\`${dScore}\`) seninkinden (\`${pScore}\`) yüksek.`;
    }

    return { game, busted: false };
  }
}

export const blackjackService = new BlackjackService();
