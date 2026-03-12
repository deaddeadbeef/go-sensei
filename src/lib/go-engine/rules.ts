import type { BoardState, GameState, Point, StoneColor } from './types';
import {
  getAdjacentPoints,
  getStone,
  isOnBoard,
  pointEquals,
  setStone,
} from './board';
import { getGroup } from './groups';
import { wouldHaveLiberties } from './liberties';

/**
 * Checks whether placing a stone at `point` is a valid move in the current
 * game state. Validates:
 *   1. Point is on the board
 *   2. Point is empty
 *   3. Not the ko point
 *   4. Not suicide
 */
export function isValidMove(state: GameState, point: Point): boolean {
  const { board, koPoint, currentPlayer } = state;

  // 1. Must be on the board
  if (!isOnBoard(board, point)) return false;

  // 2. Must be empty
  if (getStone(board, point) !== null) return false;

  // 3. Must not be the ko point
  if (koPoint && pointEquals(koPoint, point)) return false;

  // 4. Must not be suicide
  if (isSuicide(board, point, currentPlayer)) return false;

  return true;
}

/**
 * After placing a stone of `color` at `point`, returns all enemy stones
 * that would be captured (groups with 0 liberties).
 */
export function findCaptures(
  board: BoardState,
  point: Point,
  color: StoneColor
): Point[] {
  const opponent: StoneColor = color === 'black' ? 'white' : 'black';
  const captured: Point[] = [];
  const seen = new Set<string>();

  // Place the stone temporarily to evaluate captures
  const tempBoard = setStone(board, point, color);

  for (const adj of getAdjacentPoints(tempBoard, point)) {
    if (getStone(tempBoard, adj) !== opponent) continue;

    const group = getGroup(tempBoard, adj);
    if (!group) continue;

    // Check if this group has 0 liberties
    if (group.liberties.length === 0) {
      for (const stone of group.stones) {
        const key = `${stone.x},${stone.y}`;
        if (!seen.has(key)) {
          seen.add(key);
          captured.push(stone);
        }
      }
    }
  }

  return captured;
}

/**
 * Removes captured stones from the board, returning a new board.
 */
export function applyCaptures(board: BoardState, captures: Point[]): BoardState {
  let result = board;
  for (const point of captures) {
    result = setStone(result, point, null);
  }
  return result;
}

/**
 * Detects simple ko. If exactly 1 stone was captured and the capturing stone
 * sits alone (no friendly neighbors), the captured position becomes the ko
 * point for the next turn.
 */
export function detectKo(
  prevBoard: BoardState,
  newBoard: BoardState,
  captures: Point[]
): Point | null {
  if (captures.length !== 1) return null;

  // The ko point is the position of the single captured stone
  return captures[0];
}

/**
 * Determines whether placing `color` at `point` would be suicide.
 * A move is suicide if:
 *   1. The placed stone would have 0 liberties, AND
 *   2. It doesn't capture any enemy stones, AND
 *   3. It doesn't connect to any friendly group that still has liberties
 *
 * `wouldHaveLiberties` already accounts for all three conditions:
 * it checks direct liberties, friendly connections, and enemy captures.
 */
export function isSuicide(
  board: BoardState,
  point: Point,
  color: StoneColor
): boolean {
  return !wouldHaveLiberties(board, point, color);
}
