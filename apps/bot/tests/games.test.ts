import { describe, it, expect } from 'vitest';
import { GamesService } from '../src/services/games.service';

describe('Mini Oyunlar — XOX ve TKM Mantığı', () => {
  it('XOX oyunu oluşturulmalı ve hamleler sırayla yapılmalı', () => {
    const service = new GamesService();
    const game = service.createXoxGame('guild_1', 'user_x', 'user_o');

    expect(game.turn).toBe('X');

    // Yanlış kullanıcının hamlesi engellenmeli
    const invalidMove = service.makeXoxMove(game.id, 'user_o', 0, 0);
    expect(invalidMove.success).toBe(false);

    // Doğru kullanıcının hamlesi başarılı olmalı
    const validMove = service.makeXoxMove(game.id, 'user_x', 0, 0);
    expect(validMove.success).toBe(true);
    expect(validMove.game?.turn).toBe('O');
  });

  it('XOX yatay 3 karede kazananı tespit etmeli', () => {
    const service = new GamesService();
    const game = service.createXoxGame('guild_1', 'user_x', 'user_o');

    service.makeXoxMove(game.id, 'user_x', 0, 0); // X
    service.makeXoxMove(game.id, 'user_o', 1, 0); // O
    service.makeXoxMove(game.id, 'user_x', 0, 1); // X
    service.makeXoxMove(game.id, 'user_o', 1, 1); // O
    const winMove = service.makeXoxMove(game.id, 'user_x', 0, 2); // X

    expect(winMove.game?.isFinished).toBe(true);
    expect(winMove.game?.winner).toBe('user_x');
  });

  it('TKM oyunu Taş - Makas durumunda Taş kazananı seçmeli', () => {
    const service = new GamesService();
    const game = service.createTkmGame('guild_1', 'p1', 'p2');

    service.makeTkmChoice(game.id, 'p1', 'TAS');
    const finish = service.makeTkmChoice(game.id, 'p2', 'MAKAS');

    expect(finish.game?.isFinished).toBe(true);
    expect(finish.game?.winner).toBe('p1');
  });
});
