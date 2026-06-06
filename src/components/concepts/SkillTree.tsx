'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CONCEPTS } from '@/lib/concepts/concept-data';
import {
  findLessonForConcept,
  findProblemCategoryForConcept,
  problemCategoryTitle,
} from '@/lib/learning-path/concept-practice';
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
  const detailRef = useRef<HTMLDivElement | null>(null);
  const getMastery = useConceptStore((s) => s.getMastery);
  const getNextToLearn = useConceptStore((s) => s.getNextToLearn);
  const getStats = useConceptStore((s) => s.getStats);
  const getUnlockedConcepts = useConceptStore((s) => s.getUnlockedConcepts);
  const returnToGame = useGameStore((s) => s.returnToGame);
  const showLearningPath = useGameStore((s) => s.showLearningPath);
  const showProblems = useGameStore((s) => s.showProblems);
  const startLesson = useGameStore((s) => s.startLesson);

  const stats = getStats();
  const unlocked = new Set(getUnlockedConcepts());
  const nextToLearnIds = getNextToLearn();
  const nextConcept = (
    nextToLearnIds
      .map((conceptId) => CONCEPTS.find((concept) => concept.id === conceptId))
      .find((concept): concept is Concept => Boolean(concept))
    ?? CONCEPTS.find((concept) => {
      const mastery = getMastery(concept.id);
      return unlocked.has(concept.id) && mastery.level > 0 && mastery.level < 3;
    })
    ?? null
  );
  const nextLesson = nextConcept ? findLessonForConcept(nextConcept.id) : null;
  const nextProblemCategory = nextConcept
    ? findProblemCategoryForConcept(nextConcept.id)
    : null;
  const nextMastery = nextConcept ? getMastery(nextConcept.id) : null;
  const selectedLesson = selectedConcept ? findLessonForConcept(selectedConcept.id) : null;
  const selectedProblemCategory = selectedConcept
    ? findProblemCategoryForConcept(selectedConcept.id)
    : null;
  const selectedMastery = selectedConcept ? getMastery(selectedConcept.id) : null;
  const selectedIsUnlocked = selectedConcept ? unlocked.has(selectedConcept.id) : false;
  const missingPrerequisites = selectedConcept
    ? selectedConcept.prerequisites
      .map((prereqId) => CONCEPTS.find((concept) => concept.id === prereqId))
      .filter((concept): concept is Concept => Boolean(concept))
      .filter((concept) => getMastery(concept.id).level < 1)
    : [];
  const firstActionablePrerequisite = missingPrerequisites.find((concept) => (
    Boolean(findLessonForConcept(concept.id)) || Boolean(findProblemCategoryForConcept(concept.id))
  )) ?? null;
  const prerequisiteLesson = firstActionablePrerequisite
    ? findLessonForConcept(firstActionablePrerequisite.id)
    : null;
  const prerequisiteProblemCategory = firstActionablePrerequisite
    ? findProblemCategoryForConcept(firstActionablePrerequisite.id)
    : null;
  const prerequisiteActionLabel = prerequisiteLesson
    ? `Start prerequisite lesson: ${prerequisiteLesson.title}`
    : prerequisiteProblemCategory
      ? `Practice prerequisite ${problemCategoryTitle(prerequisiteProblemCategory).toLowerCase()} problems`
      : null;

  const conceptsByCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    concepts: CONCEPTS.filter((c) => c.category === cat),
  }));

  function selectConcept(concept: Concept) {
    const nextConcept = selectedConcept?.id === concept.id ? null : concept;

    setSelectedConcept(nextConcept);

    if (nextConcept) {
      const scrollDetailIntoView = () => {
        detailRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      };

      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(scrollDetailIntoView);
      } else {
        scrollDetailIntoView();
      }
    }
  }

  function startConceptPractice(concept: Concept) {
    const lesson = findLessonForConcept(concept.id);

    if (lesson) {
      startLesson(lesson.id);
      return;
    }

    const problemCategory = findProblemCategoryForConcept(concept.id);

    if (problemCategory) {
      showProblems(problemCategory);
      return;
    }

    selectConcept(concept);
  }

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

        {nextConcept && (
          <div
            data-testid="skill-tree-up-next"
            className="mx-auto mb-6 max-w-2xl rounded-lg border p-3 text-left"
            style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase" style={{ color: COLORS.textDim }}>
                    Up next
                  </p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: COLORS.mastery[(nextMastery?.level ?? 0) as MasteryLevel] + '22',
                      color: COLORS.mastery[(nextMastery?.level ?? 0) as MasteryLevel],
                    }}
                  >
                    {MASTERY_LABELS[(nextMastery?.level ?? 0) as MasteryLevel]}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-bold" style={{ color: COLORS.accent }}>
                  {nextConcept.name}
                </h2>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.text }}>
                  {nextConcept.description}
                </p>
              </div>
              <button
                onClick={() => startConceptPractice(nextConcept)}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
              >
                {nextLesson
                  ? `Start lesson: ${nextLesson.title}`
                  : nextProblemCategory
                    ? `Practice ${problemCategoryTitle(nextProblemCategory).toLowerCase()}`
                    : 'Open concept'}
              </button>
            </div>
          </div>
        )}

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
                    onClick={() => selectConcept(concept)}
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
            ref={detailRef}
            data-testid="skill-tree-detail"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 scroll-mt-20 p-4 rounded-xl"
            style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold" style={{ color: COLORS.accent }}>
                {selectedConcept.name}
              </h3>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: selectedIsUnlocked
                    ? COLORS.mastery[(selectedMastery?.level ?? 0) as MasteryLevel] + '22'
                    : `${COLORS.locked}cc`,
                  color: selectedIsUnlocked
                    ? COLORS.mastery[(selectedMastery?.level ?? 0) as MasteryLevel]
                    : COLORS.textDim,
                }}
              >
                {selectedIsUnlocked
                  ? MASTERY_LABELS[(selectedMastery?.level ?? 0) as MasteryLevel]
                  : 'Locked for now'}
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
            {selectedIsUnlocked ? (
              <div className="mt-4 border-t pt-3" style={{ borderColor: COLORS.border }}>
                <p className="text-xs font-semibold uppercase" style={{ color: COLORS.textDim }}>
                  Practice this
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {selectedLesson && (
                    <button
                      onClick={() => startLesson(selectedLesson.id)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
                    >
                      Start lesson: {selectedLesson.title}
                    </button>
                  )}
                  {selectedProblemCategory && (
                    <button
                      onClick={() => showProblems(selectedProblemCategory)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{ backgroundColor: COLORS.cardHover, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                    >
                      Practice {problemCategoryTitle(selectedProblemCategory).toLowerCase()} problems
                    </button>
                  )}
                  <button
                    onClick={showLearningPath}
                    aria-label="Learning path from skill tree"
                    className="rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: COLORS.cardHover, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                  >
                    Learning path
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 border-t pt-3" style={{ borderColor: COLORS.border }}>
                <p className="text-xs font-semibold uppercase" style={{ color: COLORS.textDim }}>
                  Unlock first
                </p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.text }}>
                  Build the prerequisite ideas before practicing this concept directly.
                </p>
                {firstActionablePrerequisite && prerequisiteActionLabel && (
                  <button
                    onClick={() => startConceptPractice(firstActionablePrerequisite)}
                    className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
                  >
                    {prerequisiteActionLabel}
                  </button>
                )}
                {missingPrerequisites.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {missingPrerequisites.map((concept) => (
                      <button
                        key={concept.id}
                        onClick={() => selectConcept(concept)}
                        className="rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                        style={{ backgroundColor: COLORS.cardHover, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                      >
                        View {concept.name} requirement
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={showLearningPath}
                  className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: COLORS.cardHover, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                >
                  Follow learning path
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Return to board button */}
        <div className="text-center mt-8">
          <button
            onClick={returnToGame}
            aria-label="Return to board from skill tree"
            className="px-6 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          >
            Return to board
          </button>
        </div>
      </div>
    </div>
  );
}
