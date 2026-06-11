'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/stores/game-store';
import { useConceptStore } from '@/stores/concept-store';
import { useReviewStore } from '@/stores/review-store';
import { useProgressStore } from '@/stores/progress-store';
import { CONCEPTS } from '@/lib/concepts/concept-data';
import { LESSONS } from '@/lib/lessons/lesson-data';
import { getLearningRecommendation, type LearningRecommendation } from '@/lib/learning-path/recommendations';
import { PROBLEMS } from '@/lib/problems/problem-data';

const COLORS = {
  bg: '#0a0a0f',
  card: '#1a1a2e',
  cardHover: '#252540',
  accent: '#e2b55a',
  text: '#e0e0e0',
  textDim: '#888',
  green: '#4ade80',
  blue: '#4a9eff',
  amber: '#e2b55a',
  red: '#ef4444',
  border: '#333',
};

const CONCEPT_NAMES = new Map(CONCEPTS.map((concept) => [concept.id, concept.name]));
const LESSON_IDS = new Set(LESSONS.map((lesson) => lesson.id));
const PROBLEM_IDS = new Set(PROBLEMS.map((problem) => problem.id));
const PROBLEM_BY_ID = new Map(PROBLEMS.map((problem) => [problem.id, problem]));

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay: number;
}

function StatCard({ icon, label, value, sub, color, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="p-4 rounded-xl"
      style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-sm" style={{ color: COLORS.text }}>{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: COLORS.textDim }}>{sub}</div>}
    </motion.div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.card }}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function conceptLabel(conceptId: string): string {
  return CONCEPT_NAMES.get(conceptId) ?? conceptId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function NextMovePanel({
  recommendation,
  onStart,
  onLearningPath,
}: {
  recommendation: LearningRecommendation;
  onStart: () => void;
  onLearningPath: () => void;
}) {
  const focusConcepts = recommendation.focusConcepts.slice(0, 4);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="mb-6 rounded-xl p-4"
      style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textDim }}>
        Next best move
      </p>
      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-bold leading-tight" style={{ color: COLORS.text }}>
            {recommendation.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.textDim }}>
            {recommendation.reason}
          </p>
          <div
            className="mt-2 rounded-lg border px-3 py-2 text-sm leading-relaxed"
            style={{ borderColor: `${COLORS.accent}55`, backgroundColor: `${COLORS.accent}12` }}
          >
            <span className="font-semibold" style={{ color: COLORS.accent }}>
              Finish line:{' '}
            </span>
            <span style={{ color: COLORS.text }}>
              {recommendation.finishLine}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            onClick={onStart}
            className="rounded-lg px-3 py-2 text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
          >
            {recommendation.actionLabel}
          </button>
          <button
            onClick={onLearningPath}
            className="rounded-lg px-3 py-2 text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: COLORS.cardHover, color: COLORS.text }}
          >
            See full learning path
          </button>
        </div>
      </div>
      {focusConcepts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {focusConcepts.map((conceptId) => (
            <span
              key={conceptId}
              className="rounded-full px-2.5 py-1 text-xs"
              style={{ backgroundColor: `${COLORS.accent}22`, color: COLORS.accent }}
            >
              {conceptLabel(conceptId)}
            </span>
          ))}
        </div>
      )}
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {recommendation.practicePlan.map((step, index) => (
          <li
            key={step}
            className="flex gap-2 text-xs leading-relaxed"
            style={{ color: COLORS.textDim }}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: `${COLORS.accent}22`, color: COLORS.accent }}
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}

export function ProgressDashboard() {
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const problemAttempts = useProgressStore((s) => s.problemAttempts);
  const hasStartedIntroGame = useProgressStore((s) => s.hasStartedIntroGame);
  const conceptStats = useConceptStore((s) => s.getStats)();
  const mastery = useConceptStore((s) => s.mastery);
  const reviewCards = useReviewStore((s) => s.cards);
  const reviewHistory = useReviewStore((s) => s.history);
  const getReviewStats = useReviewStore((s) => s.getReviewStats);
  const reviewStats = useMemo(
    () => {
      void reviewCards;
      void reviewHistory;
      return getReviewStats();
    },
    [getReviewStats, reviewCards, reviewHistory],
  );
  const returnToGame = useGameStore((s) => s.returnToGame);
  const openGuidedGame = useGameStore((s) => s.openGuidedGame);
  const startGuidedIntroGame = useGameStore((s) => s.startGuidedIntroGame);
  const startLesson = useGameStore((s) => s.startLesson);
  const startProblem = useGameStore((s) => s.startProblem);
  const showLessons = useGameStore((s) => s.showLessons);
  const showProblems = useGameStore((s) => s.showProblems);
  const showSkillTree = useGameStore((s) => s.showSkillTree);
  const showReview = useGameStore((s) => s.showReview);
  const showLearningPath = useGameStore((s) => s.showLearningPath);

  const completedLessonCount = completedLessons.filter((lessonId) => LESSON_IDS.has(lessonId)).length;
  const knownProblemAttempts = problemAttempts.filter((attempt) => PROBLEM_IDS.has(attempt.problemId));
  const solvedProblems = new Set(
    knownProblemAttempts.filter((attempt) => attempt.solved).map((attempt) => attempt.problemId),
  ).size;

  const totalAccuracy = knownProblemAttempts.length > 0
    ? Math.round((knownProblemAttempts.filter((attempt) => attempt.solved).length / knownProblemAttempts.length) * 100)
    : 0;

  const recommendation = useMemo(
    () => getLearningRecommendation({
      completedLessons,
      problemAttempts,
      dueReviewCount: reviewStats.dueToday,
      hasStartedIntroGame,
      mastery: Object.values(mastery),
    }),
    [completedLessons, problemAttempts, reviewStats.dueToday, hasStartedIntroGame, mastery],
  );
  const reviewEntryLabel = reviewStats.dueToday > 0 ? 'Start daily review →' : 'Seed review queue →';

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

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: COLORS.bg }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.accent }}>
            📊 Progress Dashboard
          </h1>
          <p className="text-sm" style={{ color: COLORS.textDim }}>
            Your Go learning journey at a glance
          </p>
        </motion.div>

        <NextMovePanel
          recommendation={recommendation}
          onStart={startRecommended}
          onLearningPath={showLearningPath}
        />

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon="📚" label="Lessons" value={`${completedLessonCount}/${LESSONS.length}`} color={COLORS.blue} delay={0.05} />
          <StatCard icon="🧩" label="Problems Solved" value={`${solvedProblems}/${PROBLEMS.length}`} sub={`${totalAccuracy}% accuracy`} color={COLORS.green} delay={0.1} />
          <StatCard icon="🧠" label="Concepts" value={`${conceptStats.mastered + conceptStats.practiced}/${conceptStats.total}`} sub={`${conceptStats.mastered} mastered`} color={COLORS.amber} delay={0.15} />
          <StatCard icon="🔥" label="Review Streak" value={`${reviewStats.streak}d`} sub={`${reviewStats.dueToday} due today`} color={COLORS.red} delay={0.2} />
        </div>

        {/* Section: Lessons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-6 p-4 rounded-xl"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>📚 Lessons</h2>
            <button onClick={showLessons} className="text-xs" style={{ color: COLORS.accent }}>Open lessons →</button>
          </div>
          <ProgressBar value={completedLessonCount} max={LESSONS.length} color={COLORS.blue} />
          <p className="text-xs mt-1" style={{ color: COLORS.textDim }}>
            {completedLessonCount === LESSONS.length ? 'All lessons completed! 🎉' : `${LESSONS.length - completedLessonCount} remaining`}
          </p>
        </motion.div>

        {/* Section: Problems */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6 p-4 rounded-xl"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>🧩 Tsumego Problems</h2>
            <button onClick={() => showProblems()} className="text-xs" style={{ color: COLORS.accent }}>Open problem practice →</button>
          </div>
          <ProgressBar value={solvedProblems} max={PROBLEMS.length} color={COLORS.green} />
          <p className="text-xs mt-1" style={{ color: COLORS.textDim }}>
            {solvedProblems}/{PROBLEMS.length} solved · {totalAccuracy}% accuracy
          </p>
        </motion.div>

        {/* Section: Concepts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-6 p-4 rounded-xl"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>🧠 Concept Mastery</h2>
            <button onClick={showSkillTree} className="text-xs" style={{ color: COLORS.accent }}>Open skill tree →</button>
          </div>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <ProgressBar value={conceptStats.mastered} max={conceptStats.total} color={COLORS.green} />
              <p className="text-xs mt-0.5" style={{ color: COLORS.green }}>Mastered: {conceptStats.mastered}</p>
            </div>
            <div className="flex-1">
              <ProgressBar value={conceptStats.practiced} max={conceptStats.total} color={COLORS.amber} />
              <p className="text-xs mt-0.5" style={{ color: COLORS.amber }}>Practicing: {conceptStats.practiced}</p>
            </div>
            <div className="flex-1">
              <ProgressBar value={conceptStats.introduced} max={conceptStats.total} color={COLORS.blue} />
              <p className="text-xs mt-0.5" style={{ color: COLORS.blue }}>Introduced: {conceptStats.introduced}</p>
            </div>
          </div>
        </motion.div>

        {/* Section: Reviews */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6 p-4 rounded-xl"
          style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>📖 Spaced Repetition</h2>
            <button onClick={showReview} className="text-xs" style={{ color: COLORS.accent }}>{reviewEntryLabel}</button>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: COLORS.textDim }}>
            <span>🔥 {reviewStats.streak} day streak</span>
            <span>📋 {reviewStats.dueToday} due today</span>
            <span>✅ {reviewStats.totalReviewed} problems reviewed</span>
          </div>
        </motion.div>

        {/* Return to board button */}
        <div className="text-center mt-6">
          <button
            onClick={returnToGame}
            aria-label="Return to board from progress dashboard"
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
