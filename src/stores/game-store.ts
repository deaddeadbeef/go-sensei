import { create } from 'zustand';
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

  // Ko
  koRejection: { point: Point; timestamp: number } | null;

  // Hesitation
  lastInteractionTime: number;
  hesitationLevel: 'none' | 'mild' | 'stuck';
  hintOffered: boolean;

  // Meta
  phase: 'welcome' | 'playing' | 'scoring' | 'finished' | 'lesson' | 'review';
  learnedConcepts: string[];

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
  startLesson: (config: {
    title: string;
    stones: LessonState['stones'];
    arrows: LessonState['arrows'];
    totalSteps: number;
  }) => void;
  advanceLessonStep: () => void;
  endLesson: () => void;

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

const defaultOverlays = {
  highlights: [] as OverlayHighlight[],
  liberties: [] as OverlayLiberty[],
  suggestions: [] as OverlaySuggestion[],
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameStore = create<GameStore>((set, get) => ({
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

  territory: null,
  scorecard: null,

  koRejection: null,

  lastInteractionTime: Date.now(),
  hesitationLevel: 'none',
  hintOffered: false,

  phase: 'welcome',
  learnedConcepts: [],

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
    const prev = undoMove(game);
    if (prev) {
      set({ game: prev, koRejection: null, pendingCaptures: [] });
    }
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
  startLesson(config) {
    const { game } = get();
    set({
      phase: 'lesson',
      lesson: {
        active: true,
        title: config.title,
        savedGameState: game,
        stones: config.stones,
        arrows: config.arrows,
        step: 0,
        totalSteps: config.totalSteps,
        interactiveChallenge: null,
      },
    });
  },

  advanceLessonStep() {
    set((s) => ({
      lesson: {
        ...s.lesson,
        step: Math.min(s.lesson.step + 1, s.lesson.totalSteps - 1),
      },
    }));
  },

  endLesson() {
    const { lesson } = get();
    set({
      game: lesson.savedGameState ?? createGame(19),
      phase: 'playing',
      lesson: { ...defaultLesson },
    });
  },

  // Scoring
  enterScoring(territory) {
    set({ phase: 'scoring', territory });
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
      overlays: { highlights: [], liberties: [], suggestions: [] },
      pendingCaptures: [],
      bubble: { ...defaultBubble },
      chatMessages: [],
      lesson: { ...defaultLesson },
      territory: null,
      scorecard: null,
      koRejection: null,
      lastInteractionTime: Date.now(),
      hesitationLevel: 'none',
      hintOffered: false,
      phase: 'welcome',
      learnedConcepts: [],
    });
  },

  addLearnedConcept(concept: string) {
    set((s) => ({
      learnedConcepts: s.learnedConcepts.includes(concept)
        ? s.learnedConcepts
        : [...s.learnedConcepts, concept],
    }));
  },

  setPhase(phase) {
    set({ phase });
  },
}));
