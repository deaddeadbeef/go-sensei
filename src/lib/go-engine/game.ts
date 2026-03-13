import type { BoardSize, GameState, Move, PlayResult, Point, StoneColor } from './types';
import { createBoard, setStone, boardHash } from './board';
import { findCaptures, applyCaptures, detectKo, isValidMove } from './rules';
import { calculateTerritory } from './scoring';

/**
 * Creates a new game with default settings.
 */
export function createGame(size: BoardSize = 9, komi: number = 6.5): GameState {
  const board = createBoard(size);
  const positionHistory = new Set<string>();
  positionHistory.add(boardHash(board));

  return {
    board,
    currentPlayer: 'black',
    moveHistory: [],
    captures: { black: 0, white: 0 },
    koPoint: null,
    consecutivePasses: 0,
    phase: 'playing',
    komi,
    winner: null,
    positionHistory,
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

  // 4. Superko check
  const hash = boardHash(newBoard);
  const newHistory = new Set(state.positionHistory);
  if (newHistory.has(hash)) {
    return { success: false, reason: 'Superko violation' };
  }
  newHistory.add(hash);

  // 5. Build the move record
  const move: Move = { type: 'place', point, color, captured };

  // 6. Update captures count
  const newCaptures = { ...state.captures };
  newCaptures[color] += captured.length;

  // 7. Build new state
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
    positionHistory: newHistory,
  };

  return { success: true, newState, captured };
}

/**
 * Pass the current player's turn.
 * Two consecutive passes move the game to 'scoring' phase.
 */
export function passMove(state: GameState): GameState {
  if (state.phase !== 'playing') return state;

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
    positionHistory: state.positionHistory,
  };
}

/**
 * Resign the game. The opponent wins.
 */
export function resignGame(state: GameState): GameState {
  if (state.phase !== 'playing') return state;

  const move: Move = { type: 'resign', color: state.currentPlayer };

  return {
    ...state,
    moveHistory: [...state.moveHistory, move],
    phase: 'finished',
    winner: getOpponent(state.currentPlayer),
    positionHistory: state.positionHistory,
  };
}

/**
 * Undoes the last move using stored captured stones (O(1) reverse).
 * Returns null if there are no moves to undo.
 */
export function undoMove(state: GameState): GameState | null {
  if (state.moveHistory.length === 0) return null;

  const lastMove = state.moveHistory[state.moveHistory.length - 1];
  const newMoveHistory = state.moveHistory.slice(0, -1);

  if (lastMove.type === 'place') {
    // Remove the placed stone
    let newBoard = setStone(state.board, lastMove.point, null);
    // Restore captured stones
    for (const cap of lastMove.captured) {
      newBoard = setStone(newBoard, cap, getOpponent(lastMove.color));
    }
    // Remove from position history
    const newHistory = new Set(state.positionHistory);
    newHistory.delete(boardHash(state.board));

    return {
      board: newBoard,
      currentPlayer: lastMove.color,
      moveHistory: newMoveHistory,
      captures: {
        ...state.captures,
        [lastMove.color]: state.captures[lastMove.color] - lastMove.captured.length,
      },
      koPoint: null,
      consecutivePasses: 0,
      phase: 'playing',
      komi: state.komi,
      winner: null,
      positionHistory: newHistory,
    };
  } else if (lastMove.type === 'pass') {
    // Calculate what consecutivePasses was before this pass
    let prevPasses = 0;
    for (let i = newMoveHistory.length - 1; i >= 0; i--) {
      if (newMoveHistory[i].type === 'pass') prevPasses++;
      else break;
    }
    return {
      ...state,
      currentPlayer: lastMove.color,
      moveHistory: newMoveHistory,
      consecutivePasses: prevPasses,
      phase: 'playing',
      winner: null,
    };
  }
  // resign — can't undo
  return null;
}

/**
 * Finishes the game from scoring phase, determining the winner.
 */
export function finishGame(state: GameState, deadStones: Point[] = []): GameState {
  if (state.phase !== 'scoring') return state;

  const territory = calculateTerritory(state.board, state.komi, deadStones);
  const winner = territory.finalBlackScore > territory.finalWhiteScore ? 'black' as const
    : territory.finalWhiteScore > territory.finalBlackScore ? 'white' as const
    : 'draw' as const;

  return {
    ...state,
    phase: 'finished',
    winner,
  };
}

/**
 * Returns the opposite color.
 */
export function getOpponent(color: StoneColor): StoneColor {
  return color === 'black' ? 'white' : 'black';
}
