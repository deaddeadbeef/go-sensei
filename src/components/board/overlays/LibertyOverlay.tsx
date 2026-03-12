"use client";

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';
import { libertyColor } from '@/utils/colors';
import { motion, AnimatePresence } from 'framer-motion';

export function LibertyOverlay() {
  const liberties = useGameStore((s) => s.overlays.liberties);
  const boardSize = useGameStore((s) => s.game.board.size);

  if (liberties.length === 0) return null;

  const r = stoneRadius(boardSize);

  return (
    <AnimatePresence>
      {liberties.map((lib) => {
        const { cx, cy } = pointToSvg(lib.point, boardSize);
        const color = libertyColor(lib.count);
        const badgeR = r * 0.4;

        return (
          <g key={lib.id}>
            {/* Badge with count number */}
            <motion.circle
              cx={cx + r * 0.6}
              cy={cy - r * 0.6}
              r={badgeR}
              fill={color}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              style={{
                transformOrigin: `${cx + r * 0.6}px ${cy - r * 0.6}px`,
              }}
            />
            <motion.text
              x={cx + r * 0.6}
              y={cy - r * 0.6}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#fff"
              fontSize={badgeR * 1.2}
              fontWeight="bold"
              fontFamily="monospace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              pointerEvents="none"
            >
              {lib.count}
            </motion.text>

            {/* Small diamonds at actual liberty positions */}
            {lib.libertyPoints.map((lp, j) => {
              const { cx: lpx, cy: lpy } = pointToSvg(lp, boardSize);
              const dotSize = r * 0.2;
              return (
                <motion.rect
                  key={`lib-dot-${lp.x}-${lp.y}`}
                  x={lpx - dotSize / 2}
                  y={lpy - dotSize / 2}
                  width={dotSize}
                  height={dotSize}
                  fill={color}
                  opacity={0.6}
                  initial={{ scale: 0, rotate: 45 }}
                  animate={{ scale: 1, rotate: 45 }}
                  exit={{ scale: 0 }}
                  transition={{
                    delay: j * 0.05,
                    type: 'spring',
                    stiffness: 400,
                    damping: 20,
                  }}
                  style={{ transformOrigin: `${lpx}px ${lpy}px` }}
                />
              );
            })}
          </g>
        );
      })}
    </AnimatePresence>
  );
}
