import {
  createBoard,
  setStone,
  calculateTerritory,
  countStones,
} from '@/lib/go-engine';
import { setupBoard, p, black, white } from './test-helpers';

describe('calculateTerritory', () => {
  it('empty board has no territory (all neutral, no bordering colors)', () => {
    const board = createBoard(9);
    const result = calculateTerritory(board, 6.5);
    // Empty board: one big empty region with no adjacent stones = neutral
    expect(result.blackTerritory).toHaveLength(0);
    expect(result.whiteTerritory).toHaveLength(0);
  });

  it('simple enclosed territory - black surrounds corner', () => {
    // Black wall along column 1 and row 1, enclosing (0,0):
    //   col: 0 1
    // y=0:   . B
    // y=1:   B .
    // The point (0,0) is bordered only by black -> black territory
    const board = setupBoard(9, [
      black(1, 0),
      black(0, 1),
    ]);
    const result = calculateTerritory(board, 0);
    expect(result.blackTerritory).toContainEqual(p(0, 0));
    // But the large open region touches black too AND is connected to the rest,
    // which touches nothing else... actually (0,0) is isolated empty region
    // bordered only by black stones. The rest of the board is one big region
    // bordered only by black, so it's also black territory.
    expect(result.blackTerritory.length).toBeGreaterThanOrEqual(1);
  });

  it('territory touching both colors is neutral (dame)', () => {
    // Black at (0,1), white at (2,1). The point (1,1) borders both.
    // Large empty region connected to both colors = neutral.
    const board = setupBoard(9, [
      black(0, 4),
      white(8, 4),
    ]);
    const result = calculateTerritory(board, 0);
    // The large empty region touches both colors, so it's neutral
    expect(result.blackTerritory).toHaveLength(0);
    expect(result.whiteTerritory).toHaveLength(0);
  });

  it('fully enclosed territory with walls', () => {
    // Black encloses a 2x2 area in the corner:
    //   col: 0 1 2
    // y=0:   . . B
    // y=1:   . . B
    // y=2:   B B B
    // The 4 empty points (0,0),(1,0),(0,1),(1,1) are bordered only by black.
    const board = setupBoard(9, [
      black(2, 0), black(2, 1), black(0, 2), black(1, 2), black(2, 2),
    ]);
    const result = calculateTerritory(board, 0);
    // (0,0),(1,0),(0,1),(1,1) should be black territory
    expect(result.blackTerritory).toContainEqual(p(0, 0));
    expect(result.blackTerritory).toContainEqual(p(1, 0));
    expect(result.blackTerritory).toContainEqual(p(0, 1));
    expect(result.blackTerritory).toContainEqual(p(1, 1));
  });
});

describe('countStones', () => {
  it('counts correctly on empty board', () => {
    const board = createBoard(9);
    expect(countStones(board, 'black')).toBe(0);
    expect(countStones(board, 'white')).toBe(0);
  });

  it('counts stones after placement', () => {
    const board = setupBoard(9, [
      black(0, 0), black(1, 1), black(2, 2),
      white(3, 3), white(4, 4),
    ]);
    expect(countStones(board, 'black')).toBe(3);
    expect(countStones(board, 'white')).toBe(2);
  });
});

describe('Chinese scoring with komi', () => {
  it('white gets komi bonus in final score', () => {
    const board = createBoard(9);
    const result = calculateTerritory(board, 6.5);
    // Empty board: 0 territory, 0 stones for both
    expect(result.finalBlackScore).toBe(0);
    expect(result.finalWhiteScore).toBe(6.5); // only komi
  });

  it('full scoring scenario with territory and stones', () => {
    // Black encloses corner (4 empty points), white encloses opposite corner (4 empty points)
    // Black wall in top-left, White wall in bottom-right
    //
    // For a clean test, let's make isolated territories:
    //   col: 0 1 2 ... 6 7 8
    // y=0:   . . B     W . .
    // y=1:   . . B     W . .
    // y=2:   B B B     W W W
    //
    // ... (middle is dame - borders both)
    //
    // y=6:   B B B     W W W
    // y=7:   B . .     . . W
    // y=8:   B . .     . . W
    //
    // This is too complex. Let's use a simpler scenario.

    // Black: 5 stones forming wall, enclosing 4 points.
    // White: 5 stones forming wall, enclosing 4 points.
    // Both sets separated so territory is clean.
    //
    // Simpler: use setupBoard directly.
    const board = setupBoard(9, [
      // Black wall in top-left corner enclosing (0,0),(1,0),(0,1),(1,1)
      black(2, 0), black(2, 1), black(0, 2), black(1, 2), black(2, 2),
      // White wall in bottom-right corner enclosing (7,8),(8,8),(7,7),(8,7)... hmm
      // Actually: enclosing (7,7),(8,7),(7,8),(8,8)
      white(6, 7), white(6, 8), white(7, 6), white(8, 6), white(6, 6),
    ]);

    const result = calculateTerritory(board, 6.5);

    // Black territory: 4 points in top-left
    expect(result.blackTerritory).toHaveLength(4);
    // White territory: 4 points in bottom-right
    expect(result.whiteTerritory).toHaveLength(4);

    // Black: 5 stones + 4 territory = 9
    expect(result.finalBlackScore).toBe(9);
    // White: 5 stones + 4 territory + 6.5 komi = 15.5
    expect(result.finalWhiteScore).toBe(15.5);
  });
});

describe('dead stone support', () => {
  it('dead stone inside territory is excluded from scoring', () => {
    // Black encloses corner with a dead white stone inside
    const board = setupBoard(9, [
      black(2, 0), black(2, 1), black(0, 2), black(1, 2), black(2, 2),
      white(1, 1), // dead white stone inside black territory
    ]);

    // Without marking dead: white stone breaks territory
    const withoutDead = calculateTerritory(board, 0);

    // With marking dead: white stone removed, territory restored
    const withDead = calculateTerritory(board, 0, [p(1, 1)]);
    expect(withDead.blackTerritory.length).toBeGreaterThan(withoutDead.blackTerritory.length);
    // Should have 4 points of territory (the dead stone position + 3 empty)
    expect(withDead.blackTerritory).toContainEqual(p(0, 0));
    expect(withDead.blackTerritory).toContainEqual(p(1, 0));
    expect(withDead.blackTerritory).toContainEqual(p(0, 1));
    expect(withDead.blackTerritory).toContainEqual(p(1, 1));
  });
});
