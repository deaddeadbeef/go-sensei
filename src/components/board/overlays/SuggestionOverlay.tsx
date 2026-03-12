"use client";

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';
import { SUGGESTION_PULSE_CYCLE } from '@/utils/animation';
import { motion, AnimatePresence } from 'framer-motion';

export function SuggestionOverlay() {
  const suggestions = useGameStore((s) => s.overlays.suggestions);
  const boardSize = useGameStore((s) => s.game.board.size);

  if (suggestions.length === 0) return null;

  const r = stoneRadius(boardSize);

  return (
    <AnimatePresence>
      {suggestions.map((sg) => {
        const { cx, cy } = pointToSvg(sg.point, boardSize);
        const isBest = sg.rank === 1;

        return (
          <g key={sg.id}>
            <motion.circle
              cx={cx}
              cy={cy}
              r={r}
              fill={COLORS.overlay.suggestion}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: [0, isBest ? 0.5 : 0.35, isBest ? 0.3 : 0.2],
                scale: [0.5, 1.05, 0.95],
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                duration: SUGGESTION_PULSE_CYCLE,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
            {/* Rank label */}
            <motion.text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#fff"
              fontSize={r * 0.8}
              fontWeight="bold"
              fontFamily="sans-serif"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              exit={{ opacity: 0 }}
              pointerEvents="none"
            >
              {String(sg.rank)}
            </motion.text>
          </g>
        );
      })}
    </AnimatePresence>
  );
}
