import { getGroup, pointToCoord } from '@/lib/go-engine';
import type { GameState, Move, Point } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';

export interface LocalQuestionAnswer {
  text: string;
  conceptIds: string[];
}

function isLocalAnswerLevel(teachingLevel: TeachingLevel): boolean {
  return teachingLevel === 'guided' || teachingLevel === 'beginner';
}

function lastPlacedMove(game: GameState): Extract<Move, { type: 'place' }> | null {
  for (let index = game.moveHistory.length - 1; index >= 0; index -= 1) {
    const move = game.moveHistory[index];
    if (move.type === 'place') return move;
  }

  return null;
}

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function describeCurrentLiberties(game: GameState, point: Point): string | null {
  const group = getGroup(game.board, point);
  if (!group) return null;

  const anchor = pointToCoord(point, game.board.size);
  const libertyCoords = group.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const libertyWord = group.liberties.length === 1 ? 'liberty' : 'liberties';

  return `Your group at ${anchor} currently has ${group.liberties.length} ${libertyWord}: ${joinList(libertyCoords)}.`;
}

function normalizedQuestion(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
}

export function getLocalQuestionAnswer(
  question: string,
  game: GameState,
  teachingLevel: TeachingLevel,
): LocalQuestionAnswer | null {
  if (!isLocalAnswerLevel(teachingLevel)) return null;

  const q = normalizedQuestion(question);
  const lastMove = lastPlacedMove(game);

  if (/\blibert(y|ies)\b/.test(q) || q.includes('breathing room')) {
    const context = lastMove ? ` ${describeCurrentLiberties(game, lastMove.point) ?? ''}` : '';
    return {
      text: `A liberty is an empty point directly next to a stone or connected group. Diagonals do not count.${context} When all liberties are filled by the opponent, that group is captured.`,
      conceptIds: ['liberties', 'groups', 'capture'],
    };
  }

  if (q.includes('atari')) {
    return {
      text: 'Atari means a stone or group has exactly one liberty left. Treat it like an alarm: either save your group by adding a liberty or capture the attacking stones first.',
      conceptIds: ['atari', 'liberties', 'capture'],
    };
  }

  if (q.includes('capture') || q.includes('capturing')) {
    return {
      text: 'To capture, fill every liberty of one connected enemy group. Count the empty points directly touching that group, then play the final one when it cannot escape.',
      conceptIds: ['capture', 'liberties', 'groups'],
    };
  }

  if (q.includes('territory')) {
    return {
      text: 'Territory is empty space your stones surround well enough that the opponent cannot safely live inside. Beginners should start with corners and edges because the board edge helps form the border.',
      conceptIds: ['territory', 'corner-opening'],
    };
  }

  if (/\beye(s)?\b/.test(q) || q.includes('life and death')) {
    return {
      text: 'An eye is internal empty space your group controls. A group with two real eyes cannot be captured, because the opponent cannot fill both without playing illegal self-capture.',
      conceptIds: ['eyes', 'life-and-death'],
    };
  }

  if (/\bko\b/.test(q)) {
    return {
      text: 'Ko is the rule that stops both players from immediately repeating the same board position. If a capture would recreate the previous board, you must play somewhere else first.',
      conceptIds: ['ko'],
    };
  }

  if (q.includes('ladder')) {
    return {
      text: 'A ladder is a forcing chase where every move puts the running stones back into atari. Before starting one, read the path to the edge and check whether another stone breaks the chase.',
      conceptIds: ['ladder', 'reading', 'atari'],
    };
  }

  return null;
}
