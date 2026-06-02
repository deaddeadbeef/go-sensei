import { calculateTerritory, coordToPoint, countStones, getAllGroups, getGroup, getStone, pointEquals, pointKey, pointToCoord } from '@/lib/go-engine';
import type { BoardSize, GameState, Group, Move, Point } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';
import {
  formatObjectiveTargetText,
  getBeginnerObjective,
  getBeginnerObjectiveProgress,
} from '@/lib/coaching/beginner-objectives';
import { getBeginnerObjectiveActions, getBeginnerObjectiveLessonAction } from '@/lib/coaching/beginner-objective-actions';
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

function latestMove(game: GameState): Move | null {
  return game.moveHistory[game.moveHistory.length - 1] ?? null;
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

function findLearnerWeakGroup(game: GameState): Group | null {
  return getAllGroups(game.board)
    .filter((group) => group.color === 'black' && group.liberties.length > 0 && group.liberties.length <= 2)
    .sort((a, b) => a.liberties.length - b.liberties.length || compareGroupsByAnchor(a, b))[0] ?? null;
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

function isConfusionQuestion(q: string): boolean {
  return /\b(i\s+m|im|i\s+am|i\s+feel)\s+(confused|lost|stuck|overwhelmed)\b/.test(q)
    || /\b(i\s+do\s+not|i\s+don\s+t|i\s+dont)\s+(understand|know)\b/.test(q)
    || /\b(this|go)\s+(is|feels)\s+(confusing|overwhelming|hard)\b/.test(q)
    || /\btoo\s+much\b/.test(q)
    || /\bwhere\s+do\s+i\s+even\s+start\b/.test(q);
}

function isResignRestartQuestion(q: string): boolean {
  return /\b(should|can|could|do)\s+i\s+resign\b/.test(q)
    || /\bhow\s+do\s+i\s+resign\b/.test(q)
    || /\bresign\s+(now|this|game)\b/.test(q)
    || /\b(i\s+want\s+to|i\s+m\s+going\s+to|im\s+going\s+to|i\s+am\s+going\s+to)\s+(resign|give\s+up|quit|start\s+over|restart)\b/.test(q)
    || /\b(should|can|could|do)\s+i\s+(give\s+up|quit|start\s+over|restart)\b/.test(q)
    || /\bstart\s+(this\s+)?over\b/.test(q)
    || /\brestart\s+(the\s+)?(game|board)\b/.test(q);
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

function isConnectionQuestion(q: string): boolean {
  const mentionsConnection = /\bconnect(?:ed|ing|ion|ions)?\b/.test(q)
    || /\bcut(?:s|ting)?\b/.test(q)
    || /\bdiagonal(?:ly|s)?\b/.test(q)
    || /\bgroups?\b/.test(q);

  return /\bwhat\s+(is|are)\s+(a\s+)?groups?\b/.test(q)
    || /\bhow\s+do\s+i\s+connect\b/.test(q)
    || /\bdo\s+diagonal\s+stones\s+connect\b/.test(q)
    || (mentionsConnection && /\b(stones?|groups?|diagonal(?:ly|s)?|cuts?|cutting|solid|jump)\b/.test(q));
}

function isWeakGroupQuestion(q: string): boolean {
  return /\bweak\s+groups?\b/.test(q)
    || /\bwhich\s+(stones?|groups?)\s+(is|are)\s+(weak|in\s+trouble|in\s+danger|short\s+on\s+liberties)\b/.test(q)
    || /\bwhich\s+(stones?|groups?)\s+(need|needs)\s+(room|help|saving|liberties)\b/.test(q)
    || /\bhow\s+do\s+i\s+(save|defend|rescue|help)\s+(my\s+)?(stones?|groups?)\b/.test(q)
    || /\bwhat\s+(does|do|is)\s+give\s+weak\s+groups?\s+room\b/.test(q)
    || /\bshort\s+on\s+liberties\b/.test(q);
}

function mentionedCoordinates(q: string, boardSize: BoardSize): Point[] {
  const points: Point[] = [];
  const seen = new Set<string>();

  for (const token of q.split(/\s+/)) {
    if (!/^[a-hj-t]\d{1,2}$/i.test(token)) continue;
    const point = coordToPoint(token, boardSize);
    if (!point) continue;

    const key = pointKey(point);
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(point);
  }

  return points;
}

function mentionedCoordinate(q: string, boardSize: BoardSize): Point | null {
  return mentionedCoordinates(q, boardSize)[0] ?? null;
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

function isCandidateComparisonQuestion(q: string, boardSize: BoardSize): boolean {
  if (mentionedCoordinates(q, boardSize).length < 2) return false;

  return /\b(or|vs|versus|compare|choose|which|better)\b/.test(q);
}

function isPassQuestion(q: string): boolean {
  if (!/\bpass(ed|ing)?\b/.test(q)) return false;

  return /\bwhy\b/.test(q)
    || /\bwhat\s+(is|does|did)\b/.test(q)
    || /\bdid\s+(white|sensei|you)\s+pass\b/.test(q)
    || /\bshould\s+i\s+pass\b/.test(q)
    || /\b(can|could|do)\s+i\s+pass\b/.test(q)
    || /\bpass\s+now\b/.test(q)
    || /\bwhose\s+turn\b/.test(q);
}

function isLearnerPassDecisionQuestion(q: string): boolean {
  return /\bshould\s+i\s+pass\b/.test(q)
    || /\b(can|could|do)\s+i\s+pass\b/.test(q)
    || /\bpass\s+now\b/.test(q);
}

function isUndoQuestion(q: string): boolean {
  return /\b(can|could|should|do)\s+i\s+(undo|take\s+back)\b/.test(q)
    || /\b(can|could|should|do)\s+i\s+take\s+(that|this|my\s+move|move)\s+back\b/.test(q)
    || /\bhow\s+do\s+i\s+(undo|take\s+back)\b/.test(q)
    || /\bhow\s+do\s+i\s+take\s+(that|this|my\s+move|move)\s+back\b/.test(q)
    || /\bundo\s+(that|this|my\s+move|move)\b/.test(q)
    || /\btake\s+(that|this|my\s+move|move)\s+back\b/.test(q)
    || /\btake\s+back\s+(that|this|my\s+move|move)\b/.test(q)
    || /\bfix\s+(that|this|my\s+move|mistake)\b/.test(q)
    || /\bi\s+made\s+a\s+mistake\b/.test(q)
    || /\bmisclicked\b/.test(q);
}

function isPositionQuestion(q: string): boolean {
  return /\b(am\s+i|are\s+we|is\s+black|is\s+white)\s+(winning|ahead|behind|losing)\b/.test(q)
    || /\bwho\s+(is|s)\s+(winning|ahead|behind)\b/.test(q)
    || /\bwhat\s+(is|s)\s+the\s+score\b/.test(q)
    || /\bscore\b/.test(q)
    || /\bhow\s+many\s+points\b/.test(q)
    || /\bcount\s+(the\s+)?(score|points|territory)\b/.test(q)
    || /\bposition\s+(look|looks)\b/.test(q);
}

function isGameGoalQuestion(q: string): boolean {
  return /\bhow\s+(do|can)\s+(i|you|we|black|white)\s+win\b/.test(q)
    || /\bhow\s+(do|does)\s+(players?|someone)\s+win\b/.test(q)
    || /\bwhat\s+(is|s)\s+the\s+(goal|objective|object|point)\s+(of\s+(go|this\s+game|the\s+game))?\b/.test(q)
    || /\bwhat\s+am\s+i\s+trying\s+to\s+do\b/.test(q)
    || /\bwhat\s+are\s+we\s+trying\s+to\s+do\b/.test(q)
    || /\bwhat\s+should\s+i\s+be\s+trying\s+to\s+do\b/.test(q);
}

function isRulesQuestion(q: string): boolean {
  return /\bwhat\s+(are|re)\s+the\s+(basic\s+)?rules\b/.test(q)
    || /\bhow\s+(do|does)\s+(i|we|you)\s+play\s+(go|this\s+game)?\b/.test(q)
    || /\bhow\s+is\s+go\s+played\b/.test(q)
    || /\bhow\s+does\s+go\s+work\b/.test(q)
    || /\bteach\s+me\s+the\s+(rules|basics)\b/.test(q)
    || /\bexplain\s+the\s+(rules|basics)\b/.test(q)
    || /\bi\s+do\s+not\s+know\s+how\s+to\s+play\b/.test(q);
}

function isKomiQuestion(q: string): boolean {
  return /\bkomi\b/.test(q);
}

function isCoordinateQuestion(q: string, boardSize: BoardSize): boolean {
  const mentionsPoint = mentionedCoordinate(q, boardSize) !== null;
  if (mentionsPoint) {
    if (/\bwhat\s+about\b/.test(q) || /\bhow\s+about\b/.test(q)) return false;

    return /\b(where|show|find|locate)\b/.test(q)
      || /\bwhat\s+(is|does)\s+[a-hj-t]\d{1,2}\b/.test(q)
      || /\bhow\s+do\s+i\s+(find|read|see)\b/.test(q);
  }

  return /\bhow\s+(do|does)\s+(go\s+)?coordinates?\s+work\b/.test(q)
    || /\bwhat\s+(is|are)\s+(go\s+)?coordinates?\b/.test(q)
    || /\bhow\s+do\s+i\s+read\s+(the\s+)?board\b/.test(q)
    || /\bwhich\s+way\s+do\s+numbers\s+go\b/.test(q);
}

function isTurnQuestion(q: string): boolean {
  return /\bwhose\s+turn\b/.test(q)
    || /\bwho\s+(plays|moves|goes)\s+(next|now)\b/.test(q)
    || /\b(is\s+it|is\s+this)\s+(my|your|black|white)\s+turn\b/.test(q)
    || /\bdo\s+i\s+(play|move|go)\s+(now|next|again)\b/.test(q)
    || /\bwhy\s+do\s+i\s+(play|move|go)\s+again\b/.test(q)
    || /\bam\s+i\s+(black|white)\b/.test(q)
    || /\bam\s+i\s+playing\s+(black|white)\b/.test(q)
    || /\bdo\s+i\s+play\s+(black|white)\b/.test(q)
    || /\bwhich\s+colou?r\s+(am\s+i|do\s+i\s+play)\b/.test(q)
    || /\bwhat\s+colou?r\s+(am\s+i|do\s+i\s+play)\b/.test(q);
}

function isBoardMarkerQuestion(q: string): boolean {
  return /\bwhat\s+are\s+(these|the)\s+(numbered\s+)?(targets|suggestions|markers|dots|circles)\b/.test(q)
    || /\bwhat\s+do\s+(these|the)\s+(numbered\s+)?(targets|suggestions|markers|dots|circles)\s+(mean|do)\b/.test(q)
    || /\bwhat\s+are\s+(the\s+)?marked\s+(points|moves|targets)\b/.test(q)
    || /\bwhat\s+do\s+(the\s+)?marked\s+(points|moves|targets)\s+(mean|do)\b/.test(q)
    || /\bhow\s+do\s+i\s+(use|read|understand)\s+(the\s+)?(targets|suggestions|markers|dots|circles|board\s+analysis)\b/.test(q)
    || /\bwhat\s+(is|does)\s+(show\s+targets|board\s+analysis)\s+(mean|do)\b/.test(q)
    || /\bwhy\s+are\s+(there\s+)?(numbers|targets|suggestions|markers|dots|circles)\s+on\s+(the\s+)?board\b/.test(q);
}

function isCornerOpeningQuestion(q: string): boolean {
  return /\bwhy\s+(start|play|begin|open)\s+(in|near|with)\s+(a\s+)?corner\b/.test(q)
    || /\bwhy\s+(the\s+)?corners?\b/.test(q)
    || /\bwhy\s+not\s+(the\s+)?cent(er|re)\b/.test(q)
    || /\bshould\s+i\s+(start|play|begin|open)\s+(in|near|with)\s+(the\s+)?cent(er|re)\b/.test(q)
    || /\bis\s+(the\s+)?cent(er|re)\s+(good|bad|ok|okay)\s+(to\s+start|for\s+my\s+first\s+move|in\s+the\s+opening)?\b/.test(q)
    || /\bshould\s+i\s+(start|play|begin|open)\s+(in|near|with)\s+(a\s+)?corner\b/.test(q)
    || /\bwhere\s+should\s+i\s+start\s+(the\s+)?opening\b/.test(q)
    || /\bhow\s+do\s+i\s+start\s+(the\s+)?opening\b/.test(q);
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

function comparisonTargetReason(
  objective: BeginnerObjective,
  points: Point[],
  boardSize: BoardSize,
  anchor: Point | null,
): string {
  const coords = points.map((point) => pointToCoord(point, boardSize));
  const coordText = joinList(coords);

  if (objective.id === 'claim-corner') {
    return `${coordText} are marked corner starts. The board edges help both of them make territory, so either one is a good beginner choice.`;
  }

  if (objective.id === 'extend-from-stone') {
    const anchorCoord = anchor ? pointToCoord(anchor, boardSize) : 'your anchor stone';
    return `${coordText} are both one-space jumps from ${anchorCoord}. They teach the same idea in different directions: keep a one-point gap so the stones help each other without clumping.`;
  }

  return `${coordText} are marked liberties for the group that needs room, so either one helps that group breathe.`;
}

function buildCandidateComparisonAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer | null {
  const requestedPoints = mentionedCoordinates(q, game.board.size);
  if (requestedPoints.length < 2) return null;

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });

  if (!objective) return null;

  const suggestions = objectiveSuggestions(objective, game.board.size, 'local-candidate-comparison-move');
  const action = getBeginnerObjectiveLessonAction(objective);
  const lastMove = lastPlacedMove(game);
  const targetCoordText = objectiveTargetCoordList(objective, game.board.size);
  const comparedPoints = requestedPoints.slice(0, 4);
  const markedPoints = comparedPoints.filter((candidate) => (
    objective.targetPoints.some((target) => pointEquals(target, candidate))
  ));
  const unmarkedPoints = comparedPoints.filter((candidate) => (
    !objective.targetPoints.some((target) => pointEquals(target, candidate))
  ));
  const highlights: LocalHighlightFocus[] = unmarkedPoints.map((point) => {
    const coord = pointToCoord(point, game.board.size);
    return {
      id: `local-candidate-comparison-${pointKey(point)}`,
      point: copyPoint(point),
      variant: getStone(game.board, point) === null ? 'warning' : 'danger',
      label: getStone(game.board, point) === null
        ? `${coord}: open, but not the current beginner target.`
        : `${coord}: already occupied.`,
    };
  });

  const lines: string[] = [];

  if (markedPoints.length >= 2 && unmarkedPoints.length === 0) {
    lines.push(`Both choices fit the current goal: ${objective.title}.`);
    lines.push(comparisonTargetReason(objective, markedPoints, game.board.size, lastMove?.point ?? null));
    lines.push('I marked both choices again; choose the side where you want your next area to grow.');
  } else if (markedPoints.length >= 1) {
    const preferred = markedPoints[0];
    const preferredCoord = pointToCoord(preferred, game.board.size);
    lines.push(`I would choose ${preferredCoord} for this beginner goal.`);
    lines.push(targetReason(objective, preferred, game.board.size, lastMove?.point ?? null));
    for (const point of unmarkedPoints.slice(0, 2)) {
      lines.push(candidateMissReason(objective, point, game.board.size, lastMove?.point ?? null));
    }
    lines.push(`I highlighted the off-goal option${unmarkedPoints.length === 1 ? '' : 's'} and re-marked the better beginner target.`);
  } else {
    lines.push('Neither mentioned point is one of the current marked beginner targets.');
    if (targetCoordText) {
      lines.push(`For this board, I would compare the marked choices instead: ${targetCoordText}.`);
    } else {
      lines.push(objective.instruction);
    }
    for (const point of unmarkedPoints.slice(0, 2)) {
      lines.push(candidateMissReason(objective, point, game.board.size, lastMove?.point ?? null));
    }
  }

  return {
    text: lines.join(' '),
    conceptIds: objective.conceptIds,
    boardFocus: {
      ...(highlights.length > 0 ? { highlights } : {}),
      suggestions,
    },
    actions: [
      { id: 'hint', label: 'Show targets' },
      ...(action ? [action] : []),
    ],
  };
}

function buildPassAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer {
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-pass-explanation-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;
  const move = latestMove(game);
  const lines: string[] = [];

  if (isLearnerPassDecisionQuestion(q) && objective && game.phase === 'playing') {
    lines.push('Not yet. Passing is usually an endgame decision, when both players believe there are no valuable moves left.');
    lines.push('Early in this guided game, passing would skip useful practice and hand the turn away.');
    const targetText = formatObjectiveTargetText(objective, game.board.size);
    lines.push(`Your better move is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  } else if (move?.type === 'pass' && move.color === 'white' && game.currentPlayer === 'black') {
    lines.push('White passed because I am keeping this guided practice moving locally: you get the next turn right away so you can try the next beginner idea.');
  } else if (move?.type === 'pass') {
    lines.push(`${move.color === 'black' ? 'Black' : 'White'} passed, which means that player chose not to place a stone on that turn.`);
  } else {
    lines.push('A pass means a player chooses not to place a stone on that turn.');
  }

  if (!isLearnerPassDecisionQuestion(q)) {
    lines.push('In a real game, players usually pass near the end when they believe there are no valuable moves left; two passes in a row move the game to scoring.');
  }

  if (objective && !isLearnerPassDecisionQuestion(q)) {
    const targetText = formatObjectiveTargetText(objective, game.board.size);
    lines.push(`Here, do not treat White's pass as endgame strategy. Your next focus is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  }

  if (suggestions.length > 0) {
    lines.push(isLearnerPassDecisionQuestion(q)
      ? 'I marked the moves that keep the game useful right now.'
      : 'I marked the next beginner targets on the board.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['stones-and-board', 'scoring', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
    ],
  };
}

function buildUndoAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const objective = game.phase === 'playing'
    ? getBeginnerObjective({
      boardSize: game.board.size,
      board: game.board,
      moveHistory: game.moveHistory,
      moveCount: game.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel,
    })
    : null;
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-undo-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;
  const move = latestMove(game);
  const lines: string[] = [];

  if (!move) {
    lines.push('There is nothing to undo yet; no stones have been played.');
  } else if (move.type === 'pass' && move.color === 'white' && game.currentPlayer === 'black') {
    lines.push('Yes. The Undo button will take back the local White pass and your previous Black move, returning you to the choice before that turn.');
    lines.push('Use it for misclicks, then replay one of the marked targets.');
  } else if (move.color === 'white') {
    lines.push("Yes. The Undo button will take back White's last move and your previous Black move, returning you to your last decision.");
    lines.push('Use it for misclicks; for learning, also ask me to review the move so you know what changed.');
  } else if (move.type === 'place') {
    const coord = pointToCoord(move.point, game.board.size);
    lines.push(`Yes. Use Undo to take back your last move at ${coord} and try again.`);
    lines.push('That is fine for misclicks; for learning, also ask me to review the move so you know what changed.');
  } else {
    lines.push('Yes. Use Undo to take back the last move and return to the previous board position.');
    lines.push('That is fine for misclicks; for learning, also ask me to review the move so you know what changed.');
  }

  if (objective) {
    const targetText = formatObjectiveTargetText(objective, game.board.size);
    const prefix = move ? 'Your current guided target is' : 'In guided practice, your next useful move is';
    lines.push(`${prefix}: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  }

  if (suggestions.length > 0) {
    lines.push(move ? 'I marked the current targets again.' : 'I marked the first targets again.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['stones-and-board', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
    ],
  };
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatLead(blackScore: number, whiteScore: number): string {
  const margin = Math.abs(blackScore - whiteScore);
  if (margin === 0) return 'The score is tied';

  return `${blackScore > whiteScore ? 'Black' : 'White'} leads by ${margin} ${margin === 1 ? 'point' : 'points'}`;
}

function buildPositionAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const blackStones = countStones(game.board, 'black');
  const whiteStones = countStones(game.board, 'white');
  const objective = game.phase === 'playing'
    ? getBeginnerObjective({
      boardSize: game.board.size,
      board: game.board,
      moveHistory: game.moveHistory,
      moveCount: game.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel,
    })
    : null;
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-position-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;
  const lines: string[] = [];

  if (game.phase === 'scoring' || game.phase === 'finished') {
    const territory = calculateTerritory(game.board, game.komi);
    const blackScore = territory.finalBlackScore;
    const whiteScore = territory.finalWhiteScore;

    lines.push(`${formatLead(blackScore, whiteScore)} if this board is scored now.`);
    lines.push(`Black has ${pluralize(blackStones, 'stone')} plus ${pluralize(territory.blackTerritory.length, 'territory point')}; White has ${pluralize(whiteStones, 'stone')} plus ${pluralize(territory.whiteTerritory.length, 'territory point')} and ${game.komi} komi.`);
    lines.push('In scoring, first make sure dead stones are marked correctly; that can change the final count.');
  } else {
    lines.push('It is too early for a real score: most of the board is still open, so territory is not settled yet.');
    lines.push(`Right now Black has ${pluralize(blackStones, 'stone')} on the board and ${pluralize(game.captures.black, 'capture')}; White has ${pluralize(whiteStones, 'stone')} and ${pluralize(game.captures.white, 'capture')}, plus ${game.komi} komi.`);
    lines.push('A better beginner position check is: are your stones near easy territory, do they have room, and are any groups short on liberties?');

    if (objective) {
      const targetText = formatObjectiveTargetText(objective, game.board.size);
      lines.push(`For this board, your next useful test is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
    }
  }

  if (suggestions.length > 0) {
    lines.push('I marked the next targets so you can improve the position instead of only counting it.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['scoring', 'territory', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
    ],
  };
}

function buildKomiAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const objective = game.phase === 'playing'
    ? getBeginnerObjective({
      boardSize: game.board.size,
      board: game.board,
      moveHistory: game.moveHistory,
      moveCount: game.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel,
    })
    : null;
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-komi-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;
  const lines = [
    `Komi is ${game.komi} points added to White's score because Black moves first.`,
    'It balances the first-move advantage and usually makes draws impossible because of the half point.',
    'Komi is not territory White has surrounded; it is a scoring bonus that matters when the game is counted.',
  ];

  if (objective) {
    const targetText = formatObjectiveTargetText(objective, game.board.size);
    lines.push(`For now, improve the board before counting it: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  }

  if (suggestions.length > 0) {
    lines.push('I marked the next targets so you can keep building a position worth scoring later.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['scoring', 'territory', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
    ],
  };
}

function buildGameGoalAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const objective = game.phase === 'playing'
    ? getBeginnerObjective({
      boardSize: game.board.size,
      board: game.board,
      moveHistory: game.moveHistory,
      moveCount: game.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel,
    })
    : null;
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-game-goal-move') : [];
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const lines = [
    'To win Go, finish with more points than your opponent.',
    `Points come from empty territory you surround, captured stones, and White's ${game.komi} komi bonus.`,
    'Stones are the tools: they claim space, keep liberties, connect into strong groups, and make the opponent work harder to live.',
  ];

  if (objective) {
    lines.push(`For this beginner board, translate that big goal into one job: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  }

  if (suggestions.length > 0) {
    lines.push('I marked moves that turn the win condition into your next board decision.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['scoring', 'territory', 'capture', 'liberties', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'lesson:territory', label: 'Review territory' },
    ],
  };
}

function buildRulesAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const objective = game.phase === 'playing'
    ? getBeginnerObjective({
      boardSize: game.board.size,
      board: game.board,
      moveHistory: game.moveHistory,
      moveCount: game.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel,
    })
    : null;
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-rules-move') : [];
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const lines = [
    'The basic rules of Go are small: players alternate placing Black and White stones on empty intersections, not squares.',
    'Stones that touch up, down, left, or right become one group; empty points touching that group are liberties.',
    'If a group loses every liberty, it is captured and removed from the board.',
    `When both players pass, the board is scored: surrounded territory, captures, and White's ${game.komi} komi decide who has more points.`,
  ];

  if (objective) {
    lines.push(`In this guided game, use those rules by following one concrete job: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  }

  if (suggestions.length > 0) {
    lines.push('I marked the legal beginner targets so the rules connect to your next move.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds([
      'stones-and-board',
      'groups',
      'liberties',
      'capture',
      'territory',
      'scoring',
      ...(objective?.conceptIds ?? []),
    ]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'lesson:liberties', label: 'Review liberties' },
    ],
  };
}

function buildCoordinateAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer {
  const requestedPoint = mentionedCoordinate(q, game.board.size);
  const requestedCoord = requestedPoint ? pointToCoord(requestedPoint, game.board.size) : null;
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-coordinate-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;
  const lines = [
    'Go coordinates name intersections, not squares.',
    `Letters run left to right across the board and skip I; numbers run from bottom to top, so row ${game.board.size} is the top edge and row 1 is the bottom edge.`,
  ];
  const highlights: LocalHighlightFocus[] = [];

  if (requestedPoint && requestedCoord) {
    const column = requestedCoord[0];
    const row = requestedCoord.slice(1);
    lines.push(`${requestedCoord} means column ${column}, row ${row}. I highlighted ${requestedCoord} on the board.`);
    highlights.push({
      id: `local-coordinate-${pointKey(requestedPoint)}`,
      point: copyPoint(requestedPoint),
      variant: 'neutral',
      label: `${requestedCoord}: column ${column}, row ${row}.`,
    });
  } else {
    lines.push('Read a coordinate by finding its letter column first, then its numbered row, and place the stone where they cross.');
  }

  if (objective) {
    const targetText = formatObjectiveTargetText(objective, game.board.size);
    lines.push(`For the current beginner goal, ${targetText ?? objective.instruction}`);
  }

  if (suggestions.length > 0) {
    lines.push('I kept the current target points marked so you can connect the coordinate labels to the board.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['stones-and-board', ...(objective?.conceptIds ?? [])]),
    boardFocus: {
      ...(highlights.length > 0 ? { highlights } : {}),
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
    ],
  };
}

function buildTurnAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const objective = game.phase === 'playing' && game.currentPlayer === 'black'
    ? getBeginnerObjective({
      boardSize: game.board.size,
      board: game.board,
      moveHistory: game.moveHistory,
      moveCount: game.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel,
    })
    : null;
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-turn-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;
  const move = latestMove(game);
  const lines = [
    'You are playing Black in this guided beginner game. Black moves first; Sensei is White.',
  ];

  if (game.phase === 'scoring') {
    lines.push('The game is in scoring now, so there is no normal move to play. Check dead stones and count territory.');
  } else if (game.phase === 'finished') {
    lines.push('The game is finished, so there is no turn to take.');
  } else if (game.currentPlayer === 'black') {
    lines.push('It is your turn now: place one black stone on an empty intersection.');

    if (move?.type === 'pass' && move.color === 'white') {
      lines.push('White just passed locally so you can keep practicing right away; that teaching shortcut is why you move again.');
    } else if (move?.type === 'place' && move.color === 'white') {
      lines.push(`White just played ${pointToCoord(move.point, game.board.size)}, so the turn returned to Black.`);
    } else if (!move) {
      lines.push('No moves have been played yet, so Black starts.');
    }
  } else {
    lines.push("It is White's turn now, so wait for Sensei's response before playing another black stone.");

    if (move?.type === 'place' && move.color === 'black') {
      lines.push(`Your last move was ${pointToCoord(move.point, game.board.size)}; White should answer next.`);
    } else if (move?.type === 'pass' && move.color === 'black') {
      lines.push('You just passed, so White is to play.');
    }
  }

  if (objective) {
    const targetText = formatObjectiveTargetText(objective, game.board.size);
    lines.push(`Your next move should follow the current goal: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  } else if (game.phase === 'playing' && game.currentPlayer === 'black') {
    lines.push('If no target is marked, look for a move that gives your stones room, connects, or claims easier territory.');
  }

  if (suggestions.length > 0) {
    lines.push('I marked the next targets so the turn status connects to the board.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['stones-and-board', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
    ],
  };
}

function markerObjectiveReason(objective: BeginnerObjective, boardSize: BoardSize): string {
  if (objective.id === 'claim-corner') {
    return 'These targets are corner starts: the board edge helps you make territory with fewer stones.';
  }

  if (objective.id === 'extend-from-stone') {
    const coords = objective.targetPoints.slice(0, 4).map((point) => pointToCoord(point, boardSize));
    return `${joinList(coords)} are marked because they are one-space jumps: they keep your stones working together without clumping.`;
  }

  return 'These targets are liberties for a group that is short on breathing room; playing one gives that group more ways to escape.';
}

function buildBoardMarkerAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer | null {
  const objective = game.phase === 'playing'
    ? getBeginnerObjective({
      boardSize: game.board.size,
      board: game.board,
      moveHistory: game.moveHistory,
      moveCount: game.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel,
    })
    : null;

  if (!objective || objective.targetPoints.length === 0) return null;

  const suggestions = objectiveSuggestions(objective, game.board.size, 'local-marker-guide-move');
  const action = getBeginnerObjectiveLessonAction(objective);
  const targetText = formatObjectiveTargetText(objective, game.board.size);
  const lines = [
    'The glowing numbered circles are suggested moves, not stones already on the board.',
    'The number is the suggestion rank: #1 is the first idea to try, and higher numbers are other good options for the same beginner goal.',
    `Right now the marked target goal is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`,
    markerObjectiveReason(objective, game.board.size),
    'Click one marked intersection to play there, or use Show targets to restore the markers if they disappear.',
    'I marked the targets again and kept the reasons in Board Analysis.',
  ];

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['stones-and-board', ...(objective?.conceptIds ?? [])]),
    boardFocus: { suggestions },
    actions: [
      { id: 'hint', label: 'Show targets' },
      ...(action ? [action] : []),
    ],
  };
}

function buildCornerOpeningAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const objective = game.phase === 'playing'
    ? getBeginnerObjective({
      boardSize: game.board.size,
      board: game.board,
      moveHistory: game.moveHistory,
      moveCount: game.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel,
    })
    : null;
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-corner-opening-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const lines = [
    'Corners are the easiest place for beginners to make territory because two board edges already act like walls.',
    'A center stone reaches in every direction, but it has to build all four sides itself before it becomes points.',
    'That is why the first guided goal starts near a corner instead of the open center.',
  ];

  if (objective?.id === 'claim-corner') {
    lines.push(`${targetText ?? 'Try one of the marked corner starts.'} I marked the corner starts again.`);
  } else if (objective) {
    lines.push(`For the current board, keep following: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['corner-opening', 'territory', 'influence', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
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

function buildConnectionAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const lastMove = lastPlacedMove(game);
  const context = lastMove ? buildLibertyContext(game, lastMove.point, 'This connected group') : null;
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-connection-move') : [];
  const anchorText = lastMove ? pointToCoord(lastMove.point, game.board.size) : null;
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const targetCoords = objective?.targetPoints.slice(0, 4).map((point) => pointToCoord(point, game.board.size)) ?? [];
  const lines = [
    'Stones become one solid group only when they touch up, down, left, or right.',
    'Diagonals do not connect.',
    'A cut is the empty point or line where the opponent can separate stones that are only loosely related.',
  ];

  if (context) {
    lines.push(context.sentence);
  } else {
    lines.push('Play a stone first, then I can mark its group and liberties on the board.');
  }

  if (objective?.id === 'extend-from-stone') {
    if (targetCoords.length === 1) {
      lines.push(`${targetCoords[0]} is not a solid connection${anchorText ? ` to ${anchorText}` : ''} yet. It is a one-space jump: close enough to work together while reaching for territory. If White attacks the gap later, answer by connecting or defending.`);
    } else {
      const targets = targetCoords.length > 1 ? joinList(targetCoords) : 'The marked targets';
      lines.push(`${targets} are not solid connections${anchorText ? ` to ${anchorText}` : ''} yet. They are one-space jumps: close enough to work together while reaching for territory. If White attacks the gap later, answer by connecting or defending.`);
    }
  } else if (objective) {
    lines.push(`For the current board, first follow the beginner target: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  }

  if (context && suggestions.length > 0) {
    lines.push('I marked your current group and the connection-shape targets.');
  } else if (suggestions.length > 0) {
    lines.push('I marked the current beginner targets.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['groups', 'liberties', 'shape', ...(objective?.conceptIds ?? [])]),
    boardFocus: {
      ...(context?.boardFocus ?? {}),
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'lesson:groups', label: 'Review groups' },
    ],
  };
}

function buildWeakGroupAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const weakGroup = findLearnerWeakGroup(game);
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });

  if (!weakGroup) {
    const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-weak-group-current-move') : [];
    const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;

    return {
      text: [
        'A weak group is a connected group with very little room, usually one or two liberties.',
        'I do not see one of your Black groups in immediate danger right now.',
        objective ? `Your current guided job is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}` : '',
        suggestions.length > 0 ? 'I marked the current beginner targets so you can keep building safely.' : '',
      ].filter(Boolean).join(' '),
      conceptIds: uniqueConceptIds(['groups', 'liberties', ...(objective?.conceptIds ?? [])]),
      ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
      actions: [
        ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
        { id: 'lesson:liberties', label: 'Review liberties' },
      ],
    };
  }

  const anchor = groupAnchor(weakGroup);
  const anchorCoord = pointToCoord(anchor, game.board.size);
  const libertyCoords = weakGroup.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const libertyList = joinList(libertyCoords);
  const libertyWord = weakGroup.liberties.length === 1 ? 'liberty' : 'liberties';
  const suggestions = weakGroup.liberties.slice(0, 4).map((liberty, index) => {
    const coord = pointToCoord(liberty, game.board.size);

    return {
      id: `local-weak-group-move-${pointKey(liberty)}`,
      point: copyPoint(liberty),
      rank: index + 1,
      reason: weakGroup.liberties.length === 1
        ? `Save the group by playing its last liberty at ${coord}.`
        : `Give the weak group another liberty by playing ${coord}.`,
    };
  });
  const lines = [
    `The weak group is your Black group at ${anchorCoord}.`,
    `It has only ${weakGroup.liberties.length} ${libertyWord}: ${libertyList}.`,
    weakGroup.liberties.length === 1
      ? 'That is atari: if White fills that last liberty, the group will be captured.'
      : 'A weak group is not lost, but it is short on room; if White fills those liberties, it will be captured.',
    weakGroup.liberties.length === 1
      ? 'Play the marked liberty to give it breathing room.'
      : 'Play one marked liberty to give it breathing room.',
    'I marked the weak group, its liberties, and the rescue moves.',
  ];

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds([
      'groups',
      'liberties',
      'capture',
      ...(weakGroup.liberties.length === 1 ? ['atari'] : []),
      ...(objective?.conceptIds ?? []),
    ]),
    boardFocus: {
      liberties: [{
        id: `local-weak-group-liberties-${pointKey(anchor)}`,
        point: copyPoint(anchor),
        count: weakGroup.liberties.length,
        libertyPoints: weakGroup.liberties.map(copyPoint),
      }],
      groups: [{
        id: `local-weak-group-${pointKey(anchor)}`,
        stones: weakGroup.stones.map(copyPoint),
        color: weakGroup.color,
        liberties: weakGroup.liberties.length,
        label: `Weak Black group: ${weakGroup.liberties.length} ${libertyWord} at ${libertyList}.`,
      }],
      suggestions,
    },
    actions: [
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ],
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
    currentPlayer: 'black',
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

function buildConfusionAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
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
      text: 'Slow down to one board question: find an empty intersection where your stones get more room, easier territory, or a capture threat. Ask "What should I play?" when you want a concrete target.',
      conceptIds: ['direction-of-play'],
    };
  }

  const targetText = formatObjectiveTargetText(objective, game.board.size);
  const suggestions = objectiveSuggestions(objective, game.board.size, 'local-confusion-move');

  return {
    text: [
      'Slow down to one board job.',
      `Your current job is: ${objective.title}.`,
      objective.instruction,
      targetText ?? '',
      objective.why,
      'Do not try to solve the whole board yet: choose one marked coordinate, then ask what it changed.',
      suggestions.length > 0 ? 'I marked the targets again so your next action is visible.' : '',
    ].filter(Boolean).join(' '),
    conceptIds: uniqueConceptIds(['direction-of-play', ...(objective.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions: getBeginnerObjectiveActions(objective),
  };
}

function buildResignRestartAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const objective = game.phase === 'playing'
    ? getBeginnerObjective({
      boardSize: game.board.size,
      board: game.board,
      moveHistory: game.moveHistory,
      moveCount: game.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel,
    })
    : null;
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-resign-restart-move') : [];
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const actions: SenseiAction[] = [
    ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
    { id: 'guided:intro', label: 'Start fresh guided game' },
  ];
  const lessonAction = objective ? getBeginnerObjectiveLessonAction(objective) : null;

  if (lessonAction) actions.push(lessonAction);

  return {
    text: [
      'Resigning or starting over is allowed, but do it deliberately: it ends this practice position instead of teaching from it.',
      'For guided learning, first try to rescue one useful idea from the board.',
      objective ? `Your current salvage job is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}` : 'If the board feels unusable, start a fresh guided game and keep the first move simple.',
      objective?.why ?? '',
      suggestions.length > 0 ? 'I marked the current targets; play one of them before deciding to throw this board away.' : '',
    ].filter(Boolean).join(' '),
    conceptIds: uniqueConceptIds(['stones-and-board', 'direction-of-play', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions,
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

  if (isPassQuestion(q)) {
    return buildPassAnswer(game, teachingLevel, q);
  }

  if (isUndoQuestion(q)) {
    return buildUndoAnswer(game, teachingLevel);
  }

  if (isResignRestartQuestion(q)) {
    return buildResignRestartAnswer(game, teachingLevel);
  }

  if (isKomiQuestion(q)) {
    return buildKomiAnswer(game, teachingLevel);
  }

  if (isGameGoalQuestion(q)) {
    return buildGameGoalAnswer(game, teachingLevel);
  }

  if (isRulesQuestion(q)) {
    return buildRulesAnswer(game, teachingLevel);
  }

  if (isPositionQuestion(q)) {
    return buildPositionAnswer(game, teachingLevel);
  }

  if (isCoordinateQuestion(q, game.board.size)) {
    return buildCoordinateAnswer(game, teachingLevel, q);
  }

  if (isTurnQuestion(q)) {
    return buildTurnAnswer(game, teachingLevel);
  }

  if (isCandidateComparisonQuestion(q, game.board.size)) {
    const comparisonAnswer = buildCandidateComparisonAnswer(game, teachingLevel, q);
    if (comparisonAnswer) return comparisonAnswer;
  }

  if (isTargetReasonQuestion(q, game.board.size)) {
    const targetAnswer = buildTargetReasonAnswer(game, teachingLevel, q);
    if (targetAnswer) return targetAnswer;
  }

  if (isBoardMarkerQuestion(q)) {
    const markerAnswer = buildBoardMarkerAnswer(game, teachingLevel);
    if (markerAnswer) return markerAnswer;
  }

  if (isCornerOpeningQuestion(q)) {
    return buildCornerOpeningAnswer(game, teachingLevel);
  }

  if (isWeakGroupQuestion(q)) {
    return buildWeakGroupAnswer(game, teachingLevel);
  }

  if (isConnectionQuestion(q)) {
    return buildConnectionAnswer(game, teachingLevel);
  }

  if (isCandidateMoveQuestion(q, game.board.size)) {
    const candidateAnswer = buildCandidateMoveAnswer(game, teachingLevel, q);
    if (candidateAnswer) return candidateAnswer;
  }

  if (isShapeQuestion(q)) {
    return buildShapeAnswer(game, teachingLevel);
  }

  if (isConfusionQuestion(q)) {
    return buildConfusionAnswer(game, teachingLevel);
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
