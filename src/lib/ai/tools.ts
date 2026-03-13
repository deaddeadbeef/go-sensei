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
