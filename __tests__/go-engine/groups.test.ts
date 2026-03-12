import { getGroup, getAllGroups } from '@/lib/go-engine';
import { setupBoard, p, black, white } from './test-helpers';

describe('getGroup', () => {
  it('returns null on empty point', () => {
    const board = setupBoard(9, []);
    expect(getGroup(board, p(4, 4))).toBeNull();
  });

  it('finds a single stone group with up to 4 liberties (center)', () => {
    const board = setupBoard(9, [black(4, 4)]);
    const group = getGroup(board, p(4, 4));
    expect(group).not.toBeNull();
    expect(group!.color).toBe('black');
    expect(group!.stones).toHaveLength(1);
    expect(group!.stones).toContainEqual(p(4, 4));
    expect(group!.liberties).toHaveLength(4);
  });

  it('finds a single stone on edge with 3 liberties', () => {
    const board = setupBoard(9, [black(0, 4)]);
    const group = getGroup(board, p(0, 4));
    expect(group!.liberties).toHaveLength(3);
  });

  it('finds a single stone in corner with 2 liberties', () => {
    const board = setupBoard(9, [black(0, 0)]);
    const group = getGroup(board, p(0, 0));
    expect(group!.liberties).toHaveLength(2);
  });

  it('finds two horizontally connected stones as one group', () => {
    const board = setupBoard(9, [black(3, 3), black(4, 3)]);
    const group = getGroup(board, p(3, 3));
    expect(group!.stones).toHaveLength(2);
    expect(group!.stones).toContainEqual(p(3, 3));
    expect(group!.stones).toContainEqual(p(4, 3));
    // 2 stones in a horizontal line at center: 6 unique liberties
    expect(group!.liberties).toHaveLength(6);
  });

  it('finds two vertically connected stones as one group', () => {
    const board = setupBoard(9, [black(4, 3), black(4, 4)]);
    const group = getGroup(board, p(4, 3));
    expect(group!.stones).toHaveLength(2);
    expect(group!.stones).toContainEqual(p(4, 3));
    expect(group!.stones).toContainEqual(p(4, 4));
    expect(group!.liberties).toHaveLength(6);
  });

  it('finds an L-shaped group', () => {
    // L-shape: (3,3), (4,3), (4,4)
    const board = setupBoard(9, [black(3, 3), black(4, 3), black(4, 4)]);
    const group = getGroup(board, p(3, 3));
    expect(group!.stones).toHaveLength(3);
    expect(group!.stones).toContainEqual(p(3, 3));
    expect(group!.stones).toContainEqual(p(4, 3));
    expect(group!.stones).toContainEqual(p(4, 4));
    // 7 unique liberties around the L
    expect(group!.liberties).toHaveLength(7);
  });

  it('group surrounded by enemy has reduced liberties', () => {
    // Black stone at (4,4), white stones at (3,4), (5,4), (4,3)
    // That leaves only (4,5) as a liberty
    const board = setupBoard(9, [
      black(4, 4),
      white(3, 4),
      white(5, 4),
      white(4, 3),
    ]);
    const group = getGroup(board, p(4, 4));
    expect(group!.liberties).toHaveLength(1);
    expect(group!.liberties).toContainEqual(p(4, 5));
  });

  it('group with no liberties (fully surrounded)', () => {
    // Black stone at (4,4), white on all 4 adjacent points
    const board = setupBoard(9, [
      black(4, 4),
      white(3, 4),
      white(5, 4),
      white(4, 3),
      white(4, 5),
    ]);
    const group = getGroup(board, p(4, 4));
    expect(group!.liberties).toHaveLength(0);
  });

  it('large connected group spanning multiple rows/columns', () => {
    // A 2x3 block: (2,2),(3,2),(2,3),(3,3),(2,4),(3,4)
    const board = setupBoard(9, [
      black(2, 2), black(3, 2),
      black(2, 3), black(3, 3),
      black(2, 4), black(3, 4),
    ]);
    const group = getGroup(board, p(2, 2));
    expect(group!.stones).toHaveLength(6);
    // Perimeter liberties of a 2x3 block in center = 10
    expect(group!.liberties).toHaveLength(10);
  });
});

describe('getAllGroups', () => {
  it('returns empty array for empty board', () => {
    const board = setupBoard(9, []);
    expect(getAllGroups(board)).toHaveLength(0);
  });

  it('finds multiple separate groups', () => {
    const board = setupBoard(9, [
      black(0, 0),         // group 1
      white(4, 4),         // group 2
      black(8, 8),         // group 3
    ]);
    const groups = getAllGroups(board);
    expect(groups).toHaveLength(3);
  });

  it('does not double-count connected stones', () => {
    const board = setupBoard(9, [
      black(3, 3), black(4, 3), black(5, 3), // one connected group
      white(0, 0), white(1, 0),              // another connected group
    ]);
    const groups = getAllGroups(board);
    expect(groups).toHaveLength(2);

    const blackGroup = groups.find(g => g.color === 'black');
    const whiteGroup = groups.find(g => g.color === 'white');
    expect(blackGroup!.stones).toHaveLength(3);
    expect(whiteGroup!.stones).toHaveLength(2);
  });
});
