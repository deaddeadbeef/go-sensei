import {
  createGame,
  playMove,
  passMove,
  resignGame,
  undoMove,
  getOpponent,
  getStone,
} from '@/lib/go-engine';
import { p } from './test-helpers';

describe('createGame', () => {
  it('creates default game (9x9, komi 6.5, black first)', () => {
    const game = createGame();
    expect(game.board.size).toBe(9);
    expect(game.komi).toBe(6.5);
    expect(game.currentPlayer).toBe('black');
    expect(game.moveHistory).toHaveLength(0);
    expect(game.captures.black).toBe(0);
    expect(game.captures.white).toBe(0);
    expect(game.koPoint).toBeNull();
    expect(game.consecutivePasses).toBe(0);
    expect(game.phase).toBe('playing');
    expect(game.winner).toBeNull();
  });

  it('creates game with custom size 19', () => {
    const game = createGame(19);
    expect(game.board.size).toBe(19);
  });

  it('creates game with custom size 13 and komi 7.5', () => {
    const game = createGame(13, 7.5);
    expect(game.board.size).toBe(13);
    expect(game.komi).toBe(7.5);
  });
});

describe('playMove', () => {
  it('successful move updates board, switches player, adds to history', () => {
    const game = createGame(9);
    const result = playMove(game, p(4, 4));

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(getStone(result.newState.board, p(4, 4))).toBe('black');
    expect(result.newState.currentPlayer).toBe('white');
    expect(result.newState.moveHistory).toHaveLength(1);
    expect(result.newState.moveHistory[0]).toEqual({
      type: 'place',
      point: p(4, 4),
      color: 'black',
      captured: [],
    });
    expect(result.captured).toEqual([]);
  });

  it('returns error for invalid move (occupied)', () => {
    const game = createGame(9);
    const r1 = playMove(game, p(4, 4));
    if (!r1.success) throw new Error('first move should succeed');

    const r2 = playMove(r1.newState, p(4, 4));
    expect(r2.success).toBe(false);
    if (!r2.success) {
      expect(r2.reason).toBeDefined();
    }
  });

  it('returns error when game is not in playing phase', () => {
    let game = createGame(9);
    game = passMove(game);
    game = passMove(game); // now in 'scoring' phase

    const r = playMove(game, p(4, 4));
    expect(r.success).toBe(false);
  });

  it('resets consecutive passes after a stone placement', () => {
    let game = createGame(9);
    game = passMove(game); // 1 pass
    expect(game.consecutivePasses).toBe(1);

    const r = playMove(game, p(4, 4));
    if (!r.success) throw new Error('expected success');
    expect(r.newState.consecutivePasses).toBe(0);
  });
});

describe('passMove', () => {
  it('switches player and increments consecutive passes', () => {
    const game = createGame(9);
    const afterPass = passMove(game);

    expect(afterPass.currentPlayer).toBe('white');
    expect(afterPass.consecutivePasses).toBe(1);
    expect(afterPass.moveHistory).toHaveLength(1);
    expect(afterPass.moveHistory[0]).toEqual({ type: 'pass', color: 'black' });
  });

  it('two consecutive passes move to scoring phase', () => {
    let game = createGame(9);
    game = passMove(game); // black passes
    expect(game.phase).toBe('playing');
    expect(game.consecutivePasses).toBe(1);

    game = passMove(game); // white passes
    expect(game.phase).toBe('scoring');
    expect(game.consecutivePasses).toBe(2);
  });

  it('clears ko point on pass', () => {
    // Even if there was a ko point, pass should clear it
    let game = createGame(9);
    // Manually set ko for testing purposes
    game = { ...game, koPoint: p(3, 3) };
    const afterPass = passMove(game);
    expect(afterPass.koPoint).toBeNull();
  });
});

describe('resignGame', () => {
  it('sets winner to opponent and phase to finished', () => {
    const game = createGame(9);
    const resigned = resignGame(game);

    expect(resigned.phase).toBe('finished');
    expect(resigned.winner).toBe('white'); // black resigned, white wins
    expect(resigned.moveHistory).toHaveLength(1);
    expect(resigned.moveHistory[0]).toEqual({ type: 'resign', color: 'black' });
  });

  it('white resigns, black wins', () => {
    let game = createGame(9);
    const r = playMove(game, p(4, 4));
    if (!r.success) throw new Error('expected success');
    const resigned = resignGame(r.newState);

    expect(resigned.winner).toBe('black'); // white resigned
    expect(resigned.phase).toBe('finished');
  });
});

describe('undoMove', () => {
  it('returns null on fresh game (no moves to undo)', () => {
    const game = createGame(9);
    expect(undoMove(game)).toBeNull();
  });

  it('undoes a single move, returning to empty board', () => {
    const game = createGame(9);
    const r = playMove(game, p(4, 4));
    if (!r.success) throw new Error('expected success');

    const undone = undoMove(r.newState);
    expect(undone).not.toBeNull();
    expect(undone!.moveHistory).toHaveLength(0);
    expect(getStone(undone!.board, p(4, 4))).toBeNull();
    expect(undone!.currentPlayer).toBe('black');
  });

  it('undoes multiple moves correctly', () => {
    let game = createGame(9);
    let r: any;
    r = playMove(game, p(0, 0)); game = r.newState; // B
    r = playMove(game, p(1, 1)); game = r.newState; // W
    r = playMove(game, p(2, 2)); game = r.newState; // B

    expect(game.moveHistory).toHaveLength(3);

    const undone = undoMove(game);
    expect(undone).not.toBeNull();
    expect(undone!.moveHistory).toHaveLength(2);
    expect(getStone(undone!.board, p(2, 2))).toBeNull();
    expect(getStone(undone!.board, p(0, 0))).toBe('black');
    expect(getStone(undone!.board, p(1, 1))).toBe('white');
    expect(undone!.currentPlayer).toBe('black');
  });

  it('undoes a pass', () => {
    let game = createGame(9);
    game = passMove(game);
    expect(game.consecutivePasses).toBe(1);

    const undone = undoMove(game);
    expect(undone).not.toBeNull();
    expect(undone!.consecutivePasses).toBe(0);
    expect(undone!.currentPlayer).toBe('black');
  });
});

describe('getOpponent', () => {
  it('black returns white', () => {
    expect(getOpponent('black')).toBe('white');
  });

  it('white returns black', () => {
    expect(getOpponent('white')).toBe('black');
  });
});

describe('Full short game', () => {
  it('play a few moves, captures, pass pass -> scoring', () => {
    let state = createGame(9);
    let r: any;

    // A few moves
    r = playMove(state, p(2, 2)); state = r.newState;
    r = playMove(state, p(6, 6)); state = r.newState;
    r = playMove(state, p(3, 3)); state = r.newState;
    r = playMove(state, p(5, 5)); state = r.newState;

    expect(state.moveHistory).toHaveLength(4);
    expect(state.phase).toBe('playing');

    // Both pass
    state = passMove(state);
    state = passMove(state);

    expect(state.phase).toBe('scoring');
    expect(state.consecutivePasses).toBe(2);
  });
});
