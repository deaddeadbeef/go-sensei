'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/stores/game-store';
import { useReviewStore } from '@/stores/review-store';
import { useConceptStore } from '@/stores/concept-store';
import { useProgressStore } from '@/stores/progress-store';
import { PROBLEMS } from '@/lib/problems/problem-data';
import { getRecommendedProblem } from '@/lib/problems/recommendation';
import type { Problem } from '@/lib/problems/types';
import type { MoveNode } from '@/lib/problems/types';
import type { Point, BoardSize, GameState } from '@/lib/go-engine/types';
import type { ProblemCategory } from '@/lib/problems/types';
import { applyProblemMove, buildProblemGame } from '@/lib/problems/runtime';
import { formatProblemPoint, getPrimarySolutionLine, getProblemSolutionTakeaway } from '@/lib/problems/solution-review';
import { buildReviewSessionSummary } from '@/lib/review/session-summary';
import { ProblemReadingPlan } from '@/components/problems/ProblemReadingPlan';
import { ProblemSolutionOverlay, ProblemSolutionPanel } from '@/components/problems/ProblemSolutionReview';
import {
  SVG_SIZE,
  BOARD_PADDING,
  pointToSvg,
  cellSize,
  stoneRadius,
  getStarPoints,
} from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewState {
  problemIds: string[];
  currentIndex: number;
  results: Array<{ problemId: string; solved: boolean; attempts: number }>;
  phase: 'reviewing' | 'complete';
}

interface ProblemState {
  game: GameState;
  currentNodes: MoveNode[];
  status: 'playing' | 'solved' | 'failed';
  attempts: number;
  feedback: string | null;
  showHint: boolean;
}

// ---------------------------------------------------------------------------
// Board sub-components (mirrors ProblemView)
// ---------------------------------------------------------------------------

const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST';
const boardInset = BOARD_PADDING * 0.75;
const PROBLEM_CONCEPTS: Record<ProblemCategory, string[]> = {
  capture: ['capture', 'atari'],
  'life-and-death': ['eyes', 'life-and-death'],
  tesuji: ['tesuji'],
  reading: ['reading', 'ladder', 'net', 'connect-and-cut'],
  endgame: ['sente-gote', 'endgame-counting'],
};

function ReviewBoardGrid({ boardSize }: { boardSize: BoardSize }) {
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

function ReviewCoordinateLabels({ boardSize }: { boardSize: BoardSize }) {
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
// Helpers
// ---------------------------------------------------------------------------

function initProblemState(problem: Problem): ProblemState {
  return {
    game: buildProblemGame(problem),
    currentNodes: problem.solutionTree,
    status: 'playing',
    attempts: 0,
    feedback: null,
    showHint: false,
  };
}

// ---------------------------------------------------------------------------
// DailyReview
// ---------------------------------------------------------------------------

export function DailyReview() {
  const returnToGame = useGameStore((s) => s.returnToGame);
  const showLearningPath = useGameStore((s) => s.showLearningPath);
  const showProblems = useGameStore((s) => s.showProblems);
  const startProblem = useGameStore((s) => s.startProblem);
  const getDueProblems = useReviewStore((s) => s.getDueProblems);
  const recordAttempt = useReviewStore((s) => s.recordAttempt);
  const getReviewStats = useReviewStore((s) => s.getReviewStats);
  const recordEvidence = useConceptStore((s) => s.recordEvidence);
  const problemAttempts = useProgressStore((s) => s.problemAttempts);

  const [review, setReview] = useState<ReviewState>(() => {
    const problemIds = getDueProblems().filter((id) =>
      PROBLEMS.some((problem) => problem.id === id),
    );

    return {
      problemIds,
      currentIndex: 0,
      results: [],
      phase: problemIds.length > 0 ? 'reviewing' : 'complete',
    };
  });

  const currentProblemId = review.problemIds[review.currentIndex] ?? null;
  const currentProblem = currentProblemId
    ? PROBLEMS.find((problem) => problem.id === currentProblemId) ?? null
    : null;

  const [problemState, setProblemState] = useState<ProblemState>(() =>
    currentProblem ? initProblemState(currentProblem) : initProblemState(PROBLEMS[0]),
  );

  const [feedbackPoint, setFeedbackPoint] = useState<{ point: Point; correct: boolean } | null>(null);

  // --- Board click handler ---
  const handleBoardClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!currentProblem || problemState.status !== 'playing') return;

      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * SVG_SIZE;
      const svgY = ((e.clientY - rect.top) / rect.height) * SVG_SIZE;
      const cs = cellSize(currentProblem.boardSize as BoardSize);
      const bx = Math.round((svgX - BOARD_PADDING) / cs);
      const by = Math.round((svgY - BOARD_PADDING) / cs);

      if (bx < 0 || bx >= currentProblem.boardSize || by < 0 || by >= currentProblem.boardSize) return;

      const played: Point = { x: bx, y: by };
      const result = applyProblemMove(currentProblem, problemState.game, problemState.currentNodes, played);
      const newAttempts = problemState.attempts + 1;

      setFeedbackPoint({ point: played, correct: result.status !== 'wrong' });
      setTimeout(() => setFeedbackPoint(null), 600);

      if (result.status === 'wrong') {
        const failed = newAttempts >= 3;
        setProblemState((s) => ({
          ...s,
          attempts: newAttempts,
          feedback: result.message ?? 'Incorrect.',
          status: failed ? 'failed' : 'playing',
        }));
      } else if (result.status === 'solved') {
        setProblemState((s) => ({
          ...s,
          game: result.game,
          status: 'solved',
          feedback: result.message ?? 'Solved!',
        }));
      } else {
        // correct, continue
        setProblemState((s) => ({
          ...s,
          game: result.game,
          currentNodes: result.nextNodes ?? [],
          feedback: result.message ?? 'Good move!',
        }));
      }
    },
    [currentProblem, problemState],
  );

  // --- Advance to next problem ---
  const handleNext = useCallback(() => {
    if (!currentProblem) return;

    const solved = problemState.status === 'solved';
    const reviewAttempts = solved ? problemState.attempts + 1 : problemState.attempts;
    recordAttempt(currentProblem.id, solved, reviewAttempts, problemState.showHint);
    for (const conceptId of PROBLEM_CONCEPTS[currentProblem.category] ?? []) {
      recordEvidence(conceptId, solved ? 'review_solved' : 'review_failed');
    }

    const newResults = [
      ...review.results,
      { problemId: currentProblem.id, solved, attempts: reviewAttempts },
    ];
    const nextIndex = review.currentIndex + 1;

    if (nextIndex >= review.problemIds.length) {
      setReview({ ...review, currentIndex: nextIndex, results: newResults, phase: 'complete' });
    } else {
      setReview({ ...review, currentIndex: nextIndex, results: newResults, phase: 'reviewing' });
      const nextProblem = PROBLEMS.find((problem) => problem.id === review.problemIds[nextIndex]);
      if (!nextProblem) return;
      setProblemState(initProblemState(nextProblem));
    }
  }, [currentProblem, problemState, review, recordAttempt, recordEvidence]);

  // =======================================================================
  // NO PROBLEMS DUE / COMPLETE
  // =======================================================================
  if (review.problemIds.length === 0 || review.phase === 'complete') {
    const stats = getReviewStats();
    const summary = buildReviewSessionSummary(review.results);
    const replayProblem = summary.attentionProblems[0]?.problem ?? null;
    const seedProblem = getRecommendedProblem(problemAttempts);
    const learningPathLabel = review.results.length > 0 && !summary.practiceCategory
      ? 'Pick up next recommendation'
      : 'Learning path';

    return (
      <div className="flex-1 flex items-center justify-center p-6" style={{ backgroundColor: COLORS.ui.bgPrimary }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg p-8 rounded-2xl"
          style={{ backgroundColor: COLORS.ui.bgCard }}
        >
          {review.results.length > 0 ? (
            <>
              <h2 className="text-center text-2xl font-bold mb-2" style={{ color: COLORS.ui.accent }}>
                ✅ Review Complete!
              </h2>
              <p className="text-center text-4xl font-bold mb-4" style={{ color: COLORS.overlay.positive }}>
                {summary.solvedCount}/{summary.totalCount}
              </p>
              <p className="text-center text-sm mb-1" style={{ color: COLORS.ui.textPrimary }}>
                Accuracy: {summary.accuracy}%
              </p>
              <p className="text-center text-sm mb-4" style={{ color: COLORS.ui.textSecondary }}>
                🔥 {stats.streak} day streak
              </p>
              <div
                className="mt-5 border-t pt-5 text-left"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <p className="text-xs font-semibold uppercase" style={{ color: COLORS.ui.textSecondary }}>
                  Next step
                </p>
                <h3 className="mt-2 text-lg font-bold" style={{ color: COLORS.ui.textPrimary }}>
                  {summary.headline}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                  {summary.nextStep}
                </p>
                {summary.tone === 'advance' && (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                    Review finish line reached: every due card landed cleanly, so the path can move to the next recommendation.
                  </p>
                )}
                {summary.attentionProblems.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase" style={{ color: COLORS.ui.textSecondary }}>
                      Needs attention
                    </p>
                    <ul className="mt-2 space-y-2">
                      {summary.attentionProblems.slice(0, 3).map(({ problem, solved, attempts, replayMoveLabel }) => {
                        const reviewStatus = solved ? `${attempts} attempts` : 'missed';
                        const replayCue = replayMoveLabel ? `${reviewStatus} - replay ${replayMoveLabel}` : reviewStatus;

                        return (
                          <li key={problem.id} className="text-sm" style={{ color: COLORS.ui.textPrimary }}>
                            <span className="font-semibold">{problem.title}</span>
                            {' '}
                            <span className="ml-2" style={{ color: COLORS.ui.textSecondary }}>
                              {replayCue}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-center text-2xl font-bold mb-2" style={{ color: COLORS.ui.accent }}>
                🎉 All caught up!
              </h2>
              <p className="text-center text-sm mb-4" style={{ color: COLORS.ui.textSecondary }}>
                No problems due for review. Solve more problems to build your review queue.
              </p>
              <div
                className="mt-5 border-t pt-5 text-left"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <p className="text-xs font-semibold uppercase" style={{ color: COLORS.ui.textSecondary }}>
                  Best next step
                </p>
                <h3 className="mt-2 text-lg font-bold" style={{ color: COLORS.ui.textPrimary }}>
                  Seed tomorrow&apos;s review
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                  Solve one fresh problem now. If it takes extra attempts or a hint, Go Sensei will bring it back when
                  the lesson is ready to stick.
                </p>
              </div>
              {stats.streak > 0 && (
                <p className="text-center text-sm mb-4" style={{ color: COLORS.overlay.positive }}>
                  🔥 {stats.streak} day streak — keep it going!
                </p>
              )}
            </>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {review.results.length > 0 && summary.practiceCategory && summary.practiceLabel && (
              <button
                onClick={() => {
                  if (replayProblem) {
                    showProblems(replayProblem.category);
                    startProblem(replayProblem);
                  } else {
                    showProblems(summary.practiceCategory ?? undefined);
                  }
                }}
                className="px-6 py-2 rounded-lg text-sm font-medium transition-transform hover:scale-[1.02] active:scale-95"
                style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
              >
                {replayProblem ? `Replay ${replayProblem.title}` : summary.practiceLabel}
              </button>
            )}
            {review.results.length === 0 && (
              <button
                onClick={() => {
                  if (seedProblem) {
                    startProblem(seedProblem);
                  } else {
                    showProblems();
                  }
                }}
                className="px-6 py-2 rounded-lg text-sm font-medium transition-transform hover:scale-[1.02] active:scale-95"
                style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
              >
                {seedProblem ? `Start ${seedProblem.title}` : 'Solve a fresh problem'}
              </button>
            )}
            <button
              onClick={showLearningPath}
              aria-label={`${learningPathLabel} from review summary`}
              className="px-6 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: review.results.length > 0 && !summary.practiceCategory ? COLORS.ui.accent : COLORS.ui.bgCard,
                color: review.results.length > 0 && !summary.practiceCategory ? COLORS.ui.bgPrimary : COLORS.ui.textPrimary,
              }}
            >
              {learningPathLabel}
            </button>
            <button
              onClick={returnToGame}
              aria-label="Return to board from review summary"
              className="px-6 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: COLORS.ui.bgCard, color: COLORS.ui.textSecondary }}
            >
              Return to board
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // =======================================================================
  // REVIEWING
  // =======================================================================
  if (!currentProblem) return null;

  const boardSize = currentProblem.boardSize as BoardSize;
  const r = stoneRadius(boardSize);
  const playerColor = currentProblem.playerColor;
  const solutionSteps = getPrimarySolutionLine(currentProblem);
  const solutionTakeaway = getProblemSolutionTakeaway(currentProblem, solutionSteps);
  const firstStudentSolutionStep = solutionSteps.find((step) => step.role === 'student') ?? null;
  const firstStudentMoveLabel = firstStudentSolutionStep
    ? formatProblemPoint(firstStudentSolutionStep.move, boardSize)
    : null;
  const revealSolution = problemState.status !== 'playing';
  const hintActionLabel = problemState.showHint ? 'Hint shown' : 'Show hint';

  return (
    <div
      data-testid="daily-review-shell"
      className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden md:flex-row md:overflow-hidden"
    >
      {/* ---- Left: Board area ---- */}
      <div
        data-testid="daily-review-board-panel"
        className="flex-none flex min-h-[340px] shrink-0 items-center justify-center overflow-hidden p-4 min-w-0 relative md:flex-[7] md:min-h-0 md:shrink md:overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(circle at center, ${COLORS.board.bg}15 0%, transparent 70%)` }}
        />

        <div data-testid="daily-review-board-frame" className="relative aspect-square h-full max-h-[600px] max-w-full">
          <svg
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="h-full w-full select-none"
            style={{ cursor: problemState.status === 'playing' ? 'crosshair' : 'default' }}
            onClick={handleBoardClick}
          >
          <defs>
            <radialGradient id="review-black-stone" cx="35%" cy="35%">
              <stop offset="0%" stopColor={COLORS.stone.blackShine} />
              <stop offset="100%" stopColor={COLORS.stone.black} />
            </radialGradient>
            <radialGradient id="review-white-stone" cx="35%" cy="35%">
              <stop offset="0%" stopColor={COLORS.stone.whiteShine} />
              <stop offset="100%" stopColor={COLORS.stone.whiteShadow} />
            </radialGradient>
            <filter id="review-shadow" x="-20%" y="-20%" width="140%" height="140%">
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

          <ReviewBoardGrid boardSize={boardSize} />
          <ReviewCoordinateLabels boardSize={boardSize} />

          {/* Runtime board stones */}
          {problemState.game.board.grid.map((row, y) =>
            row.map((cell, x) => {
              if (!cell) return null;
              const { cx, cy } = pointToSvg({ x, y }, boardSize);
              return (
                <circle
                  key={`review-stone-${x}-${y}-${cell}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={cell === 'black' ? 'url(#review-black-stone)' : 'url(#review-white-stone)'}
                  filter="url(#review-shadow)"
                />
              );
            }),
          )}

          {revealSolution && (
            <ProblemSolutionOverlay steps={solutionSteps} boardSize={boardSize} stoneRadius={r} />
          )}

          {/* Feedback animation */}
          <AnimatePresence>
            {feedbackPoint && (() => {
              const { cx, cy } = pointToSvg(feedbackPoint.point, boardSize);
              const color = feedbackPoint.correct ? COLORS.overlay.positive : COLORS.overlay.danger;
              return (
                <motion.circle
                  key="feedback"
                  cx={cx}
                  cy={cy}
                  r={r * 0.7}
                  fill={`${color}60`}
                  stroke={color}
                  strokeWidth={3}
                  initial={{ scale: 0.3, opacity: 1 }}
                  animate={feedbackPoint.correct
                    ? { scale: 1.5, opacity: 0 }
                    : { x: [0, -4, 4, -4, 4, 0], scale: 1, opacity: [1, 1, 1, 1, 1, 0] }
                  }
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
              );
            })()}
          </AnimatePresence>
          </svg>
        </div>
      </div>

      {/* ---- Right: Info panel ---- */}
      <div
        data-testid="daily-review-sidebar"
        className="flex-none flex h-[54dvh] min-h-[300px] max-h-[600px] min-w-0 flex-col border-t md:flex-[3] md:min-h-0 md:h-auto md:max-h-none md:min-w-[280px] md:max-w-[400px] md:border-t-0 md:border-l"
        style={{ borderColor: COLORS.ui.bgCard, backgroundColor: COLORS.ui.bgPrimary }}
      >
        {/* Progress header */}
        <div className="shrink-0 p-4 border-b" style={{ borderColor: COLORS.ui.bgCard }}>
          <div className="text-xs mb-2" style={{ color: COLORS.ui.textSecondary }}>
            Problem {review.currentIndex + 1} of {review.problemIds.length}
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: COLORS.ui.bgCard }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(review.currentIndex / review.problemIds.length) * 100}%`,
                backgroundColor: COLORS.ui.accent,
              }}
            />
          </div>
        </div>

        {/* Problem info */}
        <div className="shrink-0 p-4 border-b" style={{ borderColor: COLORS.ui.bgCard }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <h2 className="text-lg font-bold" style={{ color: COLORS.ui.textPrimary }}>
              {currentProblem.title}
            </h2>
          </div>
          <p className="mt-1 text-xs" style={{ color: COLORS.ui.textSecondary }}>
            {currentProblem.description}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs" style={{ color: COLORS.ui.accent }}>
              {'★'.repeat(currentProblem.difficulty)}{'☆'.repeat(5 - currentProblem.difficulty)}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${COLORS.ui.accent}25`, color: COLORS.ui.accent }}
            >
              {currentProblem.category}
            </span>
            <span className="text-xs" style={{ color: COLORS.ui.textSecondary }}>
              Play as {playerColor}
            </span>
          </div>
        </div>

        {/* Status area */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {problemState.showHint && currentProblem.hint && (
            <motion.div
              className="mb-3 rounded-lg p-3"
              style={{ backgroundColor: `${COLORS.overlay.suggestion}15`, border: `1px solid ${COLORS.overlay.suggestion}40` }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm" style={{ color: COLORS.overlay.suggestion }}>
                💡 {currentProblem.hint}
              </p>
            </motion.div>
          )}

          {problemState.status === 'playing' && (
            <ProblemReadingPlan category={currentProblem.category} />
          )}

          {/* Status banner */}
          <AnimatePresence mode="wait">
            {problemState.status === 'solved' && (
              <motion.div
                key="solved"
                className="mb-3 rounded-xl p-4 text-center"
                style={{ backgroundColor: `${COLORS.overlay.positive}20`, border: `1px solid ${COLORS.overlay.positive}60` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <p className="text-lg font-bold" style={{ color: COLORS.overlay.positive }}>
                  🎉 Solved!
                </p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                  {firstStudentMoveLabel
                    ? `You found ${firstStudentMoveLabel}. Review the sequence once before finishing this card.`
                    : 'Review the sequence once before finishing this card.'}
                </p>
              </motion.div>
            )}
            {problemState.status === 'failed' && (
              <motion.div
                key="failed"
                className="mb-3 rounded-xl p-4 text-center"
                style={{ backgroundColor: `${COLORS.overlay.danger}20`, border: `1px solid ${COLORS.overlay.danger}60` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <p className="text-lg font-bold" style={{ color: COLORS.overlay.danger }}>
                  Study the answer
                </p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                  {firstStudentMoveLabel
                    ? `Replay ${firstStudentMoveLabel} before finishing, so this review becomes tomorrow's memory.`
                    : 'Replay the numbered line before finishing, so this review becomes tomorrow\'s memory.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feedback text */}
          {problemState.feedback && (
            <motion.div
              className="mb-3 rounded-xl p-4"
              style={{ backgroundColor: COLORS.ui.bgCard }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                {problemState.feedback}
              </p>
            </motion.div>
          )}

          {revealSolution && (
            <ProblemSolutionPanel steps={solutionSteps} boardSize={boardSize} takeaway={solutionTakeaway} />
          )}

          {/* Attempts counter */}
          {problemState.status === 'playing' && problemState.attempts > 0 && (
            <p className="mb-3 text-xs" style={{ color: COLORS.ui.textSecondary }}>
              Attempt {problemState.attempts}/3
            </p>
          )}

          {/* Playing prompt */}
          {problemState.status === 'playing' && (
            <motion.div
              className="rounded-lg p-3"
              style={{ backgroundColor: `${COLORS.ui.accent}15`, border: `1px solid ${COLORS.ui.accent}40` }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm font-medium" style={{ color: COLORS.ui.accent }}>
                👆 Read first, then click your move
              </p>
            </motion.div>
          )}
        </div>

        {/* Action buttons */}
        <div className="shrink-0 p-4 border-t flex flex-col gap-3" style={{ borderColor: COLORS.ui.bgCard }}>
          {currentProblem.hint && problemState.status === 'playing' && (
            <button
              onClick={() => setProblemState((s) => ({ ...s, showHint: true }))}
              disabled={problemState.showHint}
              aria-label={hintActionLabel}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: COLORS.ui.bgCard, color: COLORS.ui.textPrimary }}
            >
              {hintActionLabel}
            </button>
          )}
          {(problemState.status === 'solved' || problemState.status === 'failed') && (
            <button
              onClick={handleNext}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95"
              style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
            >
              {review.currentIndex + 1 < review.problemIds.length ? 'Next Problem →' : 'Finish Review'}
            </button>
          )}
          <button
            onClick={returnToGame}
            aria-label="Return to board from active review"
            className="text-sm text-center transition-opacity hover:opacity-100"
            style={{ color: COLORS.ui.textSecondary, opacity: 0.7 }}
          >
            Return to board
          </button>
        </div>
      </div>
    </div>
  );
}
