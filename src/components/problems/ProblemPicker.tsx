'use client';

import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { PROBLEMS } from '@/lib/problems/problem-data';
import { getLearningRecommendation } from '@/lib/learning-path/recommendations';
import { getRecommendedProblem, getSolvedProblemIds } from '@/lib/problems/recommendation';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';
import { COLORS } from '@/utils/colors';
import type { Problem, ProblemCategory } from '@/lib/problems/types';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const card = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
};

type FilterKey = 'all' | ProblemCategory;

const CATEGORY_LABELS: Record<FilterKey, string> = {
  all: 'All',
  capture: 'Capture',
  'life-and-death': 'Life & Death',
  tesuji: 'Tesuji',
  reading: 'Reading',
  endgame: 'Endgame',
};

const FILTERS: FilterKey[] = ['all', 'capture', 'life-and-death', 'tesuji', 'reading', 'endgame'];
const PROBLEM_BY_ID = new Map(PROBLEMS.map((problem) => [problem.id, problem]));

const FOCUS_PRACTICE_REASON: Record<ProblemCategory, string> = {
  capture: 'Capture problems train you to count liberties and take stones only when the final point is ready.',
  'life-and-death': 'Life and death problems train you to find vital points before a group lives or dies.',
  tesuji: 'Tesuji problems train you to spot the sharp move that changes the shape immediately.',
  reading: 'Reading problems train you to follow forcing moves before touching the board.',
  endgame: 'Endgame problems train you to count value and play sente before smaller gote moves.',
};

function difficultyStars(d: number) {
  return '★'.repeat(d) + '☆'.repeat(5 - d);
}

function visibleProgressLabel(filter: FilterKey): string {
  return filter === 'all' ? 'problems' : `${CATEGORY_LABELS[filter].toLowerCase()} problems`;
}

function recommendationReason({
  filter,
  solvedCount,
  totalCount,
}: {
  filter: FilterKey;
  solvedCount: number;
  totalCount: number;
}): string {
  const problemKind = filter === 'all'
    ? 'problem'
    : `${CATEGORY_LABELS[filter].toLowerCase()} problem`;

  if (totalCount > 0 && solvedCount === totalCount) {
    return filter === 'all'
      ? 'You have solved every problem in the library. Replay this one until the first move feels automatic.'
      : `You have solved every ${problemKind}. Replay this one until the first move feels automatic.`;
  }

  if (solvedCount === 0) {
    return filter === 'all'
      ? 'Start here: it is the gentlest unsolved problem in the library.'
      : `Start here: it is the gentlest unsolved ${problemKind}.`;
  }

  return filter === 'all'
    ? 'Continue with the next unsolved problem in the library.'
    : `Continue with the next unsolved ${problemKind}.`;
}

function ProblemRecommendation({
  filter,
  problem,
  solvedCount,
  totalCount,
  solved,
  pathTargeted,
  pathGoalReason,
  pathGoalFinishLine,
  focusedPracticeReason,
  reviewReminderReason,
  reviewReminderFinishLine,
  onStartReview,
  onStart,
}: {
  filter: FilterKey;
  problem: Problem;
  solvedCount: number;
  totalCount: number;
  solved: boolean;
  pathTargeted: boolean;
  pathGoalReason: string | null;
  pathGoalFinishLine: string | null;
  focusedPracticeReason: string | null;
  reviewReminderReason: string | null;
  reviewReminderFinishLine: string | null;
  onStartReview: () => void;
  onStart: () => void;
}) {
  const mustReviewFirst = Boolean(reviewReminderReason);

  return (
    <motion.section
      className="mb-6 border-y py-4"
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.35 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.ui.textSecondary }}>
            Recommended next
          </p>
          <h2 className="mt-1 text-xl font-bold leading-tight" style={{ color: COLORS.ui.textPrimary }}>
            {problem.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
            {pathTargeted
              ? `Replay this exact repair pattern before choosing another ${CATEGORY_LABELS[problem.category].toLowerCase()} problem.`
              : recommendationReason({ filter, solvedCount, totalCount })}
          </p>
          {pathGoalReason && (
            <div
              className="mt-3 rounded-lg p-3"
              style={{ backgroundColor: `${COLORS.ui.accent}12`, border: `1px solid ${COLORS.ui.accent}35` }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.ui.accent }}>
                Path goal
              </p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                {pathGoalReason}
              </p>
              {pathGoalFinishLine && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                  <span className="font-semibold" style={{ color: COLORS.ui.accent }}>
                    Finish line:{' '}
                  </span>
                  {pathGoalFinishLine}
                </p>
              )}
            </div>
          )}
          {!pathGoalReason && reviewReminderReason && (
            <div
              className="mt-3 rounded-lg p-3"
              style={{ backgroundColor: `${COLORS.overlay.suggestion}15`, border: `1px solid ${COLORS.overlay.suggestion}40` }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.overlay.suggestion }}>
                Review due
              </p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                {reviewReminderReason}
              </p>
              {reviewReminderFinishLine && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                  <span className="font-semibold" style={{ color: COLORS.overlay.suggestion }}>
                    Finish line:{' '}
                  </span>
                  {reviewReminderFinishLine}
                </p>
              )}
              <button
                onClick={onStartReview}
                aria-label="Start daily review from problem recommendation"
                className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: COLORS.overlay.suggestion, color: COLORS.ui.bgPrimary }}
              >
                Start daily review
              </button>
            </div>
          )}
          {!pathGoalReason && !reviewReminderReason && focusedPracticeReason && (
            <div
              className="mt-3 rounded-lg p-3"
              style={{ backgroundColor: `${COLORS.ui.bgCard}`, border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.ui.textSecondary }}>
                Focused practice
              </p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                {focusedPracticeReason}
              </p>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: COLORS.ui.textSecondary }}>
            <span
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ backgroundColor: `${COLORS.ui.accent}25`, color: COLORS.ui.accent }}
            >
              {CATEGORY_LABELS[problem.category]}
            </span>
            <span style={{ color: COLORS.ui.accent }}>{difficultyStars(problem.difficulty)}</span>
            <span>{solvedCount}/{totalCount} {visibleProgressLabel(filter)} solved</span>
          </div>
        </div>
        <button
          onClick={mustReviewFirst ? onStartReview : onStart}
          aria-label={mustReviewFirst ? 'Start daily review before problem recommendation' : undefined}
          className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-95"
          style={{
            backgroundColor: mustReviewFirst ? COLORS.overlay.suggestion : COLORS.ui.accent,
            color: COLORS.ui.bgPrimary,
          }}
        >
          {mustReviewFirst ? 'Review first' : solved ? `Review ${problem.title}` : `Start ${problem.title}`}
        </button>
      </div>
    </motion.section>
  );
}

export function ProblemPicker() {
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const problemAttempts = useProgressStore((s) => s.problemAttempts);
  const hasStartedIntroGame = useProgressStore((s) => s.hasStartedIntroGame);
  const preferredProblemFilter = useGameStore((s) => s.preferredProblemFilter);
  const startProblem = useGameStore((s) => s.startProblem);
  const showProblems = useGameStore((s) => s.showProblems);
  const showReview = useGameStore((s) => s.showReview);
  const returnToGame = useGameStore((s) => s.returnToGame);
  const reviewCards = useReviewStore((s) => s.cards);
  const getDueCount = useReviewStore((s) => s.getDueCount);
  const mastery = useConceptStore((s) => s.mastery);
  const topRef = useRef<HTMLDivElement>(null);
  const filter: FilterKey = preferredProblemFilter ?? 'all';

  const filtered = useMemo(
    () => filter === 'all'
      ? PROBLEMS
      : PROBLEMS.filter((p) => p.category === filter),
    [filter],
  );

  const solvedIds = useMemo(() => getSolvedProblemIds(problemAttempts), [problemAttempts]);
  const solvedVisibleCount = filtered.filter((problem) => solvedIds.has(problem.id)).length;
  const recommendedByProgress = useMemo(
    () => getRecommendedProblem(problemAttempts, filtered),
    [problemAttempts, filtered],
  );
  const dueReviewCount = useMemo(() => {
    void reviewCards;
    return getDueCount();
  }, [getDueCount, reviewCards]);
  const learningRecommendation = useMemo(
    () => getLearningRecommendation({
      completedLessons,
      problemAttempts,
      dueReviewCount,
      hasStartedIntroGame,
      mastery: Object.values(mastery),
    }),
    [completedLessons, problemAttempts, dueReviewCount, hasStartedIntroGame, mastery],
  );
  const pathGoalReason = filter !== 'all'
    && learningRecommendation.kind === 'problem'
    && learningRecommendation.filter === filter
    ? learningRecommendation.reason
    : null;
  const pathGoalFinishLine = pathGoalReason ? learningRecommendation.finishLine : null;
  const reviewReminderReason = learningRecommendation.kind === 'review'
    ? learningRecommendation.reason
    : null;
  const reviewReminderFinishLine = reviewReminderReason
    ? learningRecommendation.finishLine
    : null;
  const focusedPracticeReason = filter !== 'all' ? FOCUS_PRACTICE_REASON[filter] : null;
  const pathTargetProblem = useMemo(() => {
    if (
      filter === 'all'
      || learningRecommendation.kind !== 'problem'
      || learningRecommendation.filter !== filter
      || !learningRecommendation.targetProblemId
    ) {
      return null;
    }

    const targetProblem = PROBLEM_BY_ID.get(learningRecommendation.targetProblemId);
    return targetProblem && filtered.some((problem) => problem.id === targetProblem.id)
      ? targetProblem
      : null;
  }, [filter, filtered, learningRecommendation]);
  const recommendedProblem = pathTargetProblem ?? recommendedByProgress;

  const isSolved = (id: string) =>
    solvedIds.has(id);

  useEffect(() => {
    topRef.current?.scrollIntoView?.({ block: 'start' });
  }, [filter]);

  return (
    <div
      ref={topRef}
      className="min-h-screen overflow-y-auto px-4 py-6 sm:py-10"
      style={{ backgroundColor: COLORS.ui.bgPrimary }}
    >
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <motion.div
          className="mb-8 text-center"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: COLORS.ui.textPrimary }}
          >
            🧩 Go Problems
          </h1>
          <p
            className="mt-2 text-base sm:text-lg"
            style={{ color: COLORS.ui.textSecondary }}
          >
            Sharpen your reading with tsumego
          </p>
        </motion.div>

        {/* Filter buttons */}
        <motion.div
          className="mb-6 flex flex-wrap justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          {FILTERS.map((key) => (
            <button
              key={key}
              onClick={() => showProblems(key === 'all' ? undefined : key)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-all"
              style={{
                backgroundColor: filter === key ? COLORS.ui.accent : COLORS.ui.bgCard,
                color: filter === key ? COLORS.ui.bgPrimary : COLORS.ui.textSecondary,
              }}
            >
              {CATEGORY_LABELS[key]}
            </button>
          ))}
        </motion.div>

        {recommendedProblem && (
          <ProblemRecommendation
            filter={filter}
            problem={recommendedProblem}
            solvedCount={solvedVisibleCount}
            totalCount={filtered.length}
            solved={isSolved(recommendedProblem.id)}
            pathTargeted={pathTargetProblem?.id === recommendedProblem.id}
            pathGoalReason={pathGoalReason}
            pathGoalFinishLine={pathGoalFinishLine}
            focusedPracticeReason={focusedPracticeReason}
            reviewReminderReason={reviewReminderReason}
            reviewReminderFinishLine={reviewReminderFinishLine}
            onStartReview={showReview}
            onStart={() => startProblem(recommendedProblem)}
          />
        )}

        {/* Problem grid */}
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={container}
          initial="hidden"
          animate="show"
          key={filter}
        >
          {filtered.map((problem) => {
            const solved = isSolved(problem.id);
            const mustReviewFirst = dueReviewCount > 0;

            return (
              <motion.div
                key={problem.id}
                variants={card}
                className="group relative flex cursor-pointer flex-col rounded-xl border p-5 transition-shadow hover:shadow-lg hover:shadow-black/30"
                style={{
                  backgroundColor: COLORS.ui.bgCard,
                  borderColor: solved
                    ? COLORS.overlay.positive + '60'
                    : 'rgba(255,255,255,0.06)',
                }}
                onClick={() => {
                  if (mustReviewFirst) {
                    showReview();
                    return;
                  }
                  startProblem(problem);
                }}
              >
                {/* Solved badge */}
                {solved && (
                  <span
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: COLORS.overlay.positive,
                      color: COLORS.ui.bgPrimary,
                    }}
                  >
                    ✓
                  </span>
                )}

                {/* Category badge */}
                <span
                  className="mb-2 w-fit rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${COLORS.ui.accent}25`,
                    color: COLORS.ui.accent,
                  }}
                >
                  {CATEGORY_LABELS[problem.category]}
                </span>

                <h2
                  className="text-base font-semibold leading-snug"
                  style={{ color: COLORS.ui.textPrimary }}
                >
                  {problem.title}
                </h2>

                {/* Difficulty stars */}
                <span
                  className="mt-1 text-sm"
                  style={{ color: COLORS.ui.accent }}
                >
                  {difficultyStars(problem.difficulty)}
                </span>

                <p
                  className="mt-1 flex-1 text-sm leading-relaxed"
                  style={{ color: COLORS.ui.textSecondary }}
                >
                  {problem.description}
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mustReviewFirst) {
                      showReview();
                      return;
                    }
                    startProblem(problem);
                  }}
                  aria-label={mustReviewFirst ? `Start daily review before ${problem.title}` : undefined}
                  className="mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: mustReviewFirst ? COLORS.overlay.suggestion : COLORS.ui.accent,
                    color: COLORS.ui.bgPrimary,
                  }}
                >
                  {mustReviewFirst ? 'Review first' : solved ? `Retry: ${problem.title}` : `Solve: ${problem.title}`}
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Return to board button */}
        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <button
            onClick={returnToGame}
            aria-label="Return to board from problem library"
            className="rounded-xl px-8 py-3 text-base font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: COLORS.ui.accent,
              color: COLORS.ui.bgPrimary,
            }}
          >
            Return to board
          </button>
        </motion.div>
      </div>
    </div>
  );
}
