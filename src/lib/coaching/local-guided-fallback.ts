import {
  formatObjectiveTargetText,
  getBeginnerObjectiveSuggestionReason,
  getBeginnerObjective,
  getBeginnerObjectiveProgress,
  getFreshAreaFollowUpContext,
} from '@/lib/coaching/beginner-objectives';
import { getBeginnerObjectiveActions } from '@/lib/coaching/beginner-objective-actions';
import { pointEquals, pointKey, pointToCoord } from '@/lib/go-engine';
import type { BoardSize, GameState, Move, Point } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';
import type { SenseiAction } from '@/lib/coaching/sensei-actions';
import type { LocalBoardFocus, LocalSuggestionFocus } from '@/lib/coaching/local-question-answer';
import type { BeginnerObjective, FreshAreaFollowUpContext } from '@/lib/coaching/beginner-objectives';
import { getMoveInsight } from '@/lib/coaching/move-insight';

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
    return 'I can keep coaching from this board, so your practice does not have to stop.';
  }
  if (reason === 'auth-unavailable') {
    return 'I can coach this guided game from the board in front of us.';
  }
  if (reason === 'network-error') {
    return 'I can keep coaching from this board while the connection recovers.';
  }
  return 'I can keep the lesson moving from this board while the tutor recovers.';
}

function copyPoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

function uniqueConceptIds(conceptIds: string[]): string[] {
  return [...new Set(conceptIds)];
}

function joinOrList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} or ${items[1]}`;

  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

function openingCornerTargets(boardSize: BoardSize): Point[] {
  const offset = boardSize === 9 ? 2 : 3;
  const high = boardSize - 1 - offset;

  return [
    { x: offset, y: offset },
    { x: high, y: offset },
    { x: offset, y: high },
    { x: high, y: high },
  ];
}

function cornerDirection(point: Point, boardSize: BoardSize): string {
  const center = (boardSize - 1) / 2;
  const vertical = point.y < center ? 'upper' : 'lower';
  const horizontal = point.x < center ? 'left' : 'right';

  return `${vertical}-${horizontal}`;
}

interface OpeningFollowUp {
  lesson: string;
  nextFocus: string;
  passText: string;
  actions: SenseiAction[];
  boardFocus: LocalBoardFocus;
}

function buildLargeBoardOpeningFollowUp(game: GameState, move: Move | null): OpeningFollowUp | null {
  if (game.board.size === 9) return null;
  if (game.moveHistory.length !== 1 || move?.type !== 'place') return null;

  const openingTargets = openingCornerTargets(game.board.size);
  const playedTarget = openingTargets.find((target) => pointEquals(target, move.point));
  if (!playedTarget) return null;

  const coord = pointToCoord(move.point, game.board.size);
  const remainingTargets = openingTargets.filter((target) => !pointEquals(target, move.point));
  const remainingCoords = remainingTargets.map((target) => pointToCoord(target, game.board.size));

  return {
    lesson: `${coord} starts an ${cornerDirection(move.point, game.board.size)} corner framework.`,
    nextFocus: `Next focus: choose a second corner framework. Try ${joinOrList(remainingCoords)}.`,
    passText: 'I marked your move, gave White a teaching pass, and marked the next corner choices.',
    actions: [{ id: 'lesson:territory', label: 'Review territory' }],
    boardFocus: {
      highlights: [{
        id: `local-fallback-learned-${pointKey(move.point)}`,
        point: copyPoint(move.point),
        variant: 'positive',
        label: `${coord}: first corner framework started.`,
      }],
      suggestions: remainingTargets.map((target, index) => {
        const targetCoord = pointToCoord(target, game.board.size);

        return {
          id: `local-fallback-opening-${game.board.size}-move-${pointKey(target)}`,
          point: copyPoint(target),
          rank: index + 1,
          reason: `Try ${targetCoord} next: another corner gives Black a second easy framework before fighting starts.`,
        };
      }),
    },
  };
}

function buildObjectiveBoardFocus(
  objective: BeginnerObjective,
  boardSize: BoardSize,
  move: Move | null,
  progressStatus: 'met' | 'missed' | null,
  followUpContext?: FreshAreaFollowUpContext | null,
  suppressSuggestions = false,
): LocalBoardFocus | undefined {
  const suggestions: LocalSuggestionFocus[] = suppressSuggestions
    ? []
    : objective.targetPoints.slice(0, 4).map((point, index) => ({
      id: `local-fallback-move-${pointKey(point)}`,
      point: copyPoint(point),
      rank: index + 1,
      reason: getBeginnerObjectiveSuggestionReason(objective, point, boardSize, followUpContext),
    }));
  const highlights = move?.type === 'place'
    ? [{
      id: `local-fallback-learned-${pointKey(move.point)}`,
      point: copyPoint(move.point),
      variant: progressStatus === 'missed' ? 'warning' as const : progressStatus === 'met' ? 'positive' as const : 'neutral' as const,
      label: `${pointToCoord(move.point, boardSize)}: move to learn from${progressStatus === 'met' ? ' - beginner job met' : progressStatus === 'missed' ? ' - beginner job missed' : ''}.`,
    }]
    : [];

  if (highlights.length === 0 && suggestions.length === 0) return undefined;

  return {
    ...(highlights.length > 0 ? { highlights } : {}),
    ...(suggestions.length > 0 ? { suggestions } : {}),
  };
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
  const insight = getMoveInsight(game, teachingLevel);
  const move = lastBlackMove(game);
  const shouldPassSensei = game.currentPlayer !== 'black';
  const openingFollowUp = buildLargeBoardOpeningFollowUp(game, move);
  const followUpContext = objective ? getFreshAreaFollowUpContext(game, teachingLevel, objective) : null;
  const shouldPrioritizePendingPressureRead = Boolean(
    objective?.id === 'choose-new-area'
    && progress?.status === 'met'
    && progress.objectiveId === 'extend-from-stone',
  );
  const lines = [
    introText(reason),
    progress?.text ?? describeLastMove(game),
  ];

  if (insight) {
    lines.push(`Lesson: ${insight.observation}`);
  }
  if (openingFollowUp) {
    lines.push(openingFollowUp.lesson);
  }

  if (shouldPrioritizePendingPressureRead && insight) {
    lines.push(`Next focus: ${insight.nextStep}`);
  } else if (openingFollowUp) {
    lines.push(openingFollowUp.nextFocus);
  } else if (objective) {
    const targetText = formatObjectiveTargetText(objective, game.board.size, 4, followUpContext);
    const targetSentence = targetText ? `${targetText} ` : '';
    lines.push(`Next focus: ${objective.title}. ${objective.instruction} ${targetSentence}${objective.why}`);
  } else {
    lines.push('Next focus: play where your stones gain room, connect, or claim easier territory.');
  }

  let followThroughText: string;
  if (shouldPassSensei) {
    if (move?.type !== 'place') {
      followThroughText = 'White takes a teaching pass so you can immediately try the next idea.';
    } else if (openingFollowUp) {
      followThroughText = openingFollowUp.passText;
    } else if (shouldPrioritizePendingPressureRead) {
      followThroughText = 'I marked your move and gave White a teaching pass so you can finish this read before choosing the next area.';
    } else {
      followThroughText = 'I marked your move, gave White a teaching pass, and marked the next targets so you can immediately try the next idea.';
    }
  } else {
    followThroughText = shouldPrioritizePendingPressureRead
      ? 'Use the pressure prompt to finish this read before choosing the next area.'
      : 'Use the marked targets to make the next move concrete.';
  }

  lines.push(followThroughText);

  const actions = openingFollowUp?.actions
    ?? (objective && !shouldPrioritizePendingPressureRead ? getBeginnerObjectiveActions(objective) : []);
  const boardFocus = openingFollowUp?.boardFocus
    ?? (objective
      ? buildObjectiveBoardFocus(
        objective,
        game.board.size,
        move,
        progress?.status ?? null,
        followUpContext,
        shouldPrioritizePendingPressureRead,
      )
      : undefined);

  return {
    text: lines.join('\n\n'),
    conceptIds: uniqueConceptIds([
      ...(objective?.conceptIds ?? []),
      ...(openingFollowUp ? ['corner-opening', 'territory'] : []),
      ...(insight?.conceptIds ?? []),
    ]),
    actions,
    ...(boardFocus ? { boardFocus } : {}),
    shouldPassSensei,
  };
}
