import {
  createBoard,
  getStone,
  setStone,
  isOnBoard,
  getAdjacentPoints,
  pointEquals,
  boardHash,
} from '@/lib/go-engine';
import { p, setupBoard, black, white } from './test-helpers';

describe('createBoard', () => {
  it.each([9, 13, 19] as const)('creates an empty %dx%d board with all cells null', (size) => {
    const board = createBoard(size);
    expect(board.size).toBe(size);
    expect(board.grid.length).toBe(size);
    for (let y = 0; y < size; y++) {
      expect(board.grid[y].length).toBe(size);
      for (let x = 0; x < size; x++) {
        expect(board.grid[y][x]).toBeNull();
      }
    }
  });
});

describe('getStone', () => {
  it('returns null for empty cells', () => {
    const board = createBoard(9);
    expect(getStone(board, p(0, 0))).toBeNull();
    expect(getStone(board, p(4, 4))).toBeNull();
    expect(getStone(board, p(8, 8))).toBeNull();
  });

  it('returns null for out-of-bounds points', () => {
    const board = createBoard(9);
    expect(getStone(board, p(-1, 0))).toBeNull();
    expect(getStone(board, p(0, -1))).toBeNull();
    expect(getStone(board, p(9, 0))).toBeNull();
    expect(getStone(board, p(0, 9))).toBeNull();
    expect(getStone(board, p(100, 100))).toBeNull();
  });

  it('returns the stone color after placement', () => {
    let board = createBoard(9);
    board = setStone(board, p(3, 3), 'black');
    board = setStone(board, p(5, 5), 'white');
    expect(getStone(board, p(3, 3))).toBe('black');
    expect(getStone(board, p(5, 5))).toBe('white');
  });
});

describe('setStone', () => {
  it('places a stone and returns a new board (immutability)', () => {
    const original = createBoard(9);
    const modified = setStone(original, p(4, 4), 'black');

    // Original is unchanged
    expect(getStone(original, p(4, 4))).toBeNull();
    // New board has the stone
    expect(getStone(modified, p(4, 4))).toBe('black');
    // They are different objects
    expect(modified).not.toBe(original);
    expect(modified.grid).not.toBe(original.grid);
    expect(modified.grid[4]).not.toBe(original.grid[4]);
  });

  it('can remove a stone by setting null', () => {
    const board = setStone(createBoard(9), p(0, 0), 'white');
    expect(getStone(board, p(0, 0))).toBe('white');
    const cleared = setStone(board, p(0, 0), null);
    expect(getStone(cleared, p(0, 0))).toBeNull();
  });
});

describe('isOnBoard', () => {
  const board = createBoard(9);

  it('returns true for corners', () => {
    expect(isOnBoard(board, p(0, 0))).toBe(true);
    expect(isOnBoard(board, p(8, 0))).toBe(true);
    expect(isOnBoard(board, p(0, 8))).toBe(true);
    expect(isOnBoard(board, p(8, 8))).toBe(true);
  });

  it('returns true for edges', () => {
    expect(isOnBoard(board, p(4, 0))).toBe(true);
    expect(isOnBoard(board, p(0, 4))).toBe(true);
    expect(isOnBoard(board, p(8, 4))).toBe(true);
    expect(isOnBoard(board, p(4, 8))).toBe(true);
  });

  it('returns true for center', () => {
    expect(isOnBoard(board, p(4, 4))).toBe(true);
  });

  it('returns false for off-board points', () => {
    expect(isOnBoard(board, p(-1, 0))).toBe(false);
    expect(isOnBoard(board, p(0, -1))).toBe(false);
    expect(isOnBoard(board, p(9, 0))).toBe(false);
    expect(isOnBoard(board, p(0, 9))).toBe(false);
    expect(isOnBoard(board, p(-1, -1))).toBe(false);
    expect(isOnBoard(board, p(9, 9))).toBe(false);
  });
});

describe('getAdjacentPoints', () => {
  const board = createBoard(9);

  it('returns 4 neighbors for center point', () => {
    const adj = getAdjacentPoints(board, p(4, 4));
    expect(adj).toHaveLength(4);
    expect(adj).toContainEqual(p(4, 3)); // up
    expect(adj).toContainEqual(p(4, 5)); // down
    expect(adj).toContainEqual(p(3, 4)); // left
    expect(adj).toContainEqual(p(5, 4)); // right
  });

  it('returns 3 neighbors for edge point', () => {
    const adj = getAdjacentPoints(board, p(4, 0)); // top edge
    expect(adj).toHaveLength(3);
    expect(adj).toContainEqual(p(3, 0));
    expect(adj).toContainEqual(p(5, 0));
    expect(adj).toContainEqual(p(4, 1));
  });

  it('returns 2 neighbors for corner point', () => {
    const adj = getAdjacentPoints(board, p(0, 0)); // top-left corner
    expect(adj).toHaveLength(2);
    expect(adj).toContainEqual(p(1, 0));
    expect(adj).toContainEqual(p(0, 1));
  });

  it('returns 2 neighbors for bottom-right corner', () => {
    const adj = getAdjacentPoints(board, p(8, 8));
    expect(adj).toHaveLength(2);
    expect(adj).toContainEqual(p(7, 8));
    expect(adj).toContainEqual(p(8, 7));
  });
});

describe('pointEquals', () => {
  it('returns true for identical points', () => {
    expect(pointEquals(p(3, 5), p(3, 5))).toBe(true);
    expect(pointEquals(p(0, 0), p(0, 0))).toBe(true);
  });

  it('returns false for different points', () => {
    expect(pointEquals(p(3, 5), p(5, 3))).toBe(false);
    expect(pointEquals(p(0, 0), p(0, 1))).toBe(false);
    expect(pointEquals(p(1, 0), p(0, 0))).toBe(false);
  });
});

describe('boardHash', () => {
  it('returns same hash for identical positions', () => {
    const board1 = setupBoard(9, [black(3, 3), white(5, 5)]);
    const board2 = setupBoard(9, [black(3, 3), white(5, 5)]);
    expect(boardHash(board1)).toBe(boardHash(board2));
  });

  it('returns different hash for different positions', () => {
    const board1 = setupBoard(9, [black(3, 3)]);
    const board2 = setupBoard(9, [black(3, 4)]);
    expect(boardHash(board1)).not.toBe(boardHash(board2));
  });

  it('returns different hash for different colors at same point', () => {
    const board1 = setupBoard(9, [black(4, 4)]);
    const board2 = setupBoard(9, [white(4, 4)]);
    expect(boardHash(board1)).not.toBe(boardHash(board2));
  });

  it('empty boards of same size produce the same hash', () => {
    const board1 = createBoard(9);
    const board2 = createBoard(9);
    expect(boardHash(board1)).toBe(boardHash(board2));
  });
});
