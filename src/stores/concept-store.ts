import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ConceptMastery, MasteryLevel } from '@/lib/concepts/types';
import { CONCEPTS } from '@/lib/concepts/concept-data';

interface ConceptStore {
  mastery: Record<string, ConceptMastery>;

  // Get mastery for a specific concept
  getMastery: (conceptId: string) => ConceptMastery;

  // Record that a concept was encountered (increment count, maybe raise level)
  recordEncounter: (conceptId: string) => void;

  // Explicitly set mastery level
  setMasteryLevel: (conceptId: string, level: MasteryLevel) => void;

  // Get all concepts that are unlocked (prerequisites met at level >= 1)
  getUnlockedConcepts: () => string[];

  // Get next concepts to learn (unlocked but level 0)
  getNextToLearn: () => string[];

  // Get mastery summary stats
  getStats: () => { total: number; introduced: number; practiced: number; mastered: number };

  // Reset all mastery
  resetAll: () => void;
}

const defaultMastery = (conceptId: string): ConceptMastery => ({
  conceptId,
  level: 0,
  lastSeen: 0,
  encounterCount: 0,
});

export const useConceptStore = create<ConceptStore>()(
  persist(
    (set, get) => ({
      mastery: {},

      getMastery: (conceptId: string) => {
        return get().mastery[conceptId] ?? defaultMastery(conceptId);
      },

      recordEncounter: (conceptId: string) => {
        set((state) => {
          const existing = state.mastery[conceptId] ?? defaultMastery(conceptId);
          const newCount = existing.encounterCount + 1;
          // Auto-promote: 1 encounter → introduced(1), 3 → practiced(2), 7 → mastered(3)
          let newLevel = existing.level;
          if (newLevel < 1 && newCount >= 1) newLevel = 1;
          if (newLevel < 2 && newCount >= 3) newLevel = 2;
          if (newLevel < 3 && newCount >= 7) newLevel = 3;

          return {
            mastery: {
              ...state.mastery,
              [conceptId]: {
                conceptId,
                level: newLevel as MasteryLevel,
                lastSeen: Date.now(),
                encounterCount: newCount,
              },
            },
          };
        });
      },

      setMasteryLevel: (conceptId: string, level: MasteryLevel) => {
        set((state) => {
          const existing = state.mastery[conceptId] ?? defaultMastery(conceptId);
          return {
            mastery: {
              ...state.mastery,
              [conceptId]: {
                ...existing,
                level,
                lastSeen: Date.now(),
              },
            },
          };
        });
      },

      getUnlockedConcepts: () => {
        const state = get();
        return CONCEPTS.filter((concept) => {
          if (concept.prerequisites.length === 0) return true;
          return concept.prerequisites.every((prereqId) => {
            const m = state.mastery[prereqId];
            return m && m.level >= 1;
          });
        }).map((c) => c.id);
      },

      getNextToLearn: () => {
        const state = get();
        const unlocked = get().getUnlockedConcepts();
        return unlocked.filter((id) => {
          const m = state.mastery[id];
          return !m || m.level === 0;
        });
      },

      getStats: () => {
        const state = get();
        let introduced = 0;
        let practiced = 0;
        let mastered = 0;
        for (const m of Object.values(state.mastery)) {
          if (m.level >= 3) mastered++;
          else if (m.level >= 2) practiced++;
          else if (m.level >= 1) introduced++;
        }
        return { total: CONCEPTS.length, introduced, practiced, mastered };
      },

      resetAll: () => set({ mastery: {} }),
    }),
    {
      name: 'go-sensei-concepts',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
