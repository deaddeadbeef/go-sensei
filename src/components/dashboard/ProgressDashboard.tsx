'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/stores/game-store';
import { useConceptStore } from '@/stores/concept-store';
import { useReviewStore } from '@/stores/review-store';
import { LESSONS } from '@/lib/lessons/lesson-data';
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

export function ProgressDashboard() {
  const completedLessons = useGameStore((s) => s.completedLessons);
  const problemAttempts = useGameStore((s) => s.problemAttempts);
  const conceptStats = useConceptStore((s) => s.getStats)();
  const reviewStats = useReviewStore((s) => s.getReviewStats)();
  const returnToGame = useGameStore((s) => s.returnToGame);
  const showLessons = useGameStore((s) => s.showLessons);
  const showProblems = useGameStore((s) => s.showProblems);
  const showSkillTree = useGameStore((s) => s.showSkillTree);
  const showReview = useGameStore((s) => s.showReview);

  const solvedProblems = new Set(
    problemAttempts.filter((a) => a.solved).map((a) => a.problemId),
  ).size;

  const totalAccuracy = problemAttempts.length > 0
    ? Math.round((problemAttempts.filter((a) => a.solved).length / problemAttempts.length) * 100)
    : 0;

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

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon="📚" label="Lessons" value={`${completedLessons.length}/${LESSONS.length}`} color={COLORS.blue} delay={0.05} />
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
            <button onClick={showLessons} className="text-xs" style={{ color: COLORS.accent }}>View all →</button>
          </div>
          <ProgressBar value={completedLessons.length} max={LESSONS.length} color={COLORS.blue} />
          <p className="text-xs mt-1" style={{ color: COLORS.textDim }}>
            {completedLessons.length === LESSONS.length ? 'All lessons completed! 🎉' : `${LESSONS.length - completedLessons.length} remaining`}
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
            <button onClick={showProblems} className="text-xs" style={{ color: COLORS.accent }}>Solve more →</button>
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
            <button onClick={showSkillTree} className="text-xs" style={{ color: COLORS.accent }}>Skill tree →</button>
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
            <button onClick={showReview} className="text-xs" style={{ color: COLORS.accent }}>Start review →</button>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: COLORS.textDim }}>
            <span>🔥 {reviewStats.streak} day streak</span>
            <span>📋 {reviewStats.dueToday} due today</span>
            <span>✅ {reviewStats.totalReviewed} problems reviewed</span>
          </div>
        </motion.div>

        {/* Back button */}
        <div className="text-center mt-6">
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
