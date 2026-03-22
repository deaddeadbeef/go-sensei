'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useGameStore } from '@/stores/game-store';
import { LESSONS } from '@/lib/lessons/lesson-data';
import { LessonOverlay } from './LessonOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SVG_SIZE,
  BOARD_PADDING,
  pointToSvg,
  stoneRadius,
  cellSize,
  getStarPoints,
} from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';
import { LESSON_TRANSITION } from '@/utils/animation';
import type { BoardSize } from '@/lib/go-engine/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST'; // skip I
const boardInset = BOARD_PADDING * 0.75;

// ---------------------------------------------------------------------------
// Board sub-components (accept boardSize as prop — not coupled to game store)
// ---------------------------------------------------------------------------

function LessonBoardGrid({ boardSize }: { boardSize: BoardSize }) {
  const cell = cellSize(boardSize);
  const lines: React.ReactNode[] = [];

  for (let i = 0; i < boardSize; i++) {
    const pos = BOARD_PADDING + i * cell;
    const start = BOARD_PADDING;
    const end = BOARD_PADDING + (boardSize - 1) * cell;

    lines.push(
      <line key={`h-${i}`} x1={start} y1={pos} x2={end} y2={pos} stroke={COLORS.board.line} strokeWidth={i === 0 || i === boardSize - 1 ? 1.2 : 0.8} />,
      <line key={`v-${i}`} x1={pos} y1={start} x2={pos} y2={end} stroke={COLORS.board.line} strokeWidth={i === 0 || i === boardSize - 1 ? 1.2 : 0.8} />,
    );
  }

  const stars = getStarPoints(boardSize).map((p) => {
    const { cx, cy } = pointToSvg(p, boardSize);
    return <circle key={`star-${p.x}-${p.y}`} cx={cx} cy={cy} r={3} fill={COLORS.board.star} />;
  });

  return (
    <g>
      {lines}
      {stars}
    </g>
  );
}

function LessonCoordinateLabels({ boardSize }: { boardSize: BoardSize }) {
  const cell = cellSize(boardSize);
  const labels: React.ReactNode[] = [];
  const fontSize = Math.min(10, cell * 0.45);
  const offset = 14;

  for (let i = 0; i < boardSize; i++) {
    const pos = BOARD_PADDING + i * cell;
    const letter = COLUMN_LETTERS[i];
    const number = String(boardSize - i);

    labels.push(
      <text key={`ct-${i}`} x={pos} y={BOARD_PADDING - offset} textAnchor="middle" dominantBaseline="middle" fill={COLORS.ui.textSecondary} fontSize={fontSize} fontFamily="monospace">{letter}</text>,
      <text key={`cb-${i}`} x={pos} y={BOARD_PADDING + (boardSize - 1) * cell + offset} textAnchor="middle" dominantBaseline="middle" fill={COLORS.ui.textSecondary} fontSize={fontSize} fontFamily="monospace">{letter}</text>,
      <text key={`rl-${i}`} x={BOARD_PADDING - offset} y={pos} textAnchor="middle" dominantBaseline="middle" fill={COLORS.ui.textSecondary} fontSize={fontSize} fontFamily="monospace">{number}</text>,
      <text key={`rr-${i}`} x={BOARD_PADDING + (boardSize - 1) * cell + offset} y={pos} textAnchor="middle" dominantBaseline="middle" fill={COLORS.ui.textSecondary} fontSize={fontSize} fontFamily="monospace">{number}</text>,
    );
  }

  return <g>{labels}</g>;
}

// ---------------------------------------------------------------------------
// LessonView
// ---------------------------------------------------------------------------

export function LessonView() {
  const currentLessonId = useGameStore((s) => s.currentLessonId);
  const currentStep = useGameStore((s) => s.currentStep);
  const nextStep = useGameStore((s) => s.nextStep);
  const prevStep = useGameStore((s) => s.prevStep);
  const completeLesson = useGameStore((s) => s.completeLesson);
  const showLessons = useGameStore((s) => s.showLessons);

  // Board sizing (mirrors BoardContainer approach)
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setBoardPx(Math.max(Math.floor(Math.min(rect.width, rect.height) - 8), 300));
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    requestAnimationFrame(update);
    return () => observer.disconnect();
  }, []);

  // Find lesson data by ID
  const lessonData = LESSONS.find((l) => l.id === currentLessonId);

  const handlePrev = useCallback(() => prevStep(), [prevStep]);
  const handleNext = useCallback(() => nextStep(), [nextStep]);
  const handleComplete = useCallback(() => {
    completeLesson();
  }, [completeLesson]);
  const handleExit = useCallback(() => showLessons(), [showLessons]);

  if (!lessonData || !currentLessonId) return null;

  const totalSteps = lessonData.steps.length;
  const stepData = lessonData.steps[currentStep];
  if (!stepData) return null;

  const boardSize = (stepData.boardSize ?? 9) as BoardSize;
  const r = stoneRadius(boardSize);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep >= totalSteps - 1;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* ---- Left: Board area ---- */}
      <div className="flex-[7] flex flex-col relative min-w-0 min-h-0 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(circle at center, ${COLORS.board.bg}15 0%, transparent 70%)` }}
        />

        <div
          ref={containerRef}
          style={{ flex: '1 1 0%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          <div style={{ width: boardPx, height: boardPx, position: 'relative' }}>
            <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="w-full h-full select-none">
              <defs>
                <radialGradient id="lesson-black-stone" cx="35%" cy="35%">
                  <stop offset="0%" stopColor={COLORS.stone.blackShine} />
                  <stop offset="100%" stopColor={COLORS.stone.black} />
                </radialGradient>
                <radialGradient id="lesson-white-stone" cx="35%" cy="35%">
                  <stop offset="0%" stopColor={COLORS.stone.whiteShine} />
                  <stop offset="100%" stopColor={COLORS.stone.whiteShadow} />
                </radialGradient>
                <filter id="lesson-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="1" dy="1" stdDeviation="1.5" floodColor="#00000040" />
                </filter>
              </defs>

              {/* Board background */}
              <rect
                x={boardInset}
                y={boardInset}
                width={SVG_SIZE - boardInset * 2}
                height={SVG_SIZE - boardInset * 2}
                fill={COLORS.board.bg}
              />

              <LessonBoardGrid boardSize={boardSize} />
              <LessonCoordinateLabels boardSize={boardSize} />

              {/* Stones + highlights — animated per step */}
              <AnimatePresence mode="wait">
                <motion.g
                  key={currentStep}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: LESSON_TRANSITION }}
                >
                  {stepData.stones.map((s) => {
                    const { cx, cy } = pointToSvg(s.point, boardSize);
                    return (
                      <circle
                        key={`${s.point.x}-${s.point.y}`}
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={s.color === 'black' ? 'url(#lesson-black-stone)' : 'url(#lesson-white-stone)'}
                        filter="url(#lesson-shadow)"
                      />
                    );
                  })}
                  <LessonOverlay highlights={stepData.highlights} boardSize={boardSize} />
                </motion.g>
              </AnimatePresence>
            </svg>
          </div>
        </div>
      </div>

      {/* ---- Right: Sidebar ---- */}
      <div
        className="flex-[3] flex flex-col md:min-w-[280px] md:max-w-[400px] border-t md:border-t-0 md:border-l"
        style={{ borderColor: COLORS.ui.bgCard, backgroundColor: COLORS.ui.bgPrimary }}
      >
        {/* Title */}
        <div className="shrink-0 p-4 border-b" style={{ borderColor: COLORS.ui.bgCard }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{lessonData.icon}</span>
            <h2 className="text-lg font-bold" style={{ color: COLORS.ui.textPrimary }}>
              {lessonData.title}
            </h2>
          </div>
          <p className="mt-1 text-xs" style={{ color: COLORS.ui.textSecondary }}>
            {lessonData.description}
          </p>
        </div>

        {/* Step counter + progress bar */}
        <div className="shrink-0 px-4 pt-3 pb-2">
          <span className="text-sm font-medium" style={{ color: COLORS.ui.textSecondary }}>
            Step {currentStep + 1} of {totalSteps}
          </span>
          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.ui.bgCard }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: COLORS.ui.accent }}
              animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Step text */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              className="rounded-xl p-4"
              style={{ backgroundColor: COLORS.ui.bgCard }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <p className="text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                {stepData.text}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div className="shrink-0 p-4 border-t flex flex-col gap-3" style={{ borderColor: COLORS.ui.bgCard }}>
          <div className="flex gap-2">
            <button
              onClick={handlePrev}
              disabled={isFirstStep}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-30"
              style={{ backgroundColor: COLORS.ui.bgCard, color: COLORS.ui.textPrimary }}
            >
              ← Previous
            </button>
            {isLastStep ? (
              <button
                onClick={handleComplete}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95"
                style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
              >
                Complete ✓
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-transform hover:scale-[1.02] active:scale-95"
                style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
              >
                Next →
              </button>
            )}
          </div>
          <button
            onClick={handleExit}
            className="text-sm text-center transition-opacity hover:opacity-100"
            style={{ color: COLORS.ui.textSecondary, opacity: 0.7 }}
          >
            ✕ Exit Lesson
          </button>
        </div>
      </div>
    </div>
  );
}
