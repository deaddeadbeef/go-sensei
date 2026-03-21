import type { BoardState, Point } from './types';

/**
 * Distance-based influence computation.
 * Each stone radiates influence that decays with Manhattan distance.
 * Returns normalized values: negative = black influence, positive = white influence.
 */
export function computeInfluence(board: BoardState): { point: Point; value: number }[] {
  const size = board.size;
  const grid: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const DECAY = 0.5;
  const MAX_DIST = 6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = board.grid[y]?.[x];
      if (color == null) continue;
      const sign = color === 'black' ? -1 : 1;
      for (let dy = -MAX_DIST; dy <= MAX_DIST; dy++) {
        for (let dx = -MAX_DIST; dx <= MAX_DIST; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist > MAX_DIST) continue;
          grid[ny][nx] += sign * Math.pow(DECAY, dist);
        }
      }
    }
  }

  const maxAbs = Math.max(...grid.flat().map(Math.abs), 0.001);
  const result: { point: Point; value: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const norm = grid[y][x] / maxAbs;
      if (Math.abs(norm) > 0.05) {
        result.push({ point: { x, y }, value: Math.max(-1, Math.min(1, norm)) });
      }
    }
  }
  return result;
}
