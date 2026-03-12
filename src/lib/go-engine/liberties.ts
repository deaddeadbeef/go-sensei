import type { BoardState, Point, StoneColor } from './types';
import { getAdjacentPoints, getStone, setStone, pointKey } from './board';
import { getGroup } from './groups';

/**
 * Counts the liberties of the group at the given point.
 * Returns 0 if the point is empty.
 */
export function countLiberties(board: BoardState, point: Point): number {
  const group = getGroup(board, point);
  if (!group) return 0;
  return group.liberties.length;
}

/**
 * Returns true if the group at the point has exactly 1 liberty (atari).
 */
export function isInAtari(board: BoardState, point: Point): boolean {
  return countLiberties(board, point) === 1;
}

/**
 * Returns the liberty positions of the group at the given point.
 */
export function getLibertiesOf(board: BoardState, point: Point): Point[] {
  const group = getGroup(board, point);
  if (!group) return [];
  return group.liberties;
}

/**
 * Checks whether placing `color` at `point` would result in the stone/group
 * having at least one liberty. Used for suicide detection.
 *
 * A stone has liberties after placement if:
 * 1. Any adjacent point is empty (direct liberty), OR
 * 2. It connects to a friendly group that would still have ≥1 liberty
 *    after the placement (the group had ≥2 liberties before, since the
 *    placed stone fills one), OR
 * 3. It captures at least one enemy group (freeing liberties).
 */
export function wouldHaveLiberties(
  board: BoardState,
  point: Point,
  color: StoneColor
): boolean {
  const opponent: StoneColor = color === 'black' ? 'white' : 'black';

  for (const adj of getAdjacentPoints(board, point)) {
    const adjColor = getStone(board, adj);

    if (adjColor === null) {
      // Direct liberty — definitely has liberties
      return true;
    }

    if (adjColor === color) {
      // Friendly group: would it still have liberties?
      // The placed stone fills one liberty of this group, so it needs ≥2 now.
      const group = getGroup(board, adj);
      if (group && group.liberties.length >= 2) {
        return true;
      }
    }

    if (adjColor === opponent) {
      // Enemy group: would it be captured? (has exactly 1 liberty = our point)
      const group = getGroup(board, adj);
      if (group && group.liberties.length === 1) {
        // This enemy group is captured, freeing liberties
        return true;
      }
    }
  }

  return false;
}
