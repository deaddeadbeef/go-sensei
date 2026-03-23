import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SM2Card, Quality } from '@/lib/review/sm2';
import { createCard, reviewCard, isDue, attemptToQuality } from '@/lib/review/sm2';
import { PROBLEMS } from '@/lib/problems/problem-data';

interface ReviewRecord {
  problemId: string;
  quality: Quality;
  timestamp: number;
}

interface ReviewStore {
  cards: Record<string, SM2Card>;
  history: ReviewRecord[];

  // Get or create the SM2 card for a problem
  getCard: (problemId: string) => SM2Card;

  // Record a review result
  recordReview: (problemId: string, quality: Quality) => void;

  // Record from a problem attempt (convenience wrapper)
  recordAttempt: (problemId: string, solved: boolean, attempts: number, usedHint: boolean) => void;

  // Get all problems due for review today
  getDueProblems: () => string[];

  // Get count of due problems
  getDueCount: () => number;

  // Get review stats
  getReviewStats: () => {
    totalReviewed: number;
    dueToday: number;
    streak: number; // consecutive days with at least one review
  };

  // Reset all review data
  resetAll: () => void;
}

function calculateStreak(history: ReviewRecord[]): number {
  if (history.length === 0) return 0;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const today = Math.floor(Date.now() / DAY_MS);

  // Get unique review days (sorted descending)
  const days = [...new Set(history.map((r) => Math.floor(r.timestamp / DAY_MS)))].sort((a, b) => b - a);

  if (days.length === 0) return 0;

  // If most recent review isn't today or yesterday, streak is 0
  if (days[0] < today - 1) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export const useReviewStore = create<ReviewStore>()(
  persist(
    (set, get) => ({
      cards: {},
      history: [],

      getCard: (problemId: string) => {
        return get().cards[problemId] ?? createCard();
      },

      recordReview: (problemId: string, quality: Quality) => {
        set((state) => {
          const existing = state.cards[problemId] ?? createCard();
          const updated = reviewCard(existing, quality);
          return {
            cards: { ...state.cards, [problemId]: updated },
            history: [
              ...state.history,
              { problemId, quality, timestamp: Date.now() },
            ],
          };
        });
      },

      recordAttempt: (problemId: string, solved: boolean, attempts: number, usedHint: boolean) => {
        const quality = attemptToQuality(solved, attempts, usedHint);
        get().recordReview(problemId, quality);
      },

      getDueProblems: () => {
        const state = get();
        const now = Date.now();
        return PROBLEMS
          .map((p) => p.id)
          .filter((id) => {
            const card = state.cards[id];
            if (!card) return false; // never reviewed — not in queue yet
            return isDue(card, now);
          });
      },

      getDueCount: () => {
        return get().getDueProblems().length;
      },

      getReviewStats: () => {
        const state = get();
        return {
          totalReviewed: new Set(state.history.map((r) => r.problemId)).size,
          dueToday: get().getDueCount(),
          streak: calculateStreak(state.history),
        };
      },

      resetAll: () => set({ cards: {}, history: [] }),
    }),
    {
      name: 'go-sensei-reviews',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
