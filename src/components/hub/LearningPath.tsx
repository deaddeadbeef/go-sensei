'use client';

import { getLearningRecommendation } from '@/lib/learning-path/recommendations';
import { CONCEPTS } from '@/lib/concepts/concept-data';
import type { Concept, ConceptCategory } from '@/lib/concepts/types';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';
import { COLORS } from '@/utils/colors';

const CONCEPT_BY_ID = new Map(CONCEPTS.map((concept) => [concept.id, concept]));

const CATEGORY_LABELS: Record<ConceptCategory, string> = {
  fundamentals: 'Fundamental',
  tactics: 'Tactic',
  strategy: 'Strategy',
  endgame: 'Endgame',
  opening: 'Opening',
};

function conceptDisplay(conceptId: string): Concept {
  return CONCEPT_BY_ID.get(conceptId) ?? {
    id: conceptId,
    name: conceptId
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    category: 'strategy',
    description: 'A board idea to notice during this recommendation.',
    prerequisites: [],
  };
}

export function LearningPath() {
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const problemAttempts = useProgressStore((s) => s.problemAttempts);
  const hasStartedIntroGame = useProgressStore((s) => s.hasStartedIntroGame);
  const startGuidedIntroGame = useGameStore((s) => s.startGuidedIntroGame);
  const startLesson = useGameStore((s) => s.startLesson);
  const showLessons = useGameStore((s) => s.showLessons);
  const showProblems = useGameStore((s) => s.showProblems);
  const showReview = useGameStore((s) => s.showReview);
  const showSkillTree = useGameStore((s) => s.showSkillTree);
  const showDashboard = useGameStore((s) => s.showDashboard);
  const openGuidedGame = useGameStore((s) => s.openGuidedGame);
  const mastery = useConceptStore((s) => s.mastery);
  const dueReviewCount = useReviewStore((s) => {
    void s.cards;
    return s.getDueCount();
  });

  const recommendation = getLearningRecommendation({
    completedLessons,
    problemAttempts,
    dueReviewCount,
    hasStartedIntroGame,
    mastery: Object.values(mastery),
  });

  const solvedProblems = new Set(
    problemAttempts.filter((attempt) => attempt.solved).map((attempt) => attempt.problemId),
  ).size;
  const focusConcepts = recommendation.focusConcepts.map(conceptDisplay).slice(0, 4);

  const startRecommended = () => {
    switch (recommendation.kind) {
      case 'guided_intro':
        startGuidedIntroGame();
        break;
      case 'lesson':
        startLesson(recommendation.targetId);
        break;
      case 'problem':
        showProblems(recommendation.filter);
        break;
      case 'review':
        showReview();
        break;
      case 'guided_game':
        openGuidedGame();
        break;
    }
  };
  const openGuidedGameCard = hasStartedIntroGame ? openGuidedGame : startGuidedIntroGame;
  const openProblems = () => showProblems();

  return (
    <main className="flex-1 overflow-y-auto" style={{ backgroundColor: COLORS.ui.bgPrimary }}>
      <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-5 px-4 py-5">
        <section className="grid gap-4 lg:grid-cols-[1.45fr_0.85fr]">
          <div
            className="rounded-lg border p-5"
            style={{ backgroundColor: COLORS.ui.bgCard, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <p className="text-xs font-semibold uppercase" style={{ color: COLORS.ui.textSecondary }}>
              Recommended next
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-tight" style={{ color: COLORS.ui.textPrimary }}>
              {recommendation.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
              {recommendation.reason}
            </p>
            {recommendation.focusConcepts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {focusConcepts.map((concept) => (
                  <span
                    key={concept.id}
                    className="rounded-full px-2.5 py-1 text-xs"
                    style={{ backgroundColor: `${COLORS.ui.accent}22`, color: COLORS.ui.accent }}
                  >
                    {concept.name}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1fr]">
              {focusConcepts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase" style={{ color: COLORS.ui.textSecondary }}>
                    Focus
                  </p>
                  <div className="mt-2 space-y-2">
                    {focusConcepts.map((concept) => (
                      <div key={concept.id} className="text-sm">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>
                            {concept.name}
                          </span>
                          <span className="text-xs" style={{ color: COLORS.ui.textSecondary }}>
                            {CATEGORY_LABELS[concept.category]}
                          </span>
                        </div>
                        <p className="mt-0.5 leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                          {concept.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: COLORS.ui.textSecondary }}>
                  Plan
                </p>
                <ol className="mt-2 space-y-2 text-sm">
                  {recommendation.practicePlan.map((step, index) => (
                    <li key={step} className="flex gap-2 leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                      <span className="font-semibold" style={{ color: COLORS.ui.accent }}>
                        {index + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <button
              onClick={startRecommended}
              className="mt-5 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
            >
              {recommendation.actionLabel}
            </button>
          </div>

          <div
            className="rounded-lg border p-5"
            style={{ backgroundColor: COLORS.ui.bgCard, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <p className="text-xs font-semibold uppercase" style={{ color: COLORS.ui.textSecondary }}>
              Current progress
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt style={{ color: COLORS.ui.textSecondary }}>Lessons completed</dt>
                <dd className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>{completedLessons.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt style={{ color: COLORS.ui.textSecondary }}>Problems solved</dt>
                <dd className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>{solvedProblems}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt style={{ color: COLORS.ui.textSecondary }}>Reviews due</dt>
                <dd className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>{dueReviewCount}</dd>
              </div>
            </dl>
            <button
              onClick={showDashboard}
              className="mt-5 w-full rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: COLORS.ui.bgPrimary, color: COLORS.ui.textPrimary }}
            >
              Open progress dashboard
            </button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <PathCard title="Lessons" text="Learn one idea at a time." onClick={showLessons} />
          <PathCard title="Problems" text="Practice reading and tactics." onClick={openProblems} />
          <PathCard title="Review" text="Repeat weak patterns." onClick={showReview} />
          <PathCard title="Skills" text="Inspect concept mastery." onClick={showSkillTree} />
          <PathCard
            title="Guided game"
            text={hasStartedIntroGame ? 'Use ideas in play.' : 'Start the first 9x9 board.'}
            onClick={openGuidedGameCard}
          />
        </section>
      </div>
    </main>
  );
}

function PathCard({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${title}: ${text}`}
      className="rounded-lg border p-4 text-left transition-colors hover:bg-white/[0.03]"
      style={{ backgroundColor: COLORS.ui.bgCard, borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <span className="block text-sm font-semibold" style={{ color: COLORS.ui.textPrimary }}>
        {title}
      </span>
      <span className="mt-1 block text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
        {text}
      </span>
    </button>
  );
}
