'use client';

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, cellSize } from '@/utils/coordinates';
import { OVERLAY_FADE_IN, OVERLAY_STAGGER } from '@/utils/animation';
import { motion, AnimatePresence } from 'framer-motion';

export function GroupOverlay() {
  const groups = useGameStore((s) => s.overlays.groups);
  const boardSize = useGameStore((s) => s.game.board.size);

  if (groups.length === 0) return null;

  const cell = cellSize(boardSize);
  const r = cell * 0.52;

  return (
    <AnimatePresence>
      {groups.map((group, gi) => {
        const isWeak = group.liberties <= 2;
        const fill =
          group.color === 'black'
            ? 'rgba(59, 130, 246, 0.15)'
            : 'rgba(249, 115, 22, 0.15)';
        const stroke = isWeak ? '#ef4444' : group.color === 'black' ? '#3b82f6' : '#f97316';

        // Find top-left stone for liberty badge (min y, then min x)
        const sorted = [...group.stones].sort((a, b) => a.y - b.y || a.x - b.x);
        const badgeStone = sorted[0];
        const badge = badgeStone ? pointToSvg(badgeStone, boardSize) : null;

        // Compute centroid for label
        const cx = group.stones.reduce((sum, s) => sum + s.x, 0) / group.stones.length;
        const cy = group.stones.reduce((sum, s) => sum + s.y, 0) / group.stones.length;
        const centroid = pointToSvg({ x: Math.round(cx), y: Math.round(cy) }, boardSize);

        return (
          <motion.g
            key={group.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: OVERLAY_FADE_IN, delay: gi * OVERLAY_STAGGER }}
          >
            {/* Highlight rect around each stone */}
            {group.stones.map((stone, si) => {
              const { cx: sx, cy: sy } = pointToSvg(stone, boardSize);
              return (
                <motion.rect
                  key={`${group.id}-s-${si}`}
                  x={sx - r}
                  y={sy - r}
                  width={r * 2}
                  height={r * 2}
                  rx={r * 0.3}
                  ry={r * 0.3}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isWeak ? 1.5 : 1}
                  strokeDasharray={isWeak ? '4 2' : undefined}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: OVERLAY_FADE_IN,
                    delay: gi * OVERLAY_STAGGER + si * 0.03,
                  }}
                  style={{ transformOrigin: `${sx}px ${sy}px`, pointerEvents: 'none' }}
                />
              );
            })}

            {/* Liberty count badge at top-left stone */}
            {badge && (
              <motion.g
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: OVERLAY_FADE_IN, delay: gi * OVERLAY_STAGGER + 0.1 }}
              >
                <circle
                  cx={badge.cx - r * 0.7}
                  cy={badge.cy - r * 0.7}
                  r={cell * 0.2}
                  fill={isWeak ? '#ef4444' : '#1e293b'}
                  opacity={0.9}
                />
                <text
                  x={badge.cx - r * 0.7}
                  y={badge.cy - r * 0.7}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={cell * 0.22}
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {group.liberties}
                </text>
              </motion.g>
            )}

            {/* Optional label at group centroid */}
            {group.label && (
              <motion.text
                x={centroid.cx}
                y={centroid.cy + r + cell * 0.25}
                textAnchor="middle"
                fill={isWeak ? '#ef4444' : '#334155'}
                fontSize={cell * 0.28}
                fontWeight="600"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: OVERLAY_FADE_IN, delay: gi * OVERLAY_STAGGER + 0.15 }}
                style={{ pointerEvents: 'none' }}
              >
                {group.label}
              </motion.text>
            )}
          </motion.g>
        );
      })}
    </AnimatePresence>
  );
}
