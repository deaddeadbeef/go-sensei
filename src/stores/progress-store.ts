import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GameState } from '@/lib/go-engine/types';
import type { ProblemAttempt } from '@/lib/problems/types';

interface ProgressStore {
  completedLessons: string[];
  hasStartedIntroGame: boolean;
  guidedGameSnapshot: GameState | null;
  problemAttempts: ProblemAttempt[];
  completeLesson: (lessonId: string) => void;
  markIntroGameStarted: () => void;
  saveGuidedGameSnapshot: (game: GameState) => void;
  recordProblemAttempt: (attempt: ProblemAttempt) => void;
  resetAll: () => void;
}

const defaultProgress = {
  completedLessons: [] as string[],
  hasStartedIntroGame: false,
  guidedGameSnapshot: null as GameState | null,
  problemAttempts: [] as ProblemAttempt[],
};

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set) => ({
      ...defaultProgress,

      completeLesson: (lessonId: string) => set((state) => ({
        completedLessons: state.completedLessons.includes(lessonId)
          ? state.completedLessons
          : [...state.completedLessons, lessonId],
      })),

      markIntroGameStarted: () => set({ hasStartedIntroGame: true }),

      saveGuidedGameSnapshot: (game: GameState) => set({
        guidedGameSnapshot: game,
      }),

      recordProblemAttempt: (attempt: ProblemAttempt) => set((state) => ({
        problemAttempts: [...state.problemAttempts, attempt],
      })),

      resetAll: () => set({ ...defaultProgress }),
    }),
    {
      name: 'go-sensei-progress',
      storage: createJSONStorage(() => localStorage, {
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
    },
  ),
);
