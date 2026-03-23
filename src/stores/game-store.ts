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
} from '@/lib/go-engine';
import type { Problem, ProblemAttempt } from '@/lib/problems/types';
import type { MoveNode } from '@/lib/problems/types';
import { validateMove, type ValidationResult } from '@/lib/problems/validator';

// ---------------------------------------------------------------------------
// Overlay types
// ---------------------------------------------------------------------------

interface OverlayHighlight {
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
  actions: { id: string; label: string }[];
  streamingComplete: boolean;
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
}

interface ProblemInteraction {
  active: boolean;
  problemId: string | null;
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
  chatMessages: { id: string; text: string; variant: string; timestamp: number }[];

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
  appPhase: 'game' | 'lessons' | 'lesson' | 'problems' | 'problem' | 'skills' | 'review' | 'dashboard';
  currentLessonId: string | null;
  currentStep: number;
  completedLessons: string[];

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
  addChatMessage: (text: string, variant: string) => void;

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
  problemInteraction: ProblemInteraction;
  problemAttempts: ProblemAttempt[];
  startProblem: (problem: Problem) => void;
  submitProblemMove: (point: Point) => ValidationResult;
  resetProblem: () => void;
  showProblems: () => void;
  requestProblemHint: () => void;
  showSkillTree: () => void;
  showReview: () => void;
  showDashboard: () => void;

  returnToGame: () => void;

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
  addLearnedConcept: (concept: string) => void;
  setPhase: (phase: GameStore['phase']) => void;
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
};

const defaultProblemInteraction: ProblemInteraction = {
  active: false,
  problemId: null,
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
  liberties: [] as OverlayLiberty[],
  suggestions: [] as OverlaySuggestion[],
  arrows: [] as OverlayArrow[],
  influence: [] as OverlayInfluence[],
  groups: [] as OverlayGroup[],
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
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

  lesson: { ...defaultLesson },

  lessonInteraction: { ...defaultLessonInteraction },

  currentProblemId: null,
  problemInteraction: { ...defaultProblemInteraction },
  problemAttempts: [],

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

  appPhase: 'game' as const,
  currentLessonId: null,
  currentStep: 0,
  completedLessons: [],

  // ---- Actions ----

  placeStone(point: Point) {
    const { game, phase } = get();
    if (phase !== 'playing') return { success: false, captured: [] };

    const result = playMove(game, point);

    if (result.success) {
      const captured = result.captured;
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
    set({
      game: passMove(game),
      lastInteractionTime: Date.now(),
      hesitationLevel: 'none',
    });
  },

  resign() {
    const { game, phase } = get();
    if (phase !== 'playing') return;
    set({ game: resignGame(game), phase: 'finished' });
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
      const lastMsg = s.chatMessages[s.chatMessages.length - 1];
      const isDuplicate = lastMsg && lastMsg.text === text;
      return {
        bubble: { ...s.bubble, streamingComplete: false, ...config, visible: true },
        ...(text && !isDuplicate ? {
          chatMessages: [...s.chatMessages, {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text,
            variant,
            timestamp: Date.now(),
          }],
        } : {}),
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
  addChatMessage(text: string, variant: string) {
    set((s) => ({
      chatMessages: [...s.chatMessages, {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        variant,
        timestamp: Date.now(),
      }],
    }));
  },

  // Overlays
  clearOverlays() {
    set({
      overlays: {
        highlights: [],
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

  completeLesson: () => set((state) => ({
    appPhase: 'lessons',
    completedLessons: state.currentLessonId && !state.completedLessons.includes(state.currentLessonId)
      ? [...state.completedLessons, state.currentLessonId]
      : state.completedLessons,
    currentLessonId: null,
    currentStep: 0,
  })),

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
      set({
        lessonInteraction: {
          ...lessonInteraction,
          feedback: 'wrong',
          attempts: lessonInteraction.attempts + 1,
        },
      });
      return 'wrong';
    }
  },

  clearLessonPrompt() {
    set({ lessonInteraction: { ...defaultLessonInteraction } });
  },

  showProblems: () => set({ appPhase: 'problems', currentProblemId: null }),

  showSkillTree: () => set({ appPhase: 'skills' }),

  showReview: () => set({ appPhase: 'review' }),

  showDashboard: () => set({ appPhase: 'dashboard' }),

  startProblem: (problem: Problem) => set({
    appPhase: 'problem',
    currentProblemId: problem.id,
    problemInteraction: {
      active: true,
      problemId: problem.id,
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

    const result = validateMove(pi.currentNodes, point);

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
        set((s) => ({
          problemAttempts: [
            ...s.problemAttempts,
            {
              problemId: pi.problemId!,
              solved: false,
              attempts: newAttempts,
              moveSequence: [...pi.playerMoves, point],
              timestamp: Date.now(),
            },
          ],
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
          playerMoves: newPlayerMoves,
          opponentMoves: newOpponentMoves,
          status: 'solved',
          feedback: result.message ?? 'Solved!',
        },
      });
      set((s) => ({
        problemAttempts: [
          ...s.problemAttempts,
          {
            problemId: pi.problemId!,
            solved: true,
            attempts: pi.attempts + 1,
            moveSequence: newPlayerMoves,
            timestamp: Date.now(),
          },
        ],
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
    set({
      problemInteraction: {
        ...defaultProblemInteraction,
        active: !!pid,
        problemId: pid,
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
    set({
      game: createGame(size),
      hoveredPoint: null,
      hoveredGroup: null,
      lastPlayerMove: null,
      lastAiMove: null,
      isAiThinking: false,
      overlays: { highlights: [], liberties: [], suggestions: [], arrows: [], influence: [], groups: [] },
      pendingCaptures: [],
      bubble: { ...defaultBubble },
      chatMessages: [],
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
      problemAttempts: [],
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
    }),
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
        chatMessages: state.chatMessages,
        phase: state.phase,
        learnedConcepts: state.learnedConcepts,
        teachingLevel: state.teachingLevel,
        completedLessons: state.completedLessons,
        appPhase: state.appPhase,
        problemAttempts: state.problemAttempts,
      }),
    },
  ),
);
