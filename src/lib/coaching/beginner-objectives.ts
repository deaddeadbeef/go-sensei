import { getAllGroups, getAdjacentPoints, getStone, isOnBoard, pointEquals, pointKey, pointToCoord, undoMove } from '@/lib/go-engine';
import type { BoardSize, BoardState, GameState, Move, Point, StoneColor } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';

export interface BeginnerObjectiveInput {
  boardSize: BoardSize;
  board?: BoardState;
  moveHistory?: Move[];
  moveCount: number;
  currentPlayer: StoneColor;
  teachingLevel: TeachingLevel;
}

export interface BeginnerObjective {
  id: 'claim-corner' | 'extend-from-stone' | 'look-for-weak-groups' | 'choose-new-area';
  title: string;
  instruction: string;
  why: string;
  targetPoints: Point[];
  conceptIds: string[];
}

export interface BeginnerObjectiveProgress {
  status: 'met' | 'missed';
  text: string;
  lastMove: Point;
  objectiveId: BeginnerObjective['id'];
}

const CORNER_TARGETS_9X9: Point[] = [
  { x: 2, y: 2 },
  { x: 6, y: 2 },
  { x: 2, y: 6 },
  { x: 6, y: 6 },
];

const SIDE_TARGETS_9X9: Point[] = [
  { x: 2, y: 4 },
  { x: 4, y: 2 },
  { x: 6, y: 4 },
  { x: 4, y: 6 },
];

const ONE_SPACE_JUMP_DELTAS: Point[] = [
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
  { x: 0, y: -2 },
];

function uniquePoints(points: Point[]): Point[] {
  const seen = new Set<string>();
  const result: Point[] = [];

  for (const point of points) {
    const key = pointKey(point);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(point);
  }

  return result;
}

function joinCoordinateList(coords: string[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return coords[0];
  if (coords.length === 2) return `${coords[0]} or ${coords[1]}`;

  return `${coords.slice(0, -1).join(', ')}, or ${coords[coords.length - 1]}`;
}

export function getBoardAreaDirectionLabel(point: Point, boardSize: BoardSize): string {
  const center = (boardSize - 1) / 2;
  const vertical = point.y < center ? 'upper' : point.y > center ? 'lower' : null;
  const horizontal = point.x < center ? 'left' : point.x > center ? 'right' : null;

  if (vertical && horizontal) return `${vertical}-${horizontal} direction`;
  if (vertical) return `${vertical} side`;
  if (horizontal) return `${horizontal} side`;

  return 'center';
}

export function formatObjectiveTargetText(
  objective: BeginnerObjective,
  boardSize: BoardSize,
  limit = 4,
): string | null {
  if (objective.targetPoints.length === 0) return null;

  const shownCoords = objective.targetPoints
    .slice(0, limit)
    .map((point) => pointToCoord(point, boardSize));
  const suffix = objective.targetPoints.length > shownCoords.length ? ' first' : '';

  return `Try ${joinCoordinateList(shownCoords)}${suffix}.`;
}

function getStones(board: BoardState, color: StoneColor): Point[] {
  const stones: Point[] = [];

  for (let y = 0; y < board.size; y++) {
    for (let x = 0; x < board.size; x++) {
      if (board.grid[y][x] === color) stones.push({ x, y });
    }
  }

  return stones;
}

function isNearCorner(point: Point, boardSize: BoardSize): boolean {
  const low = 3;
  const high = boardSize - 4;
  return (point.x <= low || point.x >= high) && (point.y <= low || point.y >= high);
}

function getOpenTargets(board: BoardState | undefined, targets: Point[]): Point[] {
  if (!board) return targets;
  return targets.filter((point) => getStone(board, point) === null);
}

function hasCornerStone(board: BoardState, color: StoneColor): boolean {
  return getStones(board, color).some((stone) => isNearCorner(stone, board.size));
}

function isAdjacentToColor(board: BoardState, point: Point, color: StoneColor): boolean {
  return getAdjacentPoints(board, point).some((adjacent) => getStone(board, adjacent) === color);
}

function isTeachingExtensionTarget(board: BoardState, point: Point): boolean {
  return point.x > 0 && point.x < board.size - 1 && point.y > 0 && point.y < board.size - 1;
}

function getRecentPlacedPoints(moveHistory: Move[] | undefined, color: StoneColor): Point[] {
  if (!moveHistory) return [];

  return moveHistory
    .filter((move): move is Extract<Move, { type: 'place' }> => move.type === 'place' && move.color === color)
    .map((move) => move.point)
    .reverse();
}

function getExtensionTargets(board: BoardState, color: StoneColor, moveHistory?: Move[]): Point[] {
  const stones = getStones(board, color);
  const recent = getRecentPlacedPoints(moveHistory, color);
  const anchors = uniquePoints([...recent, ...stones]);
  const targets: Point[] = [];

  for (const stone of anchors) {
    for (const delta of ONE_SPACE_JUMP_DELTAS) {
      const target = { x: stone.x + delta.x, y: stone.y + delta.y };
      const gap = { x: stone.x + delta.x / 2, y: stone.y + delta.y / 2 };
      if (!isOnBoard(board, target)) continue;
      if (!isTeachingExtensionTarget(board, target)) continue;
      if (getStone(board, gap) !== null) continue;
      if (getStone(board, target) !== null) continue;
      if (isAdjacentToColor(board, target, color)) continue;
      targets.push(target);
    }
  }

  return uniquePoints(targets).slice(0, 6);
}

function getWeakGroupLiberties(board: BoardState, color: StoneColor): Point[] {
  const weakGroups = getAllGroups(board)
    .filter((group) => group.color === color && group.liberties.length > 0 && group.liberties.length <= 2)
    .sort((a, b) => a.liberties.length - b.liberties.length || a.stones.length - b.stones.length);

  return weakGroups[0]?.liberties ?? [];
}

function distance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function countAdjacentStones(board: BoardState, point: Point, color: StoneColor): number {
  return getAdjacentPoints(board, point)
    .filter((adjacent) => getStone(board, adjacent) === color)
    .length;
}

function getFreshAreaAnchor(board: BoardState, color: StoneColor, moveHistory?: Move[]): Point | null {
  const recent = getRecentPlacedPoints(moveHistory, color)
    .find((point) => getStone(board, point) === color);
  if (recent) return recent;

  const center = { x: Math.floor(board.size / 2), y: Math.floor(board.size / 2) };
  return getStones(board, color)
    .sort((a, b) => (
      countAdjacentStones(board, b, color) - countAdjacentStones(board, a, color)
      || distance(a, center) - distance(b, center)
    ))[0] ?? null;
}

function getFreshAreaTargets(board: BoardState, color: StoneColor, moveHistory?: Move[]): Point[] {
  const anchor = getFreshAreaAnchor(board, color, moveHistory);
  if (!anchor) return [];

  const stones = getStones(board, color);
  const candidates: Point[] = [];

  for (let y = 1; y < board.size - 1; y++) {
    for (let x = 1; x < board.size - 1; x++) {
      const point = { x, y };
      if (getStone(board, point) !== null) continue;
      if (isAdjacentToColor(board, point, color)) continue;
      candidates.push(point);
    }
  }

  return candidates
    .sort((a, b) => (
      distance(b, anchor) - distance(a, anchor)
      || distanceToNearestStone(stones, b) - distanceToNearestStone(stones, a)
      || a.y - b.y
      || a.x - b.x
    ))
    .slice(0, 2);
}

function distanceToNearestStone(stones: Point[], point: Point): number {
  if (stones.length === 0) return 0;

  return Math.min(...stones.map((stone) => distance(point, stone)));
}

function openingObjective(targetPoints: Point[] = CORNER_TARGETS_9X9): BeginnerObjective {
  return {
    id: 'claim-corner',
    title: 'Start with a corner',
    instruction: 'Place your next stone near an empty corner.',
    why: 'Corners are easier to surround because the board edge helps you.',
    targetPoints,
    conceptIds: ['corner-opening', 'territory'],
  };
}

function extensionObjective(targetPoints: Point[] = SIDE_TARGETS_9X9): BeginnerObjective {
  return {
    id: 'extend-from-stone',
    title: 'Make your stones work together',
    instruction: 'Play a one-space jump from one of your stones.',
    why: 'A small gap keeps your stones connected in spirit while sketching future territory.',
    targetPoints,
    conceptIds: ['shape', 'direction-of-play'],
  };
}

function weakGroupObjective(targetPoints: Point[] = []): BeginnerObjective {
  return {
    id: 'look-for-weak-groups',
    title: 'Give weak groups room',
    instruction: targetPoints.length
      ? 'Play on a marked liberty to help your group breathe.'
      : 'Before playing, ask which stones have little room to escape.',
    why: 'Groups with few liberties need help or can become targets.',
    targetPoints,
    conceptIds: ['liberties', 'groups'],
  };
}

function chooseNewAreaObjective(targetPoints: Point[] = []): BeginnerObjective {
  return {
    id: 'choose-new-area',
    title: 'Choose a new area',
    instruction: 'Your nearby groups are safe for now. Pick a fresh area instead of rereading the settled shape.',
    why: 'When nothing is short on liberties, the next useful habit is to scan for a new direction.',
    targetPoints,
    conceptIds: ['direction-of-play', 'shape'],
  };
}

export function getBeginnerObjective(input: BeginnerObjectiveInput): BeginnerObjective | null {
  if (input.boardSize !== 9) return null;
  if (input.currentPlayer !== 'black') return null;
  if (input.teachingLevel !== 'beginner' && input.teachingLevel !== 'guided') return null;

  const board = input.board?.size === 9 ? input.board : undefined;

  if (board) {
    const openCornerTargets = getOpenTargets(board, CORNER_TARGETS_9X9);
    const hasCorner = hasCornerStone(board, 'black');

    if (!hasCorner && openCornerTargets.length > 0) {
      return openingObjective(openCornerTargets);
    }

    const weakGroupLiberties = getWeakGroupLiberties(board, 'black');
    if (weakGroupLiberties.length > 0 && input.moveCount >= 4) {
      return weakGroupObjective(weakGroupLiberties);
    }

    const extensionTargets = getExtensionTargets(board, 'black', input.moveHistory);
    if (extensionTargets.length > 0) {
      return extensionObjective(extensionTargets);
    }

    if (openCornerTargets.length > 0 && !CORNER_TARGETS_9X9.some((target) => getStone(board, target) === 'black')) {
      return openingObjective(openCornerTargets);
    }

    return chooseNewAreaObjective(getFreshAreaTargets(board, 'black', input.moveHistory));
  }

  if (input.moveCount <= 2) {
    return openingObjective();
  }

  if (input.moveCount <= 8) {
    return extensionObjective();
  }

  return weakGroupObjective();
}

function findStateBeforeLastBlackPlacement(game: GameState): {
  beforeMove: GameState;
  move: Extract<Move, { type: 'place' }>;
} | null {
  let current: GameState | null = game;

  while (current.moveHistory.length > 0) {
    const lastMove = current.moveHistory[current.moveHistory.length - 1];
    const previous = undoMove(current);
    if (!previous) return null;

    if (lastMove.type === 'place' && lastMove.color === 'black') {
      return { beforeMove: previous, move: lastMove };
    }

    current = previous;
  }

  return null;
}

function successText(objective: BeginnerObjective, coord: string): string {
  switch (objective.id) {
    case 'claim-corner':
      return `Good: ${coord} hit the marked corner goal. Next, make that stone work with another one.`;
    case 'extend-from-stone':
      return `Good: ${coord} made a one-space jump from your stone. Next, check whether any group is short on liberties.`;
    case 'look-for-weak-groups':
      return `Good: ${coord} gave the weak group another liberty. Next, look for the biggest safe move.`;
    case 'choose-new-area':
      return `Good: ${coord} chose a new area after the local shape settled. Now check whether the new shape creates a useful follow-up.`;
  }
}

function missedText(objective: BeginnerObjective, coord: string, boardSize: BoardSize): string {
  const targets = formatObjectiveTargetText(objective, boardSize);

  switch (objective.id) {
    case 'claim-corner':
      return `Progress check: ${coord} was not one of the marked corner points. ${targets ?? 'Play near an empty corner next.'}`;
    case 'extend-from-stone':
      return `Progress check: ${coord} was not one of the marked extension points. ${targets ?? 'Play a one-space jump from one of your stones.'}`;
    case 'look-for-weak-groups':
      return `Progress check: ${coord} did not help the short-on-liberties group. ${targets ?? 'Find the group with the least room before playing.'}`;
    case 'choose-new-area':
      return `Progress check: ${coord} stayed near the settled shape. Look for a fresh direction before rereading the same local area.`;
  }
}

export function getBeginnerObjectiveProgress(
  game: GameState,
  teachingLevel: TeachingLevel,
): BeginnerObjectiveProgress | null {
  if (game.board.size !== 9) return null;
  if (teachingLevel !== 'beginner' && teachingLevel !== 'guided') return null;

  const lastBlackPlacement = findStateBeforeLastBlackPlacement(game);
  if (!lastBlackPlacement) return null;

  const priorObjective = getBeginnerObjective({
    boardSize: lastBlackPlacement.beforeMove.board.size,
    board: lastBlackPlacement.beforeMove.board,
    moveHistory: lastBlackPlacement.beforeMove.moveHistory,
    moveCount: lastBlackPlacement.beforeMove.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });

  if (!priorObjective || priorObjective.id === 'choose-new-area' || priorObjective.targetPoints.length === 0) return null;

  const coord = pointToCoord(lastBlackPlacement.move.point, game.board.size);
  const metObjective = priorObjective.targetPoints.some((point) => pointEquals(point, lastBlackPlacement.move.point));

  return {
    status: metObjective ? 'met' : 'missed',
    text: metObjective
      ? successText(priorObjective, coord)
      : missedText(priorObjective, coord, game.board.size),
    lastMove: lastBlackPlacement.move.point,
    objectiveId: priorObjective.id,
  };
}
