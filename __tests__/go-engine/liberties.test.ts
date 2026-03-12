import {
  countLiberties,
  isInAtari,
  getLibertiesOf,
  wouldHaveLiberties,
} from '@/lib/go-engine';
import { setupBoard, p, black, white } from './test-helpers';

describe('countLiberties', () => {
  it('returns 0 for empty point', () => {
    const board = setupBoard(9, []);
    expect(countLiberties(board, p(4, 4))).toBe(0);
  });

  it('stone in center has 4 liberties', () => {
    const board = setupBoard(9, [black(4, 4)]);
    expect(countLiberties(board, p(4, 4))).toBe(4);
  });

  it('stone on edge has 3 liberties', () => {
    const board = setupBoard(9, [black(0, 4)]);
    expect(countLiberties(board, p(0, 4))).toBe(3);
  });

  it('stone in corner has 2 liberties', () => {
    const board = setupBoard(9, [black(0, 0)]);
    expect(countLiberties(board, p(0, 0))).toBe(2);
  });

  it('group with shared liberties are deduplicated', () => {
    // Two horizontal stones: liberties are the set union
    const board = setupBoard(9, [black(4, 4), black(5, 4)]);
    // Each stone has 4 liberties but they share (4,3)/(5,3) and (4,5)/(5,5)
    // Unique liberties: (3,4), (6,4), (4,3), (5,3), (4,5), (5,5) = 6
    expect(countLiberties(board, p(4, 4))).toBe(6);
  });
});

describe('getLibertiesOf', () => {
  it('returns empty array for empty point', () => {
    const board = setupBoard(9, []);
    expect(getLibertiesOf(board, p(4, 4))).toEqual([]);
  });

  it('returns correct liberty points', () => {
    const board = setupBoard(9, [black(0, 0)]);
    const libs = getLibertiesOf(board, p(0, 0));
    expect(libs).toHaveLength(2);
    expect(libs).toContainEqual(p(1, 0));
    expect(libs).toContainEqual(p(0, 1));
  });
});

describe('isInAtari', () => {
  it('returns true for group with exactly 1 liberty', () => {
    // Black at (0,0), white at (1,0) — black has only (0,1) left
    const board = setupBoard(9, [black(0, 0), white(1, 0)]);
    expect(isInAtari(board, p(0, 0))).toBe(true);
  });

  it('returns false for group with 2 liberties', () => {
    const board = setupBoard(9, [black(0, 0)]);
    expect(isInAtari(board, p(0, 0))).toBe(false);
  });

  it('returns false for group with 4 liberties', () => {
    const board = setupBoard(9, [black(4, 4)]);
    expect(isInAtari(board, p(4, 4))).toBe(false);
  });

  it('returns false for empty point (0 liberties, not 1)', () => {
    const board = setupBoard(9, []);
    expect(isInAtari(board, p(4, 4))).toBe(false);
  });
});

describe('wouldHaveLiberties', () => {
  it('placing in open area — has adjacent empty', () => {
    const board = setupBoard(9, []);
    expect(wouldHaveLiberties(board, p(4, 4), 'black')).toBe(true);
  });

  it('placing next to friendly group with liberties', () => {
    // Black at (4,4) has 4 liberties. Placing at (5,4) fills one, but group still has >1
    const board = setupBoard(9, [black(4, 4)]);
    expect(wouldHaveLiberties(board, p(5, 4), 'black')).toBe(true);
  });

  it('placing in fully enclosed position — suicide, no liberties', () => {
    // Surrounded by white on all sides with no capture possible
    // (1,0), white at (0,0),(2,0),(1,1) — no friendly stone, no empty adj except occupied
    // Actually simpler: corner. White at (1,0) and (0,1). Placing black at (0,0)
    // (0,0) adj: (1,0)=white, (0,1)=white. No empty adj, no friendly, no capture.
    const board = setupBoard(9, [white(1, 0), white(0, 1)]);
    expect(wouldHaveLiberties(board, p(0, 0), 'black')).toBe(false);
  });

  it('placing that captures — has liberties even though surrounded', () => {
    // White at (0,0) with only liberty at (1,0) blocked by existing black at (0,1)
    // White at (0,0), black at (0,1). White has liberties: (1,0).
    // Place black at (1,0) — would capture white at (0,0), freeing liberty.
    const board = setupBoard(9, [white(0, 0), black(0, 1)]);
    // White at (0,0) has liberties: (1,0). If black plays (1,0), white at (0,0) has 0 libs.
    expect(wouldHaveLiberties(board, p(1, 0), 'black')).toBe(true);
  });

  it('placing connecting to friendly group that has enough liberties', () => {
    // Black group at (4,4),(5,4) has 6 liberties. Place at (3,4) connects.
    // (3,4) fills one liberty of the (4,4) group, but group still has >=2.
    const board = setupBoard(9, [black(4, 4), black(5, 4)]);
    expect(wouldHaveLiberties(board, p(3, 4), 'black')).toBe(true);
  });
});
