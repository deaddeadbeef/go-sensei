'use client';

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, cellSize } from '@/utils/coordinates';
import { motion } from 'framer-motion';

export function InfluenceOverlay() {
  const influence = useGameStore((s) => s.overlays.influence);
  const boardSize = useGameStore((s) => s.game.board.size);

  if (influence.length === 0) return null;

  const cell = cellSize(boardSize);

  return (
    <motion.g
      className="influence-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {influence.map((inf) => {
        const { cx, cy } = pointToSvg(inf.point, boardSize);
        const abs = Math.abs(inf.value);
        // blue for black influence, orange for white influence
        const color = inf.value < 0 ? '59, 130, 246' : '249, 115, 22';
        return (
          <rect
            key={`inf-${inf.point.x}-${inf.point.y}`}
            x={cx - cell / 2}
            y={cy - cell / 2}
            width={cell}
            height={cell}
            fill={`rgba(${color}, ${abs * 0.35})`}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}
    </motion.g>
  );
}
