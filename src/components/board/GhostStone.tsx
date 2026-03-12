"use client";

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';
import { isValidMove } from '@/lib/go-engine';
import { motion, AnimatePresence } from 'framer-motion';

export function GhostStone() {
  const hoveredPoint = useGameStore((s) => s.hoveredPoint);
  const game = useGameStore((s) => s.game);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const phase = useGameStore((s) => s.phase);

  if (
    !hoveredPoint ||
    isAiThinking ||
    phase !== 'playing' ||
    game.currentPlayer !== 'black'
  )
    return null;

  const valid = isValidMove(game, hoveredPoint);
  if (!valid) return null;

  const { cx, cy } = pointToSvg(hoveredPoint, game.board.size);
  const r = stoneRadius(game.board.size);

  return (
    <AnimatePresence>
      <motion.circle
        key={`ghost-${hoveredPoint.x}-${hoveredPoint.y}`}
        cx={cx}
        cy={cy}
        r={r}
        fill="url(#black-stone-gradient)"
        opacity={0.35}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        pointerEvents="none"
      />
    </AnimatePresence>
  );
}
