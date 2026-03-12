import type { BoardSize, BoardState, Point, StoneColor } from '@/lib/go-engine';
import { createBoard, setStone } from '@/lib/go-engine';

/**
 * Sets up a board with specific stones placed on it.
 */
export function setupBoard(
  size: BoardSize,
  stones: { point: Point; color: StoneColor }[]
): BoardState {
  let board = createBoard(size);
  for (const { point, color } of stones) {
    board = setStone(board, point, color);
  }
  return board;
}

/** Shorthand for creating a point. */
export function p(x: number, y: number): Point {
  return { x, y };
}

/** Shorthand for black stone placement descriptor. */
export function black(x: number, y: number): { point: Point; color: StoneColor } {
  return { point: p(x, y), color: 'black' };
}

/** Shorthand for white stone placement descriptor. */
export function white(x: number, y: number): { point: Point; color: StoneColor } {
  return { point: p(x, y), color: 'white' };
}
