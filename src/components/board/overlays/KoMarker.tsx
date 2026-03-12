"use client";

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';
import { motion, AnimatePresence } from 'framer-motion';

export function KoMarker() {
  const koPoint = useGameStore((s) => s.game.koPoint);
  const boardSize = useGameStore((s) => s.game.board.size);

  if (!koPoint) return null;

  const { cx, cy } = pointToSvg(koPoint, boardSize);
  const r = stoneRadius(boardSize) * 0.35;

  return (
    <AnimatePresence>
      <motion.g
        key={`ko-${koPoint.x}-${koPoint.y}`}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 0.6, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* X marker */}
        <line
          x1={cx - r}
          y1={cy - r}
          x2={cx + r}
          y2={cy + r}
          stroke={COLORS.overlay.danger}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={cx + r}
          y1={cy - r}
          x2={cx - r}
          y2={cy + r}
          stroke={COLORS.overlay.danger}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </motion.g>
    </AnimatePresence>
  );
}
