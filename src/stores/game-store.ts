import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  GameState,
  Point,
  StoneColor,
  BoardSize,
  Group,
} from '@/lib/go-engine/types';
import {
  createGame,
  playMove,
  passMove,
  resignGame,
  undoMove,
  getOpponent,
  getGroup,
  pointEquals,
  getStone,
  pointKey,
  pointToCoord,
} from '@/lib/go-engine';
import type { Problem, ProblemAttempt, ProblemCategory } from '@/lib/problems/types';
import type { MoveNode } from '@/lib/problems/types';
import { PROBLEMS } from '@/lib/problems/problem-data';
import { applyProblemMove, buildProblemGame } from '@/lib/problems/runtime';
import type { ValidationResult } from '@/lib/problems/validator';
import type { SenseiAction } from '@/lib/coaching/sensei-actions';
import {
  formatObjectiveTargetText,
  getBeginnerObjective,
  getBeginnerObjectiveProgress,
} from '@/lib/coaching/beginner-objectives';
import type { BeginnerObjective } from '@/lib/coaching/beginner-objectives';
import { getBeginnerObjectiveActions } from '@/lib/coaching/beginner-objective-actions';
import { useProgressStore } from './progress-store';

// ---------------------------------------------------------------------------
// Overlay types
// ---------------------------------------------------------------------------

export interface OverlayHighlight {
  id: string;
  point: Point;
  variant: 'positive' | 'warning' | 'danger' | 'neutral';
  label?: string;
}

interface OverlayLiberty {
  id: string;
  point: Point;
  count: number;
  libertyPoints: Point[];
}

interface OverlaySuggestion {
  id: string;
  point: Point;
  rank: number;
  reason: string;
}

interface OverlayArrow {
  id: string;
  from: Point;
  to: Point;
  label?: string;
  order: number;
}

interface OverlayInfluence {
  point: Point;
  value: number; // -1.0 (full black) to +1.0 (full white), 0 = neutral
}

interface OverlayGroup {
  id: string;
  stones: Point[];
  color: 'black' | 'white';
  liberties: number;
  label?: string;
}

// ---------------------------------------------------------------------------
// Sensei bubble
// ---------------------------------------------------------------------------

interface SenseiBubbleState {
  visible: boolean;
  text: string;
  anchorPoint: Point | null;
  variant: 'neutral' | 'celebrate' | 'warning' | 'teaching' | 'thinking';
  actions: SenseiAction[];
  streamingComplete: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  variant: string;
  timestamp: number;
  actions?: SenseiAction[];
}

export interface GuidedReadReplayRequest {
  id: number;
  type: 'read-pressure';
  mode: 'branch' | 'recount' | 'comparison';
  promptKey: string;
  replyKey: string;
  comparedReplyKey?: string;
}

const MAX_CHAT_MESSAGES = 80;
let guidedReadReplayRequestSequence = 0;

function chatMessageKey(message: ChatMessage): string {
  const actionKey = message.actions?.map((action) => `${action.id}:${action.label}`).join('|') ?? '';
  return `${message.variant}:${message.text.trim()}:${actionKey}`;
}

function isDedupableChatMessage(message: ChatMessage): boolean {
  return message.variant !== 'user' && message.text.trim().length > 0;
}

export function compactChatMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const compacted: ChatMessage[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (isDedupableChatMessage(message)) {
      const key = chatMessageKey(message);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
    }

    compacted.unshift(message);
    if (compacted.length >= MAX_CHAT_MESSAGES) {
      break;
    }
  }

  return compacted;
}

function appendChatMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (isDedupableChatMessage(message)) {
    const nextKey = chatMessageKey(message);
    const alreadyExists = messages.some(
      (existing) => isDedupableChatMessage(existing) && chatMessageKey(existing) === nextKey,
    );

    if (alreadyExists) {
      return compactChatMessages(messages);
    }
  }

  return compactChatMessages([...messages, message]);
}

// ---------------------------------------------------------------------------
// Lesson mode
// ---------------------------------------------------------------------------

interface LessonState {
  active: boolean;
  title: string;
  savedGameState: GameState | null;
  stones: { point: Point; color: StoneColor; order: number }[];
  arrows: { from: Point; to: Point; label?: string }[];
  step: number;
  totalSteps: number;
  interactiveChallenge: {
    prompt: string;
    correctPoint: Point;
    options: Point[];
  } | null;
}

interface LessonInteraction {
  awaitingClick: boolean;
  prompt: string | null;
  expectedMove: Point | null;
  wrongMoveHint: string | null;
  branchOnFail: number | null;
  acceptRadius: number;
  attempts: number;
  feedback: 'correct' | 'wrong' | null;
  answerRevealed: boolean;
}

interface ProblemInteraction {
  active: boolean;
  problemId: string | null;
  problem: Problem | null;
  game: GameState | null;
  currentNodes: MoveNode[];
  playerMoves: Point[];
  opponentMoves: Point[];
  status: 'playing' | 'solved' | 'failed';
  attempts: number;
  feedback: string | null;
  showHint: boolean;
}

// ---------------------------------------------------------------------------
// Capture animation
// ---------------------------------------------------------------------------

interface PendingCapture {
  point: Point;
  color: StoneColor;
  phase: 'flash' | 'dissolve' | 'done';
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface GameStore {
  // Core game state
  game: GameState;

  // Player interaction
  hoveredPoint: Point | null;
  hoveredGroup: Group | null;
  lastPlayerMove: Point | null;
  lastAiMove: Point | null;

  // AI state
  isAiThinking: boolean;

  // Overlay layers
  overlays: {
    highlights: OverlayHighlight[];
    targetHints: OverlayHighlight[];
    liberties: OverlayLiberty[];
    suggestions: OverlaySuggestion[];
    arrows: OverlayArrow[];
    influence: OverlayInfluence[];
    groups: OverlayGroup[];
  };

  // Capture animations
  pendingCaptures: PendingCapture[];

  // Sensei bubble
  bubble: SenseiBubbleState;

  // Chat messages (accumulated log)
  chatMessages: ChatMessage[];

  // Transient request from chat actions back to the board-side guided read UI
  guidedReadReplayRequest: GuidedReadReplayRequest | null;

  // Lesson mode
  lesson: LessonState;

  // Territory / scoring
  territory: {
    black: Point[];
    white: Point[];
    dame: Point[];
  } | null;
  scorecard: {
    visible: boolean;
    blackScore: number;
    whiteScore: number;
    blackTerritory: number;
    whiteTerritory: number;
    blackCaptures: number;
    whiteCaptures: number;
    komi: number;
    winner: StoneColor | 'draw' | null;
  } | null;

  // Dead stones (scoring phase)
  deadStones: Point[];
  toggleDeadStone: (point: Point) => void;

  // Ko
  koRejection: { point: Point; timestamp: number } | null;

  // Hesitation
  lastInteractionTime: number;
  hesitationLevel: 'none' | 'mild' | 'stuck';
  hintOffered: boolean;

  // Meta
  phase: 'welcome' | 'playing' | 'scoring' | 'finished' | 'lesson' | 'review';
  learnedConcepts: string[];
  teachingLevel: 'beginner' | 'intermediate' | 'advanced' | 'guided';

  // App-level navigation (lessons)
  appPhase: 'path' | 'game' | 'lessons' | 'lesson' | 'problems' | 'problem' | 'skills' | 'review' | 'dashboard';
  currentLessonId: string | null;
  currentStep: number;
  completedLessons: string[];
  hasStartedIntroGame: boolean;

  setTeachingLevel: (level: 'beginner' | 'intermediate' | 'advanced' | 'guided') => void;

  // === ACTIONS ===
  placeStone: (point: Point) => { success: boolean; captured: Point[] };
  setHover: (point: Point | null) => void;
  pass: () => void;
  resign: () => void;
  undo: () => void;

  // AI actions
  setAiThinking: (thinking: boolean) => void;
  applyHighlights: (highlights: OverlayHighlight[]) => void;
  applyTargetHints: (targetHints: OverlayHighlight[]) => void;
  applyLibertyOverlay: (overlay: OverlayLiberty) => void;
  applySuggestions: (suggestions: OverlaySuggestion[]) => void;
  applyArrows: (arrows: OverlayArrow[]) => void;
  applyInfluence: (influence: OverlayInfluence[]) => void;
  applyGroups: (groups: OverlayGroup[]) => void;
  applyAiMove: (point: Point) => { success: boolean; captured: Point[] };

  // Bubble
  showBubble: (config: Partial<SenseiBubbleState>) => void;
  updateBubbleText: (text: string) => void;
  dismissBubble: () => void;

  // Chat
  addChatMessage: (text: string, variant: string, actions?: SenseiAction[]) => void;
  requestGuidedReadReplay: (request: Omit<GuidedReadReplayRequest, 'id'>) => void;
  clearGuidedReadReplay: (id?: number) => void;

  // Overlays
  clearOverlays: () => void;

  // Captures
  addPendingCaptures: (captures: { point: Point; color: StoneColor }[]) => void;
  completeCaptureAnimation: (points: Point[]) => void;

  // Lesson
  startLesson: (lessonId: string) => void;

  // Lesson navigation
  showLessons: () => void;
  nextStep: (maxSteps: number) => void;
  prevStep: () => void;
  completeLesson: () => void;

  // Lesson interaction
  lessonInteraction: LessonInteraction;
  setLessonPrompt: (config: {
    prompt: string;
    expectedMove: Point;
    wrongMoveHint: string | null;
    branchOnFail: number | null;
    acceptRadius: number;
  }) => void;
  checkLessonAnswer: (point: Point) => 'correct' | 'wrong';
  clearLessonPrompt: () => void;

  // Problem (tsumego)
  currentProblemId: string | null;
  preferredProblemFilter: ProblemCategory | null;
  problemInteraction: ProblemInteraction;
  problemAttempts: ProblemAttempt[];
  startProblem: (problem: Problem) => void;
  submitProblemMove: (point: Point) => ValidationResult;
  resetProblem: () => void;
  showProblems: (filter?: ProblemCategory) => void;
  requestProblemHint: () => void;
  showSkillTree: () => void;
  showReview: () => void;
  showDashboard: () => void;
  showLearningPath: () => void;

  returnToGame: () => void;
  openGuidedGame: () => void;

  // Scoring
  enterScoring: (territory: {
    black: Point[];
    white: Point[];
    dame: Point[];
  }) => void;

  // Hesitation
  recordInteraction: () => void;
  setHesitationLevel: (level: 'none' | 'mild' | 'stuck') => void;
  setHintOffered: (offered: boolean) => void;

  // Meta
  startNewGame: (size?: BoardSize) => void;
  startGuidedIntroGame: () => void;
  addLearnedConcept: (concept: string) => void;
  setPhase: (phase: GameStore['phase']) => void;
}

export type AppPhase = GameStore['appPhase'];

export function getRestorableAppPhase(appPhase: AppPhase | undefined): AppPhase {
  switch (appPhase) {
    case 'lesson':
      return 'path';
    case 'problem':
      return 'problems';
    default:
      return appPhase ?? 'path';
  }
}

function isGuidedGameSnapshot(game: GameState | null | undefined): game is GameState {
  return game?.board.size === 9 && Array.isArray(game.moveHistory) && game.moveHistory.length > 0;
}

// ---------------------------------------------------------------------------
// Default slices
// ---------------------------------------------------------------------------

const defaultBubble: SenseiBubbleState = {
  visible: false,
  text: '',
  anchorPoint: null,
  variant: 'neutral',
  actions: [],
  streamingComplete: true,
};

function countLearnerPlacedMoves(game: GameState): number {
  return game.moveHistory.filter((move) => move.type === 'place' && move.color === 'black').length;
}

function formatRestoredMoveCount(learnerMoveCount: number): string {
  if (learnerMoveCount === 0) return 'before your first learner move';

  return `with ${learnerMoveCount} learner ${learnerMoveCount === 1 ? 'move' : 'moves'}`;
}

function getGuidedResumeObjective(game: GameState): BeginnerObjective | null {
  return getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: 'black',
    teachingLevel: 'guided',
  });
}

function shouldPassWhiteOnGuidedResume(game: GameState): boolean {
  const lastMove = game.moveHistory[game.moveHistory.length - 1];

  return game.phase === 'playing'
    && game.currentPlayer === 'white'
    && lastMove?.type === 'place'
    && lastMove.color === 'black';
}

function buildGuidedResumeBubble(
  game: GameState,
  passedForWhite: boolean,
  objective = getGuidedResumeObjective(game),
): SenseiBubbleState {
  const targetText = objective
    ? formatObjectiveTargetText(objective, game.board.size)
    : null;
  const learnerMoveText = `I restored your paused board ${formatRestoredMoveCount(countLearnerPlacedMoves(game))}.`;

  return {
    ...defaultBubble,
    visible: true,
    text: objective
      ? [
          'Welcome back to your guided 9x9.',
          passedForWhite ? 'White passed while I restored this board, so it is your turn again.' : '',
          learnerMoveText,
          `Your next job is: ${objective.title}.`,
          objective.instruction,
          targetText ?? '',
          objective.why,
        ].filter(Boolean).join(' ')
      : [
          'Welcome back to your guided 9x9.',
          passedForWhite ? 'White passed while I restored this board, so it is your turn again.' : '',
          learnerMoveText,
          'Keep looking for the biggest safe move.',
        ].filter(Boolean).join(' '),
    variant: 'teaching',
    actions: objective ? getBeginnerObjectiveActions(objective) : [],
    streamingComplete: true,
  };
}

const defaultLesson: LessonState = {
  active: false,
  title: '',
  savedGameState: null,
  stones: [],
  arrows: [],
  step: 0,
  totalSteps: 0,
  interactiveChallenge: null,
};

const defaultLessonInteraction: LessonInteraction = {
  awaitingClick: false,
  prompt: null,
  expectedMove: null,
  wrongMoveHint: null,
  branchOnFail: null,
  acceptRadius: 0,
  attempts: 0,
  feedback: null,
  answerRevealed: false,
};

const defaultProblemInteraction: ProblemInteraction = {
  active: false,
  problemId: null,
  problem: null,
  game: null,
  currentNodes: [],
  playerMoves: [],
  opponentMoves: [],
  status: 'playing',
  attempts: 0,
  feedback: null,
  showHint: false,
};

const defaultOverlays = {
  highlights: [] as OverlayHighlight[],
  targetHints: [] as OverlayHighlight[],
  liberties: [] as OverlayLiberty[],
  suggestions: [] as OverlaySuggestion[],
  arrows: [] as OverlayArrow[],
  influence: [] as OverlayInfluence[],
  groups: [] as OverlayGroup[],
};

function lastBlackPlacedMove(game: GameState): Extract<GameState['moveHistory'][number], { type: 'place' }> | null {
  for (let index = game.moveHistory.length - 1; index >= 0; index -= 1) {
    const move = game.moveHistory[index];
    if (move.type === 'place' && move.color === 'black') return move;
  }

  return null;
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

function buildObjectiveSuggestions(
  objective: BeginnerObjective,
  boardSize: BoardSize,
  idPrefix: string,
): OverlaySuggestion[] {
  return objective.targetPoints.slice(0, 4).map((point, index) => ({
    id: `${idPrefix}-${pointKey(point)}`,
    point: { ...point },
    rank: index + 1,
    reason: suggestionReason(objective, point, boardSize),
  }));
}

function buildGuidedResumeOverlays(
  game: GameState,
  objective = getGuidedResumeObjective(game),
): GameStore['overlays'] {
  const progress = getBeginnerObjectiveProgress(game, 'guided');
  const lastMove = lastBlackPlacedMove(game);
  const highlights: OverlayHighlight[] = lastMove
    ? [{
        id: `guided-resume-learned-${pointKey(lastMove.point)}`,
        point: { ...lastMove.point },
        variant: progress?.status === 'met' ? 'positive' : progress?.status === 'missed' ? 'warning' : 'neutral',
        label: `${pointToCoord(lastMove.point, game.board.size)}: move to learn from${progress?.status === 'met' ? ' - beginner job met' : progress?.status === 'missed' ? ' - beginner job missed' : ''}.`,
      }]
    : [];
  const suggestions = objective
    ? buildObjectiveSuggestions(objective, game.board.size, 'guided-resume-move')
    : [];

  return {
    highlights,
    targetHints: [],
    liberties: [],
    suggestions,
    arrows: [],
    influence: [],
    groups: [],
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      const progress = useProgressStore.getState();
      const saveGuidedSnapshot = (
        game: GameState,
        teachingLevel: GameStore['teachingLevel'] = get().teachingLevel,
      ) => {
        if (teachingLevel === 'guided' && game.board.size === 9) {
          useProgressStore.getState().saveGuidedGameSnapshot(game);
        }
      };

      return ({
  // ---- Initial state ----
  game: createGame(19),

  hoveredPoint: null,
  hoveredGroup: null,
  lastPlayerMove: null,
  lastAiMove: null,

  isAiThinking: false,

  overlays: { ...defaultOverlays },

  pendingCaptures: [],

  bubble: { ...defaultBubble },

  chatMessages: [],

  guidedReadReplayRequest: null,

  lesson: { ...defaultLesson },

  lessonInteraction: { ...defaultLessonInteraction },

  currentProblemId: null,
  preferredProblemFilter: null,
  problemInteraction: { ...defaultProblemInteraction },
  problemAttempts: progress.problemAttempts,

  territory: null,
  scorecard: null,

  deadStones: [],

  koRejection: null,

  lastInteractionTime: Date.now(),
  hesitationLevel: 'none',
  hintOffered: false,

  phase: 'welcome',
  learnedConcepts: [],
  teachingLevel: 'beginner' as const,

  appPhase: 'path' as const,
  currentLessonId: null,
  currentStep: 0,
  completedLessons: progress.completedLessons,
  hasStartedIntroGame: progress.hasStartedIntroGame,

  // ---- Actions ----

  placeStone(point: Point) {
    const { game, phase } = get();
    if (phase !== 'playing') return { success: false, captured: [] };

    const result = playMove(game, point);

    if (result.success) {
      const captured = result.captured;
      saveGuidedSnapshot(result.newState);
      set((s) => ({
        game: result.newState,
        lastPlayerMove: point,
        koRejection: null,
        hesitationLevel: 'none',
        hintOffered: false,
        lastInteractionTime: Date.now(),
        pendingCaptures:
          captured.length > 0
            ? [
                ...s.pendingCaptures,
                ...captured.map((p) => ({
                  point: p,
                  color: getOpponent(game.currentPlayer),
                  phase: 'flash' as const,
                })),
              ]
            : s.pendingCaptures,
      }));
      return { success: true, captured };
    }

    // Failed — check if ko rejection
    if (game.koPoint && pointEquals(point, game.koPoint)) {
      set({ koRejection: { point, timestamp: Date.now() } });
    }
    return { success: false, captured: [] };
  },

  applyAiMove(point: Point) {
    const { game } = get();
    const result = playMove(game, point);

    if (result.success) {
      const captured = result.captured;
      saveGuidedSnapshot(result.newState);
      set((s) => ({
        game: result.newState,
        lastAiMove: point,
        isAiThinking: false,
        pendingCaptures:
          captured.length > 0
            ? [
                ...s.pendingCaptures,
                ...captured.map((p) => ({
                  point: p,
                  color: getOpponent(game.currentPlayer),
                  phase: 'flash' as const,
                })),
              ]
            : s.pendingCaptures,
      }));
      return { success: true, captured };
    }

    set({ isAiThinking: false });
    return { success: false, captured: [] };
  },

  setHover(point: Point | null) {
    if (point === null) {
      set({ hoveredPoint: null, hoveredGroup: null });
      return;
    }
    const { game } = get();
    const stone = getStone(game.board, point);
    const group = stone !== null ? getGroup(game.board, point) : null;
    set({ hoveredPoint: point, hoveredGroup: group });
  },

  pass() {
    const { game, phase } = get();
    if (phase !== 'playing') return;
    const nextGame = passMove(game);
    saveGuidedSnapshot(nextGame);
    set({
      game: nextGame,
      lastInteractionTime: Date.now(),
      hesitationLevel: 'none',
    });
  },

  resign() {
    const { game, phase } = get();
    if (phase !== 'playing') return;
    const nextGame = resignGame(game);
    saveGuidedSnapshot(nextGame);
    set({ game: nextGame, phase: 'finished' });
  },

  undo() {
    const { game } = get();

    // If AI just moved (last move is white), undo both AI and player moves
    const lastMove = game.moveHistory[game.moveHistory.length - 1];
    let current = game;

    if (lastMove && lastMove.color === 'white') {
      // Undo AI move first
      const afterUndoAi = undoMove(current);
      if (!afterUndoAi) return;
      current = afterUndoAi;
      // Then undo player move
      const afterUndoPlayer = undoMove(current);
      if (afterUndoPlayer) {
        current = afterUndoPlayer;
      }
    } else {
      // Undo single move (player hasn't received AI response yet)
      const prev = undoMove(current);
      if (!prev) return;
      current = prev;
    }

    saveGuidedSnapshot(current);
    set({
      game: current,
      koRejection: null,
      pendingCaptures: [],
      lastPlayerMove: null,
      lastAiMove: null,
    });
  },

  // AI actions
  setAiThinking(thinking: boolean) {
    set({ isAiThinking: thinking });
  },

  applyHighlights(highlights: OverlayHighlight[]) {
    set((s) => ({ overlays: { ...s.overlays, highlights } }));
  },

  applyTargetHints(targetHints: OverlayHighlight[]) {
    set((s) => ({ overlays: { ...s.overlays, targetHints } }));
  },

  applyLibertyOverlay(overlay: OverlayLiberty) {
    set((s) => ({
      overlays: {
        ...s.overlays,
        liberties: [...s.overlays.liberties, overlay],
      },
    }));
  },

  applySuggestions(suggestions: OverlaySuggestion[]) {
    set((s) => ({ overlays: { ...s.overlays, suggestions } }));
  },

  applyArrows(arrows: OverlayArrow[]) {
    set((s) => ({ overlays: { ...s.overlays, arrows } }));
  },

  applyInfluence(influence: OverlayInfluence[]) {
    set((s) => ({ overlays: { ...s.overlays, influence } }));
  },

  applyGroups(groups: OverlayGroup[]) {
    set((s) => ({ overlays: { ...s.overlays, groups } }));
  },

  // Bubble
  showBubble(config: Partial<SenseiBubbleState>) {
    set((s) => {
      const text = config.text || '';
      const variant = config.variant || 'neutral';
      const nextMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        variant,
        timestamp: Date.now(),
        ...(config.actions?.length ? { actions: config.actions } : {}),
      };
      return {
        bubble: { ...s.bubble, streamingComplete: false, ...config, visible: true },
        ...(text ? { chatMessages: appendChatMessage(s.chatMessages, nextMessage) } : {}),
      };
    });
  },

  updateBubbleText(text: string) {
    set((s) => ({ bubble: { ...s.bubble, text } }));
  },

  dismissBubble() {
    set({ bubble: { ...defaultBubble } });
  },

  // Chat
  addChatMessage(text: string, variant: string, actions?: SenseiAction[]) {
    const nextMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      variant,
      timestamp: Date.now(),
      ...(actions?.length ? { actions } : {}),
    };

    set((s) => ({
      chatMessages: appendChatMessage(s.chatMessages, nextMessage),
    }));
  },

  requestGuidedReadReplay(request) {
    set({
      guidedReadReplayRequest: {
        ...request,
        id: guidedReadReplayRequestSequence += 1,
      },
    });
  },

  clearGuidedReadReplay(id?: number) {
    set((s) => {
      if (id !== undefined && s.guidedReadReplayRequest?.id !== id) return {};
      return { guidedReadReplayRequest: null };
    });
  },

  // Overlays
  clearOverlays() {
    set({
      overlays: {
        highlights: [],
        targetHints: [],
        liberties: [],
        suggestions: [],
        arrows: [],
        influence: [],
        groups: [],
      },
    });
  },

  // Captures
  addPendingCaptures(captures: { point: Point; color: StoneColor }[]) {
    set((s) => ({
      pendingCaptures: [
        ...s.pendingCaptures,
        ...captures.map((c) => ({ ...c, phase: 'flash' as const })),
      ],
    }));
  },

  completeCaptureAnimation(points: Point[]) {
    set((s) => ({
      pendingCaptures: s.pendingCaptures.filter(
        (pc) => !points.some((p) => pointEquals(p, pc.point)),
      ),
    }));
  },

  // Lesson
  startLesson: (lessonId: string) => set({ appPhase: 'lesson', currentLessonId: lessonId, currentStep: 0 }),

  // Lesson navigation
  showLessons: () => set({ appPhase: 'lessons', currentLessonId: null, currentStep: 0 }),

  nextStep: (maxSteps: number) => set((state) => ({ currentStep: Math.min(state.currentStep + 1, maxSteps - 1) })),

  prevStep: () => set((state) => ({ currentStep: Math.max(0, state.currentStep - 1) })),

  completeLesson: () => {
    const lessonId = get().currentLessonId;
    if (lessonId) {
      useProgressStore.getState().completeLesson(lessonId);
    }
    const nextProgress = useProgressStore.getState();

    set({
      appPhase: 'path',
      completedLessons: nextProgress.completedLessons,
      currentLessonId: null,
      currentStep: 0,
    });
  },

  setLessonPrompt(config) {
    set({
      lessonInteraction: {
        awaitingClick: true,
        prompt: config.prompt,
        expectedMove: config.expectedMove,
        wrongMoveHint: config.wrongMoveHint,
        branchOnFail: config.branchOnFail,
        acceptRadius: config.acceptRadius,
        attempts: 0,
        feedback: null,
        answerRevealed: false,
      },
    });
  },

  checkLessonAnswer(point: Point) {
    const { lessonInteraction } = get();
    if (!lessonInteraction.expectedMove) return 'wrong';

    const dx = Math.abs(point.x - lessonInteraction.expectedMove.x);
    const dy = Math.abs(point.y - lessonInteraction.expectedMove.y);
    const isCorrect = (dx + dy) <= lessonInteraction.acceptRadius;

    if (isCorrect) {
      set({
        lessonInteraction: { ...lessonInteraction, feedback: 'correct', awaitingClick: false },
      });
      return 'correct';
    } else {
      const attempts = lessonInteraction.attempts + 1;
      set({
        lessonInteraction: {
          ...lessonInteraction,
          feedback: 'wrong',
          attempts,
          answerRevealed: attempts >= 3,
        },
      });
      return 'wrong';
    }
  },

  clearLessonPrompt() {
    set({ lessonInteraction: { ...defaultLessonInteraction } });
  },

  showProblems: (filter) => set({
    appPhase: 'problems',
    currentProblemId: null,
    preferredProblemFilter: filter ?? null,
  }),

  showSkillTree: () => set({ appPhase: 'skills' }),

  showReview: () => set({ appPhase: 'review' }),

  showDashboard: () => set({ appPhase: 'dashboard' }),

  showLearningPath: () => set({ appPhase: 'path' }),

  startProblem: (problem: Problem) => set({
    appPhase: 'problem',
    currentProblemId: problem.id,
    problemInteraction: {
      active: true,
      problemId: problem.id,
      problem,
      game: buildProblemGame(problem),
      currentNodes: problem.solutionTree,
      playerMoves: [],
      opponentMoves: [],
      status: 'playing',
      attempts: 0,
      feedback: null,
      showHint: false,
    },
  }),

  submitProblemMove: (point: Point) => {
    const state = get();
    const pi = state.problemInteraction;
    if (!pi.active || pi.status !== 'playing') {
      return { status: 'wrong' as const, message: 'No active problem.' };
    }

    const problem = pi.problem ?? (pi.problemId
      ? PROBLEMS.find((candidate) => candidate.id === pi.problemId)
      : undefined);
    if (!problem || !pi.game) {
      return { status: 'wrong' as const, message: 'No active problem.' };
    }

    const result = applyProblemMove(problem, pi.game, pi.currentNodes, point);

    if (result.status === 'wrong') {
      const newAttempts = pi.attempts + 1;
      const failed = newAttempts >= 3;
      set({
        problemInteraction: {
          ...pi,
          attempts: newAttempts,
          feedback: result.message ?? 'Incorrect.',
          status: failed ? 'failed' : 'playing',
        },
      });
      if (failed) {
        const attempt = {
          problemId: pi.problemId!,
          solved: false,
          attempts: newAttempts,
          moveSequence: [...pi.playerMoves, point],
          timestamp: Date.now(),
        };
        useProgressStore.getState().recordProblemAttempt(attempt);
        set((s) => ({
          problemAttempts: [...s.problemAttempts, attempt],
        }));
      }
      return result;
    }

    if (result.status === 'solved') {
      const newPlayerMoves = [...pi.playerMoves, point];
      const newOpponentMoves = result.opponentResponse
        ? [...pi.opponentMoves, result.opponentResponse.move]
        : pi.opponentMoves;
      set({
        problemInteraction: {
          ...pi,
          game: result.game,
          playerMoves: newPlayerMoves,
          opponentMoves: newOpponentMoves,
          status: 'solved',
          feedback: result.message ?? 'Solved!',
        },
      });
      const attempt = {
        problemId: pi.problemId!,
        solved: true,
        attempts: pi.attempts + 1,
        moveSequence: newPlayerMoves,
        timestamp: Date.now(),
      };
      useProgressStore.getState().recordProblemAttempt(attempt);
      set((s) => ({
        problemAttempts: [...s.problemAttempts, attempt],
      }));
      return result;
    }

    // correct but continue
    const newPlayerMoves = [...pi.playerMoves, point];
    const newOpponentMoves = result.opponentResponse
      ? [...pi.opponentMoves, result.opponentResponse.move]
      : pi.opponentMoves;
    set({
      problemInteraction: {
        ...pi,
        game: result.game,
        playerMoves: newPlayerMoves,
        opponentMoves: newOpponentMoves,
        currentNodes: result.nextNodes ?? [],
        attempts: pi.attempts,
        feedback: result.message ?? 'Good move!',
      },
    });
    return result;
  },

  resetProblem: () => {
    const state = get();
    const pid = state.currentProblemId;
    const problem = state.problemInteraction.problem ?? (pid
      ? PROBLEMS.find((candidate) => candidate.id === pid)
      : undefined);
    set({
      problemInteraction: {
        ...defaultProblemInteraction,
        active: !!problem,
        problemId: pid,
        problem: problem ?? null,
        game: problem ? buildProblemGame(problem) : null,
        currentNodes: problem ? problem.solutionTree : [],
      },
    });
  },

  requestProblemHint: () => set((state) => ({
    problemInteraction: {
      ...state.problemInteraction,
      showHint: true,
    },
  })),

  returnToGame: () => set({ appPhase: 'game' }),

  openGuidedGame: () => {
    const state = get();
    if (state.teachingLevel === 'guided' && state.game.board.size === 9) {
      set({ appPhase: 'game' });
      return;
    }

    const snapshot = useProgressStore.getState().guidedGameSnapshot;
    if (isGuidedGameSnapshot(snapshot)) {
      if (!useProgressStore.getState().hasStartedIntroGame) {
        useProgressStore.getState().markIntroGameStarted();
      }
      const passedForWhite = shouldPassWhiteOnGuidedResume(snapshot);
      const restoredGame = passedForWhite ? passMove(snapshot) : snapshot;
      if (passedForWhite) {
        saveGuidedSnapshot(restoredGame, 'guided');
      }
      const resumeObjective = getGuidedResumeObjective(restoredGame);
      const nextProgress = useProgressStore.getState();
      set({
        game: restoredGame,
        appPhase: 'game',
        phase: restoredGame.phase,
        teachingLevel: 'guided',
        hoveredPoint: null,
        hoveredGroup: null,
        lastPlayerMove: null,
        lastAiMove: null,
        isAiThinking: false,
        overlays: buildGuidedResumeOverlays(restoredGame, resumeObjective),
        pendingCaptures: [],
        bubble: buildGuidedResumeBubble(restoredGame, passedForWhite, resumeObjective),
        chatMessages: [],
        guidedReadReplayRequest: null,
        lesson: { ...defaultLesson },
        lessonInteraction: { ...defaultLessonInteraction },
        scorecard: null,
        territory: null,
        deadStones: [],
        koRejection: null,
        lastInteractionTime: Date.now(),
        hesitationLevel: 'none',
        hintOffered: false,
        currentLessonId: null,
        currentStep: 0,
        currentProblemId: null,
        preferredProblemFilter: null,
        problemInteraction: { ...defaultProblemInteraction },
        completedLessons: nextProgress.completedLessons,
        hasStartedIntroGame: nextProgress.hasStartedIntroGame,
        problemAttempts: nextProgress.problemAttempts,
      });
      return;
    }

    get().startGuidedIntroGame();
  },

  // Scoring
  enterScoring(territory) {
    set({ phase: 'scoring', territory });
  },

  toggleDeadStone(point: Point) {
    set((s) => {
      const exists = s.deadStones.some(
        (ds) => ds.x === point.x && ds.y === point.y,
      );
      return {
        deadStones: exists
          ? s.deadStones.filter((ds) => !(ds.x === point.x && ds.y === point.y))
          : [...s.deadStones, point],
      };
    });
  },

  // Hesitation
  recordInteraction() {
    set({ lastInteractionTime: Date.now(), hesitationLevel: 'none' });
  },

  setHesitationLevel(level) {
    set({ hesitationLevel: level });
  },

  setHintOffered(offered) {
    set({ hintOffered: offered });
  },

  // Meta
  startNewGame(size: BoardSize = 19) {
    const nextProgress = useProgressStore.getState();
    set({
      game: createGame(size),
      hoveredPoint: null,
      hoveredGroup: null,
      lastPlayerMove: null,
      lastAiMove: null,
      isAiThinking: false,
      overlays: { highlights: [], targetHints: [], liberties: [], suggestions: [], arrows: [], influence: [], groups: [] },
      pendingCaptures: [],
      bubble: { ...defaultBubble },
      chatMessages: [],
      guidedReadReplayRequest: null,
      lesson: { ...defaultLesson },
      lessonInteraction: { ...defaultLessonInteraction },
      territory: null,
      scorecard: null,
      deadStones: [],
      koRejection: null,
      lastInteractionTime: Date.now(),
      hesitationLevel: 'none',
      hintOffered: false,
      phase: 'welcome',
      learnedConcepts: [],
      appPhase: 'game',
      currentLessonId: null,
      currentStep: 0,
      currentProblemId: null,
      problemInteraction: { ...defaultProblemInteraction },
      completedLessons: nextProgress.completedLessons,
      hasStartedIntroGame: nextProgress.hasStartedIntroGame,
      problemAttempts: nextProgress.problemAttempts,
    });
  },

  startGuidedIntroGame: () => {
    const guidedGame = createGame(9);
    useProgressStore.getState().markIntroGameStarted();
    saveGuidedSnapshot(guidedGame, 'guided');
    const nextProgress = useProgressStore.getState();
    const openingObjective = getBeginnerObjective({
      boardSize: guidedGame.board.size,
      board: guidedGame.board,
      moveHistory: guidedGame.moveHistory,
      moveCount: guidedGame.moveHistory.length,
      currentPlayer: guidedGame.currentPlayer,
      teachingLevel: 'guided',
    });
    const openingTargetText = openingObjective
      ? formatObjectiveTargetText(openingObjective, guidedGame.board.size)
      : null;

    set({
      game: guidedGame,
      appPhase: 'game',
      phase: 'playing',
      teachingLevel: 'guided',
      hoveredPoint: null,
      hoveredGroup: null,
      lastPlayerMove: null,
      lastAiMove: null,
      isAiThinking: false,
      overlays: { ...defaultOverlays },
      pendingCaptures: [],
      chatMessages: [],
      guidedReadReplayRequest: null,
      lesson: { ...defaultLesson },
      lessonInteraction: { ...defaultLessonInteraction },
      scorecard: null,
      territory: null,
      deadStones: [],
      koRejection: null,
      lastInteractionTime: Date.now(),
      hesitationLevel: 'none',
      hintOffered: false,
      currentLessonId: null,
      currentStep: 0,
      currentProblemId: null,
      preferredProblemFilter: null,
      problemInteraction: { ...defaultProblemInteraction },
      completedLessons: nextProgress.completedLessons,
      problemAttempts: nextProgress.problemAttempts,
      bubble: {
        ...defaultBubble,
        visible: true,
        text: openingObjective
          ? [
              'This is a 9x9 board.',
              `Your first job is: ${openingObjective.title}.`,
              openingObjective.instruction,
              openingTargetText ?? '',
              openingObjective.why,
              'Click a marked coordinate when you are ready.',
            ].filter(Boolean).join(' ')
          : 'This is a 9x9 board. Your first goal is simple: play near a corner and learn why corners are easier to surround.',
        variant: 'teaching',
        actions: openingObjective ? getBeginnerObjectiveActions(openingObjective) : [],
        streamingComplete: true,
      },
      hasStartedIntroGame: true,
    });
  },

  addLearnedConcept(concept: string) {
    set((s) => ({
      learnedConcepts: s.learnedConcepts.includes(concept)
        ? s.learnedConcepts
        : [...s.learnedConcepts, concept],
    }));
  },

  setTeachingLevel(level: 'beginner' | 'intermediate' | 'advanced' | 'guided') {
    set({ teachingLevel: level });
  },

  setPhase(phase) {
    set({ phase });
  },
    });
  },
    {
      name: 'go-sensei-game',
      storage: createJSONStorage(() => sessionStorage, {
        replacer: (_key: string, value: unknown) => {
          if (value instanceof Set) {
            return { __type: 'Set', values: [...value] };
          }
          return value;
        },
        reviver: (_key: string, value: unknown) => {
          if (value && typeof value === 'object' && (value as Record<string, unknown>).__type === 'Set') {
            return new Set((value as Record<string, unknown[]>).values);
          }
          return value;
        },
      }),
      partialize: (state) => ({
        game: state.game,
        chatMessages: compactChatMessages(state.chatMessages),
        phase: state.phase,
        learnedConcepts: state.learnedConcepts,
        teachingLevel: state.teachingLevel,
        appPhase: getRestorableAppPhase(state.appPhase),
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<GameStore>;
        return {
          ...current,
          ...persistedState,
          chatMessages: Array.isArray(persistedState.chatMessages)
            ? compactChatMessages(persistedState.chatMessages)
            : current.chatMessages,
          appPhase: getRestorableAppPhase(persistedState.appPhase),
        };
      },
    },
  ),
);
