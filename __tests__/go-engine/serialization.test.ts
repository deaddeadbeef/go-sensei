import {
  createGame,
  playMove,
  boardToText,
  pointToCoord,
  coordToPoint,
} from '@/lib/go-engine';
import { p } from './test-helpers';

describe('pointToCoord', () => {
  it('converts (0,8) on 9x9 to A1', () => {
    expect(pointToCoord(p(0, 8), 9)).toBe('A1');
  });

  it('converts (0,0) on 9x9 to A9', () => {
    expect(pointToCoord(p(0, 0), 9)).toBe('A9');
  });

  it('converts (4,4) on 9x9 to E5', () => {
    expect(pointToCoord(p(4, 4), 9)).toBe('E5');
  });

  it('handles the I-skip correctly (column 8 = J, not I)', () => {
    // ABCDEFGH J KLMNOPQRST (no I)
    // Index:   0123456789...
    // Column index 8 should be 'J'
    expect(pointToCoord(p(8, 0), 9)).toBe('J9');
  });

  it('converts (18,0) on 19x19 to T19', () => {
    expect(pointToCoord(p(18, 0), 19)).toBe('T19');
  });

  it('converts column 7 to H (before I-skip)', () => {
    expect(pointToCoord(p(7, 0), 9)).toBe('H9');
  });
});

describe('coordToPoint', () => {
  it('parses A1 on 9x9 correctly', () => {
    expect(coordToPoint('A1', 9)).toEqual(p(0, 8));
  });

  it('parses A9 on 9x9 correctly', () => {
    expect(coordToPoint('A9', 9)).toEqual(p(0, 0));
  });

  it('parses E5 on 9x9 correctly', () => {
    expect(coordToPoint('E5', 9)).toEqual(p(4, 4));
  });

  it('parses J9 on 9x9 correctly (I-skip)', () => {
    expect(coordToPoint('J9', 9)).toEqual(p(8, 0));
  });

  it('parses T19 on 19x19 correctly', () => {
    expect(coordToPoint('T19', 19)).toEqual(p(18, 0));
  });

  it('handles lowercase input', () => {
    expect(coordToPoint('a1', 9)).toEqual(p(0, 8));
    expect(coordToPoint('e5', 9)).toEqual(p(4, 4));
  });

  it('returns null for invalid coords', () => {
    expect(coordToPoint('', 9)).toBeNull();
    expect(coordToPoint('Z', 9)).toBeNull();
    expect(coordToPoint('A0', 9)).toBeNull();    // row 0 invalid
    expect(coordToPoint('A10', 9)).toBeNull();   // row 10 invalid for 9x9
    expect(coordToPoint('I5', 9)).toBeNull();    // I is skipped
  });

  it('returns null for out-of-range column', () => {
    // On 9x9, columns go A-J (skipping I), so K should be invalid
    expect(coordToPoint('K1', 9)).toBeNull();
  });
});

describe('round-trip: pointToCoord -> coordToPoint', () => {
  it('is identity for various points on 9x9', () => {
    const size = 9 as const;
    const points = [p(0, 0), p(4, 4), p(8, 0), p(0, 8), p(8, 8), p(3, 6)];
    for (const pt of points) {
      const coord = pointToCoord(pt, size);
      const roundTripped = coordToPoint(coord, size);
      expect(roundTripped).toEqual(pt);
    }
  });

  it('is identity for all points on 9x9', () => {
    const size = 9 as const;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const pt = p(x, y);
        const coord = pointToCoord(pt, size);
        const roundTripped = coordToPoint(coord, size);
        expect(roundTripped).toEqual(pt);
      }
    }
  });
});

describe('boardToText', () => {
  it('empty board produces grid with dots', () => {
    const state = createGame(9);
    const text = boardToText(state);
    // Should contain column headers A-J (skipping I)
    expect(text).toContain('A B C D E F G H J');
    // Should contain row numbers 9 down to 1
    expect(text).toContain(' 9 ');
    expect(text).toContain(' 1 ');
    // Should contain dots for empty cells
    expect(text).toContain('. . . . . . . . .');
  });

  it('board with black stone shows marker on last move', () => {
    const state = createGame(9);
    const r = playMove(state, p(4, 4));
    if (!r.success) throw new Error('expected success');
    const text = boardToText(r.newState);
    // Last move at (4,4) by black should show star
    expect(text).toContain('\u2605'); // ★
  });

  it('board with white stone shows marker on last move', () => {
    let state = createGame(9);
    let r: any;
    r = playMove(state, p(0, 0)); state = r.newState;
    r = playMove(state, p(4, 4)); state = r.newState;
    const text = boardToText(state);
    // Last move at (4,4) by white should show ☆
    expect(text).toContain('\u2606'); // ☆
    // First move at (0,0) by black should show ● (not ★ since it's not the last move)
    expect(text).toContain('\u25CF'); // ●
  });

  it('shows correct column letters skipping I', () => {
    const state = createGame(9);
    const text = boardToText(state);
    // 9 columns: A B C D E F G H J (no I)
    expect(text).toContain('A B C D E F G H J');
    expect(text).not.toMatch(/\bI\b/); // I should not appear as a column
  });

  it('shows correct row numbers for 9x9', () => {
    const state = createGame(9);
    const text = boardToText(state);
    const lines = text.split('\n');
    // Find lines that start with row numbers
    const rowLines = lines.filter(l => l.match(/^\s*\d+\s/));
    expect(rowLines).toHaveLength(9);
    // First row should be 9, last should be 1
    expect(rowLines[0].trim()).toMatch(/^9\s/);
    expect(rowLines[8].trim()).toMatch(/^1\s/);
  });
});
