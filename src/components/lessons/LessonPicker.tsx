'use client';

import { motion } from 'framer-motion';
import { LESSONS } from '@/lib/lessons/lesson-data';
import { useGameStore } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
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

export function LessonPicker() {
  const completedLessons = useGameStore((s) => s.completedLessons);
  const startLesson = useGameStore((s) => s.startLesson);
  const returnToGame = useGameStore((s) => s.returnToGame);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ backgroundColor: COLORS.ui.bgPrimary }}
    >
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: COLORS.ui.textPrimary }}
          >
            📚 Go Tutorials
          </h1>
          <p
            className="mt-2 text-base sm:text-lg"
            style={{ color: COLORS.ui.textSecondary }}
          >
            Master the basics before playing
          </p>
        </motion.div>

        {/* Lesson grid */}
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {LESSONS.map((lesson) => {
            const completed = completedLessons.includes(lesson.id);

            return (
              <motion.div
                key={lesson.id}
                variants={card}
                className="group relative flex flex-col rounded-xl border p-5 transition-shadow hover:shadow-lg hover:shadow-black/30"
                style={{
                  backgroundColor: COLORS.ui.bgCard,
                  borderColor: completed
                    ? COLORS.overlay.positive + '60'
                    : 'rgba(255,255,255,0.06)',
                }}
              >
                {/* Completed badge */}
                {completed && (
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

                <span className="text-3xl">{lesson.icon}</span>

                <h2
                  className="mt-3 text-base font-semibold leading-snug"
                  style={{ color: COLORS.ui.textPrimary }}
                >
                  {lesson.title}
                </h2>

                <p
                  className="mt-1 flex-1 text-sm leading-relaxed"
                  style={{ color: COLORS.ui.textSecondary }}
                >
                  {lesson.description}
                </p>

                <button
                  onClick={() => startLesson(lesson.id)}
                  className="mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: COLORS.ui.accent,
                    color: COLORS.ui.bgPrimary,
                  }}
                >
                  {completed ? 'Review →' : 'Start →'}
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Play button */}
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
            Start Playing →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
