import { applyBoardSnapshot, reconstructGame } from '@/lib/ai/tools';
import { boardHash, createGame, setStone } from '@/lib/go-engine';

describe('AI tool game reconstruction', () => {
  it('hydrates a no-history study board from a valid board snapshot', () => {
    const base = createGame(9);
    const snapshotBoard = setStone(base.board, { x: 2, y: 2 }, 'black');

    const state = applyBoardSnapshot(base, snapshotBoard);

    expect(state.board.grid[2][2]).toBe('black');
    expect(state.moveHistory).toHaveLength(0);
    expect(state.positionHistory.has(boardHash(state.board))).toBe(true);
    expect(state.positionHistory.has(boardHash(base.board))).toBe(false);
  });

  it('ignores malformed board snapshots', () => {
    const base = createGame(9);

    const state = applyBoardSnapshot(base, {
      size: 9,
      grid: [[null, 'black', 'not-a-stone']],
    });

    expect(state.board.grid).toEqual(base.board.grid);
    expect(state.positionHistory).toEqual(base.positionHistory);
  });

  it('keeps normal move replay independent from board snapshots', () => {
    const state = reconstructGame([{ type: 'place', x: 2, y: 2 }], 9, 6.5);

    expect(state.board.grid[2][2]).toBe('black');
    expect(state.moveHistory).toHaveLength(1);
    expect(state.currentPlayer).toBe('white');
  });
});
