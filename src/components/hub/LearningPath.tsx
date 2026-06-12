'use client';

import { useMemo } from 'react';
import { getLearningRecommendation } from '@/lib/learning-path/recommendations';
import { CONCEPTS } from '@/lib/concepts/concept-data';
import { LESSONS } from '@/lib/lessons/lesson-data';
import { PROBLEMS } from '@/lib/problems/problem-data';
import type { Concept, ConceptCategory } from '@/lib/concepts/types';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';
import { COLORS } from '@/utils/colors';

const CONCEPT_BY_ID = new Map(CONCEPTS.map((concept) => [concept.id, concept]));
const LESSON_IDS = new Set(LESSONS.map((lesson) => lesson.id));
const PROBLEM_IDS = new Set(PROBLEMS.map((problem) => problem.id));
const PROBLEM_BY_ID = new Map(PROBLEMS.map((problem) => [problem.id, problem]));
const DUE_REVIEW_PREVIEW_LIMIT = 3;

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

function formatDueReviewPreview(problemIds: string[]): string | null {
  const dueProblems = problemIds
    .map((problemId) => PROBLEM_BY_ID.get(problemId))
    .filter((problem): problem is NonNullable<typeof problem> => problem !== undefined);

  if (dueProblems.length === 0) return null;

  const previewTitles = dueProblems
    .slice(0, DUE_REVIEW_PREVIEW_LIMIT)
    .map((problem) => problem.title);
  const hiddenCount = dueProblems.length - previewTitles.length;
  const hiddenText = hiddenCount > 0 ? `, +${hiddenCount} more` : '';

  return `${dueProblems.length} due: ${previewTitles.join(', ')}${hiddenText}.`;
}

export function LearningPath() {
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const problemAttempts = useProgressStore((s) => s.problemAttempts);
  const hasStartedIntroGame = useProgressStore((s) => s.hasStartedIntroGame);
  const startGuidedIntroGame = useGameStore((s) => s.startGuidedIntroGame);
  const startLesson = useGameStore((s) => s.startLesson);
  const startProblem = useGameStore((s) => s.startProblem);
  const showLessons = useGameStore((s) => s.showLessons);
  const showProblems = useGameStore((s) => s.showProblems);
  const showReview = useGameStore((s) => s.showReview);
  const showSkillTree = useGameStore((s) => s.showSkillTree);
  const showDashboard = useGameStore((s) => s.showDashboard);
  const openGuidedGame = useGameStore((s) => s.openGuidedGame);
  const mastery = useConceptStore((s) => s.mastery);
  const reviewCards = useReviewStore((s) => s.cards);
  const getDueProblems = useReviewStore((s) => s.getDueProblems);
  const dueReviewProblemIds = useMemo(() => {
    void reviewCards;
    return getDueProblems();
  }, [getDueProblems, reviewCards]);
  const dueReviewCount = dueReviewProblemIds.length;
  const dueReviewPreview = formatDueReviewPreview(dueReviewProblemIds);

  const recommendation = getLearningRecommendation({
    completedLessons,
    problemAttempts,
    dueReviewCount,
    hasStartedIntroGame,
    mastery: Object.values(mastery),
  });

  const completedLessonCount = completedLessons.filter((lessonId) => LESSON_IDS.has(lessonId)).length;
  const solvedProblems = new Set(
    problemAttempts
      .filter((attempt) => attempt.solved && PROBLEM_IDS.has(attempt.problemId))
      .map((attempt) => attempt.problemId),
  ).size;
  const focusConcepts = recommendation.focusConcepts.map(conceptDisplay).slice(0, 4);
  const reviewPathText = dueReviewCount > 0
    ? dueReviewPreview ?? `${dueReviewCount} due before new material.`
    : recommendation.kind === 'problem'
      ? "No reviews due; seed tomorrow's queue."
      : 'No reviews due; follow the path first.';

  const startRecommended = () => {
    switch (recommendation.kind) {
      case 'guided_intro':
        startGuidedIntroGame();
        break;
      case 'lesson':
        startLesson(recommendation.targetId);
        break;
      case 'problem':
        if (recommendation.targetProblemId) {
          const problem = PROBLEM_BY_ID.get(recommendation.targetProblemId);
          if (problem) {
            showProblems(problem.category);
            startProblem(problem);
            break;
          }
        }
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
            {recommendation.kind === 'review' && dueReviewPreview && (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                Up now: {dueReviewPreview}
              </p>
            )}
            <div
              className="mt-3 rounded-md border px-3 py-2 text-sm leading-relaxed"
              style={{ borderColor: `${COLORS.ui.accent}55`, backgroundColor: `${COLORS.ui.accent}12` }}
            >
              <span className="font-semibold" style={{ color: COLORS.ui.accent }}>
                Finish line:{' '}
              </span>
              <span style={{ color: COLORS.ui.textPrimary }}>
                {recommendation.finishLine}
              </span>
            </div>
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
                <dd className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>{completedLessonCount}/{LESSONS.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt style={{ color: COLORS.ui.textSecondary }}>Problems solved</dt>
                <dd className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>{solvedProblems}/{PROBLEMS.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt style={{ color: COLORS.ui.textSecondary }}>Reviews due</dt>
                <dd className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>{dueReviewCount} today</dd>
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
          <PathCard title="Lessons" text="Build one Go idea at a time." onClick={showLessons} />
          <PathCard title="Problems" text="Read one shape, then check it." onClick={openProblems} />
          <PathCard title="Review" text={reviewPathText} onClick={showReview} />
          <PathCard title="Skills" text="See what each concept unlocks." onClick={showSkillTree} />
          <PathCard
            title="Guided game"
            text={hasStartedIntroGame ? 'Keep playing with one clear goal.' : 'Play the first 9x9 with a goal.'}
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
