import {
  createGame,
  playMove,
  passMove,
  boardHash,
} from '@/lib/go-engine';
import type { CellState, GameState } from '@/lib/go-engine/types';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCellState(value: unknown): value is CellState {
  return value === 'black' || value === 'white' || value === null;
}

export function applyBoardSnapshot(state: GameState, boardSnapshot: unknown): GameState {
  if (!isRecord(boardSnapshot) || boardSnapshot.size !== state.board.size || !Array.isArray(boardSnapshot.grid)) {
    return state;
  }

  const grid: CellState[][] = [];
  for (const row of boardSnapshot.grid) {
    if (!Array.isArray(row) || row.length !== state.board.size || !row.every(isCellState)) {
      return state;
    }
    grid.push([...row]);
  }

  if (grid.length !== state.board.size) {
    return state;
  }

  const board = { size: state.board.size, grid };
  const positionHistory = new Set([boardHash(board)]);

  return {
    ...state,
    board,
    positionHistory,
  };
}

/**
 * Reconstructs a GameState by replaying a move history from scratch.
 * Used to rebuild server-side state from the client-provided move list.
 */
export function reconstructGame(
  moves: { type: string; x?: number; y?: number; color?: string }[],
  size: 9 | 13 | 19 = 9,
  komi: number = 6.5,
): GameState {
  let game = createGame(size, komi);
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move.type === 'place' && move.x !== undefined && move.y !== undefined) {
      const result = playMove(game, { x: move.x, y: move.y });
      if (!result.success) {
        throw new Error(`Invalid move at index ${i}: (${move.x},${move.y}) — ${result.reason}`);
      }
      game = result.newState;
    } else if (move.type === 'pass') {
      game = passMove(game);
    }
  }
  return game;
}
