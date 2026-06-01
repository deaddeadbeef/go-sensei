import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ProblemAttempt } from '@/lib/problems/types';

interface ProgressStore {
  completedLessons: string[];
  hasStartedIntroGame: boolean;
  problemAttempts: ProblemAttempt[];
  completeLesson: (lessonId: string) => void;
  markIntroGameStarted: () => void;
  recordProblemAttempt: (attempt: ProblemAttempt) => void;
  resetAll: () => void;
}

const defaultProgress = {
  completedLessons: [] as string[],
  hasStartedIntroGame: false,
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

      recordProblemAttempt: (attempt: ProblemAttempt) => set((state) => ({
        problemAttempts: [...state.problemAttempts, attempt],
      })),

      resetAll: () => set({ ...defaultProgress }),
    }),
    {
      name: 'go-sensei-progress',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
