import type { TeachingLevel } from '@/lib/ai/system-prompt';
import {
  formatObjectiveTargetText,
  getBeginnerObjective,
} from '@/lib/coaching/beginner-objectives';
import { getBeginnerObjectiveActions } from '@/lib/coaching/beginner-objective-actions';
import {
  getStone,
  isOnBoard,
  isSuicide,
  pointEquals,
  pointKey,
  pointToCoord,
} from '@/lib/go-engine';
import type { BoardSize, GameState, Point } from '@/lib/go-engine';
import type { SenseiAction } from '@/lib/coaching/sensei-actions';
import type { LocalBoardFocus, LocalSuggestionFocus } from '@/lib/coaching/local-question-answer';

export interface IllegalMoveFeedback {
  text: string;
  conceptIds: string[];
  boardFocus: LocalBoardFocus;
  actions?: SenseiAction[];
}

function uniqueConceptIds(conceptIds: string[]): string[] {
  return [...new Set(conceptIds)];
}

function suggestionReason(objectiveId: string, point: Point, boardSize: BoardSize): string {
  const coord = pointToCoord(point, boardSize);

  if (objectiveId === 'claim-corner') {
    return `Start at ${coord}: the board edge helps this stone make territory.`;
  }

  if (objectiveId === 'extend-from-stone') {
    return `Try ${coord} as a one-space jump that works with your stones.`;
  }

  return `Give your group room by playing its liberty at ${coord}.`;
}

function buildObjectiveSuggestions(game: GameState, teachingLevel: TeachingLevel): {
  conceptIds: string[];
  line: string | null;
  suggestions: LocalSuggestionFocus[];
  actions: SenseiAction[];
} {
  if (game.phase !== 'playing') {
    return { conceptIds: [], line: null, suggestions: [], actions: [] };
  }

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: game.currentPlayer,
    teachingLevel,
  });

  if (!objective) {
    return { conceptIds: [], line: null, suggestions: [], actions: [] };
  }

  const targetText = formatObjectiveTargetText(objective, game.board.size);

  return {
    conceptIds: objective.conceptIds,
    line: `For the current beginner goal, play a legal target: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`,
    suggestions: objective.targetPoints.slice(0, 4).map((target, index) => ({
      id: `illegal-move-target-${pointKey(target)}`,
      point: { x: target.x, y: target.y },
      rank: index + 1,
      reason: suggestionReason(objective.id, target, game.board.size),
    })),
    actions: getBeginnerObjectiveActions(objective),
  };
}

export function getIllegalMoveFeedback(
  game: GameState,
  point: Point,
  teachingLevel: TeachingLevel,
): IllegalMoveFeedback | null {
  if (!isOnBoard(game.board, point)) return null;

  const coord = pointToCoord(point, game.board.size);
  const objective = buildObjectiveSuggestions(game, teachingLevel);
  const lines: string[] = [];
  const conceptIds: string[] = [];
  const highlights: LocalBoardFocus['highlights'] = [];
  const occupant = getStone(game.board, point);

  if (occupant) {
    const stoneName = occupant === 'black' ? 'Black' : 'White';
    lines.push(`${coord} already has a ${stoneName} stone, so you cannot play there.`);
    lines.push('Go stones stay fixed once placed; choose an empty intersection instead.');
    conceptIds.push('stones-and-board');
    highlights.push({
      id: `illegal-occupied-${pointKey(point)}`,
      point: { x: point.x, y: point.y },
      variant: 'warning',
      label: `${coord} is occupied by ${stoneName}.`,
    });
  } else if (game.koPoint && pointEquals(game.koPoint, point)) {
    lines.push(`${coord} is the ko point, so you cannot immediately play there.`);
    lines.push('That recapture would recreate the previous board position. Play a ko threat elsewhere first, then come back if the opponent answers.');
    conceptIds.push('ko');
    highlights.push({
      id: `illegal-ko-${pointKey(point)}`,
      point: { x: point.x, y: point.y },
      variant: 'danger',
      label: `${coord} is forbidden by ko right now.`,
    });
  } else if (isSuicide(game.board, point, game.currentPlayer)) {
    lines.push(`${coord} would have no liberties and would not capture anything, so it is suicide.`);
    lines.push('A legal Go move must leave the new stone or its connected group with breathing room.');
    conceptIds.push('liberties', 'groups', 'capture');
    highlights.push({
      id: `illegal-suicide-${pointKey(point)}`,
      point: { x: point.x, y: point.y },
      variant: 'danger',
      label: `${coord} has no liberties.`,
    });
  } else {
    lines.push(`${coord} is not a legal move in this position.`);
    lines.push('Choose an empty point that is not forbidden by ko and leaves your stones with liberties.');
    conceptIds.push('stones-and-board', 'ko', 'liberties');
    highlights.push({
      id: `illegal-generic-${pointKey(point)}`,
      point: { x: point.x, y: point.y },
      variant: 'warning',
      label: `${coord} is not legal right now.`,
    });
  }

  if (objective.line) {
    lines.push(objective.line);
  }

  if (objective.suggestions.length > 0) {
    lines.push('I marked the legal targets again.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds([...conceptIds, ...objective.conceptIds]),
    boardFocus: {
      highlights,
      ...(objective.suggestions.length > 0 ? { suggestions: objective.suggestions } : {}),
    },
    ...(objective.actions.length > 0 ? { actions: objective.actions } : {}),
  };
}
