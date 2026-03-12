import {
  createGame,
  playMove,
  passMove,
} from '@/lib/go-engine';
import type { GameState } from '@/lib/go-engine/types';

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
  for (const move of moves) {
    if (move.type === 'place' && move.x !== undefined && move.y !== undefined) {
      const result = playMove(game, { x: move.x, y: move.y });
      if (result.success) game = result.newState;
    } else if (move.type === 'pass') {
      game = passMove(game);
    }
  }
  return game;
}
