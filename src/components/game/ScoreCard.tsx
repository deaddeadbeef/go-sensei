"use client";
import { useGameStore } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';
import { motion, AnimatePresence } from 'framer-motion';
import { SCORE_LINE_STAGGER } from '@/utils/animation';

interface ScoreCardProps {
  onPlayAgain: () => void;
  onReviewGame?: () => void;
}

export function ScoreCard({ onPlayAgain, onReviewGame }: ScoreCardProps) {
  const scorecard = useGameStore((s) => s.scorecard);
  if (!scorecard?.visible) return null;

  const lines = [
    { label: 'Territory', black: scorecard.blackTerritory, white: scorecard.whiteTerritory },
    { label: 'Captures', black: scorecard.blackCaptures, white: scorecard.whiteCaptures },
    { label: 'Komi', black: 0, white: scorecard.komi },
    { label: 'Total', black: scorecard.blackScore, white: scorecard.whiteScore },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 rounded-xl p-5 shadow-2xl min-w-64"
        style={{ backgroundColor: COLORS.ui.bgCard + 'f5' }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
      >
        <div className="flex justify-center gap-8 mb-3 text-sm font-bold" style={{ color: COLORS.ui.textPrimary }}>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-black inline-block" /> Black
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-white inline-block border border-gray-400" /> White
          </span>
        </div>
        {lines.map((line, i) => (
          <motion.div
            key={line.label}
            className="flex justify-between text-xs py-1"
            style={{
              color: line.label === 'Total' ? COLORS.ui.textPrimary : COLORS.ui.textSecondary,
              fontWeight: line.label === 'Total' ? 'bold' : 'normal',
              borderTop: line.label === 'Total' ? `1px solid ${COLORS.ui.textSecondary}40` : 'none',
            }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * SCORE_LINE_STAGGER }}
          >
            <span className="w-20">{line.label}</span>
            <span className="w-12 text-center">{line.black}</span>
            <span className="w-12 text-center">{line.white}</span>
          </motion.div>
        ))}
        <motion.div
          className="text-center mt-3 text-sm font-bold"
          style={{ color: COLORS.ui.accent }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: lines.length * SCORE_LINE_STAGGER }}
        >
          {scorecard.winner === 'black' ? '● Black wins!' : scorecard.winner === 'white' ? '○ White wins!' : "It's a draw!"}
        </motion.div>
        <motion.div
          className="flex gap-2 mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: (lines.length + 1) * SCORE_LINE_STAGGER }}
        >
          <button
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
            onClick={onPlayAgain}
          >
            Play Again
          </button>
          {onReviewGame && (
            <button
              onClick={onReviewGame}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: 'transparent',
                color: COLORS.ui.accent,
                border: `1px solid ${COLORS.ui.accent}`,
              }}
            >
              📋 Review Game
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
