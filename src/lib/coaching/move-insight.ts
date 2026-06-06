import {
  type BeginnerObjective,
  formatObjectiveTargetText,
  getBoardAreaDirectionLabel,
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

interface OneSpaceJumpAnchor {
  anchor: Point;
  gap: Point;
  moveIndex: number;
}

function objectiveNextStep(
  game: GameState,
  teachingLevel: TeachingLevel,
): { text: string; concepts: string[]; objectiveId: BeginnerObjective['id'] | null } {
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
      objectiveId: null,
    };
  }

  const targetText = formatObjectiveTargetText(objective, game.board.size);

  return {
    text: targetText ? `${objective.instruction} ${targetText}` : objective.instruction,
    concepts: objective.conceptIds,
    objectiveId: objective.id,
  };
}

function weakBlackGroupInsight(game: GameState): { liberties: number; stones: Point[] } | null {
  const weakGroup = getAllGroups(game.board)
    .filter((group) => group.color === 'black' && group.liberties.length > 0 && group.liberties.length <= 2)
    .sort((a, b) => a.liberties.length - b.liberties.length || a.stones.length - b.stones.length)[0];

  return weakGroup ? { liberties: weakGroup.liberties.length, stones: weakGroup.stones } : null;
}

function getLastBlackPlacementIndex(game: GameState, point: Point): number {
  for (let i = game.moveHistory.length - 1; i >= 0; i -= 1) {
    const move = game.moveHistory[i];
    if (
      move.type === 'place'
      && move.color === 'black'
      && move.point.x === point.x
      && move.point.y === point.y
    ) {
      return i;
    }
  }

  return -1;
}

function findOneSpaceJumpAnchors(game: GameState, point: Point): OneSpaceJumpAnchor[] {
  const anchors: OneSpaceJumpAnchor[] = [];

  for (const delta of ONE_SPACE_JUMP_DELTAS) {
    const anchor = { x: point.x - delta.x, y: point.y - delta.y };
    const gap = { x: point.x - delta.x / 2, y: point.y - delta.y / 2 };

    if (getStone(game.board, anchor) !== 'black') continue;
    if (getStone(game.board, gap) !== null) continue;

    anchors.push({
      anchor,
      gap,
      moveIndex: getLastBlackPlacementIndex(game, anchor),
    });
  }

  return anchors;
}

function findOneSpaceJumpAnchor(game: GameState, point: Point): OneSpaceJumpAnchor | null {
  return findOneSpaceJumpAnchors(game, point)[0] ?? null;
}

function isOppositeJumpPair(point: Point, first: OneSpaceJumpAnchor, second: OneSpaceJumpAnchor): boolean {
  const verticalPair = first.anchor.x === point.x
    && second.anchor.x === point.x
    && Math.sign(first.anchor.y - point.y) !== Math.sign(second.anchor.y - point.y);
  const horizontalPair = first.anchor.y === point.y
    && second.anchor.y === point.y
    && Math.sign(first.anchor.x - point.x) !== Math.sign(second.anchor.x - point.x);

  return verticalPair || horizontalPair;
}

function describeBridgeSide(anchor: Point, point: Point): string {
  if (anchor.y > point.y) return 'lower-side stone';
  if (anchor.y < point.y) return 'upper-side stone';
  if (anchor.x < point.x) return 'left-side stone';
  return 'right-side stone';
}

function findOneSpaceJumpBridge(game: GameState, point: Point): {
  earlier: OneSpaceJumpAnchor;
  later: OneSpaceJumpAnchor;
} | null {
  const anchors = findOneSpaceJumpAnchors(game, point);

  for (let i = 0; i < anchors.length; i += 1) {
    for (let j = i + 1; j < anchors.length; j += 1) {
      const first = anchors[i];
      const second = anchors[j];
      if (!isOppositeJumpPair(point, first, second)) continue;
      if (first.moveIndex < 0 || second.moveIndex < 0) continue;

      const [earlier, later] = first.moveIndex < second.moveIndex ? [first, second] : [second, first];
      if (!isNearCorner(earlier.anchor, game.board.size)) continue;

      return { earlier, later };
    }
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
    if (next.objectiveId === 'choose-new-area') {
      return {
        title: 'Choose a fresh direction',
        observation: 'Your nearby shape is already settled. Pick a fresh area instead of rereading the same local stones.',
        nextStep: next.text,
        conceptIds: ['direction-of-play', 'shape', ...next.concepts],
      };
    }

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
  const jumpBridge = progress?.status === 'met' && progress.objectiveId === 'extend-from-stone'
    ? findOneSpaceJumpBridge(game, move.point)
    : null;
  const jumpShape = progress?.status === 'met' && progress.objectiveId === 'extend-from-stone'
    ? findOneSpaceJumpAnchor(game, move.point)
    : null;

  if (jumpBridge) {
    const earlierCoord = pointToCoord(jumpBridge.earlier.anchor, game.board.size);
    const laterCoord = pointToCoord(jumpBridge.later.anchor, game.board.size);
    const earlierGapCoord = pointToCoord(jumpBridge.earlier.gap, game.board.size);
    const laterGapCoord = pointToCoord(jumpBridge.later.gap, game.board.size);

    return {
      title: 'Bridge back to the corner',
      observation: `${coord} links ${laterCoord} back toward the earlier ${earlierCoord} corner: ${earlierGapCoord} and ${laterGapCoord} stay open, so the corner stone and the ${describeBridgeSide(jumpBridge.later.anchor, move.point)} now support the same line before you extend again.`,
      nextStep: next.text,
      conceptIds: ['shape', 'direction-of-play', ...next.concepts],
    };
  }

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

  if (progress?.status === 'met' && progress.objectiveId === 'choose-new-area') {
    const direction = getBoardAreaDirectionLabel(move.point, game.board.size);
    const area = direction.replace(/ direction$/, '');

    return {
      title: 'Fresh direction chosen',
      observation: `${coord} opens the ${direction} away from the settled local shape. Treat it as a new plan: ask what space it claims and how White might answer nearby.`,
      nextStep: `Before extending from ${coord}, name the new ${area} area you want Black to build. Then use the marked follow-up targets to make that plan concrete.`,
      conceptIds: ['direction-of-play', 'territory', ...next.concepts],
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
