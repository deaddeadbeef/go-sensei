'use client';

import { getLearningRecommendation } from '@/lib/learning-path/recommendations';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';
import { COLORS } from '@/utils/colors';

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
  const returnToGame = useGameStore((s) => s.returnToGame);
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
        returnToGame();
        break;
    }
  };

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
                {recommendation.focusConcepts.map((conceptId) => (
                  <span
                    key={conceptId}
                    className="rounded-full px-2.5 py-1 text-xs"
                    style={{ backgroundColor: `${COLORS.ui.accent}22`, color: COLORS.ui.accent }}
                  >
                    {conceptId}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={startRecommended}
              className="mt-5 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
            >
              Start recommended action
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
          <PathCard title="Problems" text="Practice reading and tactics." onClick={showProblems} />
          <PathCard title="Review" text="Repeat weak patterns." onClick={showReview} />
          <PathCard title="Skills" text="Inspect concept mastery." onClick={showSkillTree} />
          <PathCard title="Guided game" text="Use ideas in play." onClick={returnToGame} />
        </section>
      </div>
    </main>
  );
}

function PathCard({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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
