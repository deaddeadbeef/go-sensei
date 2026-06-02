import {
  formatObjectiveTargetText,
  getBeginnerObjective,
  getBeginnerObjectiveProgress,
} from '@/lib/coaching/beginner-objectives';
import { getAllGroups, getStone, pointToCoord } from '@/lib/go-engine';
import type { GameState, Move, Point } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';

export interface MoveInsight {
  title: string;
  observation: string;
  nextStep: string;
  conceptIds: string[];
}

function isTeachingLevel(teachingLevel: TeachingLevel): boolean {
  return teachingLevel === 'guided' || teachingLevel === 'beginner';
}

function lastBlackMove(game: GameState): Move | null {
  for (let i = game.moveHistory.length - 1; i >= 0; i--) {
    const move = game.moveHistory[i];
    if (move.color === 'black') return move;
  }

  return null;
}

function isNearCorner(point: Point, boardSize: number): boolean {
  const low = 3;
  const high = boardSize - 4;
  return (point.x <= low || point.x >= high) && (point.y <= low || point.y >= high);
}

function isCenterArea(point: Point, boardSize: number): boolean {
  const center = Math.floor(boardSize / 2);
  return Math.abs(point.x - center) <= 1 && Math.abs(point.y - center) <= 1;
}

const ONE_SPACE_JUMP_DELTAS: Point[] = [
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
  { x: 0, y: -2 },
];

function objectiveNextStep(game: GameState, teachingLevel: TeachingLevel): { text: string; concepts: string[] } {
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });

  if (!objective) {
    return {
      text: 'Look for the move that gives your stones more room or easier territory.',
      concepts: [],
    };
  }

  const targetText = formatObjectiveTargetText(objective, game.board.size);

  return {
    text: targetText ? `${objective.instruction} ${targetText}` : objective.instruction,
    concepts: objective.conceptIds,
  };
}

function weakBlackGroupInsight(game: GameState): { liberties: number; stones: Point[] } | null {
  const weakGroup = getAllGroups(game.board)
    .filter((group) => group.color === 'black' && group.liberties.length > 0 && group.liberties.length <= 2)
    .sort((a, b) => a.liberties.length - b.liberties.length || a.stones.length - b.stones.length)[0];

  return weakGroup ? { liberties: weakGroup.liberties.length, stones: weakGroup.stones } : null;
}

function findOneSpaceJumpAnchor(game: GameState, point: Point): { anchor: Point; gap: Point } | null {
  for (const delta of ONE_SPACE_JUMP_DELTAS) {
    const anchor = { x: point.x - delta.x, y: point.y - delta.y };
    const gap = { x: point.x - delta.x / 2, y: point.y - delta.y / 2 };

    if (getStone(game.board, anchor) !== 'black') continue;
    if (getStone(game.board, gap) !== null) continue;

    return { anchor, gap };
  }

  return null;
}

export function getMoveInsight(game: GameState, teachingLevel: TeachingLevel): MoveInsight | null {
  if (!isTeachingLevel(teachingLevel)) return null;
  if (game.phase !== 'playing') return null;

  const next = objectiveNextStep(game, teachingLevel);
  const weakGroup = weakBlackGroupInsight(game);

  if (weakGroup && game.moveHistory.length >= 4) {
    const anchor = pointToCoord(weakGroup.stones[0], game.board.size);
    const libertyWord = weakGroup.liberties === 1 ? 'liberty' : 'liberties';

    return {
      title: 'Your group needs air',
      observation: `${anchor} has only ${weakGroup.liberties} ${libertyWord}. A group this short on breathing room can be attacked immediately.`,
      nextStep: next.text,
      conceptIds: ['liberties', 'groups', ...next.concepts],
    };
  }

  const move = lastBlackMove(game);
  if (!move) {
    return {
      title: 'Start from the easiest territory',
      observation: 'Corners use two board edges, so they need fewer stones to become real territory.',
      nextStep: next.text,
      conceptIds: ['corner-opening', 'territory', ...next.concepts],
    };
  }

  if (move.type === 'pass') {
    return {
      title: 'Passing gives the initiative away',
      observation: game.moveHistory.length <= 6
        ? 'This is still the opening. Passing now gives up a chance to claim easy points and practice shape.'
        : 'Passing is reasonable only when the biggest remaining moves are smaller than ending the game.',
      nextStep: next.text,
      conceptIds: ['sente-gote', ...next.concepts],
    };
  }

  if (move.type === 'resign') {
    return null;
  }

  const coord = pointToCoord(move.point, game.board.size);
  const progress = getBeginnerObjectiveProgress(game, teachingLevel);
  const jumpShape = progress?.status === 'met' && progress.objectiveId === 'extend-from-stone'
    ? findOneSpaceJumpAnchor(game, move.point)
    : null;

  if (jumpShape) {
    const anchorCoord = pointToCoord(jumpShape.anchor, game.board.size);
    const gapCoord = pointToCoord(jumpShape.gap, game.board.size);

    return {
      title: 'One-space jump shape',
      observation: `${coord} is a one-space jump from ${anchorCoord}. The empty point at ${gapCoord} leaves room to grow while the two stones still work together.`,
      nextStep: next.text,
      conceptIds: ['shape', 'direction-of-play', ...next.concepts],
    };
  }

  if (isNearCorner(move.point, game.board.size)) {
    return {
      title: 'Corner anchor',
      observation: `${coord} is a useful anchor because the edge helps it surround space. Your next job is to make it work with another stone.`,
      nextStep: next.text,
      conceptIds: ['corner-opening', 'territory', ...next.concepts],
    };
  }

  if (isCenterArea(move.point, game.board.size) && game.moveHistory.length <= 3) {
    return {
      title: 'Center is influence, not territory',
      observation: `${coord} reaches in every direction, but it does not use the board edge. Beginners usually learn faster by anchoring a corner first.`,
      nextStep: next.text,
      conceptIds: ['influence', 'territory', ...next.concepts],
    };
  }

  return {
    title: 'Turn one stone into a plan',
    observation: `${coord} matters only if the next stones support it. Look for a nearby move that builds shape without crowding your own stone.`,
    nextStep: next.text,
    conceptIds: ['shape', 'direction-of-play', ...next.concepts],
  };
}
