import type { BoardState, Point, StoneColor, TerritoryResult } from './types';
import { getAdjacentPoints, getStone, pointKey } from './board';

/**
 * Calculates territory using Chinese scoring rules.
 * Score = territory + stones on board. Komi added to white.
 */
export function calculateTerritory(board: BoardState, komi: number = 6.5): TerritoryResult {
  const visited = new Set<string>();
  const blackTerritory: Point[] = [];
  const whiteTerritory: Point[] = [];

  // Find all empty regions and determine ownership
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      const point: Point = { x, y };
      const key = pointKey(point);
      if (visited.has(key)) continue;
      if (getStone(board, point) !== null) continue;

      // Flood-fill this empty region
      const { points, adjacentColors } = floodFillEmpty(board, point, visited);

      if (adjacentColors.size === 1) {
        // Region borders only one color — it's that color's territory
        const owner = adjacentColors.values().next().value as StoneColor;
        if (owner === 'black') {
          blackTerritory.push(...points);
        } else {
          whiteTerritory.push(...points);
        }
      }
      // If adjacentColors.size === 0 or 2 → neutral (dame)
    }
  }

  const blackStones = countStones(board, 'black');
  const whiteStones = countStones(board, 'white');

  const blackScore = blackTerritory.length;
  const whiteScore = whiteTerritory.length;

  // Chinese scoring: territory + stones on board
  const finalBlackScore = blackScore + blackStones;
  const finalWhiteScore = whiteScore + whiteStones + komi;

  return {
    blackTerritory,
    whiteTerritory,
    blackScore,
    whiteScore,
    finalBlackScore,
    finalWhiteScore,
  };
}

/**
 * Counts the number of stones of a given color on the board.
 */
export function countStones(board: BoardState, color: StoneColor): number {
  let count = 0;
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      if (board.grid[y][x] === color) count++;
    }
  }
  return count;
}

/**
 * Flood-fills from an empty point, collecting all connected empty points
 * and tracking which stone colors border the region.
 */
export function floodFillEmpty(
  board: BoardState,
  start: Point,
  visited: Set<string>
): { points: Point[]; adjacentColors: Set<StoneColor> } {
  const points: Point[] = [];
  const adjacentColors = new Set<StoneColor>();
  const queue: Point[] = [start];
  visited.add(pointKey(start));

  while (queue.length > 0) {
    const current = queue.pop()!;
    points.push(current);

    for (const adj of getAdjacentPoints(board, current)) {
      const key = pointKey(adj);
      const stone = getStone(board, adj);

      if (stone === null) {
        if (!visited.has(key)) {
          visited.add(key);
          queue.push(adj);
        }
      } else {
        adjacentColors.add(stone);
      }
    }
  }

  return { points, adjacentColors };
}
