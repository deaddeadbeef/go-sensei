import {
  formatObjectiveTargetText,
  getBeginnerObjective,
  getBeginnerObjectiveProgress,
} from '@/lib/coaching/beginner-objectives';
import { getBeginnerObjectiveActions } from '@/lib/coaching/beginner-objective-actions';
import { pointKey, pointToCoord } from '@/lib/go-engine';
import type { BoardSize, GameState, Move, Point } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';
import type { SenseiAction } from '@/lib/coaching/sensei-actions';
import type { LocalBoardFocus, LocalSuggestionFocus } from '@/lib/coaching/local-question-answer';
import type { BeginnerObjective } from '@/lib/coaching/beginner-objectives';

type LocalFallbackReason = 'auth-expired' | 'auth-unavailable' | 'network-error' | 'server-error';

export interface LocalGuidedFallback {
  text: string;
  conceptIds: string[];
  actions: SenseiAction[];
  boardFocus?: LocalBoardFocus;
  shouldPassSensei: boolean;
}

function isLocalFallbackLevel(teachingLevel: TeachingLevel): boolean {
  return teachingLevel === 'guided' || teachingLevel === 'beginner';
}

function lastBlackMove(game: GameState): Move | null {
  for (let i = game.moveHistory.length - 1; i >= 0; i--) {
    const move = game.moveHistory[i];
    if (move.color === 'black') return move;
  }

  return null;
}

function describeLastMove(game: GameState): string {
  const move = lastBlackMove(game);
  if (!move) return 'No move has been played yet.';
  if (move.type === 'pass') return 'You passed. That is fine near the end, but early on it usually gives away practice.';
  if (move.type === 'resign') return 'You resigned, so this game is over.';

  const coord = pointToCoord(move.point, game.board.size);
  if (game.moveHistory.length === 1) {
    return `Your first stone at ${coord} gives us a real board position to learn from.`;
  }

  return `Your last stone was at ${coord}. Use the next move to make that stone part of a plan.`;
}

function introText(reason: LocalFallbackReason): string {
  if (reason === 'auth-expired') {
    return 'The cloud Sensei session expired, so I will keep the lesson moving locally for now.';
  }
  if (reason === 'auth-unavailable') {
    return 'I can teach this beginner path locally, so keep playing on the board.';
  }
  if (reason === 'network-error') {
    return 'I could not reach cloud Sensei, so I will keep the lesson moving locally for now.';
  }
  return 'Cloud Sensei had trouble answering, so I will keep the lesson moving locally for now.';
}

function copyPoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

function suggestionReason(objective: BeginnerObjective, point: Point, boardSize: BoardSize): string {
  const coord = pointToCoord(point, boardSize);

  if (objective.id === 'claim-corner') {
    return `Start at ${coord}: the board edge helps this stone make territory.`;
  }

  if (objective.id === 'extend-from-stone') {
    return `Try ${coord} as a one-space jump that works with your stones.`;
  }

  return `Give your group room by playing its liberty at ${coord}.`;
}

function buildObjectiveBoardFocus(objective: BeginnerObjective, boardSize: BoardSize): LocalBoardFocus | undefined {
  const suggestions: LocalSuggestionFocus[] = objective.targetPoints.slice(0, 4).map((point, index) => ({
    id: `local-fallback-move-${pointKey(point)}`,
    point: copyPoint(point),
    rank: index + 1,
    reason: suggestionReason(objective, point, boardSize),
  }));

  return suggestions.length > 0 ? { suggestions } : undefined;
}

export function getLocalGuidedFallback(
  game: GameState,
  teachingLevel: TeachingLevel,
  reason: LocalFallbackReason,
): LocalGuidedFallback | null {
  if (!isLocalFallbackLevel(teachingLevel)) return null;
  if (game.phase !== 'playing') return null;

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const progress = getBeginnerObjectiveProgress(game, teachingLevel);
  const shouldPassSensei = game.currentPlayer !== 'black';
  const lines = [
    introText(reason),
    progress?.text ?? describeLastMove(game),
  ];

  if (objective) {
    const targetText = formatObjectiveTargetText(objective, game.board.size);
    const targetSentence = targetText ? `${targetText} ` : '';
    lines.push(`Next focus: ${objective.title}. ${objective.instruction} ${targetSentence}${objective.why}`);
  } else {
    lines.push('Next focus: play where your stones gain room, connect, or claim easier territory.');
  }

  if (shouldPassSensei) {
    lines.push('I am passing for White so you can immediately try the next idea.');
  } else {
    lines.push('Use the marked board guidance while the full AI connection is unavailable.');
  }

  return {
    text: lines.join('\n\n'),
    conceptIds: objective?.conceptIds ?? [],
    actions: objective ? getBeginnerObjectiveActions(objective) : [],
    ...(objective ? { boardFocus: buildObjectiveBoardFocus(objective, game.board.size) } : {}),
    shouldPassSensei,
  };
}
