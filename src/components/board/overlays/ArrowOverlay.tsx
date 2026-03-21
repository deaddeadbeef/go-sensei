"use client";

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';
import { OVERLAY_FADE_IN, OVERLAY_STAGGER } from '@/utils/animation';
import { motion, AnimatePresence } from 'framer-motion';

const ARROW_COLOR = '#fbbf24'; // amber-400

export function ArrowOverlay() {
  const arrows = useGameStore((s) => s.overlays.arrows);
  const boardSize = useGameStore((s) => s.game.board.size);

  if (arrows.length === 0) return null;

  const r = stoneRadius(boardSize);
  const shortenBy = r * 0.6; // shorten lines so arrowheads don't overlap stones

  return (
    <AnimatePresence>
      <g key="arrow-overlay">
        {/* Arrowhead marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={ARROW_COLOR} />
          </marker>
        </defs>

        {arrows.map((arrow, i) => {
          const from = pointToSvg(arrow.from, boardSize);
          const to = pointToSvg(arrow.to, boardSize);

          // Shorten line at both ends so arrowhead doesn't cover stones
          const dx = to.cx - from.cx;
          const dy = to.cy - from.cy;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return null;

          const ux = dx / len;
          const uy = dy / len;
          const x1 = from.cx + ux * shortenBy;
          const y1 = from.cy + uy * shortenBy;
          const x2 = to.cx - ux * shortenBy;
          const y2 = to.cy - uy * shortenBy;

          return (
            <motion.g
              key={arrow.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: OVERLAY_FADE_IN,
                delay: i * OVERLAY_STAGGER,
              }}
            >
              {/* Arrow line */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={ARROW_COLOR}
                strokeWidth={2}
                markerEnd="url(#arrowhead)"
              />

              {/* Numbered circle at start */}
              <circle
                cx={from.cx}
                cy={from.cy}
                r={r * 0.45}
                fill={ARROW_COLOR}
              />
              <text
                x={from.cx}
                y={from.cy}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#000"
                fontSize={r * 0.55}
                fontWeight="bold"
                fontFamily="sans-serif"
                pointerEvents="none"
              >
                {arrow.order}
              </text>

            </motion.g>
          );
        })}
      </g>
    </AnimatePresence>
  );
}
