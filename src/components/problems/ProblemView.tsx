'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useGameStore } from '@/stores/game-store';
import { PROBLEMS } from '@/lib/problems/problem-data';
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
import type { BoardSize } from '@/lib/go-engine/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST'; // skip I
const boardInset = BOARD_PADDING * 0.75;

// ---------------------------------------------------------------------------
// Board sub-components
// ---------------------------------------------------------------------------

function ProblemBoardGrid({ boardSize }: { boardSize: BoardSize }) {
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

function ProblemCoordinateLabels({ boardSize }: { boardSize: BoardSize }) {
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
// ProblemView
// ---------------------------------------------------------------------------

export function ProblemView() {
  const currentProblemId = useGameStore((s) => s.currentProblemId);
  const problemInteraction = useGameStore((s) => s.problemInteraction);
  const submitProblemMove = useGameStore((s) => s.submitProblemMove);
  const resetProblem = useGameStore((s) => s.resetProblem);
  const requestProblemHint = useGameStore((s) => s.requestProblemHint);
  const showProblems = useGameStore((s) => s.showProblems);
  const startProblem = useGameStore((s) => s.startProblem);

  // Feedback animation state
  const [feedbackPoint, setFeedbackPoint] = useState<{ x: number; y: number; type: 'correct' | 'wrong' } | null>(null);

  // Board sizing
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

  const problem = PROBLEMS.find((p) => p.id === currentProblemId);
  const boardSize = (problem?.boardSize ?? 9) as BoardSize;
  const r = stoneRadius(boardSize);

  const nextProblem = (() => {
    if (!problem) return null;
    const idx = PROBLEMS.findIndex((p) => p.id === problem.id);
    return idx >= 0 && idx < PROBLEMS.length - 1 ? PROBLEMS[idx + 1] : null;
  })();

  const handleBoardClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!problemInteraction.active || problemInteraction.status !== 'playing') return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * SVG_SIZE;
    const svgY = ((e.clientY - rect.top) / rect.height) * SVG_SIZE;

    const cell = cellSize(boardSize);
    const bx = Math.round((svgX - BOARD_PADDING) / cell);
    const by = Math.round((svgY - BOARD_PADDING) / cell);

    if (bx < 0 || bx >= boardSize || by < 0 || by >= boardSize) return;

    const result = submitProblemMove({ x: bx, y: by });
    if (result.status === 'wrong') {
      setFeedbackPoint({ x: bx, y: by, type: 'wrong' });
      setTimeout(() => setFeedbackPoint(null), 600);
    } else {
      setFeedbackPoint({ x: bx, y: by, type: 'correct' });
      setTimeout(() => setFeedbackPoint(null), 700);
    }
  }, [problemInteraction, boardSize, submitProblemMove]);

  if (!problem || !currentProblemId) return null;

  const playerColor = problem.playerColor;
  const opponentColor = playerColor === 'black' ? 'white' : 'black';

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
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="w-full h-full select-none"
              onClick={handleBoardClick}
              style={{ cursor: problemInteraction.active && problemInteraction.status === 'playing' ? 'crosshair' : 'default' }}
            >
              <defs>
                <radialGradient id="problem-black-stone" cx="35%" cy="35%">
                  <stop offset="0%" stopColor={COLORS.stone.blackShine} />
                  <stop offset="100%" stopColor={COLORS.stone.black} />
                </radialGradient>
                <radialGradient id="problem-white-stone" cx="35%" cy="35%">
                  <stop offset="0%" stopColor={COLORS.stone.whiteShine} />
                  <stop offset="100%" stopColor={COLORS.stone.whiteShadow} />
                </radialGradient>
                <filter id="problem-shadow" x="-20%" y="-20%" width="140%" height="140%">
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

              <ProblemBoardGrid boardSize={boardSize} />
              <ProblemCoordinateLabels boardSize={boardSize} />

              {/* Setup stones */}
              {problem.setupStones.map((s) => {
                const { cx, cy } = pointToSvg(s.point, boardSize);
                return (
                  <circle
                    key={`setup-${s.point.x}-${s.point.y}`}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={s.color === 'black' ? 'url(#problem-black-stone)' : 'url(#problem-white-stone)'}
                    filter="url(#problem-shadow)"
                  />
                );
              })}

              {/* Player moves */}
              {problemInteraction.playerMoves.map((pt, i) => {
                const { cx, cy } = pointToSvg(pt, boardSize);
                return (
                  <motion.circle
                    key={`player-${i}-${pt.x}-${pt.y}`}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={playerColor === 'black' ? 'url(#problem-black-stone)' : 'url(#problem-white-stone)'}
                    filter="url(#problem-shadow)"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                );
              })}

              {/* Opponent moves */}
              {problemInteraction.opponentMoves.map((pt, i) => {
                const { cx, cy } = pointToSvg(pt, boardSize);
                return (
                  <motion.circle
                    key={`opp-${i}-${pt.x}-${pt.y}`}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={opponentColor === 'black' ? 'url(#problem-black-stone)' : 'url(#problem-white-stone)'}
                    filter="url(#problem-shadow)"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.3 }}
                  />
                );
              })}

              {/* Feedback animation */}
              <AnimatePresence>
                {feedbackPoint && (() => {
                  const { cx, cy } = pointToSvg(feedbackPoint, boardSize);
                  const color = feedbackPoint.type === 'correct' ? '#4ade80' : '#ef4444';
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
                      animate={feedbackPoint.type === 'correct'
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
      </div>

      {/* ---- Right: Sidebar ---- */}
      <div
        className="flex-[3] flex flex-col md:min-w-[280px] md:max-w-[400px] border-t md:border-t-0 md:border-l"
        style={{ borderColor: COLORS.ui.bgCard, backgroundColor: COLORS.ui.bgPrimary }}
      >
        {/* Title */}
        <div className="shrink-0 p-4 border-b" style={{ borderColor: COLORS.ui.bgCard }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧩</span>
            <h2 className="text-lg font-bold" style={{ color: COLORS.ui.textPrimary }}>
              {problem.title}
            </h2>
          </div>
          <p className="mt-1 text-xs" style={{ color: COLORS.ui.textSecondary }}>
            {problem.description}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs" style={{ color: COLORS.ui.accent }}>
              {'★'.repeat(problem.difficulty)}{'☆'.repeat(5 - problem.difficulty)}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${COLORS.ui.accent}25`, color: COLORS.ui.accent }}
            >
              {problem.category}
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
            {problemInteraction.status === 'solved' && (
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
            {problemInteraction.status === 'failed' && (
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
          {problemInteraction.feedback && (
            <motion.div
              className="mb-3 rounded-xl p-4"
              style={{ backgroundColor: COLORS.ui.bgCard }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                {problemInteraction.feedback}
              </p>
            </motion.div>
          )}

          {/* Attempts counter */}
          {problemInteraction.status === 'playing' && problemInteraction.attempts > 0 && (
            <p className="mb-3 text-xs" style={{ color: COLORS.ui.textSecondary }}>
              Attempt {problemInteraction.attempts}/3
            </p>
          )}

          {/* Hint area */}
          {problemInteraction.showHint && problem.hint && (
            <motion.div
              className="mb-3 rounded-lg p-3"
              style={{ backgroundColor: `${COLORS.overlay.suggestion}15`, border: `1px solid ${COLORS.overlay.suggestion}40` }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm" style={{ color: COLORS.overlay.suggestion }}>
                💡 {problem.hint}
              </p>
            </motion.div>
          )}

          {/* Playing prompt */}
          {problemInteraction.status === 'playing' && (
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
          <div className="flex gap-2">
            {problemInteraction.status === 'playing' && (
              <>
                <button
                  onClick={requestProblemHint}
                  disabled={problemInteraction.showHint}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-30"
                  style={{ backgroundColor: COLORS.ui.bgCard, color: COLORS.ui.textPrimary }}
                >
                  💡 Hint
                </button>
                <button
                  onClick={resetProblem}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity"
                  style={{ backgroundColor: COLORS.ui.bgCard, color: COLORS.ui.textPrimary }}
                >
                  ↺ Reset
                </button>
              </>
            )}
            {problemInteraction.status === 'failed' && (
              <button
                onClick={resetProblem}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95"
                style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
              >
                Try Again
              </button>
            )}
            {problemInteraction.status === 'solved' && nextProblem && (
              <button
                onClick={() => startProblem(nextProblem)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95"
                style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
              >
                Next Problem →
              </button>
            )}
          </div>
          <button
            onClick={showProblems}
            className="text-sm text-center transition-opacity hover:opacity-100"
            style={{ color: COLORS.ui.textSecondary, opacity: 0.7 }}
          >
            ✕ Back to Problems
          </button>
        </div>
      </div>
    </div>
  );
}
