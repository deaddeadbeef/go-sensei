import type { BoardSize, GameState, Move, PlayResult, Point, StoneColor } from './types';
import { createBoard, setStone } from './board';
import { findCaptures, applyCaptures, detectKo, isValidMove } from './rules';

/**
 * Creates a new game with default settings.
 */
export function createGame(size: BoardSize = 19, komi: number = 6.5): GameState {
  return {
    board: createBoard(size),
    currentPlayer: 'black',
    moveHistory: [],
    captures: { black: 0, white: 0 },
    koPoint: null,
    consecutivePasses: 0,
    phase: 'playing',
    komi,
    winner: null,
  };
}

/**
 * Places a stone at the given point. Returns a PlayResult indicating success
 * (with the new state and captured stones) or failure (with a reason string).
 */
export function playMove(state: GameState, point: Point): PlayResult {
  if (state.phase !== 'playing') {
    return { success: false, reason: 'Game is not in playing phase' };
  }

  if (!isValidMove(state, point)) {
    return { success: false, reason: 'Invalid move' };
  }

  const color = state.currentPlayer;

  // 1. Place the stone
  let newBoard = setStone(state.board, point, color);

  // 2. Find and apply captures
  const captured = findCaptures(state.board, point, color);
  if (captured.length > 0) {
    newBoard = applyCaptures(newBoard, captured);
  }

  // 3. Detect ko
  const koPoint = detectKo(state.board, newBoard, captured, point);

  // 4. Build the move record
  const move: Move = { type: 'place', point, color, captured };

  // 5. Update captures count
  const newCaptures = { ...state.captures };
  newCaptures[color] += captured.length;

  // 6. Build new state
  const newState: GameState = {
    board: newBoard,
    currentPlayer: getOpponent(color),
    moveHistory: [...state.moveHistory, move],
    captures: newCaptures,
    koPoint,
    consecutivePasses: 0,
    phase: 'playing',
    komi: state.komi,
    winner: null,
  };

  return { success: true, newState, captured };
}

/**
 * Pass the current player's turn.
 * Two consecutive passes move the game to 'scoring' phase.
 */
export function passMove(state: GameState): GameState {
  const move: Move = { type: 'pass', color: state.currentPlayer };
  const consecutivePasses = state.consecutivePasses + 1;
  const phase = consecutivePasses >= 2 ? 'scoring' : state.phase;

  return {
    ...state,
    currentPlayer: getOpponent(state.currentPlayer),
    moveHistory: [...state.moveHistory, move],
    koPoint: null,
    consecutivePasses,
    phase,
  };
}

/**
 * Resign the game. The opponent wins.
 */
export function resignGame(state: GameState): GameState {
  const move: Move = { type: 'resign', color: state.currentPlayer };

  return {
    ...state,
    moveHistory: [...state.moveHistory, move],
    phase: 'finished',
    winner: getOpponent(state.currentPlayer),
  };
}

/**
 * Undoes the last move by replaying all moves except the last one
 * from a fresh game. Returns null if there are no moves to undo.
 */
export function undoMove(state: GameState): GameState | null {
  if (state.moveHistory.length === 0) return null;

  const movesToReplay = state.moveHistory.slice(0, -1);
  let newState = createGame(state.board.size, state.komi);

  for (const move of movesToReplay) {
    if (move.type === 'place') {
      const result = playMove(newState, move.point);
      if (!result.success) {
        // Should not happen during replay of valid moves
        return null;
      }
      newState = result.newState;
    } else if (move.type === 'pass') {
      newState = passMove(newState);
    }
    // resign can't be replayed (game is over)
  }

  return newState;
}

/**
 * Returns the opposite color.
 */
export function getOpponent(color: StoneColor): StoneColor {
  return color === 'black' ? 'white' : 'black';
}
