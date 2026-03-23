'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CONCEPTS } from '@/lib/concepts/concept-data';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import type { Concept, ConceptCategory, MasteryLevel } from '@/lib/concepts/types';

const COLORS = {
  bg: '#0a0a0f',
  card: '#1a1a2e',
  cardHover: '#252540',
  accent: '#e2b55a',
  text: '#e0e0e0',
  textDim: '#888',
  mastery: {
    0: '#444',      // unseen
    1: '#4a9eff',   // introduced
    2: '#e2b55a',   // practicing
    3: '#4ade80',   // mastered
  } as Record<MasteryLevel, string>,
  locked: '#2a2a35',
  border: '#333',
};

const CATEGORY_ORDER: ConceptCategory[] = ['fundamentals', 'tactics', 'strategy', 'opening', 'endgame'];
const CATEGORY_LABELS: Record<ConceptCategory, string> = {
  fundamentals: '🏗️ Fundamentals',
  tactics: '⚔️ Tactics',
  strategy: '🧠 Strategy',
  opening: '🎯 Opening',
  endgame: '🏁 Endgame',
};

const MASTERY_LABELS: Record<MasteryLevel, string> = {
  0: 'Not yet seen',
  1: 'Introduced',
  2: 'Practicing',
  3: 'Mastered ✓',
};

export function SkillTree() {
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const getMastery = useConceptStore((s) => s.getMastery);
  const getStats = useConceptStore((s) => s.getStats);
  const getUnlockedConcepts = useConceptStore((s) => s.getUnlockedConcepts);
  const returnToGame = useGameStore((s) => s.returnToGame);

  const stats = getStats();
  const unlocked = new Set(getUnlockedConcepts());

  const conceptsByCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    concepts: CONCEPTS.filter((c) => c.category === cat),
  }));

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: COLORS.bg }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2" style={{ color: COLORS.accent }}>
            🌳 Skill Tree
          </h1>
          <p className="text-sm mb-3" style={{ color: COLORS.textDim }}>
            Your Go knowledge journey — {stats.total} concepts to master
          </p>
          {/* Stats bar */}
          <div className="flex justify-center gap-4 text-xs mb-4">
            <span style={{ color: COLORS.mastery[3] }}>● {stats.mastered} mastered</span>
            <span style={{ color: COLORS.mastery[2] }}>● {stats.practiced} practicing</span>
            <span style={{ color: COLORS.mastery[1] }}>● {stats.introduced} introduced</span>
            <span style={{ color: COLORS.mastery[0] }}>● {stats.total - stats.mastered - stats.practiced - stats.introduced} unseen</span>
          </div>
          {/* Progress bar */}
          <div className="w-full max-w-md mx-auto h-2 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.card }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((stats.mastered + stats.practiced * 0.6 + stats.introduced * 0.2) / stats.total) * 100}%`,
                background: `linear-gradient(90deg, ${COLORS.mastery[3]}, ${COLORS.mastery[2]})`,
              }}
            />
          </div>
        </div>

        {/* Category rows */}
        {conceptsByCategory.map(({ category, concepts }, catIdx) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIdx * 0.1 }}
            className="mb-6"
          >
            <h2 className="text-sm font-semibold mb-2" style={{ color: COLORS.textDim }}>
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="flex flex-wrap gap-2">
              {concepts.map((concept, idx) => {
                const mastery = getMastery(concept.id);
                const isUnlocked = unlocked.has(concept.id);
                const level = mastery.level as MasteryLevel;
                const isSelected = selectedConcept?.id === concept.id;

                return (
                  <motion.button
                    key={concept.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: catIdx * 0.1 + idx * 0.03 }}
                    onClick={() => setSelectedConcept(isSelected ? null : concept)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: isSelected ? COLORS.cardHover : (isUnlocked ? COLORS.card : COLORS.locked),
                      color: isUnlocked ? COLORS.text : COLORS.textDim,
                      border: `2px solid ${isSelected ? COLORS.mastery[level] : (level > 0 ? COLORS.mastery[level] + '66' : 'transparent')}`,
                      opacity: isUnlocked ? 1 : 0.5,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: COLORS.mastery[level] }}
                    />
                    {concept.name}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* Detail panel */}
        {selectedConcept && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl"
            style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold" style={{ color: COLORS.accent }}>
                {selectedConcept.name}
              </h3>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: COLORS.mastery[getMastery(selectedConcept.id).level as MasteryLevel] + '22',
                  color: COLORS.mastery[getMastery(selectedConcept.id).level as MasteryLevel],
                }}
              >
                {MASTERY_LABELS[getMastery(selectedConcept.id).level as MasteryLevel]}
              </span>
            </div>
            <p className="text-sm mb-3" style={{ color: COLORS.text }}>
              {selectedConcept.description}
            </p>
            {selectedConcept.prerequisites.length > 0 && (
              <p className="text-xs" style={{ color: COLORS.textDim }}>
                Requires: {selectedConcept.prerequisites.map((pid) => {
                  const pc = CONCEPTS.find((c) => c.id === pid);
                  return pc?.name ?? pid;
                }).join(', ')}
              </p>
            )}
            {getMastery(selectedConcept.id).encounterCount > 0 && (
              <p className="text-xs mt-1" style={{ color: COLORS.textDim }}>
                Encountered {getMastery(selectedConcept.id).encounterCount} times
              </p>
            )}
          </motion.div>
        )}

        {/* Back button */}
        <div className="text-center mt-8">
          <button
            onClick={returnToGame}
            className="px-6 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          >
            ← Back to Game
          </button>
        </div>
      </div>
    </div>
  );
}
