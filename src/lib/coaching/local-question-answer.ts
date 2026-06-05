import {
  calculateTerritory,
  coordToPoint,
  countStones,
  createGame,
  getAdjacentPoints,
  getAllGroups,
  getGroup,
  getStone,
  isOnBoard,
  passMove,
  playMove,
  pointEquals,
  pointKey,
  pointToCoord,
  resignGame,
} from '@/lib/go-engine';
import type { BoardSize, GameState, Group, Move, Point } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';
import {
  formatObjectiveTargetText,
  getBoardAreaDirectionLabel,
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

function lastBlackPlacedMove(game: GameState): Extract<Move, { type: 'place' }> | null {
  for (let index = game.moveHistory.length - 1; index >= 0; index -= 1) {
    const move = game.moveHistory[index];
    if (move.type === 'place' && move.color === 'black') return move;
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

function findLearnerPressureTarget(game: GameState): Group | null {
  return getAllGroups(game.board)
    .filter((group) => group.color === 'white' && group.liberties.length > 1 && group.liberties.length <= 2)
    .sort((a, b) => a.liberties.length - b.liberties.length || compareGroupsByAnchor(a, b))[0] ?? null;
}

function findLearnerWeakGroup(game: GameState): Group | null {
  return getAllGroups(game.board)
    .filter((group) => group.color === 'black' && group.liberties.length > 0 && group.liberties.length <= 2)
    .sort((a, b) => a.liberties.length - b.liberties.length || compareGroupsByAnchor(a, b))[0] ?? null;
}

function findLearnerMostRestrictedGroup(game: GameState): Group | null {
  return getAllGroups(game.board)
    .filter((group) => group.color === 'black' && group.liberties.length > 0)
    .sort((a, b) => a.liberties.length - b.liberties.length || compareGroupsByAnchor(a, b))[0] ?? null;
}

function findLearnerGroupAtPoint(game: GameState, point: Point | null): Group | null {
  if (!point) return null;
  if (getStone(game.board, point) !== 'black') return null;

  return getGroup(game.board, point);
}

function groupTouchesColor(game: GameState, group: Group, color: 'black' | 'white'): boolean {
  return group.stones.some((stone) => (
    getAdjacentPoints(game.board, stone).some((adjacent) => getStone(game.board, adjacent) === color)
  ));
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
    || /\bwhere\s+(should|do|can)\s+i\s+(start|begin)\b/.test(q)
    || /\bwhere\s+do\s+i\s+begin\b/.test(q)
    || /\bwhat\s+(is|s)\s+the\s+best\s+(first\s+)?move\b/.test(q)
    || /\bbest\s+first\s+move\b/.test(q)
    || /\bwhich\s+corner\s+(should|do|can)\s+i\s+(choose|start|play)\b/.test(q)
    || /\bwhat\s+(is|s)\s+my\s+plan\s+(now|next)?\b/.test(q)
    || /\bwhat\s+(is|s)\s+the\s+plan\s+(now|next)?\b/.test(q)
    || /\bwhere\s+(should|do|can)\s+i\s+start\s+building\b/.test(q)
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

function isMoveImpactQuestion(q: string): boolean {
  return /\bwhat\s+(did|does)\s+(that|this|my\s+move)\s+(change|do|make|accomplish)\b/.test(q)
    || /\bwhat\s+changed\b/.test(q)
    || /\bwhat\s+did\s+(that|this)\s+change\b/.test(q)
    || /\bwhat\s+did\s+i\s+(change|accomplish|make)\b/.test(q)
    || /\bhow\s+did\s+(that|this|my\s+move)\s+(help|change|matter)\b/.test(q)
    || /\bwhy\s+did\s+(that|this|my\s+move)\s+(help|matter|work)\b/.test(q)
    || /\bwhat\s+does\s+(that|this)\s+mean\s+for\s+(the\s+)?board\b/.test(q);
}

function isLearningTakeawayQuestion(q: string): boolean {
  return /\bwhat\s+(did|does)\s+(that|this|my\s+move)\s+teach\s+me\b/.test(q)
    || /\bwhat\s+(should|can)\s+i\s+(learn|take[-\s]?away)\s+from\s+(that|this|my\s+move|the\s+move|this\s+position|the\s+position|this\s+board)\b/.test(q)
    || /\bwhat\s+(is|s)\s+the\s+(lesson|take[-\s]?away)\s+(here|from\s+(that|this|my\s+move|the\s+move|this\s+position|the\s+position|this\s+board))\b/.test(q)
    || /\bwhat\s+lesson\s+should\s+i\s+(learn|take[-\s]?away)\b/.test(q)
    || /\bwhat\s+should\s+i\s+remember\s+from\s+(that|this|my\s+move|this\s+position|this\s+board)\b/.test(q);
}

function isOpponentMoveQuestion(q: string): boolean {
  return /\bwhy\s+did\s+(white|sensei|you|the\s+opponent)\s+(play|move)\b/.test(q)
    || /\bwhy\s+does\s+(white|sensei|the\s+opponent)\s+(play|move)\b/.test(q)
    || /\bwhat\s+(did|does)\s+(white|sensei|the\s+opponent)\s+(do|play|move|want|threaten)\b/.test(q)
    || /\bwhat\s+is\s+(white|sensei|the\s+opponent)\s+(trying|threatening)\b/.test(q)
    || /\bwhy\s+(there|that\s+move|this\s+move)\b/.test(q);
}

function isWhiteReplyQuestion(q: string): boolean {
  return /\bwhat\s+(can|could|will|would|might)\s+(white|sensei|the\s+opponent)\s+(do|play|try|threaten)\b/.test(q)
    || /\bwhat\s+would\s+happen\s+if\s+(white|sensei|the\s+opponent)\s+(plays|replies|responds|attacks)\b/.test(q)
    || /\bhow\s+(can|could|will|would|might)\s+(white|sensei|the\s+opponent)\s+(answer|respond|reply|attack|punish)\b/.test(q)
    || /\bwhere\s+(can|could|will|would|might)\s+(white|sensei|the\s+opponent)\s+play\b/.test(q)
    || /\bwhat\s+if\s+(white|sensei|the\s+opponent)\s+(answers|responds|attacks|plays)\b/.test(q)
    || /\bwhat\s+is\s+(white|sensei|the\s+opponent)\s+threatening\s+next\b/.test(q);
}

function isThreatQuestion(q: string): boolean {
  return /\bwhat\s+(am\s+i|are\s+my\s+stones?|does\s+(that|this|my\s+move))\s+threaten(?:ing)?\b/.test(q)
    || /\bwhat\s+(did|does)\s+(that|this|my\s+move)\s+threaten\b/.test(q)
    || /\bdo\s+i\s+have\s+(a\s+)?(threat|attack)\b/.test(q)
    || /\bam\s+i\s+(threatening|attacking)\s+anything\b/.test(q)
    || /\bwhat\s+can\s+i\s+(attack|threaten|capture)\b/.test(q)
    || /\bcan\s+i\s+(attack|capture)\s+(anything|something|a\s+stone|a\s+group)\b/.test(q)
    || /\bis\s+(white|the\s+opponent)\s+(weak|in\s+trouble|under\s+attack)\b/.test(q);
}

function isAttackDefenseDecisionQuestion(q: string): boolean {
  return /\b(attack|fight|chase)\s+or\s+(defend|save|protect)\b/.test(q)
    || /\b(defend|save|protect)\s+or\s+(attack|fight|chase)\b/.test(q)
    || /\bshould\s+i\s+(attack|fight|chase)\s+or\s+(defend|save|protect)\b/.test(q)
    || /\bshould\s+i\s+(defend|save|protect)\s+or\s+(attack|fight|chase)\b/.test(q)
    || /\bcan\s+i\s+attack\s+instead\s+of\s+(defending|saving|protecting)\b/.test(q)
    || /\bdo\s+i\s+(attack|fight|chase)\s+or\s+(defend|save|protect)\b/.test(q);
}

function isCaptureRaceQuestion(q: string): boolean {
  return /\bcapture[\s-]+race\b/.test(q)
    || /\bsemeai\b/.test(q)
    || /\bwho\s+(gets|will\s+get)\s+captured\s+first\b/.test(q)
    || /\bwho\s+(wins|is\s+winning)\s+(this\s+)?(fight|race)\b/.test(q)
    || /\bam\s+i\s+(winning|losing)\s+(this\s+)?(fight|race)\b/.test(q)
    || /\bwho\s+has\s+more\s+liberties\b/.test(q);
}

function isSnapbackQuestion(q: string): boolean {
  return /\bsnap[\s-]?back\b/.test(q)
    || /\bunder\s+the\s+stones\b/.test(q);
}

function isFightFollowUpQuestion(q: string): boolean {
  return isWhiteReplyQuestion(q)
    || /\bwhat\s+(happens|comes)\s+next\b/.test(q)
    || /\bwhat\s+now\b/.test(q)
    || /\bwhat\s+should\s+i\s+read\s+next\b/.test(q)
    || /\bwhat\s+is\s+the\s+(next\s+)?follow[-\s]?up\b/.test(q)
    || /\bwhat\s+should\s+i\s+do\s+next\s+in\s+this\s+(fight|cut|race|snapback)\b/.test(q)
    || /\bwhat\s+happens\s+if\s+(white|sensei|the\s+opponent)\s+(answers|responds|replies|runs|escapes|connects|extends|captures|adds\s+a\s+liberty)\b/.test(q)
    || /\bwhat\s+if\s+(white|sensei|the\s+opponent)\s+(runs|escapes|connects|extends|captures|adds\s+a\s+liberty)\b/.test(q)
    || /\b(after|once)\s+(white|sensei|the\s+opponent)\s+(answers|responds|replies|runs|escapes|connects|extends|captures|adds\s+a\s+liberty)\b/.test(q)
    || /\bdoes\s+(white|sensei|the\s+opponent)\s+have\s+(an?\s+)?(answer|reply|escape)\b/.test(q);
}

function isFightPlanQuestion(q: string): boolean {
  return /\bwhat\s+should\s+i\s+read\s+next\b/.test(q)
    || /\bwhat\s+is\s+the\s+(next\s+)?follow[-\s]?up\b/.test(q)
    || /\bwhat\s+is\s+the\s+plan\b/.test(q)
    || /\bwhat\s+is\s+my\s+plan\b/.test(q)
    || /\breading\s+plan\b/.test(q)
    || /\bread(?:ing)?\s+sequence\b/.test(q)
    || /\bwhat\s+should\s+i\s+do\s+next\s+in\s+this\s+(fight|cut|race|snapback)\b/.test(q)
    || /\bafter\s+this\s+(fight|cut|race|snapback)\b/.test(q);
}

function isGameReviewQuestion(q: string): boolean {
  return /\bgame\s+review\b/.test(q)
    || /\breview\s+(this|the|my)\s+(game|board|position)\b/.test(q)
    || /\b(analyze|analyse)\s+(this|the|my)\s+(game|board|position)\b/.test(q)
    || /\bhow\s+did\s+i\s+do\s+(in\s+)?(this|the)\s+game\b/.test(q);
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
    || /\b(is|are)\s+(my\s+)?(stones?|groups?)\s+(weak|safe|in\s+trouble|in\s+danger|short\s+on\s+liberties)\b/.test(q)
    || /\bam\s+i\s+(safe|in\s+trouble|in\s+danger)\b/.test(q)
    || /\bis\s+[a-hj-t]\d{1,2}\s+(weak|safe|in\s+trouble|in\s+danger|short\s+on\s+liberties)\b/.test(q)
    || /\bwhich\s+(stones?|groups?)\s+(need|needs)\s+(room|help|saving|liberties)\b/.test(q)
    || /\bhow\s+do\s+i\s+(save|defend|rescue|help)\s+(my\s+)?(stones?|groups?)\b/.test(q)
    || /\b(should|do)\s+i\s+(need\s+to\s+)?(save|defend|rescue|help)\s+(my\s+)?(stones?|groups?|[a-hj-t]\d{1,2})\b/.test(q)
    || /\bwhat\s+(does|do|is)\s+give\s+weak\s+groups?\s+room\b/.test(q)
    || /\bshort\s+on\s+liberties\b/.test(q);
}

function isReadingRoutineQuestion(q: string): boolean {
  return /\bhow\s+do\s+i\s+read\s+ahead\b/.test(q)
    || /\bhow\s+do\s+i\s+(think|plan)\s+before\s+(i\s+)?(play|move)\b/.test(q)
    || /\bwhat\s+should\s+i\s+(think\s+about|look\s+for|check)\s+before\s+(i\s+)?(play|move)\b/.test(q)
    || /\bhow\s+do\s+i\s+(choose|decide|pick)\s+(a\s+)?(move|play)\b/.test(q)
    || /\bhow\s+do\s+i\s+choose\s+between\s+moves\b/.test(q)
    || /\bwhat\s+makes\s+(a\s+)?move\s+(good|safe|useful)\b/.test(q)
    || /\breading\s+routine\b/.test(q);
}

function isPlayAwayQuestion(q: string): boolean {
  return /\btenuki\b/.test(q)
    || /\bplay\s+away\b/.test(q)
    || /\bplay\s+far\s+away\b/.test(q)
    || /\bignore\s+(this|the)\s+(side|area|corner|position)\b/.test(q)
    || /\bshould\s+i\s+ignore\s+(this|the)\b/.test(q);
}

function isSenteQuestion(q: string): boolean {
  return /\bsente\b/.test(q)
    || /\bgote\b/.test(q);
}

function isDefendFirstQuestion(q: string): boolean {
  return /\bdefend\s+first\b/.test(q)
    || /\bshould\s+i\s+defend\b/.test(q)
    || /\bdo\s+i\s+need\s+to\s+defend\b/.test(q)
    || /\bshould\s+i\s+keep\s+extending\b/.test(q)
    || /\bkeep\s+extending\b/.test(q);
}

function isSecondObjectiveStrategyQuestion(q: string): boolean {
  return isPlayAwayQuestion(q)
    || isSenteQuestion(q)
    || isDefendFirstQuestion(q);
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

function mentionedCoordinateTokens(q: string): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const token of q.split(/\s+/)) {
    if (!/^[a-t]\d{1,2}$/i.test(token)) continue;

    const normalizedToken = token.toUpperCase();
    if (seen.has(normalizedToken)) continue;
    seen.add(normalizedToken);
    tokens.push(normalizedToken);
  }

  return tokens;
}

function mentionedInvalidCoordinate(q: string, boardSize: BoardSize): string | null {
  return mentionedCoordinateTokens(q).find((token) => coordToPoint(token, boardSize) === null) ?? null;
}

function formatBoardColumnRange(boardSize: BoardSize): string {
  const goColumns = 'ABCDEFGHJKLMNOPQRST'.slice(0, boardSize).split('');
  const lastColumn = goColumns[goColumns.length - 1];

  return `A through ${lastColumn}, skipping I`;
}

function isInvalidCoordinateQuestion(q: string, boardSize: BoardSize): boolean {
  if (!mentionedInvalidCoordinate(q, boardSize)) return false;

  return /\b(can|could|should|would|do)\s+i\s+(play|try|move)\b/.test(q)
    || /\b(where|what|show|find|locate|play)\b/.test(q)
    || /\boutside\b/.test(q);
}

function isTargetReasonQuestion(q: string, boardSize: BoardSize): boolean {
  if (!/\bwhy\b/.test(q)) return false;
  if (mentionedCoordinate(q, boardSize)) return true;

  return /\b(there|that\s+point|this\s+point|that\s+move|this\s+move|marked\s+(move|point|target))\b/.test(q);
}

function isCandidateMoveQuestion(q: string, boardSize: BoardSize): boolean {
  if (!mentionedCoordinate(q, boardSize)) return false;

  return /\b(should|can|could|would)\s+i\s+(play|try|move)\b/.test(q)
    || /\b(should|can|could|would|do)\s+i\s+connect\s+(at\s+)?[a-hj-t]\d{1,2}\b/.test(q)
    || /\bwhat\s+about\b/.test(q)
    || /\bhow\s+about\b/.test(q)
    || /\bwhat\s+(is|s)\s+wrong\s+with\s+[a-hj-t]\d{1,2}\b/.test(q)
    || /\bis\s+[a-hj-t]\d{1,2}\s+(a\s+)?(good|bad|ok|okay|right|wrong|playable|safe)(\s+(move|play))?\b/.test(q)
    || /\bplay\s+(at\s+)?[a-hj-t]\d{1,2}\b/.test(q);
}

function isCandidateComparisonQuestion(q: string, boardSize: BoardSize): boolean {
  if (mentionedCoordinates(q, boardSize).length < 2) return false;

  return /\b(or|vs|versus|compare|choose|which|better)\b/.test(q);
}

function isOneSpaceJumpGapQuestion(q: string): boolean {
  if (/\b(white|opponent|sensei)\b/.test(q) && /\b(cut|attack|threaten|play|reply|answer)\b/.test(q)) {
    return false;
  }

  return /\bgap\b/.test(q)
    || /\bfill\s+(the\s+)?(gap|space)\b/.test(q)
    || /\bconnect\s+solidly\s+(at\s+)?[a-hj-t]\d{1,2}\b/.test(q)
    || /\bfill\s+[a-hj-t]\d{1,2}\s+to\s+connect\b/.test(q)
    || /\bplay\s+between\s+(them|my\s+stones|these\s+stones|the\s+stones)\b/.test(q)
    || /\bbetween\s+them\b/.test(q);
}

function isOneSpaceJumpPressureQuestion(q: string): boolean {
  return /\b(white|opponent|sensei)\b/.test(q) && /\b(cut|attack|threaten|play|reply|answer|pressure)\b/.test(q)
    || /\b(can|could|would|will|might)\s+(white|opponent|sensei)\s+cut\b/.test(q)
    || /\bwhat\s+if\s+(white|opponent|sensei)\s+(plays|attacks|cuts|pressures)\b/.test(q)
    || /\bwhat\s+should\s+i\s+do\s+if\s+(white|opponent|sensei)\s+(plays|attacks|cuts|pressures)\b/.test(q)
    || /\b(if|when)\s+(white|opponent|sensei)\s+(plays|attacks|cuts|pressures)\b/.test(q)
    || /\b(can|should|do)\s+i\s+(ignore|answer|defend)\s+(the\s+)?(cut|gap|attack|pressure)\b/.test(q);
}

function isOneSpaceJumpConnectionQuestion(q: string, boardSize: BoardSize): boolean {
  if (mentionedCoordinates(q, boardSize).length < 2) return false;

  return /\bconnect(?:ed|ing|ion|ions)?\b/.test(q)
    || /\bsame\s+group\b/.test(q)
    || /\bwork\s+together\b/.test(q)
    || /\bseparate(?:d)?\b/.test(q);
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

function isStarPointQuestion(q: string): boolean {
  if (/\bnumbered\b/.test(q) && /\b(dots?|circles|targets|suggestions|markers)\b/.test(q)) return false;

  return /\bstar[-\s]?points?\b/.test(q)
    || /\bhoshi\b/.test(q)
    || /\bwhat\s+are\s+(these|the)\s+(small\s+|printed\s+|black\s+)?dots?\b/.test(q)
    || /\bwhat\s+do\s+(these|the)\s+(small\s+|printed\s+|black\s+)?dots?\s+(mean|do)\b/.test(q)
    || /\bwhy\s+are\s+(there\s+)?(small\s+|printed\s+|black\s+)?dots?\s+on\s+(the\s+)?board\b/.test(q)
    || /\b(can|should|do)\s+i\s+play\s+on\s+(the\s+)?(dot|dots)\b/.test(q);
}

function isCornerOpeningQuestion(q: string): boolean {
  return /\bwhy\s+(start|play|begin|open)\s+(in|near|with)\s+(a\s+)?corner\b/.test(q)
    || /\bwhy\s+(the\s+)?corners?\b/.test(q)
    || /\bwhy\s+not\s+(the\s+)?cent(er|re)\b/.test(q)
    || /\bshould\s+i\s+(start|play|begin|open)\s+(in|near|with)\s+(the\s+)?cent(er|re)\b/.test(q)
    || /\b(should|can|do)\s+i\s+play\s+(in\s+)?(the\s+)?(cent(er|re)|middle)\b/.test(q)
    || /\bcent(er|re)\s+or\s+corner\b/.test(q)
    || /\bcorner\s+or\s+cent(er|re)\b/.test(q)
    || /\bis\s+(the\s+)?cent(er|re)\s+(good|bad|ok|okay)\s+(to\s+start|for\s+my\s+first\s+move|in\s+the\s+opening)?\b/.test(q)
    || /\bshould\s+i\s+(start|play|begin|open)\s+(in|near|with)\s+(a\s+)?corner\b/.test(q)
    || /\bwhere\s+should\s+i\s+start\s+(the\s+)?opening\b/.test(q)
    || /\bhow\s+do\s+i\s+start\s+(the\s+)?opening\b/.test(q);
}

function isInfluenceQuestion(q: string): boolean {
  return /\binfluence\b/.test(q)
    || /\bcenter\s+(pressure|reach)\b/.test(q)
    || /\bdoes\s+(the\s+)?cent(er|re)\s+(make|claim|become)\s+territory\b/.test(q)
    || /\bhow\s+does\s+(a\s+)?cent(er|re)\s+stone\s+(help|work|matter)\b/.test(q);
}

function suggestionReason(objective: BeginnerObjective, point: Point, boardSize: BoardSize): string {
  const coord = pointToCoord(point, boardSize);

  if (objective.id === 'claim-corner') {
    return `Start at ${coord}: the board edge helps this stone make territory.`;
  }

  if (objective.id === 'extend-from-stone') {
    return `Try ${coord} as a one-space jump that works with your stones.`;
  }

  if (objective.id === 'choose-new-area') {
    return `Consider ${coord} as a fresh ${getBoardAreaDirectionLabel(point, boardSize)} away from the settled local shape.`;
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

const ONE_SPACE_JUMP_DELTAS: Point[] = [
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
  { x: 0, y: -2 },
];

interface LearnerOneSpaceJumpShape {
  anchor: Point;
  stone: Point;
  gap: Point;
}

function findLearnerOneSpaceJumpShape(game: GameState): LearnerOneSpaceJumpShape | null {
  const move = lastBlackPlacedMove(game);
  if (!move) return null;

  for (const delta of ONE_SPACE_JUMP_DELTAS) {
    const anchor = { x: move.point.x - delta.x, y: move.point.y - delta.y };
    const gap = { x: move.point.x - delta.x / 2, y: move.point.y - delta.y / 2 };

    if (getStone(game.board, anchor) !== 'black') continue;
    if (getStone(game.board, gap) !== null) continue;

    return { anchor, stone: move.point, gap };
  }

  return null;
}

function oneSpaceJumpFrameworkSide(shape: LearnerOneSpaceJumpShape, boardSize: BoardSize): string {
  if (shape.anchor.y === shape.stone.y) {
    return shape.stone.y < boardSize / 2 ? 'top-side' : 'bottom-side';
  }

  return shape.stone.x < boardSize / 2 ? 'left-side' : 'right-side';
}

function objectiveTargetCoordList(objective: BeginnerObjective, boardSize: BoardSize): string | null {
  const coords = objective.targetPoints.slice(0, 4).map((point) => pointToCoord(point, boardSize));
  if (coords.length === 0) return null;

  return joinOrList(coords);
}

interface BlockedOneSpaceJumpContext {
  sentence: string;
  highlights: LocalHighlightFocus[];
}

interface WhiteBlockedOneSpaceJumpGap {
  sentence: string;
  highlight: LocalHighlightFocus;
}

function findWhiteBlockedOneSpaceJumpGap(
  board: GameState['board'],
  anchor: Point | null,
  cleanTargetText: string | null,
  idPrefix: string,
): WhiteBlockedOneSpaceJumpGap | null {
  if (!anchor) return null;

  for (const delta of ONE_SPACE_JUMP_DELTAS) {
    const target = { x: anchor.x + delta.x, y: anchor.y + delta.y };
    const gap = { x: anchor.x + delta.x / 2, y: anchor.y + delta.y / 2 };
    if (!isOnBoard(board, target)) continue;
    if (getStone(board, target) !== null) continue;
    if (getStone(board, gap) !== 'white') continue;

    const anchorCoord = pointToCoord(anchor, board.size);
    const targetCoord = pointToCoord(target, board.size);
    const gapCoord = pointToCoord(gap, board.size);
    const nextStep = cleanTargetText
      ? `use the clean marked extension instead: ${cleanTargetText}.`
      : 'do not treat that outside point as a clean connection-shape target yet.';

    return {
      sentence: `White is occupying ${gapCoord}, the gap between ${anchorCoord} and ${targetCoord}. ${targetCoord} is blocked as a one-space jump right now, so ${nextStep}`,
      highlight: {
        id: `${idPrefix}-blocked-gap-${pointKey(gap)}`,
        point: copyPoint(gap),
        variant: 'danger',
        label: `${gapCoord}: White occupies the one-space jump gap toward ${targetCoord}.`,
      },
    };
  }

  return null;
}

function blockedOneSpaceJumpContext(
  board: GameState['board'],
  point: Point,
  anchor: Point | null,
  idPrefix: string,
): BlockedOneSpaceJumpContext | null {
  if (!anchor) return null;

  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const isOneSpaceJump = (Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0);
  if (!isOneSpaceJump) return null;

  const gap = { x: anchor.x + dx / 2, y: anchor.y + dy / 2 };
  const gapStone = getStone(board, gap);
  if (gapStone !== 'black' && gapStone !== 'white') return null;

  const coord = pointToCoord(point, board.size);
  const anchorCoord = pointToCoord(anchor, board.size);
  const gapCoord = pointToCoord(gap, board.size);
  const occupantText = gapStone === 'white' ? 'White is' : 'your Black stone is';
  const occupantLabel = gapStone === 'white' ? 'White' : 'Black';

  return {
    sentence: `${coord} would normally be a one-space jump from ${anchorCoord}, but ${occupantText} already on ${gapCoord}, the gap between them. That gap is what lets the shape work, so ${coord} is not a clean teamwork target now.`,
    highlights: [
      {
        id: `${idPrefix}-blocked-target-${pointKey(point)}`,
        point: copyPoint(point),
        variant: 'warning',
        label: `${coord}: not a clean jump while ${gapCoord} is occupied.`,
      },
      {
        id: `${idPrefix}-blocked-gap-${pointKey(gap)}`,
        point: copyPoint(gap),
        variant: gapStone === 'white' ? 'danger' : 'neutral',
        label: `${gapCoord}: ${occupantLabel} occupies the one-space jump gap.`,
      },
    ],
  };
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
  const anchorMove = lastBlackPlacedMove(game);
  const lines: string[] = [];
  const blockedContext = requestedPoint && !pointEquals(requestedPoint, targetPoint)
    ? blockedOneSpaceJumpContext(game.board, requestedPoint, anchorMove?.point ?? null, 'local-target-reason')
    : null;
  const requestedOccupant = requestedPoint ? getStone(game.board, requestedPoint) : null;
  const requestedHighlight = requestedPoint && !pointEquals(requestedPoint, targetPoint) && !blockedContext
    ? {
        id: `local-target-reason-question-${pointKey(requestedPoint)}`,
        point: copyPoint(requestedPoint),
        variant: requestedOccupant === 'white' ? 'danger' : 'warning',
        label: requestedOccupant === null
          ? `${requestedCoord}: open, but not the current beginner target.`
          : `${requestedCoord}: already occupied, not the current beginner target.`,
      } satisfies LocalHighlightFocus
    : null;

  if (requestedPoint && !pointEquals(requestedPoint, targetPoint)) {
    lines.push(`${requestedCoord} is not one of the current marked beginner targets.`);
    if (blockedContext) {
      lines.push(blockedContext.sentence);
    } else if (requestedOccupant === null) {
      lines.push(candidateMissReason(objective, requestedPoint, game.board.size, anchorMove?.point ?? null, game.board));
    } else {
      lines.push(`${requestedCoord} is already occupied, so explain it as board shape, not as a move to play now.`);
    }
  }

  lines.push(targetReason(objective, targetPoint, game.board.size, anchorMove?.point ?? null));

  const otherTargets = objective.targetPoints
    .filter((point) => !pointEquals(point, targetPoint))
    .slice(0, 3)
    .map((point) => pointToCoord(point, game.board.size));

  if (otherTargets.length > 0) {
    lines.push(`${otherTargets.join(' or ')} works for the same beginner goal.`);
  }

  if (requestedPoint && !pointEquals(requestedPoint, targetPoint)) {
    lines.push(`I highlighted ${requestedCoord} and marked the current targets again; compare it with ${targetCoord}.`);
  } else {
    lines.push(`I marked the current targets again; ${targetCoord} is the one I explained.`);
  }

  return {
    text: lines.join(' '),
    conceptIds: objective.conceptIds,
    boardFocus: {
      ...(blockedContext ? { highlights: blockedContext.highlights } : {}),
      ...(requestedHighlight ? { highlights: [requestedHighlight] } : {}),
      suggestions,
    },
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
  board?: GameState['board'],
): string {
  const coord = pointToCoord(point, boardSize);
  const occupant = board ? getStone(board, point) : null;

  if (occupant !== null) {
    return `${coord} is already occupied by ${occupant === 'black' ? 'your Black stone' : 'White'}, so do not evaluate it as a new move to play now.`;
  }

  if (objective.id === 'claim-corner') {
    return `${coord} is open, but this beginner goal is about starting near a corner where the board edge helps you make territory.`;
  }

  if (objective.id === 'extend-from-stone') {
    if (anchor) {
      const blockedContext = board ? blockedOneSpaceJumpContext(board, point, anchor, 'local-candidate-move') : null;
      if (blockedContext) return blockedContext.sentence;

      const anchorCoord = pointToCoord(anchor, boardSize);
      const distance = Math.abs(point.x - anchor.x) + Math.abs(point.y - anchor.y);
      if (distance === 1) {
        return `${coord} touches ${anchorCoord} directly. That can be useful in a fight, but this beginner goal is practicing a one-space jump that reaches farther without losing teamwork.`;
      }

      return `${coord} is open, but it is not one of the marked one-space jumps from ${anchorCoord}.`;
    }

    return `${coord} is open, but it is not one of the marked one-space jumps from your anchor stone.`;
  }

  if (objective.id === 'choose-new-area') {
    return `${coord} is open, but this settled-shape goal is asking for a fresh area rather than one marked coordinate.`;
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
  const anchorMove = lastBlackPlacedMove(game);
  const blockedContext = !isMarkedTarget
    ? blockedOneSpaceJumpContext(game.board, requestedPoint, anchorMove?.point ?? null, 'local-candidate-move')
    : null;

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
        targetReason(objective, requestedPoint, game.board.size, anchorMove?.point ?? null),
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
      candidateMissReason(objective, requestedPoint, game.board.size, anchorMove?.point ?? null, game.board),
      targetCoordText ? `For this board, I would prefer ${targetCoordText}.` : objective.instruction,
      `I highlighted ${coord} and re-marked the better beginner targets.`,
    ].join(' '),
    conceptIds: objective.conceptIds,
    boardFocus: {
      highlights: blockedContext?.highlights ?? [{
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

  if (objective.id === 'choose-new-area') {
    const directionText = joinList(points.map((point) => {
      const coord = pointToCoord(point, boardSize);
      return `${coord} opens the ${getBoardAreaDirectionLabel(point, boardSize)}`;
    }));
    const subject = points.length === 2 ? 'Both' : 'These choices';

    return `${directionText}. ${subject} stay away from the settled local shape; choose the direction you want Black's next plan to explore.`;
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
  const anchorMove = lastBlackPlacedMove(game);
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
    lines.push(comparisonTargetReason(objective, markedPoints, game.board.size, anchorMove?.point ?? null));
    lines.push('I marked both choices again; choose the side where you want your next area to grow.');
  } else if (markedPoints.length >= 1) {
    const preferred = markedPoints[0];
    const preferredCoord = pointToCoord(preferred, game.board.size);
    lines.push(`I would choose ${preferredCoord} for this beginner goal.`);
    lines.push(targetReason(objective, preferred, game.board.size, anchorMove?.point ?? null));
    for (const point of unmarkedPoints.slice(0, 2)) {
      lines.push(candidateMissReason(objective, point, game.board.size, anchorMove?.point ?? null, game.board));
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
      lines.push(candidateMissReason(objective, point, game.board.size, anchorMove?.point ?? null, game.board));
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

function buildOneSpaceJumpGapAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer | null {
  const shape = findLearnerOneSpaceJumpShape(game);
  if (!shape) return null;

  const requestedPoint = mentionedCoordinate(q, game.board.size);
  if (requestedPoint && !pointEquals(requestedPoint, shape.gap)) return null;

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-gap-move') : [];
  const targetText = objective ? objectiveTargetCoordList(objective, game.board.size) : null;
  const anchorCoord = pointToCoord(shape.anchor, game.board.size);
  const stoneCoord = pointToCoord(shape.stone, game.board.size);
  const gapCoord = pointToCoord(shape.gap, game.board.size);

  return {
    text: [
      `${gapCoord} is the one-point gap between ${anchorCoord} and ${stoneCoord}.`,
      'That gap is not automatically wrong; it is what makes the one-space jump reach farther than a solid connection.',
      `Do not fill ${gapCoord} just because it is empty. Keep extending unless White attacks that gap or your stones become short on liberties.`,
      targetText ? `For this board, I would prefer ${targetText}.` : '',
      'I highlighted the two stones and the gap so you can see the shape.',
    ].filter(Boolean).join(' '),
    conceptIds: uniqueConceptIds(['shape', 'direction-of-play', 'liberties', ...(objective?.conceptIds ?? [])]),
    boardFocus: {
      highlights: [
        {
          id: `local-gap-anchor-${pointKey(shape.anchor)}`,
          point: copyPoint(shape.anchor),
          variant: 'positive',
          label: `${anchorCoord}: one side of the one-space jump.`,
        },
        {
          id: `local-gap-stone-${pointKey(shape.stone)}`,
          point: copyPoint(shape.stone),
          variant: 'positive',
          label: `${stoneCoord}: one side of the one-space jump.`,
        },
        {
          id: `local-gap-open-${pointKey(shape.gap)}`,
          point: copyPoint(shape.gap),
          variant: 'neutral',
          label: `${gapCoord}: intentional gap; answer it if White attacks.`,
        },
      ],
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'lesson:groups', label: 'Review groups' },
    ],
  };
}

interface OccupiedOneSpaceJumpCut {
  anchor: Point;
  stone: Point;
  gap: Point;
  anchorGroup: Group;
  stoneGroup: Group;
  cuttingGroup: Group;
}

function findOccupiedOneSpaceJumpCut(game: GameState, requestedPoint: Point | null): OccupiedOneSpaceJumpCut | null {
  const whiteMoves = game.moveHistory
    .filter((move): move is Extract<Move, { type: 'place' }> => move.type === 'place' && move.color === 'white')
    .slice()
    .reverse();

  for (const move of whiteMoves) {
    if (requestedPoint && !pointEquals(requestedPoint, move.point)) continue;
    const cuttingGroup = getGroup(game.board, move.point);
    if (!cuttingGroup || cuttingGroup.color !== 'white' || cuttingGroup.stones.length !== 1) continue;

    for (const delta of ONE_SPACE_JUMP_DELTAS) {
      const anchor = { x: move.point.x - delta.x / 2, y: move.point.y - delta.y / 2 };
      const stone = { x: move.point.x + delta.x / 2, y: move.point.y + delta.y / 2 };
      if (!isOnBoard(game.board, anchor) || !isOnBoard(game.board, stone)) continue;
      if (getStone(game.board, anchor) !== 'black' || getStone(game.board, stone) !== 'black') continue;
      const anchorGroup = getGroup(game.board, anchor);
      const stoneGroup = getGroup(game.board, stone);
      if (!anchorGroup || !stoneGroup) continue;
      if (pointKey(groupAnchor(anchorGroup)) === pointKey(groupAnchor(stoneGroup))) continue;

      return { anchor, stone, gap: move.point, anchorGroup, stoneGroup, cuttingGroup };
    }
  }

  return null;
}

function libertyCountPhrase(count: number): string {
  return `${count} ${count === 1 ? 'liberty' : 'liberties'}`;
}

function buildOccupiedOneSpaceJumpCutAnswer(game: GameState, q: string): LocalQuestionAnswer | null {
  const cut = findOccupiedOneSpaceJumpCut(game, mentionedCoordinate(q, game.board.size));
  if (!cut) return null;

  const anchorCoord = pointToCoord(cut.anchor, game.board.size);
  const stoneCoord = pointToCoord(cut.stone, game.board.size);
  const gapCoord = pointToCoord(cut.gap, game.board.size);
  const anchorLibertyCoords = cut.anchorGroup.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const stoneLibertyCoords = cut.stoneGroup.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const cutLibertyCoords = cut.cuttingGroup.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const suggestions = cut.cuttingGroup.liberties.slice(0, 4).map((liberty, index) => {
    const coord = pointToCoord(liberty, game.board.size);

    return {
      id: `local-occupied-cut-attack-${pointKey(liberty)}`,
      point: copyPoint(liberty),
      rank: index + 1,
      reason: `Attack the White cutting stone by playing ${coord}.`,
    };
  });

  return {
    text: [
      `White has played into the one-space jump gap at ${gapCoord}.`,
      `${anchorCoord} and ${stoneCoord} are separate Black groups by the rules now, but neither is captured.`,
      `Black at ${anchorCoord} has ${libertyCountPhrase(cut.anchorGroup.liberties.length)}: ${joinList(anchorLibertyCoords)}.`,
      `Black at ${stoneCoord} has ${libertyCountPhrase(cut.stoneGroup.liberties.length)}: ${joinList(stoneLibertyCoords)}.`,
      `The White cutting stone at ${gapCoord} has ${libertyCountPhrase(cut.cuttingGroup.liberties.length)}: ${joinList(cutLibertyCoords)}.`,
      `Answer the cut by attacking the marked White liberties, starting with ${joinOrList(cutLibertyCoords.slice(0, 2))}.`,
      'I marked both Black groups, the White cutting stone, and the replies to read next.',
    ].join(' '),
    conceptIds: ['connect-and-cut', 'reading', 'liberties', 'groups', 'capture'],
    boardFocus: {
      highlights: [{
        id: `local-occupied-cut-stone-${pointKey(cut.gap)}`,
        point: copyPoint(cut.gap),
        variant: 'danger',
        label: `${gapCoord}: White occupies the gap between ${anchorCoord} and ${stoneCoord}.`,
      }],
      groups: [
        {
          id: `local-occupied-cut-black-left-${pointKey(cut.anchor)}`,
          stones: cut.anchorGroup.stones.map(copyPoint),
          color: cut.anchorGroup.color,
          liberties: cut.anchorGroup.liberties.length,
          label: `Black group at ${anchorCoord}: ${libertyCountPhrase(cut.anchorGroup.liberties.length)} at ${joinList(anchorLibertyCoords)}.`,
        },
        {
          id: `local-occupied-cut-black-right-${pointKey(cut.stone)}`,
          stones: cut.stoneGroup.stones.map(copyPoint),
          color: cut.stoneGroup.color,
          liberties: cut.stoneGroup.liberties.length,
          label: `Black group at ${stoneCoord}: ${libertyCountPhrase(cut.stoneGroup.liberties.length)} at ${joinList(stoneLibertyCoords)}.`,
        },
        {
          id: `local-occupied-cut-white-${pointKey(cut.gap)}`,
          stones: cut.cuttingGroup.stones.map(copyPoint),
          color: cut.cuttingGroup.color,
          liberties: cut.cuttingGroup.liberties.length,
          label: `White cutting stone at ${gapCoord}: ${libertyCountPhrase(cut.cuttingGroup.liberties.length)} at ${joinList(cutLibertyCoords)}.`,
        },
      ],
      suggestions,
    },
    actions: [
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ],
  };
}

function buildOccupiedOneSpaceJumpCutPlanAnswer(game: GameState, q: string): LocalQuestionAnswer | null {
  const cut = findOccupiedOneSpaceJumpCut(game, mentionedCoordinate(q, game.board.size));
  if (!cut) return null;

  const anchorCoord = pointToCoord(cut.anchor, game.board.size);
  const stoneCoord = pointToCoord(cut.stone, game.board.size);
  const gapCoord = pointToCoord(cut.gap, game.board.size);
  const cutLibertyCoords = cut.cuttingGroup.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const firstLiberties = cut.cuttingGroup.liberties.slice(0, 2);
  const firstLibertyCoords = cutLibertyCoords.slice(0, 2);
  const suggestions = firstLiberties.map((liberty, index) => {
    const coord = pointToCoord(liberty, game.board.size);

    return {
      id: `local-occupied-cut-plan-${index + 1}-${pointKey(liberty)}`,
      point: copyPoint(liberty),
      rank: index + 1,
      reason: index === 0
        ? `Step 1: attack the cutting stone at ${coord}.`
        : `Step 1 backup: attack the cutting stone at ${coord}.`,
    };
  });

  return {
    text: [
      'Read the cut as a three-step plan.',
      `Step 1: attack the White cutting stone at ${gapCoord} by playing ${joinOrList(firstLibertyCoords)}.`,
      `Step 2: after White answers, recount both Black groups: ${anchorCoord} has ${libertyCountPhrase(cut.anchorGroup.liberties.length)} and ${stoneCoord} has ${libertyCountPhrase(cut.stoneGroup.liberties.length)}.`,
      'Step 3: if one Black group drops to two liberties or fewer, defend it first; otherwise fill the next White liberty.',
      `The cutting stone still has ${libertyCountPhrase(cut.cuttingGroup.liberties.length)}: ${joinList(cutLibertyCoords)}.`,
      'I marked the cut, both Black groups, and the two first reading points so the plan stays visible.',
    ].join(' '),
    conceptIds: ['connect-and-cut', 'reading', 'liberties', 'groups', 'capture'],
    boardFocus: {
      highlights: [{
        id: `local-occupied-cut-plan-stone-${pointKey(cut.gap)}`,
        point: copyPoint(cut.gap),
        variant: 'danger',
        label: `${gapCoord}: White cutting stone; start the reading plan here.`,
      }],
      groups: [
        {
          id: `local-occupied-cut-plan-black-left-${pointKey(cut.anchor)}`,
          stones: cut.anchorGroup.stones.map(copyPoint),
          color: cut.anchorGroup.color,
          liberties: cut.anchorGroup.liberties.length,
          label: `Recount ${anchorCoord} after White answers: ${libertyCountPhrase(cut.anchorGroup.liberties.length)}.`,
        },
        {
          id: `local-occupied-cut-plan-black-right-${pointKey(cut.stone)}`,
          stones: cut.stoneGroup.stones.map(copyPoint),
          color: cut.stoneGroup.color,
          liberties: cut.stoneGroup.liberties.length,
          label: `Recount ${stoneCoord} after White answers: ${libertyCountPhrase(cut.stoneGroup.liberties.length)}.`,
        },
        {
          id: `local-occupied-cut-plan-white-${pointKey(cut.gap)}`,
          stones: cut.cuttingGroup.stones.map(copyPoint),
          color: cut.cuttingGroup.color,
          liberties: cut.cuttingGroup.liberties.length,
          label: `White cutting stone at ${gapCoord}: ${libertyCountPhrase(cut.cuttingGroup.liberties.length)} at ${joinList(cutLibertyCoords)}.`,
        },
      ],
      suggestions,
    },
    actions: [
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ],
  };
}

function buildOneSpaceJumpPressureAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer | null {
  const occupiedCutAnswer = buildOccupiedOneSpaceJumpCutAnswer(game, q);
  if (occupiedCutAnswer) return occupiedCutAnswer;

  const shape = findLearnerOneSpaceJumpShape(game);
  if (!shape) return null;

  const requestedPoint = mentionedCoordinate(q, game.board.size);
  if (requestedPoint && !pointEquals(requestedPoint, shape.gap)) return null;
  if (getStone(game.board, shape.gap) !== null) return null;

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-gap-pressure-move') : [];
  const targetText = objective ? objectiveTargetCoordList(objective, game.board.size) : null;
  const anchorCoord = pointToCoord(shape.anchor, game.board.size);
  const stoneCoord = pointToCoord(shape.stone, game.board.size);
  const gapCoord = pointToCoord(shape.gap, game.board.size);

  return {
    text: [
      `${gapCoord} is the one-point gap between ${anchorCoord} and ${stoneCoord}.`,
      `White can test that gap by playing ${gapCoord}, but that is pressure, not an immediate capture.`,
      `If White actually attacks ${gapCoord}, count liberties before reacting: defend the stone that becomes short on room; if both stones still have room, keep building${targetText ? ` with ${targetText}` : ''}.`,
      'I highlighted the two stones and the gap White could pressure so the reading question stays tied to the board.',
    ].join(' '),
    conceptIds: uniqueConceptIds(['shape', 'reading', 'liberties', 'groups', ...(objective?.conceptIds ?? [])]),
    boardFocus: {
      highlights: [
        {
          id: `local-gap-pressure-anchor-${pointKey(shape.anchor)}`,
          point: copyPoint(shape.anchor),
          variant: 'positive',
          label: `${anchorCoord}: one side of the jump White could test.`,
        },
        {
          id: `local-gap-pressure-stone-${pointKey(shape.stone)}`,
          point: copyPoint(shape.stone),
          variant: 'positive',
          label: `${stoneCoord}: one side of the jump White could test.`,
        },
        {
          id: `local-gap-pressure-open-${pointKey(shape.gap)}`,
          point: copyPoint(shape.gap),
          variant: 'warning',
          label: `${gapCoord}: gap White could pressure; count liberties before answering.`,
        },
      ],
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'practice:reading', label: 'Practice reading' },
    ],
  };
}

function buildOneSpaceJumpConnectionAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer | null {
  const shape = findLearnerOneSpaceJumpShape(game);
  if (!shape) return null;

  const requestedPoints = mentionedCoordinates(q, game.board.size);
  if (requestedPoints.length >= 2) {
    const mentionsAnchor = requestedPoints.some((point) => pointEquals(point, shape.anchor));
    const mentionsStone = requestedPoints.some((point) => pointEquals(point, shape.stone));
    if (!mentionsAnchor || !mentionsStone) return null;
  }

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-gap-connection-move') : [];
  const targetText = objective ? objectiveTargetCoordList(objective, game.board.size) : null;
  const anchorCoord = pointToCoord(shape.anchor, game.board.size);
  const stoneCoord = pointToCoord(shape.stone, game.board.size);
  const gapCoord = pointToCoord(shape.gap, game.board.size);

  return {
    text: [
      `${anchorCoord} and ${stoneCoord} are not one solid group by the rules yet.`,
      `${gapCoord} is the open point between them.`,
      'They are connected in shape: a one-space jump that usually works together unless White attacks the gap.',
      targetText ? `For now, keep building with ${targetText}.` : 'For now, keep building unless the gap is attacked or one stone becomes short on liberties.',
      'I highlighted the two stones and the open gap so you can see the difference between rule connection and shape connection.',
    ].join(' '),
    conceptIds: uniqueConceptIds(['groups', 'shape', 'liberties', ...(objective?.conceptIds ?? [])]),
    boardFocus: {
      highlights: [
        {
          id: `local-gap-connection-anchor-${pointKey(shape.anchor)}`,
          point: copyPoint(shape.anchor),
          variant: 'positive',
          label: `${anchorCoord}: first stone in the one-space jump.`,
        },
        {
          id: `local-gap-connection-stone-${pointKey(shape.stone)}`,
          point: copyPoint(shape.stone),
          variant: 'positive',
          label: `${stoneCoord}: second stone in the one-space jump.`,
        },
        {
          id: `local-gap-connection-open-${pointKey(shape.gap)}`,
          point: copyPoint(shape.gap),
          variant: 'neutral',
          label: `${gapCoord}: open gap; shape connection, not a solid group.`,
        },
      ],
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'lesson:groups', label: 'Review groups' },
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

function buildInvalidCoordinateAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer | null {
  const invalidCoord = mentionedInvalidCoordinate(q, game.board.size);
  if (!invalidCoord) return null;

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
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-invalid-coordinate-move') : [];
  const targetCoordText = objective ? objectiveTargetCoordList(objective, game.board.size) : null;
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;

  return {
    text: [
      `${invalidCoord} is outside this ${game.board.size}x${game.board.size} board.`,
      `On this board, valid columns are ${formatBoardColumnRange(game.board.size)}, and valid rows are 1 through ${game.board.size}.`,
      objective && targetCoordText
        ? `For this guided position, start with one of the marked ${game.board.size}x${game.board.size} targets: ${targetCoordText}.`
        : 'Choose an empty intersection that actually appears on the current board.',
      suggestions.length > 0 ? 'I marked the legal beginner targets so the board size is visible.' : '',
    ].filter(Boolean).join(' '),
    conceptIds: uniqueConceptIds(['stones-and-board', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
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
    const stone = getStone(game.board, requestedPoint);
    const isMarkedTarget = objective?.targetPoints.some((point) => pointEquals(point, requestedPoint)) ?? false;
    const variant: LocalHighlightFocus['variant'] = stone === 'white'
      ? 'danger'
      : stone === 'black' || isMarkedTarget
        ? 'positive'
        : 'neutral';
    const label = stone === 'black'
      ? `${requestedCoord}: your Black stone.`
      : stone === 'white'
        ? `${requestedCoord}: White stone.`
        : isMarkedTarget
          ? `${requestedCoord}: marked target for ${objective?.title}.`
          : `${requestedCoord}: column ${column}, row ${row}.`;

    lines.push(`${requestedCoord} means column ${column}, row ${row}. I highlighted ${requestedCoord} on the board.`);
    if (stone === 'black') {
      lines.push(`${requestedCoord} currently has your Black stone, so use it as an anchor for the next idea rather than trying to play there again.`);
    } else if (stone === 'white') {
      lines.push(`${requestedCoord} currently has a White stone, so it is blocked as a move; look at that stone's liberties before trying to attack it.`);
    } else if (objective && isMarkedTarget) {
      lines.push(`${requestedCoord} is also one of the marked targets for ${objective.title}. ${targetReason(objective, requestedPoint, game.board.size, lastBlackPlacedMove(game)?.point ?? null)}`);
    }
    highlights.push({
      id: `local-coordinate-${pointKey(requestedPoint)}`,
      point: copyPoint(requestedPoint),
      variant,
      label,
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

  if (objective.id === 'choose-new-area') {
    return 'No coordinate is marked because the nearby shape is settled; scan for a fresh direction before choosing.';
  }

  return 'These targets are liberties for a group that is short on breathing room; playing one gives that group more ways to escape.';
}

function getStarPoints(boardSize: BoardSize): Point[] {
  if (boardSize === 9) {
    return [
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ];
  }

  const low = boardSize >= 13 ? 3 : 2;
  const high = boardSize - low - 1;
  const middle = Math.floor(boardSize / 2);
  const points = [
    { x: low, y: low },
    { x: high, y: low },
    { x: middle, y: middle },
    { x: low, y: high },
    { x: high, y: high },
  ];

  return points.filter((point) => point.x >= 0 && point.x < boardSize && point.y >= 0 && point.y < boardSize);
}

function buildStarPointAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer {
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
  const starPoints = getStarPoints(game.board.size);
  const starPointCoords = starPoints.map((point) => pointToCoord(point, game.board.size));
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-star-point-move') : [];
  const targetCoordText = objective ? objectiveTargetCoordList(objective, game.board.size) : null;
  const centerPoint = starPoints.find((point) => point.x === Math.floor(game.board.size / 2) && point.y === Math.floor(game.board.size / 2));
  const centerCoord = centerPoint ? pointToCoord(centerPoint, game.board.size) : null;
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;
  const targetKeys = new Set((objective?.targetPoints ?? []).map(pointKey));
  const asksForMove = /\b(can|should|do)\s+i\s+play\b/.test(q);

  return {
    text: [
      'The small printed dots are star points, also called hoshi.',
      'A star point is a printed reference dot on the board.',
      'They are visual reference points, not stones and not mandatory moves.',
      starPointCoords.length > 0 ? `On this ${game.board.size}x${game.board.size} board, the star points are ${joinList(starPointCoords)}.` : '',
      asksForMove && objective?.id === 'claim-corner' && targetCoordText
        ? `Yes: for this opening, choose one of the corner star points: ${targetCoordText}.`
        : '',
      objective?.id === 'claim-corner' && centerCoord
        ? `Skip the center star point ${centerCoord} for now; it reaches many directions but does not use board edges to make early territory.`
        : '',
      !asksForMove && objective?.id === 'claim-corner' && targetCoordText
        ? `For your first guided move, use a corner star point: ${targetCoordText}.`
        : '',
      starPointCoords.length > 0 && suggestions.length > 0
        ? 'I highlighted the star points and marked the beginner corner targets.'
        : 'I highlighted the star points so you can use them as board landmarks.',
    ].filter(Boolean).join(' '),
    conceptIds: uniqueConceptIds(['stones-and-board', ...(objective?.conceptIds ?? [])]),
    boardFocus: {
      highlights: starPoints.map((point) => {
        const coord = pointToCoord(point, game.board.size);
        const isTarget = targetKeys.has(pointKey(point));
        const isCenter = centerPoint ? pointEquals(point, centerPoint) : false;

        return {
          id: `local-star-point-${pointKey(point)}`,
          point: copyPoint(point),
          variant: isTarget ? 'positive' : 'neutral',
          label: isTarget
            ? `${coord}: corner star point and beginner target.`
            : isCenter
              ? `${coord}: center star point; useful later, not the first guided target.`
              : `${coord}: star point board landmark.`,
        };
      }),
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
    ],
  };
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

function buildSecondObjectiveStrategyAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer | null {
  if (!isSecondObjectiveStrategyQuestion(q)) return null;

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

  if (objective?.id !== 'extend-from-stone') return null;

  const suggestions = objectiveSuggestions(objective, game.board.size, 'local-second-objective-move');
  const targetCoordText = objectiveTargetCoordList(objective, game.board.size);
  const targetText = targetCoordText ? `Try ${targetCoordText}.` : objective.instruction;
  const anchor = lastBlackPlacedMove(game);
  const anchorCoord = anchor ? pointToCoord(anchor.point, game.board.size) : 'your anchor stone';
  const latest = latestMove(game);
  const conceptIds = uniqueConceptIds([
    ...(isSenteQuestion(q) || isPlayAwayQuestion(q) ? ['sente-gote'] : []),
    ...(isDefendFirstQuestion(q) ? ['liberties'] : []),
    ...(objective.conceptIds ?? []),
  ]);
  const lines: string[] = [];

  if (isSenteQuestion(q)) {
    lines.push('Sente means a move that strongly asks the opponent to answer.');
    lines.push('Gote means a quiet move that lets the opponent choose freely elsewhere.');
    lines.push('Right now there is no urgent forcing move on this simple board.');
    lines.push(`Your sente-like habit is to make a move with purpose: extend from ${anchorCoord} with ${targetCoordText ?? 'one of the marked jumps'}, then see how White has to deal with the growing shape.`);
  } else if (isDefendFirstQuestion(q)) {
    const keepExtending = /\bkeep\s+extending\b/.test(q);
    lines.push('Defend first when one of your groups is short on liberties or a cutting point is under attack.');
    if (latest?.type === 'pass' && latest.color === 'white') {
      lines.push(`${anchorCoord} still has room, and White just passed for teaching, so there is no emergency to defend.`);
    } else {
      lines.push(`${anchorCoord} still has room, and no White stone is attacking it yet, so there is no emergency to defend.`);
    }
    lines.push(`${keepExtending ? 'Yes: keep extending' : 'Keep extending'} with ${targetCoordText ?? 'one of the marked jumps'}.`);
  } else {
    lines.push('Tenuki means playing away from the local area.');
    lines.push(`On this guided board, do not drift away yet: ${anchorCoord} is your anchor, and the useful play-away is a nearby one-space jump.`);
    lines.push(targetText);
    lines.push('That is away enough to grow, but close enough that your stones still work together.');
  }

  if (suggestions.length > 0) {
    lines.push('I marked the extension targets so the idea becomes a move you can play.');
  }

  return {
    text: lines.join(' '),
    conceptIds,
    boardFocus: {
      ...(anchor ? {
        highlights: [{
          id: `local-second-objective-anchor-${pointKey(anchor.point)}`,
          point: copyPoint(anchor.point),
          variant: 'positive' as const,
          label: `${anchorCoord}: anchor stone for the current one-space-jump idea.`,
        }],
      } : {}),
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
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
  const lines: string[] = [];

  if (objective?.id === 'extend-from-stone') {
    const anchor = lastBlackPlacedMove(game);
    const anchorCoord = anchor ? pointToCoord(anchor.point, game.board.size) : 'your anchor stone';
    const centerCoord = pointToCoord({ x: Math.floor(game.board.size / 2), y: Math.floor(game.board.size / 2) }, game.board.size);
    const targetCoordText = objectiveTargetCoordList(objective, game.board.size);

    lines.push('You already started from a corner, so this is no longer a first-move center choice.');
    lines.push('The center reaches many directions, but it still has to build every border itself before it becomes points.');
    lines.push(`A center move like ${centerCoord} is playable later, but it does not help ${anchorCoord} as directly as the marked one-space jumps.`);
    lines.push(`For this board, keep building from ${anchorCoord} with ${targetCoordText ?? 'one of the marked jumps'}.`);
    lines.push('I marked the extension targets again.');
  } else {
    lines.push(
      'For a first beginner move, choose a corner before the center.',
      'Corners are the easiest place for beginners to make territory because two board edges already act like walls.',
      'A corner already has two board edges helping it make territory.',
      'The center reaches many directions, but it has to build every border itself before it becomes points.',
      'That is why the first guided goal starts near a corner instead of the open center.',
    );
  }

  if (objective?.id === 'claim-corner') {
    lines.push(`${targetText ?? 'Try one of the marked corner starts.'} I marked the corner starts again.`);
  } else if (objective && objective.id !== 'extend-from-stone') {
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

function buildInfluenceAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
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
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-influence-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const lastMove = lastBlackPlacedMove(game);
  const lastMoveCoord = lastMove ? pointToCoord(lastMove.point, game.board.size) : null;
  const highlights: LocalHighlightFocus[] = lastMove
    ? [{
      id: `local-influence-anchor-${pointKey(lastMove.point)}`,
      point: copyPoint(lastMove.point),
      variant: 'neutral',
      label: `${lastMoveCoord}: current Black stone creating future pressure.`,
    }]
    : [];
  const lines = [
    'Influence is future pressure, not territory you can count yet.',
    'A center stone can reach many directions, so it may help later fights, connections, or extensions, but by itself it does not surround points.',
  ];

  if (objective?.id === 'claim-corner') {
    lines.push(`${targetText ?? 'Try one of the marked corner starts.'} Corners turn into visible territory faster because the board edges already help form the border.`);
  } else if (objective?.id === 'extend-from-stone') {
    lines.push(lastMoveCoord
      ? `${lastMoveCoord} already has some influence; it becomes useful when the next stone works with it. ${targetText ?? 'Use one of the marked one-space jumps.'}`
      : `Influence becomes useful when nearby stones work together. ${targetText ?? 'Use one of the marked one-space jumps.'}`);
  } else if (objective?.id === 'look-for-weak-groups') {
    lines.push(`${targetText ?? objective.instruction} If a group is short on liberties, make it safe before chasing big influence.`);
  } else {
    lines.push('The useful question is: what can this pressure help next: territory, connection, attack, or safety?');
  }

  if (suggestions.length > 0) {
    lines.push('I marked the practical next target so influence turns into a board action.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['influence', 'territory', 'direction-of-play', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 || highlights.length > 0
      ? {
        boardFocus: {
          ...(highlights.length > 0 ? { highlights } : {}),
          ...(suggestions.length > 0 ? { suggestions } : {}),
        },
      }
      : {}),
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

function buildReadingRoutineAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-reading-routine-move') : [];
  const action = suggestions.length > 0 ? { id: 'hint', label: 'Show targets' } : null;
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const anchor = lastBlackPlacedMove(game);
  const anchorCoord = anchor ? pointToCoord(anchor.point, game.board.size) : null;
  const firstSuggestion = suggestions[0];
  const firstSuggestionCoord = firstSuggestion ? pointToCoord(firstSuggestion.point, game.board.size) : null;
  const highlights: LocalHighlightFocus[] = anchor
    ? [{
      id: `local-reading-anchor-${pointKey(anchor.point)}`,
      point: copyPoint(anchor.point),
      variant: 'neutral',
      label: `${anchorCoord}: use this stone as the anchor for your reading routine.`,
    }]
    : [];
  const lines = [
    'Use a three-question reading routine before you play.',
    'First: count liberties. If one of your groups has one or two liberties, read that emergency before expanding.',
    'Second: name the purpose: territory, connection, shape, or capture.',
    "Third: imagine White's reply next to that move; if your stone still has room and your goal is clearer, the move is worth testing.",
  ];

  if (objective) {
    lines.push(`On this board, apply the routine to: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  } else {
    lines.push('On this board, pick one candidate and ask what it saves, connects, attacks, or claims.');
  }

  if (firstSuggestionCoord) {
    lines.push(anchorCoord
      ? `Start by reading ${firstSuggestionCoord}: what Black gains, how White might touch it, and whether ${anchorCoord} still has enough liberties.`
      : `Start by reading ${firstSuggestionCoord}: what Black gains, how White might touch it, and whether the new stone still has liberties.`);
  }

  if (suggestions.length > 0) {
    lines.push('I marked the targets so you can practice the routine on an actual move.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['reading', 'direction-of-play', 'liberties', ...(objective?.conceptIds ?? [])]),
    ...(suggestions.length > 0 || highlights.length > 0
      ? {
        boardFocus: {
          ...(highlights.length > 0 ? { highlights } : {}),
          ...(suggestions.length > 0 ? { suggestions } : {}),
        },
      }
      : {}),
    actions: [
      ...(action ? [action] : []),
      { id: 'practice:reading', label: 'Practice reading' },
    ],
  };
}

function buildWhiteReplyAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const move = lastBlackPlacedMove(game);
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-white-reply-move') : [];
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;

  if (!move) {
    return {
      text: [
        'Play a Black stone first, then ask what White can do and I will read the reply from that stone.',
        objective ? `For now, your first useful job is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}` : '',
        suggestions.length > 0 ? 'I marked the first targets so the reply question has a real anchor.' : '',
      ].filter(Boolean).join(' '),
      conceptIds: uniqueConceptIds(['reading', 'direction-of-play', ...(objective?.conceptIds ?? [])]),
      ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
      actions: [
        ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
        { id: 'practice:reading', label: 'Practice reading' },
      ],
    };
  }

  const group = getGroup(game.board, move.point);
  const coord = pointToCoord(move.point, game.board.size);
  const libertyCoords = group?.liberties.map((liberty) => pointToCoord(liberty, game.board.size)) ?? [];
  const libertyList = joinOrList(libertyCoords);
  const libertyWord = group?.liberties.length === 1 ? 'liberty' : 'liberties';
  const firstSuggestion = suggestions[0];
  const firstSuggestionCoord = firstSuggestion ? pointToCoord(firstSuggestion.point, game.board.size) : null;
  const lines = [
    `Read White from your Black stone at ${coord}.`,
  ];

  if (group && libertyCoords.length > 0) {
    lines.push(`White's simplest reply is to play on one of its ${libertyWord}: ${libertyList}.`);
    lines.push(group.liberties.length <= 2
      ? `That is urgent: ${coord} is already short on room, so count before expanding.`
      : `That would not capture ${coord} yet, but it would reduce Black's room; do not panic, count.`);
  } else {
    lines.push('White usually starts by touching a nearby liberty, cutting a loose gap, or taking the easier territory point.');
  }

  if (objective) {
    lines.push(`Your practical answer is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  } else {
    lines.push('Your practical answer should ask which Black group needs room, which connection can be strengthened, or which White group can be pressured.');
  }

  if (firstSuggestionCoord) {
    lines.push(`Start by reading ${firstSuggestionCoord}: if White touches ${coord}, Black should still have room and a clearer shape.`);
  }

  if (suggestions.length > 0) {
    lines.push('I marked the reply anchor, its liberties, and the current targets so you can practice that reading on the board.');
  } else {
    lines.push('I marked the reply anchor so you can practice reading White from the actual stone.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['reading', 'direction-of-play', 'liberties', 'groups', ...(objective?.conceptIds ?? [])]),
    boardFocus: {
      highlights: [{
        id: `local-white-reply-anchor-${pointKey(move.point)}`,
        point: copyPoint(move.point),
        variant: group && group.liberties.length <= 2 ? 'warning' : 'neutral',
        label: `${coord}: read White's reply against this Black group.`,
      }],
      ...(group
        ? {
          liberties: [{
            id: `local-white-reply-liberties-${pointKey(move.point)}`,
            point: copyPoint(move.point),
            count: group.liberties.length,
            libertyPoints: group.liberties.map(copyPoint),
          }],
          groups: [{
            id: `local-white-reply-group-${pointKey(move.point)}`,
            stones: group.stones.map(copyPoint),
            color: group.color,
            liberties: group.liberties.length,
            label: `Black group White could pressure: ${group.liberties.length} ${libertyWord} at ${joinList(libertyCoords)}.`,
          }],
        }
        : {}),
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'practice:reading', label: 'Practice reading' },
    ],
  };
}

interface CaptureRacePair {
  black: Group;
  white: Group;
}

function groupsAreAdjacent(game: GameState, left: Group, right: Group): boolean {
  return left.stones.some((stone) => (
    getAdjacentPoints(game.board, stone).some((adjacent) => (
      right.stones.some((other) => pointEquals(other, adjacent))
    ))
  ));
}

function findCaptureRacePair(game: GameState): CaptureRacePair | null {
  const blackGroups = getAllGroups(game.board).filter((group) => group.color === 'black');
  const whiteGroups = getAllGroups(game.board).filter((group) => group.color === 'white');
  const pairs: CaptureRacePair[] = [];

  for (const black of blackGroups) {
    for (const white of whiteGroups) {
      if (groupsAreAdjacent(game, black, white)) pairs.push({ black, white });
    }
  }

  return pairs
    .sort((a, b) => (
      Math.min(a.black.liberties.length, a.white.liberties.length)
      - Math.min(b.black.liberties.length, b.white.liberties.length)
      || Math.abs(a.black.liberties.length - a.white.liberties.length)
      - Math.abs(b.black.liberties.length - b.white.liberties.length)
      || compareGroupsByAnchor(a.black, b.black)
      || compareGroupsByAnchor(a.white, b.white)
    ))[0] ?? null;
}

function buildCaptureRaceAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const race = findCaptureRacePair(game);
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const objectiveTargetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const lessonAction = objective ? getBeginnerObjectiveLessonAction(objective) : null;

  if (!race) {
    const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-capture-race-move') : [];

    return {
      text: [
        'I do not see an adjacent capture race yet.',
        'A capture race starts when Black and White groups are touching or nearly touching, and both sides must count liberties to see who runs out first.',
        objective ? `Use the current guided job as the priority: ${objective.title}. ${objective.instruction}${objectiveTargetText ? ` ${objectiveTargetText}` : ''}` : 'For now, pick a move that gives your stones more room before starting a fight.',
        suggestions.length > 0 ? 'I marked the practical targets so you can build before chasing.' : '',
      ].filter(Boolean).join(' '),
      conceptIds: uniqueConceptIds(['reading', 'liberties', 'groups', ...(objective?.conceptIds ?? [])]),
      ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
      actions: [
        ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
        { id: 'practice:reading', label: 'Practice reading' },
        ...(lessonAction ? [lessonAction] : []),
      ],
    };
  }

  const blackAnchor = groupAnchor(race.black);
  const whiteAnchor = groupAnchor(race.white);
  const blackCoord = pointToCoord(blackAnchor, game.board.size);
  const whiteCoord = pointToCoord(whiteAnchor, game.board.size);
  const blackLibertyCoords = race.black.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const whiteLibertyCoords = race.white.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const blackLibertyList = joinList(blackLibertyCoords);
  const whiteLibertyList = joinList(whiteLibertyCoords);
  const blackLibertyWord = race.black.liberties.length === 1 ? 'liberty' : 'liberties';
  const whiteLibertyWord = race.white.liberties.length === 1 ? 'liberty' : 'liberties';
  const blackLiberties = race.black.liberties.length;
  const whiteLiberties = race.white.liberties.length;
  const groups: LocalGroupFocus[] = [
    {
      id: `local-capture-race-black-group-${pointKey(blackAnchor)}`,
      stones: race.black.stones.map(copyPoint),
      color: race.black.color,
      liberties: blackLiberties,
      label: `Black group in the race: ${blackLiberties} ${blackLibertyWord} at ${blackLibertyList}.`,
    },
    {
      id: `local-capture-race-white-group-${pointKey(whiteAnchor)}`,
      stones: race.white.stones.map(copyPoint),
      color: race.white.color,
      liberties: whiteLiberties,
      label: `White group in the race: ${whiteLiberties} ${whiteLibertyWord} at ${whiteLibertyList}.`,
    },
  ];
  const liberties: LocalLibertyFocus[] = [
    {
      id: `local-capture-race-black-liberties-${pointKey(blackAnchor)}`,
      point: copyPoint(blackAnchor),
      count: blackLiberties,
      libertyPoints: race.black.liberties.map(copyPoint),
    },
    {
      id: `local-capture-race-white-liberties-${pointKey(whiteAnchor)}`,
      point: copyPoint(whiteAnchor),
      count: whiteLiberties,
      libertyPoints: race.white.liberties.map(copyPoint),
    },
  ];
  const lines: string[] = [];
  let suggestions: LocalSuggestionFocus[] = [];
  let actions: SenseiAction[] = [];

  if (blackLiberties < whiteLiberties) {
    suggestions = race.black.liberties.slice(0, 4).map((liberty, index) => {
      const coord = pointToCoord(liberty, game.board.size);

      return {
        id: `local-capture-race-defend-move-${pointKey(liberty)}`,
        point: copyPoint(liberty),
        rank: index + 1,
        reason: `Give Black more room by playing ${coord}.`,
      };
    });
    lines.push('This is a capture race, and Black is behind on liberties.');
    lines.push(`Your Black group at ${blackCoord} has ${blackLiberties} ${blackLibertyWord}: ${blackLibertyList}.`);
    lines.push(`White group at ${whiteCoord} has ${whiteLiberties} ${whiteLibertyWord}: ${whiteLibertyList}.`);
    lines.push('Defend first by playing one of the marked Black liberties.');
    lines.push('After Black has more room, come back and count whether the White group can be attacked.');
    actions = [
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ];
  } else if (whiteLiberties < blackLiberties) {
    suggestions = race.white.liberties.slice(0, 4).map((liberty, index) => {
      const coord = pointToCoord(liberty, game.board.size);

      return {
        id: `local-capture-race-attack-move-${pointKey(liberty)}`,
        point: copyPoint(liberty),
        rank: index + 1,
        reason: `Pressure White by playing its liberty at ${coord}.`,
      };
    });
    lines.push('This is a capture race, and Black is ahead on liberties.');
    lines.push(`Your Black group at ${blackCoord} has ${blackLiberties} ${blackLibertyWord}: ${blackLibertyList}.`);
    lines.push(`White group at ${whiteCoord} has only ${whiteLiberties} ${whiteLibertyWord}: ${whiteLibertyList}.`);
    lines.push('Attack by filling one marked White liberty, but keep counting after White answers.');
    actions = [
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:capture', label: 'Practice capture' },
    ];
  } else {
    suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-capture-race-move') : [];
    lines.push('This is a capture race, but it is even on liberties right now.');
    lines.push(`Both groups have ${blackLiberties} ${blackLibertyWord}.`);
    lines.push(`Black at ${blackCoord}: ${blackLibertyList}. White at ${whiteCoord}: ${whiteLibertyList}.`);
    lines.push('No one gets captured immediately.');
    if (objective) {
      lines.push(`Use the current guided job as the priority: ${objective.title}. ${objective.instruction}${objectiveTargetText ? ` ${objectiveTargetText}` : ''}`);
    } else {
      lines.push('Choose a move that gives your stones more room before chasing the race.');
    }
    actions = [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'practice:reading', label: 'Practice reading' },
    ];
  }

  lines.push(suggestions.length > 0
    ? 'I marked both groups, their liberties, and the practical move to read next.'
    : 'I marked both groups and their liberties so the race is visible.');

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds([
      'reading',
      'liberties',
      'groups',
      'capture',
      ...(objective?.conceptIds ?? []),
    ]),
    boardFocus: {
      liberties,
      groups,
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions,
  };
}

function buildCaptureRacePlanAnswer(game: GameState): LocalQuestionAnswer | null {
  const race = findCaptureRacePair(game);
  if (!race) return null;

  const blackAnchor = groupAnchor(race.black);
  const whiteAnchor = groupAnchor(race.white);
  const blackLibertyCoords = race.black.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const whiteLibertyCoords = race.white.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const blackLiberties = race.black.liberties.length;
  const whiteLiberties = race.white.liberties.length;

  if (blackLiberties >= whiteLiberties) return null;

  const suggestions = race.black.liberties.slice(0, 4).map((liberty, index) => {
    const coord = pointToCoord(liberty, game.board.size);

    return {
      id: `local-capture-race-plan-save-${pointKey(liberty)}`,
      point: copyPoint(liberty),
      rank: index + 1,
      reason: index === 0
        ? `Step 1: save Black by adding a liberty at ${coord}.`
        : `Step 1 backup: save Black by adding a liberty at ${coord}.`,
    };
  });

  return {
    text: [
      'Read this capture race as count, save, recount.',
      `Step 1: Black is behind, so first add a liberty at ${joinOrList(blackLibertyCoords)}.`,
      `Step 2: after White answers, count again: Black started with ${blackLiberties} liberties and White started with ${whiteLiberties}.`,
      `Step 3: if Black is still behind, add another liberty; when Black catches up, start filling White liberties at ${joinOrList(whiteLibertyCoords)}.`,
      'I marked both groups, all liberties, and the saving moves so the race has a repeatable plan.',
    ].join(' '),
    conceptIds: ['reading', 'liberties', 'groups', 'capture'],
    boardFocus: {
      liberties: [
        {
          id: `local-capture-race-plan-black-liberties-${pointKey(blackAnchor)}`,
          point: copyPoint(blackAnchor),
          count: blackLiberties,
          libertyPoints: race.black.liberties.map(copyPoint),
        },
        {
          id: `local-capture-race-plan-white-liberties-${pointKey(whiteAnchor)}`,
          point: copyPoint(whiteAnchor),
          count: whiteLiberties,
          libertyPoints: race.white.liberties.map(copyPoint),
        },
      ],
      groups: [
        {
          id: `local-capture-race-plan-black-group-${pointKey(blackAnchor)}`,
          stones: race.black.stones.map(copyPoint),
          color: race.black.color,
          liberties: blackLiberties,
          label: `Black group to save first: ${libertyCountPhrase(blackLiberties)} at ${joinList(blackLibertyCoords)}.`,
        },
        {
          id: `local-capture-race-plan-white-group-${pointKey(whiteAnchor)}`,
          stones: race.white.stones.map(copyPoint),
          color: race.white.color,
          liberties: whiteLiberties,
          label: `White group to chase after Black catches up: ${libertyCountPhrase(whiteLiberties)} at ${joinList(whiteLibertyCoords)}.`,
        },
      ],
      suggestions,
    },
    actions: [
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ],
  };
}

interface SnapbackContext {
  whiteMove: Extract<Move, { type: 'place' }>;
  whiteGroup: Group;
  snapbackPoint: Point;
  recaptured: Point[];
  postRecaptureLiberties: Point[];
}

interface SnapbackRecapturedGroup {
  keyPoint: Point;
  group: Group;
}

function findSnapbackRecapturedGroups(game: GameState, recaptured: Point[]): SnapbackRecapturedGroup[] {
  const seen = new Set<string>();
  const groups: SnapbackRecapturedGroup[] = [];

  for (const point of recaptured) {
    const group = getGroup(game.board, point);
    if (!group || group.color !== 'white') continue;

    const key = group.stones.map(pointKey).sort().join('|');
    if (seen.has(key)) continue;

    seen.add(key);
    groups.push({ keyPoint: point, group });
  }

  return groups;
}

function findSnapbackContext(game: GameState): SnapbackContext | null {
  const move = latestMove(game);
  if (move?.type !== 'place' || move.color !== 'white' || move.captured.length === 0) return null;

  const whiteGroup = getGroup(game.board, move.point);
  if (!whiteGroup || whiteGroup.color !== 'white' || whiteGroup.liberties.length !== 1) return null;

  const snapbackPoint = whiteGroup.liberties[0];
  const recapture = playMove(game, snapbackPoint);
  if (!recapture.success || recapture.captured.length === 0) return null;
  const postRecaptureGroup = getGroup(recapture.newState.board, snapbackPoint);
  if (!postRecaptureGroup || postRecaptureGroup.color !== 'black') return null;

  return {
    whiteMove: move,
    whiteGroup,
    snapbackPoint,
    recaptured: recapture.captured,
    postRecaptureLiberties: postRecaptureGroup.liberties,
  };
}

function buildSnapbackAnswer(game: GameState): LocalQuestionAnswer {
  const context = findSnapbackContext(game);

  if (!context) {
    return {
      text: 'A snapback is a capture trick: you let the opponent capture one stone, then immediately recapture the whole cramped group because that capture left it with one liberty. Look for it after a capture into a tight shape, especially when the recapture point is the only liberty.',
      conceptIds: ['snapback', 'tesuji', 'capture', 'reading'],
      actions: [
        { id: 'lesson:snapback', label: 'Review snapback' },
        { id: 'practice:tesuji', label: 'Practice tesuji' },
      ],
    };
  }

  const whiteCoord = pointToCoord(context.whiteMove.point, game.board.size);
  const capturedCoords = context.whiteMove.captured.map((point) => pointToCoord(point, game.board.size));
  const snapbackCoord = pointToCoord(context.snapbackPoint, game.board.size);
  const recapturedCoords = context.recaptured.map((point) => pointToCoord(point, game.board.size));

  return {
    text: [
      `White just captured ${joinList(capturedCoords)} by playing ${whiteCoord}.`,
      `That capture is cramped: the White stones connected to ${whiteCoord} have only one liberty, ${snapbackCoord}.`,
      `Black can snap back at ${snapbackCoord} and recapture ${joinList(recapturedCoords)}.`,
      'Play the marked snapback point before White gets another liberty.',
    ].join(' '),
    conceptIds: ['snapback', 'tesuji', 'capture', 'reading', 'liberties'],
    boardFocus: {
      highlights: [{
        id: `local-snapback-white-capture-${pointKey(context.whiteMove.point)}`,
        point: copyPoint(context.whiteMove.point),
        variant: 'danger',
        label: `${whiteCoord}: White captured into a snapback shape.`,
      }],
      liberties: [{
        id: `local-snapback-liberties-${pointKey(context.whiteMove.point)}`,
        point: copyPoint(context.whiteMove.point),
        count: context.whiteGroup.liberties.length,
        libertyPoints: context.whiteGroup.liberties.map(copyPoint),
      }],
      suggestions: [{
        id: `local-snapback-recapture-${pointKey(context.snapbackPoint)}`,
        point: copyPoint(context.snapbackPoint),
        rank: 1,
        reason: `Snap back at ${snapbackCoord}: recapture the cramped White stones.`,
      }],
    },
    actions: [
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:snapback', label: 'Review snapback' },
      { id: 'practice:tesuji', label: 'Practice tesuji' },
    ],
  };
}

function buildSnapbackPlanAnswer(game: GameState): LocalQuestionAnswer | null {
  const context = findSnapbackContext(game);
  if (!context) return null;

  const whiteCoord = pointToCoord(context.whiteMove.point, game.board.size);
  const snapbackCoord = pointToCoord(context.snapbackPoint, game.board.size);
  const recapturedCoords = context.recaptured.map((point) => pointToCoord(point, game.board.size));
  const postRecaptureLibertyCoords = context.postRecaptureLiberties.map((liberty) => pointToCoord(liberty, game.board.size));
  const recapturedGroups = findSnapbackRecapturedGroups(game, context.recaptured);

  return {
    text: [
      'Read this snapback as capture, count, continue.',
      `Step 1: snap back at ${snapbackCoord} and remove ${joinList(recapturedCoords)}.`,
      `Step 2: after those stones come off, Black's new stone at ${snapbackCoord} has ${libertyCountPhrase(context.postRecaptureLiberties.length)}: ${joinList(postRecaptureLibertyCoords)}.`,
      'Step 3: if White keeps fighting nearby, use that count before choosing the next forcing move; if White plays away, the snapback already won this local tactic.',
      'I marked the captured White stones, the recapture point, and the post-capture liberties so the follow-up is visible.',
    ].join(' '),
    conceptIds: ['snapback', 'tesuji', 'capture', 'reading', 'liberties'],
    boardFocus: {
      highlights: [
        {
          id: `local-snapback-plan-white-capture-${pointKey(context.whiteMove.point)}`,
          point: copyPoint(context.whiteMove.point),
          variant: 'danger',
          label: `${whiteCoord}: White captured into the snapback shape.`,
        },
        {
          id: `local-snapback-plan-recapture-point-${pointKey(context.snapbackPoint)}`,
          point: copyPoint(context.snapbackPoint),
          variant: 'positive',
          label: `${snapbackCoord}: Step 1 snapback and remove the cramped White stones.`,
        },
      ],
      liberties: [
        {
          id: `local-snapback-plan-white-liberties-${pointKey(context.whiteMove.point)}`,
          point: copyPoint(context.whiteMove.point),
          count: context.whiteGroup.liberties.length,
          libertyPoints: context.whiteGroup.liberties.map(copyPoint),
        },
        {
          id: `local-snapback-plan-black-after-${pointKey(context.snapbackPoint)}`,
          point: copyPoint(context.snapbackPoint),
          count: context.postRecaptureLiberties.length,
          libertyPoints: context.postRecaptureLiberties.map(copyPoint),
        },
      ],
      groups: recapturedGroups.map(({ keyPoint, group }) => {
        const stoneCoords = group.stones.map((stone) => pointToCoord(stone, game.board.size));
        const libertyCoords = group.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
        const stoneWord = group.stones.length === 1 ? 'stone' : 'stones';

        return {
          id: `local-snapback-plan-white-group-${pointKey(keyPoint)}`,
          stones: group.stones.map(copyPoint),
          color: group.color,
          liberties: group.liberties.length,
          label: `White ${stoneWord} to remove at ${joinList(stoneCoords)}: ${libertyCountPhrase(group.liberties.length)} at ${joinList(libertyCoords)}.`,
        };
      }),
      suggestions: [
        {
          id: `local-snapback-plan-recapture-${pointKey(context.snapbackPoint)}`,
          point: copyPoint(context.snapbackPoint),
          rank: 1,
          reason: `Step 1: snap back at ${snapbackCoord} and remove ${joinList(recapturedCoords)}.`,
        },
      ],
    },
    actions: [
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ],
  };
}

function buildAttackDefenseDecisionAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const weakGroup = findLearnerWeakGroup(game);

  if (weakGroup) {
    const anchor = groupAnchor(weakGroup);
    const anchorCoord = pointToCoord(anchor, game.board.size);
    const libertyCoords = weakGroup.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
    const libertyList = joinList(libertyCoords);
    const libertyWord = weakGroup.liberties.length === 1 ? 'liberty' : 'liberties';
    const suggestions = weakGroup.liberties.slice(0, 4).map((liberty, index) => {
      const coord = pointToCoord(liberty, game.board.size);

      return {
        id: `local-attack-defense-defend-move-${pointKey(liberty)}`,
        point: copyPoint(liberty),
        rank: index + 1,
        reason: weakGroup.liberties.length === 1
          ? `Save the group by playing its last liberty at ${coord}.`
          : `Give the short-on-room group another liberty at ${coord}.`,
      };
    });

    return {
      text: [
        'Defend first.',
        `Your Black group at ${anchorCoord} has only ${weakGroup.liberties.length} ${libertyWord}: ${libertyList}.`,
        weakGroup.liberties.length === 1
          ? 'That is atari, so this group can be captured if White fills the last liberty.'
          : 'If you attack while it is short on room, White can answer by filling these liberties.',
        weakGroup.liberties.length === 1
          ? 'Play the marked liberty before looking for an attack.'
          : 'Play one marked liberty to give it breathing room.',
        'Attack later, after this group has room.',
        'I marked the group, its liberties, and the defensive moves.',
      ].join(' '),
      conceptIds: uniqueConceptIds([
        'reading',
        'groups',
        'liberties',
        'capture',
        ...(weakGroup.liberties.length === 1 ? ['atari'] : []),
      ]),
      boardFocus: {
        liberties: [{
          id: `local-attack-defense-weak-liberties-${pointKey(anchor)}`,
          point: copyPoint(anchor),
          count: weakGroup.liberties.length,
          libertyPoints: weakGroup.liberties.map(copyPoint),
        }],
        groups: [{
          id: `local-attack-defense-weak-group-${pointKey(anchor)}`,
          stones: weakGroup.stones.map(copyPoint),
          color: weakGroup.color,
          liberties: weakGroup.liberties.length,
          label: `Defend Black group first: ${weakGroup.liberties.length} ${libertyWord} at ${libertyList}.`,
        }],
        suggestions,
      },
      actions: [
        { id: 'hint', label: 'Show targets' },
        { id: 'lesson:liberties', label: 'Review liberties' },
      ],
    };
  }

  const captureTarget = findLearnerCaptureTarget(game);
  if (captureTarget) {
    const anchor = groupAnchor(captureTarget);
    const anchorCoord = pointToCoord(anchor, game.board.size);
    const capturePoint = captureTarget.liberties[0];
    const captureCoord = pointToCoord(capturePoint, game.board.size);

    return {
      text: [
        'Attack now.',
        `White has a group at ${anchorCoord} in atari.`,
        `Black can capture by playing ${captureCoord}.`,
        'That is a concrete attack; play the final liberty before White gets more room.',
        'I marked the White group, its final liberty, and the capture move.',
      ].join(' '),
      conceptIds: ['capture', 'atari', 'liberties', 'reading'],
      boardFocus: {
        liberties: [{
          id: `local-attack-defense-capture-liberties-${pointKey(anchor)}`,
          point: copyPoint(anchor),
          count: captureTarget.liberties.length,
          libertyPoints: captureTarget.liberties.map(copyPoint),
        }],
        groups: [{
          id: `local-attack-defense-capture-group-${pointKey(anchor)}`,
          stones: captureTarget.stones.map(copyPoint),
          color: captureTarget.color,
          liberties: captureTarget.liberties.length,
          label: `Attack White group now: capture by playing ${captureCoord}.`,
        }],
        suggestions: [{
          id: `local-attack-defense-capture-move-${pointKey(capturePoint)}`,
          point: copyPoint(capturePoint),
          rank: 1,
          reason: `Capture White by filling its last liberty at ${captureCoord}.`,
        }],
      },
      actions: [{ id: 'practice:capture', label: 'Practice capture' }],
    };
  }

  const pressureTarget = findLearnerPressureTarget(game);
  if (pressureTarget) {
    const anchor = groupAnchor(pressureTarget);
    const anchorCoord = pointToCoord(anchor, game.board.size);
    const libertyCoords = pressureTarget.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
    const libertyList = joinList(libertyCoords);
    const libertyWord = pressureTarget.liberties.length === 1 ? 'liberty' : 'liberties';
    const suggestions = pressureTarget.liberties.slice(0, 4).map((liberty, index) => {
      const coord = pointToCoord(liberty, game.board.size);

      return {
        id: `local-attack-defense-pressure-move-${pointKey(liberty)}`,
        point: copyPoint(liberty),
        rank: index + 1,
        reason: `Pressure White by playing its liberty at ${coord}.`,
      };
    });

    return {
      text: [
        'Attack carefully.',
        `White has a group at ${anchorCoord} with only ${pressureTarget.liberties.length} ${libertyWord}: ${libertyList}.`,
        'That is pressure, not a capture yet, so count your own liberties before chasing.',
        'If your groups still have room, filling one of those liberties can make White answer.',
        'I marked the pressured White group and the attacking points to read.',
      ].join(' '),
      conceptIds: ['reading', 'liberties', 'groups', 'capture'],
      boardFocus: {
        liberties: [{
          id: `local-attack-defense-pressure-liberties-${pointKey(anchor)}`,
          point: copyPoint(anchor),
          count: pressureTarget.liberties.length,
          libertyPoints: pressureTarget.liberties.map(copyPoint),
        }],
        groups: [{
          id: `local-attack-defense-pressure-group-${pointKey(anchor)}`,
          stones: pressureTarget.stones.map(copyPoint),
          color: pressureTarget.color,
          liberties: pressureTarget.liberties.length,
          label: `Pressure White group: ${pressureTarget.liberties.length} ${libertyWord} at ${libertyList}.`,
        }],
        suggestions,
      },
      actions: [
        { id: 'hint', label: 'Show targets' },
        { id: 'practice:reading', label: 'Practice reading' },
      ],
    };
  }

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-attack-defense-move') : [];
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const currentGroup = findLearnerMostRestrictedGroup(game);
  const anchor = currentGroup ? groupAnchor(currentGroup) : null;
  const anchorCoord = anchor ? pointToCoord(anchor, game.board.size) : null;
  const libertyCoords = currentGroup?.liberties.map((liberty) => pointToCoord(liberty, game.board.size)) ?? [];
  const libertyList = joinList(libertyCoords);
  const libertyWord = currentGroup?.liberties.length === 1 ? 'liberty' : 'liberties';
  const lines = [
    'No emergency attack or defense yet.',
  ];

  if (currentGroup && anchorCoord) {
    lines.push(`Your tightest Black group is at ${anchorCoord}, with ${currentGroup.liberties.length} ${libertyWord}: ${libertyList}.`);
    lines.push('That is enough room for now, so make the next move serve a clear purpose instead of chasing randomly.');
  }

  if (objective) {
    lines.push(`Use the current guided job as the priority: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  } else {
    lines.push('Pick the move that gives your stones more room, easier territory, or a concrete capture threat.');
  }

  lines.push(suggestions.length > 0
    ? 'I marked the practical targets so you can turn the decision into a move.'
    : 'I marked the current group so you can keep counting before choosing.');

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['reading', 'direction-of-play', 'liberties', ...(objective?.conceptIds ?? [])]),
    boardFocus: {
      ...(currentGroup && anchor
        ? {
          liberties: [{
            id: `local-attack-defense-current-liberties-${pointKey(anchor)}`,
            point: copyPoint(anchor),
            count: currentGroup.liberties.length,
            libertyPoints: currentGroup.liberties.map(copyPoint),
          }],
          groups: [{
            id: `local-attack-defense-current-group-${pointKey(anchor)}`,
            stones: currentGroup.stones.map(copyPoint),
            color: currentGroup.color,
            liberties: currentGroup.liberties.length,
            label: `Black group with room: ${currentGroup.liberties.length} ${libertyWord} at ${libertyList}.`,
          }],
        }
        : {}),
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'practice:reading', label: 'Practice reading' },
    ],
  };
}

function buildFightFollowUpAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer | null {
  if (isFightPlanQuestion(q)) {
    const snapbackPlanAnswer = buildSnapbackPlanAnswer(game);
    if (snapbackPlanAnswer) return snapbackPlanAnswer;

    const occupiedCutPlanAnswer = buildOccupiedOneSpaceJumpCutPlanAnswer(game, q);
    if (occupiedCutPlanAnswer) return occupiedCutPlanAnswer;

    const captureRacePlanAnswer = buildCaptureRacePlanAnswer(game);
    if (captureRacePlanAnswer) return captureRacePlanAnswer;
  }

  if (findSnapbackContext(game)) return buildSnapbackAnswer(game);

  const occupiedCutAnswer = buildOccupiedOneSpaceJumpCutAnswer(game, q);
  if (occupiedCutAnswer) return occupiedCutAnswer;

  if (findCaptureRacePair(game)) return buildCaptureRaceAnswer(game, teachingLevel);

  if (findLearnerWeakGroup(game) || findLearnerCaptureTarget(game) || findLearnerPressureTarget(game)) {
    return buildAttackDefenseDecisionAnswer(game, teachingLevel);
  }

  return null;
}

function buildThreatAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const captureTarget = findLearnerCaptureTarget(game);
  const pressureTarget = captureTarget ? null : findLearnerPressureTarget(game);

  if (captureTarget) {
    const anchor = groupAnchor(captureTarget);
    const anchorCoord = pointToCoord(anchor, game.board.size);
    const capturePoint = captureTarget.liberties[0];
    const captureCoord = pointToCoord(capturePoint, game.board.size);

    return {
      text: [
        `Yes: White has a group at ${anchorCoord} in atari.`,
        `Your threat is capture: Black can play ${captureCoord}, the group's final liberty.`,
        'If White answers, it probably tries to add a liberty or capture first, so capture now when that matters.',
        'I marked the White group, its last liberty, and the capture move.',
      ].join(' '),
      conceptIds: ['capture', 'atari', 'liberties', 'reading'],
      boardFocus: {
        liberties: [{
          id: `local-threat-liberties-${pointKey(anchor)}`,
          point: copyPoint(anchor),
          count: captureTarget.liberties.length,
          libertyPoints: captureTarget.liberties.map(copyPoint),
        }],
        groups: [{
          id: `local-threat-group-${pointKey(anchor)}`,
          stones: captureTarget.stones.map(copyPoint),
          color: captureTarget.color,
          liberties: captureTarget.liberties.length,
          label: `White group in atari: capture by playing ${captureCoord}.`,
        }],
        suggestions: [{
          id: `local-threat-capture-move-${pointKey(capturePoint)}`,
          point: copyPoint(capturePoint),
          rank: 1,
          reason: `Capture White by filling its last liberty at ${captureCoord}.`,
        }],
      },
      actions: [{ id: 'practice:capture', label: 'Practice capture' }],
    };
  }

  if (pressureTarget) {
    const anchor = groupAnchor(pressureTarget);
    const anchorCoord = pointToCoord(anchor, game.board.size);
    const libertyCoords = pressureTarget.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
    const libertyList = joinList(libertyCoords);
    const suggestions = pressureTarget.liberties.slice(0, 4).map((liberty, index) => {
      const coord = pointToCoord(liberty, game.board.size);

      return {
        id: `local-threat-pressure-move-${pointKey(liberty)}`,
        point: copyPoint(liberty),
        rank: index + 1,
        reason: `Pressure White by playing its liberty at ${coord}.`,
      };
    });

    return {
      text: [
        `White has a group at ${anchorCoord} with only ${pressureTarget.liberties.length} liberties: ${libertyList}.`,
        'That is pressure, not a capture yet. Filling one liberty can make White answer, but count your own safety first.',
        'I marked the pressured White group and the liberties you can read as attacking moves.',
      ].join(' '),
      conceptIds: ['reading', 'liberties', 'groups', 'capture'],
      boardFocus: {
        liberties: [{
          id: `local-threat-pressure-liberties-${pointKey(anchor)}`,
          point: copyPoint(anchor),
          count: pressureTarget.liberties.length,
          libertyPoints: pressureTarget.liberties.map(copyPoint),
        }],
        groups: [{
          id: `local-threat-pressure-group-${pointKey(anchor)}`,
          stones: pressureTarget.stones.map(copyPoint),
          color: pressureTarget.color,
          liberties: pressureTarget.liberties.length,
          label: `White group under pressure: ${pressureTarget.liberties.length} liberties at ${libertyList}.`,
        }],
        suggestions,
      },
      actions: [
        { id: 'hint', label: 'Show targets' },
        { id: 'practice:capture', label: 'Practice capture' },
      ],
    };
  }

  const move = lastBlackPlacedMove(game);
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-threat-move') : [];
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;

  if (!move) {
    return {
      text: [
        'Not yet: you need a Black stone before there is a concrete threat to read.',
        objective ? `Start with one useful board job: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}` : '',
        suggestions.length > 0 ? 'I marked the first targets so your next move can create a real plan.' : '',
      ].filter(Boolean).join(' '),
      conceptIds: uniqueConceptIds(['direction-of-play', 'reading', ...(objective?.conceptIds ?? [])]),
      ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
      actions: [
        ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
        { id: 'practice:reading', label: 'Practice reading' },
      ],
    };
  }

  const coord = pointToCoord(move.point, game.board.size);
  const group = getGroup(game.board, move.point);
  const libertyCoords = group?.liberties.map((liberty) => pointToCoord(liberty, game.board.size)) ?? [];
  const libertyList = joinList(libertyCoords);
  const libertyWord = group?.liberties.length === 1 ? 'liberty' : 'liberties';
  const lines = [
    'Not a capture threat yet.',
    `${coord} threatens future shape: it gives you an anchor to extend from, not an immediate kill.`,
  ];

  if (group && libertyCoords.length > 0) {
    lines.push(`That Black group has ${group.liberties.length} ${libertyWord}: ${libertyList}, so it has room to build.`);
  }

  lines.push('A useful beginner threat is a move White should respect because it builds territory, connection, safety, or pressure.');

  if (objective) {
    lines.push(`On this board, turn the threat into: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  }

  lines.push(suggestions.length > 0
    ? `I highlighted ${coord} and marked the current targets so you can make the threat visible.`
    : `I highlighted ${coord} so you can keep reading from the actual stone.`);

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['direction-of-play', 'reading', 'liberties', ...(objective?.conceptIds ?? [])]),
    boardFocus: {
      highlights: [{
        id: `local-threat-anchor-${pointKey(move.point)}`,
        point: copyPoint(move.point),
        variant: 'neutral',
        label: `${coord}: current Black stone creating a future threat.`,
      }],
      ...(group
        ? {
          liberties: [{
            id: `local-threat-liberties-${pointKey(move.point)}`,
            point: copyPoint(move.point),
            count: group.liberties.length,
            libertyPoints: group.liberties.map(copyPoint),
          }],
          groups: [{
            id: `local-threat-group-${pointKey(move.point)}`,
            stones: group.stones.map(copyPoint),
            color: group.color,
            liberties: group.liberties.length,
            label: `Black group creating a future threat: ${group.liberties.length} ${libertyWord} at ${libertyList}.`,
          }],
        }
        : {}),
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'practice:reading', label: 'Practice reading' },
    ],
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
  const learnerAnchorMove = lastBlackPlacedMove(game);
  const context = learnerAnchorMove ? buildLibertyContext(game, learnerAnchorMove.point, 'This connected group') : null;
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-connection-move') : [];
  const anchorText = learnerAnchorMove ? pointToCoord(learnerAnchorMove.point, game.board.size) : null;
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const targetCoordText = objective ? objectiveTargetCoordList(objective, game.board.size) : null;
  const targetCoords = objective?.targetPoints.slice(0, 4).map((point) => pointToCoord(point, game.board.size)) ?? [];
  const blockedGap = findWhiteBlockedOneSpaceJumpGap(
    game.board,
    learnerAnchorMove?.point ?? null,
    targetCoordText,
    'local-connection',
  );
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

  if (blockedGap) {
    lines.push(blockedGap.sentence);
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

  if (context && blockedGap && suggestions.length > 0) {
    lines.push(`I marked your current group, the blocked gap, and the clean connection-shape ${suggestions.length === 1 ? 'target' : 'targets'}.`);
  } else if (context && suggestions.length > 0) {
    lines.push('I marked your current group and the connection-shape targets.');
  } else if (suggestions.length > 0) {
    lines.push('I marked the current beginner targets.');
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds(['groups', 'liberties', 'shape', ...(objective?.conceptIds ?? [])]),
    boardFocus: {
      ...(context?.boardFocus ?? {}),
      ...(blockedGap ? { highlights: [blockedGap.highlight] } : {}),
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'lesson:groups', label: 'Review groups' },
    ],
  };
}

function buildWeakGroupAnswer(game: GameState, teachingLevel: TeachingLevel, q: string): LocalQuestionAnswer {
  const requestedPoint = mentionedCoordinate(q, game.board.size);
  const requestedGroup = findLearnerGroupAtPoint(game, requestedPoint);
  const weakGroup = requestedGroup && requestedGroup.liberties.length <= 2
    ? requestedGroup
    : findLearnerWeakGroup(game);
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });

  if (!weakGroup) {
    const currentGroup = requestedGroup ?? findLearnerMostRestrictedGroup(game);
    const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-weak-group-current-move') : [];
    const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;

    if (requestedPoint && !requestedGroup) {
      const coord = pointToCoord(requestedPoint, game.board.size);
      const occupant = getStone(game.board, requestedPoint);

      if (occupant === null && isCandidateMoveQuestion(q, game.board.size)) {
        const candidateAnswer = buildCandidateMoveAnswer(game, teachingLevel, q);
        if (candidateAnswer) return candidateAnswer;
      }

      return {
        text: [
          `${coord} is not one of your Black groups${occupant === 'white' ? '; White has a stone there' : '; it is empty'}.`,
          'To check safety, point to one of your Black stones and count that group\'s liberties.',
          objective ? `Your current guided job is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}` : '',
          suggestions.length > 0 ? 'I marked the current beginner targets so you can keep building safely.' : '',
        ].filter(Boolean).join(' '),
        conceptIds: uniqueConceptIds(['groups', 'liberties', ...(objective?.conceptIds ?? [])]),
        boardFocus: {
          highlights: [{
            id: `local-weak-group-requested-${pointKey(requestedPoint)}`,
            point: copyPoint(requestedPoint),
            variant: occupant === 'white' ? 'danger' : 'neutral',
            label: `${coord}: not one of your Black groups.`,
          }],
          ...(suggestions.length > 0 ? { suggestions } : {}),
        },
        actions: [
          ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
          { id: 'lesson:liberties', label: 'Review liberties' },
        ],
      };
    }

    if (currentGroup) {
      const anchor = groupAnchor(currentGroup);
      const anchorCoord = pointToCoord(anchor, game.board.size);
      const libertyCoords = currentGroup.liberties.map((liberty) => pointToCoord(liberty, game.board.size));
      const libertyList = joinList(libertyCoords);
      const libertyWord = currentGroup.liberties.length === 1 ? 'liberty' : 'liberties';
      const isUnderPressure = groupTouchesColor(game, currentGroup, 'white');

      return {
        text: [
          'A weak group is a connected group with very little room, usually one or two liberties.',
          `Your Black group at ${anchorCoord} ${isUnderPressure ? 'is under pressure, but it is not in immediate danger' : 'is not in immediate danger'}: it has ${currentGroup.liberties.length} ${libertyWord}: ${libertyList}.`,
          `Immediate danger usually starts at one or two liberties; with ${currentGroup.liberties.length} ${libertyWord}, keep building while you keep counting.`,
          objective ? `Your current guided job is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}` : '',
          suggestions.length > 0
            ? `I marked that group, its liberties, and the useful next ${suggestions.length === 1 ? 'target' : 'targets'} so the safety check is visible.`
            : 'I marked that group and its liberties so the safety check is visible.',
        ].filter(Boolean).join(' '),
        conceptIds: uniqueConceptIds(['groups', 'liberties', ...(objective?.conceptIds ?? [])]),
        boardFocus: {
          liberties: [{
            id: `local-weak-group-current-liberties-${pointKey(anchor)}`,
            point: copyPoint(anchor),
            count: currentGroup.liberties.length,
            libertyPoints: currentGroup.liberties.map(copyPoint),
          }],
          groups: [{
            id: `local-weak-group-current-${pointKey(anchor)}`,
            stones: currentGroup.stones.map(copyPoint),
            color: currentGroup.color,
            liberties: currentGroup.liberties.length,
            label: isUnderPressure
              ? `Black group under pressure, not weak yet: ${currentGroup.liberties.length} ${libertyWord} at ${libertyList}.`
              : `Black group with room: ${currentGroup.liberties.length} ${libertyWord} at ${libertyList}.`,
          }],
          ...(suggestions.length > 0 ? { suggestions } : {}),
        },
        actions: [
          ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
          { id: 'lesson:liberties', label: 'Review liberties' },
        ],
      };
    }

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

function buildMoveImpactAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const move = lastBlackPlacedMove(game);
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-move-impact-next-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;

  if (!move) {
    const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;

    return {
      text: [
        'Play a stone first, then ask what changed and I will tie that move back to the board.',
        objective ? `Your first visible job is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}` : '',
        suggestions.length > 0 ? 'I marked the starting targets so you can create a move worth reviewing.' : '',
      ].filter(Boolean).join(' '),
      conceptIds: uniqueConceptIds(['stones-and-board', 'direction-of-play', ...(objective?.conceptIds ?? [])]),
      ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
      actions: [
        ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
        ...(action ? [action] : []),
      ],
    };
  }

  const coord = pointToCoord(move.point, game.board.size);
  const progress = getBeginnerObjectiveProgress(game, teachingLevel);
  const insight = getMoveInsight(game, teachingLevel);
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const highlightVariant: LocalHighlightFocus['variant'] = progress?.status === 'missed'
    ? 'warning'
    : progress?.status === 'met'
      ? 'positive'
      : 'neutral';
  const lines = [
    `That move changed the position around ${coord}.`,
  ];

  if (progress) {
    lines.push(progress.status === 'met'
      ? `It completed the beginner job: ${progress.text}`
      : `It missed the beginner job: ${progress.text}`);
  }

  if (insight) {
    lines.push(insight.observation);
  }

  if (objective) {
    lines.push(`The board now asks for: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  } else {
    lines.push('The useful habit is to ask what this stone helps next: more room, easier territory, a safer group, or a capture threat.');
  }

  lines.push(suggestions.length > 0
    ? `I highlighted ${coord} and marked the next targets so the cause-and-effect is visible.`
    : `I highlighted ${coord} so you can re-read the change on the board.`);

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds([
      'direction-of-play',
      ...(insight?.conceptIds ?? []),
      ...(objective?.conceptIds ?? []),
    ]),
    boardFocus: {
      highlights: [{
        id: `local-move-impact-${pointKey(move.point)}`,
        point: copyPoint(move.point),
        variant: highlightVariant,
        label: `${coord}: ${progress?.status === 'met' ? 'met the current beginner job' : progress?.status === 'missed' ? 'missed the current beginner job' : 'last Black move'}.`,
      }],
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
    ],
  };
}

function buildLearningTakeawayAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer {
  const move = lastBlackPlacedMove(game);
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-learning-takeaway-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;

  if (!move) {
    const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;

    return {
      text: [
        'Play a stone first, then ask what it taught you.',
        'A good takeaway comes from comparing your move with one visible beginner job.',
        objective ? `Your first job is: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}` : '',
        suggestions.length > 0 ? 'I marked the starting targets so the lesson begins with a concrete choice.' : '',
      ].filter(Boolean).join(' '),
      conceptIds: uniqueConceptIds(['stones-and-board', 'direction-of-play', ...(objective?.conceptIds ?? [])]),
      ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
      actions: [
        ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
        ...(action ? [action] : []),
      ],
    };
  }

  const coord = pointToCoord(move.point, game.board.size);
  const progress = getBeginnerObjectiveProgress(game, teachingLevel);
  const insight = getMoveInsight(game, teachingLevel);
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const highlightVariant: LocalHighlightFocus['variant'] = progress?.status === 'missed'
    ? 'warning'
    : progress?.status === 'met'
      ? 'positive'
      : 'neutral';
  const lines: string[] = [];

  if (progress?.status === 'met') {
    lines.push(`Lesson from ${coord}: your move worked because it followed the beginner job. ${progress.text}`);
  } else if (progress?.status === 'missed') {
    lines.push(`Lesson from ${coord}: the useful lesson is the mismatch. ${progress.text}`);
  } else {
    lines.push(`Lesson from ${coord}: every stone should make the next board question easier to answer.`);
  }

  if (insight) {
    lines.push(`Board idea: ${insight.observation}`);
  }

  if (objective) {
    lines.push(`Practice it now by playing the next job: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  } else {
    lines.push('Practice it now by asking which move gives your stones more room, easier territory, or a clear capture threat.');
  }

  lines.push(suggestions.length > 0
    ? `I highlighted ${coord} and marked the practice targets so the lesson has a next move.`
    : `I highlighted ${coord} so you can connect the lesson back to the board.`);

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds([
      'direction-of-play',
      ...(insight?.conceptIds ?? []),
      ...(objective?.conceptIds ?? []),
    ]),
    boardFocus: {
      highlights: [{
        id: `local-learning-takeaway-${pointKey(move.point)}`,
        point: copyPoint(move.point),
        variant: highlightVariant,
        label: `${coord}: move to learn from${progress?.status === 'met' ? ' - beginner job met' : progress?.status === 'missed' ? ' - beginner job missed' : ''}.`,
      }],
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
    ],
  };
}

function adjacentGroupsByColor(game: GameState, point: Point, color: 'black' | 'white'): Group[] {
  const seen = new Set<string>();
  const groups: Group[] = [];

  for (const adjacent of getAdjacentPoints(game.board, point)) {
    if (getStone(game.board, adjacent) !== color) continue;
    const group = getGroup(game.board, adjacent);
    if (!group) continue;
    const key = pointKey(groupAnchor(group));
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(group);
  }

  return groups.sort((a, b) => a.liberties.length - b.liberties.length || compareGroupsByAnchor(a, b));
}

function buildOpponentMoveAnswer(game: GameState, teachingLevel: TeachingLevel): LocalQuestionAnswer | null {
  const move = latestMove(game);
  if (move?.type !== 'place' || move.color !== 'white') return null;

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
  const suggestions = objective ? objectiveSuggestions(objective, game.board.size, 'local-opponent-response-move') : [];
  const action = objective ? getBeginnerObjectiveLessonAction(objective) : null;
  const coord = pointToCoord(move.point, game.board.size);
  const whiteGroup = getGroup(game.board, move.point);
  const pressuredGroups = adjacentGroupsByColor(game, move.point, 'black');
  const pressuredGroup = pressuredGroups[0] ?? null;
  const pressuredAnchor = pressuredGroup ? groupAnchor(pressuredGroup) : null;
  const pressuredCoord = pressuredAnchor ? pointToCoord(pressuredAnchor, game.board.size) : null;
  const libertyCoords = pressuredGroup?.liberties.map((liberty) => pointToCoord(liberty, game.board.size)) ?? [];
  const targetText = objective ? formatObjectiveTargetText(objective, game.board.size) : null;
  const lines = [
    `White just played ${coord}.`,
  ];

  if (move.captured.length > 0) {
    const capturedCoords = move.captured.map((point) => pointToCoord(point, game.board.size));
    lines.push(`That move captured ${joinList(capturedCoords)}, so its purpose was concrete: remove your stones by taking their last liberties.`);
  } else if (pressuredGroup && pressuredCoord) {
    const libertyWord = pressuredGroup.liberties.length === 1 ? 'liberty' : 'liberties';
    lines.push(`It touches your Black group at ${pressuredCoord} and leaves it with ${pressuredGroup.liberties.length} ${libertyWord}: ${joinList(libertyCoords)}.`);
    lines.push('That is pressure, not a mystery: White is making your group easier to attack if you ignore its liberties.');
  } else if (whiteGroup) {
    lines.push(`It starts or extends a White group with ${whiteGroup.liberties.length} ${whiteGroup.liberties.length === 1 ? 'liberty' : 'liberties'}, so it is trying to claim space without being captured immediately.`);
  } else {
    lines.push('Treat it as an opponent claim of space, then ask what it threatens before answering.');
  }

  if (objective) {
    lines.push(`Your reply should still be practical: ${objective.title}. ${objective.instruction}${targetText ? ` ${targetText}` : ''}`);
  } else {
    lines.push('Your reply should ask which Black group needs room, which White group can be pressured, or which point claims easier territory.');
  }

  if (suggestions.length > 0) {
    lines.push(`I highlighted White's move and marked Black's practical replies.`);
  } else {
    lines.push(`I highlighted White's move so you can re-read the threat on the board.`);
  }

  return {
    text: lines.join(' '),
    conceptIds: uniqueConceptIds([
      'direction-of-play',
      ...(move.captured.length > 0 ? ['capture', 'liberties'] : []),
      ...(pressuredGroup ? ['groups', 'liberties'] : []),
      ...(objective?.conceptIds ?? []),
    ]),
    boardFocus: {
      highlights: [{
        id: `local-opponent-move-${pointKey(move.point)}`,
        point: copyPoint(move.point),
        variant: move.captured.length > 0 || pressuredGroup ? 'warning' : 'neutral',
        label: `${coord}: latest White move${move.captured.length > 0 ? ' captured your stone' : pressuredGroup ? ' pressures a Black group' : ''}.`,
      }],
      ...(pressuredGroup && pressuredAnchor
        ? {
          liberties: [{
            id: `local-opponent-pressure-liberties-${pointKey(pressuredAnchor)}`,
            point: copyPoint(pressuredAnchor),
            count: pressuredGroup.liberties.length,
            libertyPoints: pressuredGroup.liberties.map(copyPoint),
          }],
          groups: [{
            id: `local-opponent-pressure-group-${pointKey(pressuredAnchor)}`,
            stones: pressuredGroup.stones.map(copyPoint),
            color: pressuredGroup.color,
            liberties: pressuredGroup.liberties.length,
            label: `Black group pressured by White's ${coord}: ${pressuredGroup.liberties.length} ${pressuredGroup.liberties.length === 1 ? 'liberty' : 'liberties'} at ${joinList(libertyCoords)}.`,
          }],
        }
        : {}),
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      ...(action ? [action] : []),
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

interface ReviewedBeginnerMove {
  moveNumber: number;
  point: Point;
  coord: string;
  objective: BeginnerObjective;
  metObjective: boolean;
  targetText: string | null;
}

function getReviewedBeginnerMoves(game: GameState, teachingLevel: TeachingLevel): ReviewedBeginnerMove[] {
  if (!isLocalAnswerLevel(teachingLevel) || game.board.size !== 9) return [];

  let replay = createGame(game.board.size, game.komi);
  const reviewedMoves: ReviewedBeginnerMove[] = [];

  for (let index = 0; index < game.moveHistory.length; index += 1) {
    const move = game.moveHistory[index];

    if (move.type === 'place') {
      if (move.color === 'black') {
        const objective = getBeginnerObjective({
          boardSize: replay.board.size,
          board: replay.board,
          moveHistory: replay.moveHistory,
          moveCount: replay.moveHistory.length,
          currentPlayer: 'black',
          teachingLevel,
        });

        if (objective && objective.targetPoints.length > 0) {
          reviewedMoves.push({
            moveNumber: index + 1,
            point: copyPoint(move.point),
            coord: pointToCoord(move.point, game.board.size),
            objective,
            metObjective: objective.targetPoints.some((target) => pointEquals(target, move.point)),
            targetText: formatObjectiveTargetText(objective, game.board.size),
          });
        }
      }

      const result = playMove(replay, move.point);
      if (!result.success) break;
      replay = result.newState;
      continue;
    }

    if (move.type === 'pass') {
      replay = passMove(replay);
      continue;
    }

    replay = resignGame(replay);
    break;
  }

  return reviewedMoves;
}

function formatReviewedMove(move: ReviewedBeginnerMove): string {
  return `Move ${move.moveNumber} ${move.coord}`;
}

export function getLocalGameReviewAnswer(
  game: GameState,
  teachingLevel: TeachingLevel,
): LocalQuestionAnswer | null {
  if (!isLocalAnswerLevel(teachingLevel)) return null;

  const reviewedMoves = getReviewedBeginnerMoves(game, teachingLevel);
  const currentObjective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel,
  });
  const suggestions = currentObjective
    ? objectiveSuggestions(currentObjective, game.board.size, 'local-game-review-next-move')
    : [];
  const currentTargetText = currentObjective ? formatObjectiveTargetText(currentObjective, game.board.size) : null;
  const lessonAction = currentObjective ? getBeginnerObjectiveLessonAction(currentObjective) : null;

  if (reviewedMoves.length === 0) {
    return {
      text: [
        'Local beginner review: there are no Black moves to review yet.',
        currentObjective
          ? `Start with one useful board job: ${currentObjective.title}. ${currentObjective.instruction}${currentTargetText ? ` ${currentTargetText}` : ''}`
          : 'Start a guided 9x9 game, play one move, then ask for review again.',
        suggestions.length > 0 ? 'I marked the first review targets on the board.' : '',
      ].filter(Boolean).join(' '),
      conceptIds: uniqueConceptIds(['stones-and-board', ...(currentObjective?.conceptIds ?? [])]),
      ...(suggestions.length > 0 ? { boardFocus: { suggestions } } : {}),
      actions: [
        ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
        { id: 'guided:intro', label: 'Start fresh guided game' },
        ...(lessonAction ? [lessonAction] : []),
      ],
    };
  }

  const bestMoves = reviewedMoves.filter((move) => move.metObjective);
  const missedMoves = reviewedMoves.filter((move) => !move.metObjective);
  const bestMove = bestMoves[0] ?? null;
  const missedMove = missedMoves[0] ?? null;
  const latestMove = reviewedMoves[reviewedMoves.length - 1];
  const highlightMoves = [
    ...(bestMove ? [{
      id: `local-game-review-best-${pointKey(bestMove.point)}`,
      point: copyPoint(bestMove.point),
      variant: 'positive' as const,
      label: `${formatReviewedMove(bestMove)} followed: ${bestMove.objective.title}.`,
    }] : []),
    ...(missedMove ? [{
      id: `local-game-review-fix-${pointKey(missedMove.point)}`,
      point: copyPoint(missedMove.point),
      variant: 'warning' as const,
      label: `${formatReviewedMove(missedMove)} missed: ${missedMove.objective.title}.`,
    }] : []),
  ];

  const reviewLines = [
    'Local beginner review: here are the board moments I can verify without cloud help.',
    bestMove
      ? `Best move: ${formatReviewedMove(bestMove)} followed "${bestMove.objective.title}". ${bestMove.objective.why}`
      : `Best habit to keep: you played ${reviewedMoves.length} Black move${reviewedMoves.length === 1 ? '' : 's'} and can now turn the review into one clearer target.`,
    missedMove
      ? `Main fix: ${formatReviewedMove(missedMove)} missed "${missedMove.objective.title}". Next time, ${missedMove.objective.instruction}${missedMove.targetText ? ` ${missedMove.targetText}` : ''}`
      : `Main fix: after ${formatReviewedMove(latestMove)}, do not stop at "good"; ask what the stone helps next.`,
    currentObjective
      ? `Next practice target: ${currentObjective.title}. ${currentObjective.instruction}${currentTargetText ? ` ${currentTargetText}` : ''}`
      : 'Next practice target: start a fresh guided 9x9 and keep each move tied to one visible job.',
    game.phase === 'playing'
      ? 'I marked the review point and the next targets so you can continue from this board.'
      : 'I marked the review point; start a fresh guided game when you want to apply the fix immediately.',
  ];

  return {
    text: reviewLines.join(' '),
    conceptIds: uniqueConceptIds([
      'stones-and-board',
      ...(bestMove?.objective.conceptIds ?? []),
      ...(missedMove?.objective.conceptIds ?? []),
      ...(currentObjective?.conceptIds ?? []),
    ]),
    boardFocus: {
      ...(highlightMoves.length > 0 ? { highlights: highlightMoves } : {}),
      ...(suggestions.length > 0 ? { suggestions } : {}),
    },
    actions: [
      ...(suggestions.length > 0 ? [{ id: 'hint', label: 'Show targets' }] : []),
      { id: 'guided:intro', label: 'Start fresh guided game' },
      ...(lessonAction ? [lessonAction] : []),
    ],
  };
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

  const shape = objective.id === 'extend-from-stone' ? findLearnerOneSpaceJumpShape(game) : null;
  if (shape) {
    const anchorCoord = pointToCoord(shape.anchor, game.board.size);
    const stoneCoord = pointToCoord(shape.stone, game.board.size);
    const gapCoord = pointToCoord(shape.gap, game.board.size);
    const frameworkSide = oneSpaceJumpFrameworkSide(shape, game.board.size);

    return {
      sentence: `${anchorCoord} and ${stoneCoord} are starting to sketch a ${frameworkSide} framework, but ${gapCoord} is only a gap in that framework, not safe territory yet. Keep extending, or answer if White attacks the gap.`,
      boardFocus: {
        highlights: [
          {
            id: `local-territory-framework-anchor-${pointKey(shape.anchor)}`,
            point: copyPoint(shape.anchor),
            variant: 'positive',
            label: `${anchorCoord}: framework stone helping sketch territory.`,
          },
          {
            id: `local-territory-framework-stone-${pointKey(shape.stone)}`,
            point: copyPoint(shape.stone),
            variant: 'positive',
            label: `${stoneCoord}: one-space jump stone extending the framework.`,
          },
          {
            id: `local-territory-gap-${pointKey(shape.gap)}`,
            point: copyPoint(shape.gap),
            variant: 'neutral',
            label: `${gapCoord}: open gap; useful shape, not settled territory.`,
          },
        ],
        suggestions,
      },
      conceptIds: uniqueConceptIds([...objective.conceptIds, 'territory', 'shape', 'direction-of-play']),
    };
  }

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

  if (isGameReviewQuestion(q)) {
    return getLocalGameReviewAnswer(game, teachingLevel);
  }

  if (isMoveImpactQuestion(q)) {
    return buildMoveImpactAnswer(game, teachingLevel);
  }

  if (isLearningTakeawayQuestion(q)) {
    return buildLearningTakeawayAnswer(game, teachingLevel);
  }

  if (isMoveReviewQuestion(q)) {
    return buildMoveReviewAnswer(game, teachingLevel);
  }

  if (isPassQuestion(q)) {
    return buildPassAnswer(game, teachingLevel, q);
  }

  if (isSecondObjectiveStrategyQuestion(q)) {
    const strategyAnswer = buildSecondObjectiveStrategyAnswer(game, teachingLevel, q);
    if (strategyAnswer) return strategyAnswer;
  }

  if (isOneSpaceJumpPressureQuestion(q)) {
    const pressureAnswer = buildOneSpaceJumpPressureAnswer(game, teachingLevel, q);
    if (pressureAnswer) return pressureAnswer;
  }

  if (isOneSpaceJumpConnectionQuestion(q, game.board.size)) {
    const connectionAnswer = buildOneSpaceJumpConnectionAnswer(game, teachingLevel, q);
    if (connectionAnswer) return connectionAnswer;
  }

  if (isFightFollowUpQuestion(q)) {
    const followUpAnswer = buildFightFollowUpAnswer(game, teachingLevel, q);
    if (followUpAnswer) return followUpAnswer;
  }

  if (isOpponentMoveQuestion(q)) {
    const opponentAnswer = buildOpponentMoveAnswer(game, teachingLevel);
    if (opponentAnswer) return opponentAnswer;
  }

  if (isWhiteReplyQuestion(q)) {
    return buildWhiteReplyAnswer(game, teachingLevel);
  }

  if (isCaptureRaceQuestion(q)) {
    return buildCaptureRaceAnswer(game, teachingLevel);
  }

  if (isAttackDefenseDecisionQuestion(q)) {
    return buildAttackDefenseDecisionAnswer(game, teachingLevel);
  }

  if (isThreatQuestion(q)) {
    return buildThreatAnswer(game, teachingLevel);
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

  if (isOneSpaceJumpGapQuestion(q)) {
    const gapAnswer = buildOneSpaceJumpGapAnswer(game, teachingLevel, q);
    if (gapAnswer) return gapAnswer;
  }

  if (isInvalidCoordinateQuestion(q, game.board.size)) {
    const invalidCoordinateAnswer = buildInvalidCoordinateAnswer(game, teachingLevel, q);
    if (invalidCoordinateAnswer) return invalidCoordinateAnswer;
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

  if (isStarPointQuestion(q)) {
    return buildStarPointAnswer(game, teachingLevel, q);
  }

  if (isBoardMarkerQuestion(q)) {
    const markerAnswer = buildBoardMarkerAnswer(game, teachingLevel);
    if (markerAnswer) return markerAnswer;
  }

  if (isCornerOpeningQuestion(q)) {
    return buildCornerOpeningAnswer(game, teachingLevel);
  }

  if (isInfluenceQuestion(q)) {
    return buildInfluenceAnswer(game, teachingLevel);
  }

  if (isReadingRoutineQuestion(q)) {
    return buildReadingRoutineAnswer(game, teachingLevel);
  }

  if (isWeakGroupQuestion(q)) {
    return buildWeakGroupAnswer(game, teachingLevel, q);
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

  if (isSnapbackQuestion(q)) {
    return buildSnapbackAnswer(game);
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
