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
  return `The student placed their first stone.

${formatGameStateForAI(game)}

Comment on their opening choice — is it a standard opening point? If not, say so. Then make your responding move.`;
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
  return `The student has been staring at the board without moving. They seem stuck.

${formatGameStateForAI(game)}

Use suggest_moves to show them 2-3 reasonable options. Don't coddle them — just show the moves and briefly explain why each is worth considering.`;
}

/**
 * Formats a message when the student passes their turn.
 */
/**
 * Formats a request for full game review after the game ends.
 */
export function formatReviewRequest(game: GameState): string {
  const boardText = boardToText(game);
  const moveCount = game.moveHistory.length;

  const moveLog = game.moveHistory.map((move, i) => {
    if (move.type === 'place') {
      const coord = pointToCoord(move.point, game.board.size);
      return `${i + 1}. ${move.color === 'black' ? '●' : '○'} ${coord}${move.captured.length > 0 ? ` (captured ${move.captured.length})` : ''}`;
    }
    return `${i + 1}. ${move.color} passes`;
  }).join('\n');

  return `GAME REVIEW REQUEST

The game is over. Here is the final board state:
${boardText}

Full move history (${moveCount} moves):
${moveLog}

Review this game. I want:
1. The student's 3-5 worst mistakes (with move numbers and what should have been played instead)
2. The student's 1-3 best moves (genuinely good ones, not just "okay")
3. Overall assessment: what concepts the student needs to work on
4. A letter grade for the game (A through F)

Use highlight_positions to visually show the critical moments. Be brutally honest.`;
}

/**
 * Formats a message when the student passes their turn.
 */
export function formatPassMessage(game: GameState): string {
  return `The student passed their turn.

${formatGameStateForAI(game)}

Decide whether to pass as well (ending the game for scoring) or explain why there are still important moves to make.`;
}
