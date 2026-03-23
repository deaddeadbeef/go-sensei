'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PROBLEMS } from '@/lib/problems/problem-data';
import { useGameStore } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';
import type { ProblemCategory } from '@/lib/problems/types';

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

function difficultyStars(d: number) {
  return '★'.repeat(d) + '☆'.repeat(5 - d);
}

export function ProblemPicker() {
  const problemAttempts = useGameStore((s) => s.problemAttempts);
  const startProblem = useGameStore((s) => s.startProblem);
  const returnToGame = useGameStore((s) => s.returnToGame);
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = filter === 'all'
    ? PROBLEMS
    : PROBLEMS.filter((p) => p.category === filter);

  const isSolved = (id: string) =>
    problemAttempts.some((a) => a.problemId === id && a.solved);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ backgroundColor: COLORS.ui.bgPrimary }}
    >
      <div className="w-full max-w-3xl">
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
              onClick={() => setFilter(key)}
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
                onClick={() => startProblem(problem)}
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
                    startProblem(problem);
                  }}
                  className="mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: COLORS.ui.accent,
                    color: COLORS.ui.bgPrimary,
                  }}
                >
                  {solved ? 'Retry →' : 'Solve →'}
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Back to Game button */}
        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <button
            onClick={returnToGame}
            className="rounded-xl px-8 py-3 text-base font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: COLORS.ui.accent,
              color: COLORS.ui.bgPrimary,
            }}
          >
            ← Back to Game
          </button>
        </motion.div>
      </div>
    </div>
  );
}
