import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ConceptMastery, MasteryLevel } from '@/lib/concepts/types';
import { CONCEPTS } from '@/lib/concepts/concept-data';

export type ConceptEvidence =
  | 'lesson_completed'
  | 'problem_solved'
  | 'problem_failed'
  | 'review_solved'
  | 'review_failed'
  | 'guided_insight'
  | 'ai_tag_success'
  | 'ai_tag_mistake';

type EvidenceAwareConceptMastery = ConceptMastery & {
  evidenceScore?: number;
};

const EVIDENCE_WEIGHTS: Record<ConceptEvidence, number> = {
  lesson_completed: 3,
  problem_solved: 3,
  problem_failed: 0,
  review_solved: 3,
  review_failed: 0,
  guided_insight: 1,
  ai_tag_success: 1,
  ai_tag_mistake: 0,
};

interface ConceptStore {
  mastery: Record<string, EvidenceAwareConceptMastery>;

  // Get mastery for a specific concept
  getMastery: (conceptId: string) => EvidenceAwareConceptMastery;

  // Record evidence that a concept was practiced or observed
  recordEvidence: (conceptId: string, evidence: ConceptEvidence) => void;

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

const levelForEvidenceScore = (score: number, hasEvidence: boolean): MasteryLevel => {
  if (score >= 7) return 3;
  if (score >= 3) return 2;
  if (hasEvidence) return 1;
  return 0;
};

export const useConceptStore = create<ConceptStore>()(
  persist(
    (set, get) => ({
      mastery: {},

      getMastery: (conceptId: string) => {
        return get().mastery[conceptId] ?? defaultMastery(conceptId);
      },

      recordEvidence: (conceptId: string, evidence: ConceptEvidence) => {
        set((state) => {
          const existing = state.mastery[conceptId] ?? defaultMastery(conceptId);
          const newCount = existing.encounterCount + 1;
          const currentScore = existing.evidenceScore ?? existing.encounterCount;
          const newScore = currentScore + EVIDENCE_WEIGHTS[evidence];
          const evidenceLevel = levelForEvidenceScore(newScore, newCount > 0);
          const newLevel = Math.max(existing.level, evidenceLevel) as MasteryLevel;

          return {
            mastery: {
              ...state.mastery,
              [conceptId]: {
                conceptId,
                level: newLevel as MasteryLevel,
                lastSeen: Date.now(),
                encounterCount: newCount,
                evidenceScore: newScore,
              },
            },
          };
        });
      },

      recordEncounter: (conceptId: string) => {
        get().recordEvidence(conceptId, 'ai_tag_success');
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
          if ((state.mastery[concept.id]?.level ?? 0) >= 1) return true;
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
        for (const concept of CONCEPTS) {
          const m = state.mastery[concept.id];
          if (!m) continue;
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
