import type { BoardSize, BoardState, CellState, Point } from './types';

/**
 * Creates an empty board of the given size.
 */
export function createBoard(size: BoardSize): BoardState {
  const grid: CellState[][] = [];
  for (let y = 0; y < size; y++) {
    grid.push(new Array<CellState>(size).fill(null));
  }
  return { size, grid };
}

/**
 * Deep-clones a board (new grid arrays, safe to mutate).
 */
export function cloneBoard(board: BoardState): BoardState {
  const grid: CellState[][] = [];
  for (let y = 0; y < board.size; y++) {
    grid.push([...board.grid[y]]);
  }
  return { size: board.size, grid };
}

/**
 * Gets the stone at a point. Returns null if out of bounds or empty.
 */
export function getStone(board: BoardState, point: Point): CellState {
  if (!isOnBoard(board, point)) return null;
  return board.grid[point.y][point.x];
}

/**
 * Returns a NEW board with the stone set at the given point (immutable).
 */
export function setStone(board: BoardState, point: Point, value: CellState): BoardState {
  if (!isOnBoard(board, point)) return board;
  const newBoard = cloneBoard(board);
  newBoard.grid[point.y][point.x] = value;
  return newBoard;
}

/**
 * Checks if a point is within the board boundaries.
 */
export function isOnBoard(board: BoardState, point: Point): boolean {
  return point.x >= 0 && point.x < board.size && point.y >= 0 && point.y < board.size;
}

/**
 * Returns adjacent points (up/down/left/right) that are on the board.
 */
export function getAdjacentPoints(board: BoardState, point: Point): Point[] {
  const deltas: [number, number][] = [
    [0, -1], // up
    [0, 1],  // down
    [-1, 0], // left
    [1, 0],  // right
  ];
  const result: Point[] = [];
  for (const [dx, dy] of deltas) {
    const adj: Point = { x: point.x + dx, y: point.y + dy };
    if (isOnBoard(board, adj)) {
      result.push(adj);
    }
  }
  return result;
}

/**
 * Checks coordinate equality of two points.
 */
export function pointEquals(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Converts a point to a string key for use in Sets/Maps.
 */
export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

/**
 * Produces a hash string of the board position for ko/superko detection.
 */
export function boardHash(board: BoardState): string {
  let hash = '';
  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      const cell = board.grid[y][x];
      hash += cell === 'black' ? 'B' : cell === 'white' ? 'W' : '.';
    }
  }
  return hash;
}
