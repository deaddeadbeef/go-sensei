'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/stores/game-store';
import { useReviewStore } from '@/stores/review-store';
import { PROBLEMS } from '@/lib/problems/problem-data';
import type { Problem } from '@/lib/problems/types';
import type { MoveNode } from '@/lib/problems/types';
import { validateMove } from '@/lib/problems/validator';
import type { Point, BoardSize } from '@/lib/go-engine/types';
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
  currentIndex: number;
  results: Array<{ problemId: string; solved: boolean; attempts: number }>;
  phase: 'reviewing' | 'complete';
}

interface ProblemState {
  currentNodes: MoveNode[];
  playerMoves: Point[];
  opponentMoves: Point[];
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
    currentNodes: problem.solutionTree,
    playerMoves: [],
    opponentMoves: [],
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
  const getDueProblems = useReviewStore((s) => s.getDueProblems);
  const recordAttempt = useReviewStore((s) => s.recordAttempt);
  const getReviewStats = useReviewStore((s) => s.getReviewStats);

  const dueIds = getDueProblems();
  const dueProblems = dueIds
    .map((id) => PROBLEMS.find((p) => p.id === id))
    .filter(Boolean) as Problem[];

  const [review, setReview] = useState<ReviewState>({
    currentIndex: 0,
    results: [],
    phase: dueProblems.length > 0 ? 'reviewing' : 'complete',
  });

  const currentProblem = dueProblems[review.currentIndex] ?? null;

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
      const result = validateMove(problemState.currentNodes, played);
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
        const newPlayerMoves = [...problemState.playerMoves, played];
        const newOpponentMoves = result.opponentResponse
          ? [...problemState.opponentMoves, result.opponentResponse.move]
          : problemState.opponentMoves;
        setProblemState((s) => ({
          ...s,
          playerMoves: newPlayerMoves,
          opponentMoves: newOpponentMoves,
          status: 'solved',
          feedback: result.message ?? 'Solved!',
        }));
      } else {
        // correct, continue
        const newPlayerMoves = [...problemState.playerMoves, played];
        const newOpponentMoves = result.opponentResponse
          ? [...problemState.opponentMoves, result.opponentResponse.move]
          : problemState.opponentMoves;
        setProblemState((s) => ({
          ...s,
          playerMoves: newPlayerMoves,
          opponentMoves: newOpponentMoves,
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
    recordAttempt(currentProblem.id, solved, problemState.attempts, problemState.showHint);

    const newResults = [
      ...review.results,
      { problemId: currentProblem.id, solved, attempts: problemState.attempts },
    ];
    const nextIndex = review.currentIndex + 1;

    if (nextIndex >= dueProblems.length) {
      setReview({ currentIndex: nextIndex, results: newResults, phase: 'complete' });
    } else {
      setReview({ currentIndex: nextIndex, results: newResults, phase: 'reviewing' });
      const nextProblem = dueProblems[nextIndex];
      setProblemState(initProblemState(nextProblem));
    }
  }, [currentProblem, problemState, review, dueProblems, recordAttempt]);

  // =======================================================================
  // NO PROBLEMS DUE / COMPLETE
  // =======================================================================
  if (dueProblems.length === 0 || review.phase === 'complete') {
    const stats = getReviewStats();
    const accuracy =
      review.results.length > 0
        ? Math.round((review.results.filter((r) => r.solved).length / review.results.length) * 100)
        : 0;

    return (
      <div className="flex-1 flex items-center justify-center p-6" style={{ backgroundColor: COLORS.ui.bgPrimary }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md p-8 rounded-2xl"
          style={{ backgroundColor: COLORS.ui.bgCard }}
        >
          {review.results.length > 0 ? (
            <>
              <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.ui.accent }}>
                ✅ Review Complete!
              </h2>
              <p className="text-4xl font-bold mb-4" style={{ color: COLORS.overlay.positive }}>
                {review.results.filter((r) => r.solved).length}/{review.results.length}
              </p>
              <p className="text-sm mb-1" style={{ color: COLORS.ui.textPrimary }}>
                Accuracy: {accuracy}%
              </p>
              <p className="text-sm mb-4" style={{ color: COLORS.ui.textSecondary }}>
                🔥 {stats.streak} day streak
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.ui.accent }}>
                🎉 All caught up!
              </h2>
              <p className="text-sm mb-4" style={{ color: COLORS.ui.textSecondary }}>
                No problems due for review. Solve more problems to build your review queue.
              </p>
              {stats.streak > 0 && (
                <p className="text-sm mb-4" style={{ color: COLORS.overlay.positive }}>
                  🔥 {stats.streak} day streak — keep it going!
                </p>
              )}
            </>
          )}
          <button
            onClick={returnToGame}
            className="px-6 py-2 rounded-lg text-sm font-medium transition-transform hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
          >
            Back to Game
          </button>
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
  const opponentColor = playerColor === 'black' ? 'white' : 'black';

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* ---- Left: Board area ---- */}
      <div className="flex-[7] flex items-center justify-center p-4 min-w-0 min-h-0 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(circle at center, ${COLORS.board.bg}15 0%, transparent 70%)` }}
        />

        <svg
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="w-full h-full max-w-[600px] max-h-[600px] select-none"
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

          {/* Setup stones */}
          {currentProblem.setupStones.map((s) => {
            const { cx, cy } = pointToSvg(s.point, boardSize);
            return (
              <circle
                key={`setup-${s.point.x}-${s.point.y}`}
                cx={cx}
                cy={cy}
                r={r}
                fill={s.color === 'black' ? 'url(#review-black-stone)' : 'url(#review-white-stone)'}
                filter="url(#review-shadow)"
              />
            );
          })}

          {/* Player moves */}
          {problemState.playerMoves.map((pt, i) => {
            const { cx, cy } = pointToSvg(pt, boardSize);
            return (
              <motion.circle
                key={`player-${i}-${pt.x}-${pt.y}`}
                cx={cx}
                cy={cy}
                r={r}
                fill={playerColor === 'black' ? 'url(#review-black-stone)' : 'url(#review-white-stone)'}
                filter="url(#review-shadow)"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
            );
          })}

          {/* Opponent moves */}
          {problemState.opponentMoves.map((pt, i) => {
            const { cx, cy } = pointToSvg(pt, boardSize);
            return (
              <motion.circle
                key={`opp-${i}-${pt.x}-${pt.y}`}
                cx={cx}
                cy={cy}
                r={r}
                fill={opponentColor === 'black' ? 'url(#review-black-stone)' : 'url(#review-white-stone)'}
                filter="url(#review-shadow)"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.3 }}
              />
            );
          })}

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

      {/* ---- Right: Info panel ---- */}
      <div
        className="flex-[3] flex flex-col md:min-w-[280px] md:max-w-[400px] border-t md:border-t-0 md:border-l"
        style={{ borderColor: COLORS.ui.bgCard, backgroundColor: COLORS.ui.bgPrimary }}
      >
        {/* Progress header */}
        <div className="shrink-0 p-4 border-b" style={{ borderColor: COLORS.ui.bgCard }}>
          <div className="text-xs mb-2" style={{ color: COLORS.ui.textSecondary }}>
            Problem {review.currentIndex + 1} of {dueProblems.length}
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: COLORS.ui.bgCard }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(review.currentIndex / dueProblems.length) * 100}%`,
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
                  ✕ Failed
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

          {/* Attempts counter */}
          {problemState.status === 'playing' && problemState.attempts > 0 && (
            <p className="mb-3 text-xs" style={{ color: COLORS.ui.textSecondary }}>
              Attempt {problemState.attempts}/3
            </p>
          )}

          {/* Hint area */}
          {currentProblem.hint && !problemState.showHint && problemState.status === 'playing' && (
            <button
              onClick={() => setProblemState((s) => ({ ...s, showHint: true }))}
              className="text-xs mb-3 underline"
              style={{ color: COLORS.ui.textSecondary }}
            >
              Show hint
            </button>
          )}
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

          {/* Playing prompt */}
          {problemState.status === 'playing' && (
            <motion.div
              className="rounded-lg p-3"
              style={{ backgroundColor: `${COLORS.ui.accent}15`, border: `1px solid ${COLORS.ui.accent}40` }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm font-medium" style={{ color: COLORS.ui.accent }}>
                👆 Click the board to make your move
              </p>
            </motion.div>
          )}
        </div>

        {/* Action buttons */}
        <div className="shrink-0 p-4 border-t flex flex-col gap-3" style={{ borderColor: COLORS.ui.bgCard }}>
          {(problemState.status === 'solved' || problemState.status === 'failed') && (
            <button
              onClick={handleNext}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95"
              style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
            >
              {review.currentIndex + 1 < dueProblems.length ? 'Next Problem →' : 'Finish Review'}
            </button>
          )}
          <button
            onClick={returnToGame}
            className="text-sm text-center transition-opacity hover:opacity-100"
            style={{ color: COLORS.ui.textSecondary, opacity: 0.7 }}
          >
            ✕ Back to Game
          </button>
        </div>
      </div>
    </div>
  );
}
