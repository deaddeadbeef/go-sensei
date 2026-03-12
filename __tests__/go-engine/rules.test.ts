import {
  createGame,
  playMove,
  isValidMove,
  findCaptures,
  isSuicide,
  getStone,
} from '@/lib/go-engine';
import { setupBoard, p, black, white } from './test-helpers';

// Helper to play a sequence of moves, returning final state
function playSequence(startState: any, moves: [number, number][]) {
  let state = startState;
  let result: any;
  for (const [x, y] of moves) {
    result = playMove(state, p(x, y));
    if (!result.success) throw new Error(`Move at (${x},${y}) failed: ${result.reason}`);
    state = result.newState;
  }
  return { state, result };
}

describe('isValidMove', () => {
  it('valid move on empty intersection', () => {
    const state = createGame(9);
    expect(isValidMove(state, p(4, 4))).toBe(true);
  });

  it('cannot place on occupied intersection', () => {
    const state = createGame(9);
    const result = playMove(state, p(4, 4));
    if (result.success) {
      expect(isValidMove(result.newState, p(4, 4))).toBe(false);
    }
  });

  it('cannot place outside board', () => {
    const state = createGame(9);
    expect(isValidMove(state, p(-1, 0))).toBe(false);
    expect(isValidMove(state, p(9, 0))).toBe(false);
    expect(isValidMove(state, p(0, -1))).toBe(false);
    expect(isValidMove(state, p(0, 9))).toBe(false);
  });
});

describe('Simple capture', () => {
  it('surround a single stone and capture it', () => {
    const state = createGame(9);
    // B(3,4) W(4,4) B(5,4) W(0,0) B(4,3) W(1,0) B(4,5) captures W(4,4)
    const { state: s, result: r } = playSequence(state, [
      [3, 4], // B
      [4, 4], // W - target
      [5, 4], // B
      [0, 0], // W elsewhere
      [4, 3], // B
      [1, 0], // W elsewhere
      [4, 5], // B - captures
    ]);

    expect(r.captured).toHaveLength(1);
    expect(r.captured).toContainEqual(p(4, 4));
    expect(getStone(s.board, p(4, 4))).toBeNull();
    expect(s.captures.black).toBe(1);
  });
});

describe('Group capture', () => {
  it('surround a group of 2 stones and capture all', () => {
    const state = createGame(9);
    // White group at (4,4) and (5,4). Black surrounds.
    const { state: s, result: r } = playSequence(state, [
      [3, 4], // B
      [4, 4], // W
      [4, 3], // B
      [5, 4], // W
      [5, 3], // B
      [0, 0], // W elsewhere
      [6, 4], // B
      [1, 0], // W elsewhere
      [4, 5], // B
      [2, 0], // W elsewhere
      [5, 5], // B - captures both
    ]);

    expect(r.captured).toHaveLength(2);
    expect(getStone(s.board, p(4, 4))).toBeNull();
    expect(getStone(s.board, p(5, 4))).toBeNull();
    expect(s.captures.black).toBe(2);
  });
});

describe('Corner capture', () => {
  it('captures a stone in the corner with only 2 surrounding moves', () => {
    const state = createGame(9);
    const { state: s, result: r } = playSequence(state, [
      [1, 0], // B
      [0, 0], // W corner stone
      [0, 1], // B captures
    ]);

    expect(r.captured).toHaveLength(1);
    expect(r.captured).toContainEqual(p(0, 0));
    expect(getStone(s.board, p(0, 0))).toBeNull();
  });
});

describe('Edge capture', () => {
  it('captures a group along the edge', () => {
    const state = createGame(9);
    const { state: s, result: r } = playSequence(state, [
      [2, 0], // B
      [3, 0], // W
      [3, 1], // B
      [4, 0], // W
      [5, 0], // B
      [8, 8], // W elsewhere
      [4, 1], // B captures
    ]);

    expect(r.captured).toHaveLength(2);
    expect(getStone(s.board, p(3, 0))).toBeNull();
    expect(getStone(s.board, p(4, 0))).toBeNull();
  });
});

describe('Suicide rule', () => {
  it('self-capture (suicide) is illegal', () => {
    const state = createGame(9);
    // Build: white at (1,0) and (0,1). Black tries (0,0) = suicide.
    const { state: s } = playSequence(state, [
      [8, 8], // B elsewhere
      [1, 0], // W
      [7, 7], // B elsewhere
      [0, 1], // W
    ]);

    // Black to play. (0,0) adj: (1,0)=W, (0,1)=W. No liberties, no captures.
    expect(isValidMove(s, p(0, 0))).toBe(false);
    const result = playMove(s, p(0, 0));
    expect(result.success).toBe(false);
  });

  it('NOT suicide when placing captures enemy stones', () => {
    const state = createGame(9);
    const { state: s } = playSequence(state, [
      [0, 1], // B
      [0, 0], // W
    ]);
    // Black plays (1,0): captures white at (0,0)
    const r = playMove(s, p(1, 0));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.captured).toContainEqual(p(0, 0));
    }
  });
});

describe('Capture priority - captures before suicide check', () => {
  it('placing captures enemy group first, then stone has liberties', () => {
    const state = createGame(9);
    // B at (2,0),(1,1). W at (1,0),(0,1). Black plays (0,0) captures W(1,0).
    const { state: s } = playSequence(state, [
      [2, 0], // B
      [1, 0], // W
      [1, 1], // B
      [0, 1], // W
    ]);

    // Black plays (0,0): adj (1,0)=W(1 lib), (0,1)=W. Captures W(1,0), then has lib at (1,0).
    const r = playMove(s, p(0, 0));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.captured).toContainEqual(p(1, 0));
      expect(getStone(r.newState.board, p(0, 0))).toBe('black');
    }
  });
});

describe('Ko rule', () => {
  it('capture one stone, cannot recapture immediately', () => {
    const state = createGame(9);
    // Standard ko shape:
    //   col: 0 1 2 3
    // y=0:   . B W .
    // y=1:   B W . W
    // y=2:   . B W .
    // Black: (1,0),(0,1),(1,2). White: (2,0),(1,1),(3,1),(2,2).
    // Black plays (2,1) captures W(1,1).
    const { state: s1 } = playSequence(state, [
      [1, 0], // B
      [2, 0], // W
      [0, 1], // B
      [1, 1], // W - will be captured
      [1, 2], // B
      [3, 1], // W
      [8, 8], // B elsewhere
      [2, 2], // W
    ]);

    // Black captures at (2,1)
    const r = playMove(s1, p(2, 1));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.captured).toContainEqual(p(1, 1));
    expect(r.newState.koPoint).toEqual(p(1, 1));

    // White cannot recapture at (1,1) immediately
    const koResult = playMove(r.newState, p(1, 1));
    expect(koResult.success).toBe(false);
  });

  it('ko clears after opponent plays elsewhere', () => {
    const state = createGame(9);
    const { state: s1 } = playSequence(state, [
      [1, 0], // B
      [2, 0], // W
      [0, 1], // B
      [1, 1], // W
      [1, 2], // B
      [3, 1], // W
      [8, 8], // B elsewhere
      [2, 2], // W
    ]);

    // Black captures at (2,1)
    const r = playMove(s1, p(2, 1));
    if (!r.success) throw new Error('Expected success');
    const afterCapture = r.newState;
    expect(afterCapture.koPoint).toEqual(p(1, 1));

    // White plays elsewhere (ko threat)
    const r2 = playMove(afterCapture, p(7, 7));
    if (!r2.success) throw new Error('Expected success');

    // Black responds elsewhere
    const r3 = playMove(r2.newState, p(6, 6));
    if (!r3.success) throw new Error('Expected success');

    // Now white CAN play at (1,1) — ko cleared
    expect(r3.newState.koPoint).toBeNull();
    const r4 = playMove(r3.newState, p(1, 1));
    expect(r4.success).toBe(true);
  });
});

describe('Snapback', () => {
  it('is NOT ko - capturing more than 1 stone is allowed', () => {
    // Snapback: a capture of 1 stone leads to a recapture of multiple stones.
    // This is NOT ko because the recapture takes more than 1 stone.
    // We need a position where:
    // 1. Black captures 1 white stone
    // 2. White recaptures a black GROUP (>1 stones) — legal, not ko
    //
    // Simple approach: just verify that capturing >1 stone does not set ko.
    const state = createGame(9);
    // Build a position where black captures 2+ white stones at once.
    // White at (0,0),(1,0). Black at (2,0),(0,1),(1,1).
    // Black plays... let's just verify captures.length > 1 means no ko.
    const { state: s, result: r } = playSequence(state, [
      [2, 0], // B
      [0, 0], // W
      [0, 1], // B
      [1, 0], // W
      [1, 1], // B - captures W(0,0) and W(1,0)
    ]);

    expect(r.captured).toHaveLength(2);
    // Ko should NOT be set (multi-stone capture)
    expect(s.koPoint).toBeNull();
  });
});

describe('Multiple groups captured simultaneously', () => {
  it('placing stone captures adjacent separate enemy groups', () => {
    const state = createGame(9);
    // Set up two separate white groups each with 1 liberty at the same point.
    // White group 1: (0,0) with liberty at (1,0)
    // White group 2: (2,0) with liberty at (1,0)
    // They are separate groups. Black plays (1,0) captures both.
    //
    // Need: W(0,0) with adj: (1,0)=target, (0,1)=B
    //       W(2,0) with adj: (1,0)=target, (3,0)=B, (2,1)=B
    const { state: s } = playSequence(state, [
      [0, 1], // B
      [0, 0], // W
      [3, 0], // B
      [2, 0], // W
      [2, 1], // B
      [8, 8], // W elsewhere
    ]);

    // Black plays (1,0) — captures both W(0,0) and W(2,0)
    const r = playMove(s, p(1, 0));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.captured).toHaveLength(2);
      expect(r.captured).toContainEqual(p(0, 0));
      expect(r.captured).toContainEqual(p(2, 0));
    }
  });
});

describe('isSuicide', () => {
  it('returns true for placing in fully surrounded position', () => {
    const board = setupBoard(9, [white(1, 0), white(0, 1)]);
    expect(isSuicide(board, p(0, 0), 'black')).toBe(true);
  });

  it('returns false for normal placement', () => {
    const board = setupBoard(9, []);
    expect(isSuicide(board, p(4, 4), 'black')).toBe(false);
  });
});

describe('findCaptures', () => {
  it('finds captured stones after placement', () => {
    // White at (0,0), black at (0,1). Place black at (1,0) captures white.
    const board = setupBoard(9, [white(0, 0), black(0, 1)]);
    const captures = findCaptures(board, p(1, 0), 'black');
    expect(captures).toHaveLength(1);
    expect(captures).toContainEqual(p(0, 0));
  });

  it('returns empty when no captures', () => {
    const board = setupBoard(9, []);
    const captures = findCaptures(board, p(4, 4), 'black');
    expect(captures).toHaveLength(0);
  });
});
