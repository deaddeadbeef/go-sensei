import type { BoardState, Group, Point } from './types';
import { getAdjacentPoints, getStone, pointKey } from './board';

/**
 * Flood-fills from a stone to find the complete group (connected stones of the
 * same color) and its liberties. Returns null if the point is empty.
 */
export function getGroup(board: BoardState, point: Point): Group | null {
  const color = getStone(board, point);
  if (color === null) return null;

  const stones: Point[] = [];
  const liberties: Point[] = [];
  const visitedStones = new Set<string>();
  const visitedLiberties = new Set<string>();
  const queue: Point[] = [point];
  visitedStones.add(pointKey(point));

  while (queue.length > 0) {
    const current = queue.pop()!;
    stones.push(current);

    for (const adj of getAdjacentPoints(board, current)) {
      const key = pointKey(adj);
      const adjColor = getStone(board, adj);

      if (adjColor === null) {
        // Empty — it's a liberty
        if (!visitedLiberties.has(key)) {
          visitedLiberties.add(key);
          liberties.push(adj);
        }
      } else if (adjColor === color && !visitedStones.has(key)) {
        // Same color — part of the group
        visitedStones.add(key);
        queue.push(adj);
      }
      // Opposite color — ignore (not a liberty, not same group)
    }
  }

  return { color, stones, liberties };
}

/**
 * Finds all distinct groups on the board.
 */
export function getAllGroups(board: BoardState): Group[] {
  const visited = new Set<string>();
  const groups: Group[] = [];

  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      const key = pointKey({ x, y });
      if (visited.has(key)) continue;

      const cell = board.grid[y][x];
      if (cell === null) continue;

      const group = getGroup(board, { x, y });
      if (group) {
        groups.push(group);
        for (const stone of group.stones) {
          visited.add(pointKey(stone));
        }
      }
    }
  }

  return groups;
}

/**
 * Alias for getGroup — more descriptive name.
 */
export function getGroupAt(board: BoardState, point: Point): Group | null {
  return getGroup(board, point);
}
