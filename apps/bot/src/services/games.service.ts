export interface XoxGame {
  id: string;
  guildId: string;
  playerX: string;
  playerO: string;
  turn: 'X' | 'O';
  board: (string | null)[][]; // 3x3
  isFinished: boolean;
  winner: string | null; // userId or 'DRAW'
  createdAt: number;
}

export interface TkmGame {
  id: string;
  guildId: string;
  player1: string;
  player2: string; // userId or 'BOT'
  p1Choice?: 'TAS' | 'KAGIT' | 'MAKAS';
  p2Choice?: 'TAS' | 'KAGIT' | 'MAKAS';
  isFinished: boolean;
  winner: string | null;
  createdAt: number;
}

export class GamesService {
  private xoxGames = new Map<string, XoxGame>();
  private tkmGames = new Map<string, TkmGame>();

  // XOX MOTORU
  public createXoxGame(guildId: string, playerX: string, playerO: string): XoxGame {
    const id = `xox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const game: XoxGame = {
      id,
      guildId,
      playerX,
      playerO,
      turn: 'X',
      board: [
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ],
      isFinished: false,
      winner: null,
      createdAt: Date.now(),
    };
    this.xoxGames.set(id, game);
    return game;
  }

  public getXoxGame(id: string): XoxGame | undefined {
    return this.xoxGames.get(id);
  }

  public makeXoxMove(id: string, userId: string, row: number, col: number): { success: boolean; message?: string; game?: XoxGame } {
    const game = this.xoxGames.get(id);
    if (!game) return { success: false, message: 'Bu oyunun süresi dolmuş veya bulunamadı.' };
    if (game.isFinished) return { success: false, message: 'Oyun zaten sona erdi.' };

    const expectedUser = game.turn === 'X' ? game.playerX : game.playerO;
    if (userId !== expectedUser) {
      return { success: false, message: 'Şu an senin sıran değil!' };
    }

    if (game.board[row][col] !== null) {
      return { success: false, message: 'Bu kare zaten dolu!' };
    }

    game.board[row][col] = game.turn;

    // Galibiyet kontrolü
    const winnerSymbol = this.checkXoxWinner(game.board);
    if (winnerSymbol) {
      game.isFinished = true;
      game.winner = winnerSymbol === 'X' ? game.playerX : game.playerO;
    } else if (this.isXoxBoardFull(game.board)) {
      game.isFinished = true;
      game.winner = 'DRAW';
    } else {
      game.turn = game.turn === 'X' ? 'O' : 'X';
    }

    return { success: true, game };
  }

  private checkXoxWinner(board: (string | null)[][]): string | null {
    // Satırlar ve sütunlar
    for (let i = 0; i < 3; i++) {
      if (board[i][0] && board[i][0] === board[i][1] && board[i][1] === board[i][2]) return board[i][0];
      if (board[0][i] && board[0][i] === board[1][i] && board[1][i] === board[2][i]) return board[0][i];
    }
    // Çaprazlar
    if (board[0][0] && board[0][0] === board[1][1] && board[1][1] === board[2][2]) return board[0][0];
    if (board[0][2] && board[0][2] === board[1][1] && board[1][1] === board[2][0]) return board[0][2];

    return null;
  }

  private isXoxBoardFull(board: (string | null)[][]): boolean {
    return board.every((row) => row.every((cell) => cell !== null));
  }

  // TAŞ KAĞIT MAKAS MOTORU
  public createTkmGame(guildId: string, player1: string, player2: string): TkmGame {
    const id = `tkm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const game: TkmGame = {
      id,
      guildId,
      player1,
      player2,
      isFinished: false,
      winner: null,
      createdAt: Date.now(),
    };
    this.tkmGames.set(id, game);
    return game;
  }

  public getTkmGame(id: string): TkmGame | undefined {
    return this.tkmGames.get(id);
  }

  public makeTkmChoice(id: string, userId: string, choice: 'TAS' | 'KAGIT' | 'MAKAS'): { success: boolean; message?: string; game?: TkmGame } {
    const game = this.tkmGames.get(id);
    if (!game) return { success: false, message: 'Oyun bulunamadı veya süresi doldu.' };
    if (game.isFinished) return { success: false, message: 'Bu oyun zaten bitti.' };

    if (userId === game.player1) {
      game.p1Choice = choice;
    } else if (userId === game.player2) {
      game.p2Choice = choice;
    } else {
      return { success: false, message: 'Bu oyunda oyuncu değilsin.' };
    }

    // Bot ile oynanıyorsa bot seçimini yap
    if (game.player2 === 'BOT' && !game.p2Choice) {
      const choices: ('TAS' | 'KAGIT' | 'MAKAS')[] = ['TAS', 'KAGIT', 'MAKAS'];
      game.p2Choice = choices[Math.floor(Math.random() * choices.length)];
    }

    // İki taraf da seçim yaptıysa kazananı belirle
    if (game.p1Choice && game.p2Choice) {
      game.isFinished = true;
      if (game.p1Choice === game.p2Choice) {
        game.winner = 'DRAW';
      } else if (
        (game.p1Choice === 'TAS' && game.p2Choice === 'MAKAS') ||
        (game.p1Choice === 'KAGIT' && game.p2Choice === 'TAS') ||
        (game.p1Choice === 'MAKAS' && game.p2Choice === 'KAGIT')
      ) {
        game.winner = game.player1;
      } else {
        game.winner = game.player2;
      }
    }

    return { success: true, game };
  }
}

export const gamesService = new GamesService();
