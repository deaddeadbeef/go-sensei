import type { GameState } from '@/lib/go-engine/types';
import { boardToText, pointToCoord } from '@/lib/go-engine';

/**
 * Formats the full game state as a text block for AI consumption.
 * Includes the board diagram, recent move history, and optional player message.
 */
export function formatGameStateForAI(game: GameState, playerMessage?: string): string {
  const boardText = boardToText(game);
  const moveCount = game.moveHistory.length;

  const parts: string[] = [];

  parts.push(boardText);
  parts.push('');

  // Last few moves for context
  if (moveCount > 0) {
    const recentMoves = game.moveHistory.slice(-5);
    const moveStrings = recentMoves.map((move, i) => {
      const moveNum = moveCount - recentMoves.length + i + 1;
      if (move.type === 'place') {
        const coord = pointToCoord(move.point, game.board.size);
        return `${moveNum}. ${move.color === 'black' ? '●' : '○'} ${coord}${move.captured.length > 0 ? ` (captured ${move.captured.length})` : ''}`;
      }
      return `${moveNum}. ${move.color} passes`;
    });
    parts.push('Recent moves: ' + moveStrings.join(', '));
  }

  // Game phase info
  if (game.phase === 'scoring') {
    parts.push('The game has entered scoring phase (both players passed).');
  }

  // Player message
  if (playerMessage) {
    parts.push('');
    parts.push(`Student says: "${playerMessage}"`);
  }

  return parts.join('\n');
}

/**
 * Formats the AI message for the very first move of a new game.
 */
export function formatFirstMoveMessage(game: GameState): string {
  return `The student has just started their first game of Go. They placed their first stone.

${formatGameStateForAI(game)}

This is their very first Go game. Welcome them warmly, explain what their stone does on the board (it claims space and intersections), and make your responding move. Keep it simple and encouraging.`;
}

/**
 * Formats a message after the student plays a move (move 2+).
 */
export function formatMoveMessage(
  game: GameState,
  wasCapture: boolean,
  capturedCount: number,
  playerMessage?: string,
): string {
  const moveNum = game.moveHistory.length;
  const lastMove = game.moveHistory[game.moveHistory.length - 1];

  let context = `The student played move ${moveNum}.`;

  if (lastMove?.type === 'place') {
    const coord = pointToCoord(lastMove.point, game.board.size);
    context += ` They placed ${lastMove.color} at ${coord}.`;
  }

  if (wasCapture) {
    context += ` This move captured ${capturedCount} stone${capturedCount !== 1 ? 's' : ''}!`;
  }

  context += '\n\n' + formatGameStateForAI(game, playerMessage);

  return context;
}

/**
 * Formats a message when the student seems stuck (hesitation detection).
 */
export function formatHesitationMessage(game: GameState): string {
  return `The student seems stuck and hasn't made a move for a while. They might not know where to play.

${formatGameStateForAI(game)}

Offer gentle encouragement and use suggest_moves to show them 2-3 good options. Be supportive, not pushy.`;
}

/**
 * Formats a message when the student passes their turn.
 */
export function formatPassMessage(game: GameState): string {
  return `The student passed their turn.

${formatGameStateForAI(game)}

Decide whether to pass as well (ending the game for scoring) or explain why there are still important moves to make.`;
}
