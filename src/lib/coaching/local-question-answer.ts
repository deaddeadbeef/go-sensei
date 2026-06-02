import { coordToPoint, getAllGroups, getGroup, getStone, pointEquals, pointKey, pointToCoord } from '@/lib/go-engine';
import type { BoardSize, GameState, Group, Move, Point } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';
import {
  formatObjectiveTargetText,
  getBeginnerObjective,
  getBeginnerObjectiveProgress,
} from '@/lib/coaching/beginner-objectives';
import { getBeginnerObjectiveLessonAction } from '@/lib/coaching/beginner-objective-actions';
import type { BeginnerObjective } from '@/lib/coaching/beginner-objectives';
import { getMoveInsight } from '@/lib/coaching/move-insight';
import type { SenseiAction } from '@/lib/coaching/sensei-actions';

export interface LocalLibertyFocus {
  id: string;
  point: Point;
  count: number;
  libertyPoints: Point[];
}

export interface LocalGroupFocus {
  id: string;
  stones: Point[];
  color: 'black' | 'white';
  liberties: number;
  label?: string;
}

export interface LocalSuggestionFocus {
  id: string;
  point: Point;
  rank: number;
  reason: string;
}

export interface LocalHighlightFocus {
  id: string;
  point: Point;
  variant: 'positive' | 'warning' | 'danger' | 'neutral';
  label?: string;
}

export interface LocalBoardFocus {
  highlights?: LocalHighlightFocus[];
  liberties?: LocalLibertyFocus[];
  groups?: LocalGroupFocus[];
  suggestions?: LocalSuggestionFocus[];
}

export interface LocalQuestionAnswer {
  text: string;
  conceptIds: string[];
  boardFocus?: LocalBoardFocus;
  actions?: SenseiAction[];
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

function joinOrList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} or ${items[1]}`;

  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

function copyPoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

interface LibertyContext {
  sentence: string;
  boardFocus: LocalBoardFocus;
}

function buildLibertyContext(game: GameState, point: Point, groupLabelPrefix: string): LibertyContext | null {
  const group = getGroup(game.board, point);
  if (!group) return null;

  const anchor = pointToCoord(point, game.board.size);
  const libertyCoords = group.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const libertyWord = group.liberties.length === 1 ? 'liberty' : 'liberties';
  const libertyList = joinList(libertyCoords);

  return {
    sentence: `Your group at ${anchor} currently has ${group.liberties.length} ${libertyWord}: ${libertyList}.`,
    boardFocus: {
      liberties: [{
        id: `local-liberties-${pointKey(point)}`,
        point: copyPoint(point),
        count: group.liberties.length,
        libertyPoints: group.liberties.map(copyPoint),
      }],
      groups: [{
        id: `local-group-${pointKey(point)}`,
        stones: group.stones.map(copyPoint),
        color: group.color,
        liberties: group.liberties.length,
        label: `${groupLabelPrefix} has ${group.liberties.length} ${libertyWord}: ${libertyList}.`,
      }],
    },
  };
}

function groupAnchor(group: Group): Point {
  return [...group.stones].sort((a, b) => a.y - b.y || a.x - b.x)[0];
}

function findCurrentAtariGroup(game: GameState, lastMove: Extract<Move, { type: 'place' }> | null): Group | null {
  if (lastMove) {
    const lastGroup = getGroup(game.board, lastMove.point);
    if (lastGroup?.liberties.length === 1) return lastGroup;
  }

  return getAllGroups(game.board).find((group) => group.liberties.length === 1) ?? null;
}

function compareGroupsByAnchor(a: Group, b: Group): number {
  const anchorA = groupAnchor(a);
  const anchorB = groupAnchor(b);

  return a.stones.length - b.stones.length
    || anchorA.y - anchorB.y
    || anchorA.x - anchorB.x;
}

function findLearnerCaptureTarget(game: GameState): Group | null {
  return getAllGroups(game.board)
    .filter((group) => group.color === 'white' && group.liberties.length === 1)
    .sort(compareGroupsByAnchor)[0] ?? null;
}

function buildAtariContext(game: GameState, group: Group): LibertyContext {
  const anchor = groupAnchor(group);
  const anchorCoord = pointToCoord(anchor, game.board.size);
  const libertyCoord = pointToCoord(group.liberties[0], game.board.size);
  const colorName = group.color === 'black' ? 'Black' : 'White';

  return {
    sentence: ` I marked the ${group.color} group at ${anchorCoord}; its only liberty is ${libertyCoord}.`,
    boardFocus: {
      liberties: [{
        id: `local-atari-liberties-${pointKey(anchor)}`,
        point: copyPoint(anchor),
        count: 1,
        libertyPoints: group.liberties.map(copyPoint),
      }],
      groups: [{
        id: `local-atari-group-${pointKey(anchor)}`,
        stones: group.stones.map(copyPoint),
        color: group.color,
        liberties: group.liberties.length,
        label: `${colorName} group in atari: only liberty at ${libertyCoord}.`,
      }],
    },
  };
}

function buildCaptureContext(game: GameState, group: Group): LibertyContext {
  const anchor = groupAnchor(group);
  const anchorCoord = pointToCoord(anchor, game.board.size);
  const capturePoint = group.liberties[0];
  const captureCoord = pointToCoord(capturePoint, game.board.size);

  return {
    sentence: ` I marked the white group at ${anchorCoord}; Black can capture it now by playing ${captureCoord}, its final liberty.`,
    boardFocus: {
      liberties: [{
        id: `local-capture-liberties-${pointKey(anchor)}`,
        point: copyPoint(anchor),
        count: 1,
        libertyPoints: [copyPoint(capturePoint)],
      }],
      groups: [{
        id: `local-capture-group-${pointKey(anchor)}`,
        stones: group.stones.map(copyPoint),
        color: group.color,
        liberties: group.liberties.length,
        label: `White group ready to capture: final liberty at ${captureCoord}.`,
      }],
      suggestions: [{
        id: `local-capture-move-${pointKey(capturePoint)}`,
        point: copyPoint(capturePoint),
        rank: 1,
        reason: `Capture White by filling its last liberty at ${captureCoord}.`,
      }],
    },
  };
}

function isNextMoveQuestion(q: string): boolean {
  return q.trim() === 'help'
    || q.trim() === 'help me'
    || /\bwhat\s+(should|do)\s+i\s+(do|play)\b/.test(q)
    || /\bwhere\s+(should|do)\s+i\s+play\b/.test(q)
    || /\bwhat\s+move\b/.test(q)
    || /\bwhat\s+now\b/.test(q)
    || /\bnext\s+move\b/.test(q)
    || /\bshow\s+me\s+(a\s+)?move\b/.test(q)
    || /\bhelp\s+me\s+(move|play|choose)\b/.test(q)
    || /\bhint\b/.test(q);
}

function isMoveReviewQuestion(q: string): boolean {
  return /\b(was|is)\s+(that|this|my\s+move)\s+(good|bad|ok|okay|right|wrong)\b/.test(q)
    || /\bhow\s+(was|is)\s+(that|this|my\s+move)\b/.test(q)
    || /\bdid\s+i\s+(make\s+a\s+mistake|play\s+(well|badly|good|right|wrong))\b/.test(q)
    || /\bwhy\s+(was|is)\s+(that|this|my\s+move)\s+(good|bad|right|wrong)\b/.test(q)
    || /\breview\s+(that|this|my)\s+move\b/.test(q);
}

function isShapeQuestion(q: string): boolean {
  return /\bone[-\s]?(space|point)\s+jump\b/.test(q)
    || /\bwhat\s+is\s+(good\s+)?shape\b/.test(q)
    || /\bshape\s+(mean|means|work|works|matter|matters)\b/.test(q)
    || /\bgood\s+shape\b/.test(q)
    || /\bdirection\s+of\s+play\b/.test(q)
    || /\bextension\b/.test(q)
    || /\bmake\s+(my\s+)?stones\s+work\b/.test(q);
}

function mentionedCoordinate(q: string, boardSize: BoardSize): Point | null {
  for (const token of q.split(/\s+/)) {
    if (!/^[a-hj-t]\d{1,2}$/i.test(token)) continue;
    const point = coordToPoint(token, boardSize);
    if (point) return point;
  }

  return null;
}

function isTargetReasonQuestion(q: string, boardSize: BoardSize): boolean {
  if (!/\bwhy\b/.test(q)) return false;
  if (mentionedCoordinate(q, boardSize)) return true;

  return /\b(there|that\s+point|this\s+point|that\s+move|this\s+move|marked\s+(move|point|target))\b/.test(q);
}

function isCandidateMoveQuestion(q: string, boardSize: BoardSize): boolean {
  if (!mentionedCoordinate(q, boardSize)) return false;

  return /\b(should|can|could|would)\s+i\s+(play|try|move)\b/.test(q)
    || /\bwhat\s+about\b/.test(q)
    || /\bhow\s+about\b/.test(q)
    || /\bis\s+[a-hj-t]\d{1,2}\s+(good|bad|ok|okay|right|wrong|playable|safe)\b/.test(q)
    || /\bplay\s+(at\s+)?[a-hj-t]\d{1,2}\b/.test(q);
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

function objectiveSuggestions(objective: BeginnerObjective, boardSize: BoardSize, idPrefix: string): LocalSuggestionFocus[] {
  return objective.targetPoints.slice(0, 4).map((point, index) => ({
    id: `${idPrefix}-${pointKey(point)}`,
    point: copyPoint(point),
    rank: index + 1,
    reason: suggestionReason(objective, point, boardSize),
  }));
}

function objectiveTargetCoordList(objective: BeginnerObjective, boardSize: BoardSize): string | null {
  const coords = objective.targetPoints.slice(0, 4).map((point) => pointToCoord(point, boardSize));
  if (coords.length === 0) return null;

  return joinOrList(coords);
}

function targetReason(
  objective: BeginnerObjective,
  point: Point,
  boardSize: BoardSize,
  anchor: Point | null,
): string {
  const coord = pointToCoord(point, boardSize);

  if (objective.id === 'claim-corner') {
    return `${coord} is marked because a corner already has two board edges helping it become territory. You need fewer stones there than in the open center.`;
  }

  if (objective.id === 'extend-from-stone') {
    const anchorCoord = anchor ? pointToCoord(anchor, boardSize) : 'your anchor stone';
    return `${coord} is marked because it is a one-space jump from ${anchorCoord}: close enough to work with that stone, but far enough away to grow territory instead of clumping.`;
  }

  return `${coord} is marked because it is a liberty for a group that is short on breathing room. Playing there gives the group more ways to escape.`;
}

function buildTargetReasonAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer | null {
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });

  if (!objective || objective.targetPoints.length === 0) return null;

  const requestedPoint = mentionedCoordinate(q, game.board.size);
  const targetPoint = requestedPoint && objective.targetPoints.some((point) => pointEquals(point, requestedPoint))
    ? requestedPoint
    : objective.targetPoints[0];
  const requestedCoord = requestedPoint ? pointToCoord(requestedPoint, game.board.size) : null;
  const targetCoord = pointToCoord(targetPoint, game.board.size);
  const suggestions = objectiveSuggestions(objective, game.board.size, 'local-target-reason-move');
  const action = getBeginnerObjectiveLessonAction(objective);
  const lastMove = lastPlacedMove(game);
  const lines: string[] = [];

  if (requestedPoint && !pointEquals(requestedPoint, targetPoint)) {
    lines.push(`${requestedCoord} is not one of the current marked beginner targets.`);
  }

  lines.push(targetReason(objective, targetPoint, game.board.size, lastMove?.point ?? null));

  const otherTargets = objective.targetPoints
    .filter((point) => !pointEquals(point, targetPoint))
    .slice(0, 3)
    .map((point) => pointToCoord(point, game.board.size));

  if (otherTargets.length > 0) {
    lines.push(`${otherTargets.join(' or ')} works for the same beginner goal.`);
  }

  lines.push(`I marked the current targets again; ${targetCoord} is the one I explained.`);

  return {
    text: lines.join(' '),
    conceptIds: objective.conceptIds,
    boardFocus: { suggestions },
    actions: [
      { id: 'hint', label: 'Show targets' },
      ...(action ? [action] : []),
    ],
  };
}

function candidateMissReason(
  objective: BeginnerObjective,
  point: Point,
  boardSize: BoardSize,
  anchor: Point | null,
): string {
  const coord = pointToCoord(point, boardSize);

  if (objective.id === 'claim-corner') {
    return `${coord} is open, but this beginner goal is about starting near a corner where the board edge helps you make territory.`;
  }

  if (objective.id === 'extend-from-stone') {
    if (anchor) {
      const anchorCoord = pointToCoord(anchor, boardSize);
      const distance = Math.abs(point.x - anchor.x) + Math.abs(point.y - anchor.y);
      if (distance === 1) {
        return `${coord} touches ${anchorCoord} directly. That can be useful in a fight, but this beginner goal is practicing a one-space jump that reaches farther without losing teamwork.`;
      }

      return `${coord} is open, but it is not one of the marked one-space jumps from ${anchorCoord}.`;
    }

    return `${coord} is open, but it is not one of the marked one-space jumps from your anchor stone.`;
  }

  return `${coord} is open, but it is not one of the marked liberties for the group that needs breathing room right now.`;
}

function buildCandidateMoveAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer | null {
  const requestedPoint = mentionedCoordinate(q, game.board.size);
  if (!requestedPoint) return null;

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });

  if (!objective) return null;

  const coord = pointToCoord(requestedPoint, game.board.size);
  const suggestions = objectiveSuggestions(objective, game.board.size, 'local-candidate-move');
  const action = getBeginnerObjectiveLessonAction(objective);
  const targetCoordText = objectiveTargetCoordList(objective, game.board.size);
  const isMarkedTarget = objective.targetPoints.some((point) => pointEquals(point, requestedPoint));
  const lastMove = lastPlacedMove(game);

  if (getStone(game.board, requestedPoint) !== null) {
    return {
      text: `${coord} is already occupied, so you cannot play there. ${targetCoordText ? `Look for an open marked target instead: ${targetCoordText}.` : objective.instruction} I marked the current beginner targets again.`,
      conceptIds: objective.conceptIds,
      boardFocus: { suggestions },
      actions: [
        { id: 'hint', label: 'Show targets' },
        ...(action ? [action] : []),
      ],
    };
  }

  if (isMarkedTarget) {
    return {
      text: [
        `Yes. ${coord} fits the current goal: ${objective.title}.`,
        targetReason(objective, requestedPoint, game.board.size, lastMove?.point ?? null),
        'I marked the current targets again so you can compare the options before playing.',
      ].join(' '),
      conceptIds: objective.conceptIds,
      boardFocus: { suggestions },
      actions: [
        { id: 'hint', label: 'Show targets' },
        ...(action ? [action] : []),
      ],
    };
  }

  return {
    text: [
      candidateMissReason(objective, requestedPoint, game.board.size, lastMove?.point ?? null),
      targetCoordText ? `For this board, I would prefer ${targetCoordText}.` : objective.instruction,
      `I highlighted ${coord} and re-marked the better beginner targets.`,
    ].join(' '),
    conceptIds: objective.conceptIds,
    boardFocus: {
      highlights: [{
        id: `local-candidate-question-${pointKey(requestedPoint)}`,
        point: copyPoint(requestedPoint),
        variant: 'warning',
        label: `${coord}: open, but not the current beginner target.`,
      }],
      suggestions,
    },
    actions: [
      { id: 'hint', label: 'Show targets' },
      ...(action ? [action] : []),
    ],
  };
}

function buildShapeAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const lastMove = lastPlacedMove(game);
  const suggestions = objective?.id === 'extend-from-stone'
    ? objectiveSuggestions(objective, game.board.size, 'local-shape-move')
    : [];
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const anchorText = lastMove ? pointToCoord(lastMove.point, game.board.size) : null;
  const lines = [
    'Shape means your stones are arranged so they help each other instead of crowding each other.',
    'A one-space jump leaves one empty point between friendly stones. It reaches farther than touching, but stays close enough that the stones can still work together.',
  ];

  if (objective?.id === 'extend-from-stone') {
    lines.push(anchorText
      ? `On this board, ${anchorText} is your anchor. ${targetText ?? 'The marked points are useful.'} Those jump targets grow from it without piling stones too close.`
      : `${targetText ?? 'The marked points are useful.'} Those jump targets grow from your stones without piling them too close.`);
  } else if (objective && targetText) {
    lines.push(`First make the current beginner goal clear: ${objective.instruction} ${targetText}`);
  } else {
    lines.push('A useful direction of play usually asks: which side gives this stone more room, easier territory, or a stronger connection?');
  }

  if (suggestions.length > 0) {
    lines.push('I marked the current shape targets on the board.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['shape', 'direction-of-play', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    ...(suggestions.length > 0 ? { actions: [{ id: 'hint', label: 'Show targets' }] } : {}),
  };
}

function buildMoveReviewAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const progress = getBeginnerObjectiveProgress(game, teachingLevel);
  const insight = getMoveInsight(game, teachingLevel);
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-review-next-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;

  if (!progress && !insight) {
    return {
      text: 'Play a stone first, then I can review the move against the beginner goal and point to the next idea.',
      conceptIds: objective?.conceptIds ?? [],
      ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
      ...(action ? { actions: [action] } : {}),
    };
  }

  const lines: string[] = [];

  if (progress) {
    lines.push(progress.status === 'met'
      ? `Yes. ${progress.text}`
      : `Not for this beginner goal. ${progress.text}`);
  }

  if (insight) {
    lines.push(insight.observation);
    lines.push(`Next: ${insight.nextStep}`);
  } else if (objective) {
    const targetText = formatObjectiveTargetText(objective, game.board.size);
    lines.push(`Next: ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  }

  if (suggestions.length > 0) {
    lines.push('I marked the next beginner targets on the board.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds([
      ...(insight?.conceptIds ?? []),
      ...(objective?.conceptIds ?? []),
    ]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    ...(action ? { actions: [action] } : {}),
  };
}

function buildObjectiveAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer | null {
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: game.currentPlayer,
    teachingLevel,
  });

  if (!objective) return null;

  const targetText = formatObjectiveTargetText(objective, game.board.size);
  const suggestions = objectiveSuggestions(objective, game.board.size, 'local-objective-move');
  const action = getBeginnerObjectiveLessonAction(objective);

  return {
    text: [
      `Your next job is: ${objective.title}.`,
      objective.instruction,
      targetText ?? '',
      objective.why,
      suggestions.length > 0 ? 'I marked the best beginner targets on the board.' : '',
    ].filter(Boolean).join(' '),
    conceptIds: objective.conceptIds,
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    ...(action ? { actions: [action] } : {}),
  };
}

interface TerritoryContext {
  sentence: string;
  boardFocus: LocalBoardFocus;
  conceptIds: string[];
}

function buildTerritoryContext(game: GameState, teachingLevel: TeachingLevel): TerritoryContext | null {
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: game.currentPlayer,
    teachingLevel,
  });

  if (!objective || objective.id === 'look-for-weak-groups') return null;

  const suggestions = objectiveSuggestions(objective, game.board.size, 'local-territory-move');
  if (!suggestions.length) return null;

  const sentence = objective.id === 'claim-corner'
    ? 'I marked the easiest territory starting points on this board: corners already have two edges helping you.'
    : 'I marked extension points that help your stones sketch a loose border without touching too closely.';

  return {
    sentence,
    boardFocus: { suggestions },
    conceptIds: objective.conceptIds,
  };
}

function uniqueConceptIds(conceptIds: string[]): string[] {
  return [...new Set(conceptIds)];
}

interface KoContext {
  sentence: string;
  boardFocus: LocalBoardFocus;
}

function buildKoContext(game: GameState): KoContext | null {
  if (!game.koPoint) return null;

  const koCoord = pointToCoord(game.koPoint, game.board.size);
  const playerName = game.currentPlayer === 'black' ? 'Black' : 'White';

  return {
    sentence: ` The marked ko point is ${koCoord}. ${playerName} cannot immediately play there; play a ko threat elsewhere first, then come back if the opponent answers.`,
    boardFocus: {
      highlights: [{
        id: `local-ko-point-${pointKey(game.koPoint)}`,
        point: copyPoint(game.koPoint),
        variant: 'danger',
        label: `Ko: ${playerName} cannot immediately recapture at ${koCoord}.`,
      }],
    },
  };
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

  if (isMoveReviewQuestion(q)) {
    return buildMoveReviewAnswer(game, teachingLevel);
  }

  if (isTargetReasonQuestion(q, game.board.size)) {
    const targetAnswer = buildTargetReasonAnswer(game, teachingLevel, q);
    if (targetAnswer) return targetAnswer;
  }

  if (isCandidateMoveQuestion(q, game.board.size)) {
    const candidateAnswer = buildCandidateMoveAnswer(game, teachingLevel, q);
    if (candidateAnswer) return candidateAnswer;
  }

  if (isShapeQuestion(q)) {
    return buildShapeAnswer(game, teachingLevel);
  }

  if (isNextMoveQuestion(q)) {
    const objectiveAnswer = buildObjectiveAnswer(game, teachingLevel);
    if (objectiveAnswer) return objectiveAnswer;
  }

  if (/\blibert(y|ies)\b/.test(q) || q.includes('breathing room')) {
    const context = lastMove ? buildLibertyContext(game, lastMove.point, 'This connected group') : null;
    return {
      text: `A liberty is an empty point directly next to a stone or connected group. Diagonals do not count.${context ? ` ${context.sentence}` : ''} When all liberties are filled by the opponent, that group is captured.`,
      conceptIds: ['liberties', 'groups', 'capture'],
      actions: [{ id: 'lesson:liberties', label: 'Review liberties' }],
      ...(context ? { boardFocus: context.boardFocus } : {}),
    };
  }

  if (q.includes('atari')) {
    const context = findCurrentAtariGroup(game, lastMove);
    const atariContext = context ? buildAtariContext(game, context) : null;

    return {
      text: `Atari means a stone or group has exactly one liberty left.${atariContext ? atariContext.sentence : ''} Treat it like an alarm: either save your group by adding a liberty or capture the attacking stones first.`,
      conceptIds: ['atari', 'liberties', 'capture'],
      actions: [{ id: 'practice:capture', label: 'Practice capture' }],
      ...(atariContext ? { boardFocus: atariContext.boardFocus } : {}),
    };
  }

  if (q.includes('capture') || q.includes('capturing')) {
    const target = findLearnerCaptureTarget(game);
    const captureContext = target ? buildCaptureContext(game, target) : null;

    return {
      text: `To capture, fill every liberty of one connected enemy group. Count the empty points directly touching that group, then play the final one when it cannot escape.${captureContext ? captureContext.sentence : ' When an enemy group has one liberty, that last liberty is the capture point.'}`,
      conceptIds: ['capture', 'liberties', 'groups'],
      actions: [{ id: 'practice:capture', label: 'Practice capture' }],
      ...(captureContext ? { boardFocus: captureContext.boardFocus } : {}),
    };
  }

  if (q.includes('territory')) {
    const territoryContext = buildTerritoryContext(game, teachingLevel);

    return {
      text: `Territory is empty space your stones surround well enough that the opponent cannot safely live inside. Beginners should start with corners and edges because the board edge helps form the border.${territoryContext ? ` ${territoryContext.sentence}` : ''}`,
      conceptIds: uniqueConceptIds(['territory', 'corner-opening', ...(territoryContext?.conceptIds ?? [])]),
      actions: [{ id: 'lesson:territory', label: 'Review territory' }],
      ...(territoryContext ? { boardFocus: territoryContext.boardFocus } : {}),
    };
  }

  if (/\beye(s)?\b/.test(q) || q.includes('life and death')) {
    return {
      text: 'An eye is internal empty space your group controls. A group with two real eyes cannot be captured, because the opponent cannot fill both without playing illegal self-capture.',
      conceptIds: ['eyes', 'life-and-death'],
      actions: [
        { id: 'lesson:eyes', label: 'Review eyes' },
        { id: 'practice:life-and-death', label: 'Practice life & death' },
      ],
    };
  }

  if (/\bko\b/.test(q)) {
    const koContext = buildKoContext(game);

    return {
      text: `Ko is the rule that stops both players from immediately repeating the same board position. If a capture would recreate the previous board, you must play somewhere else first.${koContext ? koContext.sentence : ''}`,
      conceptIds: ['ko'],
      actions: [{ id: 'lesson:ko', label: 'Review ko' }],
      ...(koContext ? { boardFocus: koContext.boardFocus } : {}),
    };
  }

  if (q.includes('ladder')) {
    return {
      text: 'A ladder is a forcing chase where every move puts the running stones back into atari. Before starting one, read the path to the edge and check whether another stone breaks the chase.',
      conceptIds: ['ladder', 'reading', 'atari'],
      actions: [
        { id: 'lesson:ladder', label: 'Review ladders' },
        { id: 'practice:reading', label: 'Practice reading' },
      ],
    };
  }

  return null;
}
