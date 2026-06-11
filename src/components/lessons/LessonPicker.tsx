'use client';

import { motion } from 'framer-motion';
import { LESSONS } from '@/lib/lessons/lesson-data';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';
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

const LESSON_IDS = new Set(LESSONS.map((lesson) => lesson.id));

function titleAsSentence(title: string): string {
  return /[.!?]$/.test(title) ? title : `${title}.`;
}

export function LessonPicker() {
  const completedLessons = useProgressStore((s) => s.completedLessons);
  const startLesson = useGameStore((s) => s.startLesson);
  const showLearningPath = useGameStore((s) => s.showLearningPath);
  const showReview = useGameStore((s) => s.showReview);
  const returnToGame = useGameStore((s) => s.returnToGame);
  const dueReviewCount = useReviewStore((s) => {
    void s.cards;
    return s.getDueCount();
  });
  const completedLessonIds = new Set(completedLessons.filter((lessonId) => LESSON_IDS.has(lessonId)));
  const nextLesson = LESSONS.find((lesson) => !completedLessonIds.has(lesson.id));
  const completedCount = completedLessonIds.size;
  const remainingCount = Math.max(LESSONS.length - completedCount, 0);
  const dueReviewText = `${dueReviewCount} review position${dueReviewCount === 1 ? ' is' : 's are'} due before new lessons.`;

  return (
    <div
      data-testid="lesson-library"
      className="flex flex-1 min-h-0 items-start justify-center overflow-y-auto px-4 py-5 sm:py-8"
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
            Learn one board idea, then return to the path for the next step.
          </p>
          <div
            className="mx-auto mt-5 max-w-md rounded-xl border p-4 text-left"
            style={{ backgroundColor: COLORS.ui.bgCard, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center justify-between gap-4 text-sm">
              <span style={{ color: COLORS.ui.textSecondary }}>Lesson progress</span>
              <span className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>
                {completedCount}/{LESSONS.length} complete
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: COLORS.ui.bgPrimary }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(completedCount / LESSONS.length) * 100}%`,
                  backgroundColor: COLORS.ui.accent,
                }}
              />
            </div>
            {dueReviewCount > 0 ? (
              <>
                <p className="mt-3 text-xs font-semibold uppercase" style={{ color: COLORS.overlay.suggestion }}>
                  Review due
                </p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                  {dueReviewText}
                </p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                  {nextLesson
                    ? `After review, next lesson: ${titleAsSentence(nextLesson.title)}`
                    : 'After review, use the path to choose problems or a guided game.'}
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                {nextLesson
                  ? `Next lesson: ${titleAsSentence(nextLesson.title)} ${remainingCount} lesson${remainingCount === 1 ? '' : 's'} left.`
                  : 'All lessons complete. Use the path to choose review, problems, or a guided game.'}
              </p>
            )}
            {dueReviewCount > 0 ? (
              <button
                onClick={showReview}
                aria-label="Start daily review from lesson library"
                className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: COLORS.overlay.suggestion,
                  color: COLORS.ui.bgPrimary,
                }}
              >
                Start daily review
              </button>
            ) : nextLesson && (
              <button
                onClick={() => startLesson(nextLesson.id)}
                aria-label={`Start next lesson: ${nextLesson.title}`}
                className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: COLORS.ui.accent,
                  color: COLORS.ui.bgPrimary,
                }}
              >
                Start next lesson
              </button>
            )}
          </div>
        </motion.div>

        {/* Lesson grid */}
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {LESSONS.map((lesson) => {
            const completed = completedLessonIds.has(lesson.id);
            const actionLabel = completed ? `Review lesson: ${lesson.title}` : `Start lesson: ${lesson.title}`;

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
                  aria-label={actionLabel}
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

        {/* Navigation buttons */}
        <motion.div
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <button
            onClick={showLearningPath}
            aria-label="Learning path from lesson library"
            className="rounded-xl px-8 py-3 text-base font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: COLORS.ui.accent,
              color: COLORS.ui.bgPrimary,
            }}
          >
            Learning path
          </button>
          <button
            onClick={returnToGame}
            aria-label="Return to board from lesson library"
            className="rounded-xl px-8 py-3 text-base font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: COLORS.ui.bgCard,
              color: COLORS.ui.textPrimary,
            }}
          >
            Return to board
          </button>
        </motion.div>
      </div>
    </div>
  );
}
