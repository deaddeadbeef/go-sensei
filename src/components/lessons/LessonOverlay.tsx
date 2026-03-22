'use client';

import { motion } from 'framer-motion';
import type { LessonHighlight } from '@/lib/lessons/types';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';

const HIGHLIGHT_COLORS: Record<string, string> = {
  green: '#4ade80',
  red: '#ef4444',
  blue: '#60a5fa',
};

interface LessonOverlayProps {
  highlights: LessonHighlight[];
  boardSize: number;
}

export function LessonOverlay({ highlights, boardSize }: LessonOverlayProps) {
  if (highlights.length === 0) return null;
  const r = stoneRadius(boardSize);

  return (
    <g>
      {highlights.map((h, i) => {
        const { cx, cy } = pointToSvg(h.point, boardSize);
        const color = HIGHLIGHT_COLORS[h.color] ?? HIGHLIGHT_COLORS.green;
        return (
          <motion.g
            key={`${h.point.x}-${h.point.y}-${i}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={r * 0.55}
              fill={`${color}40`}
              stroke={color}
              strokeWidth={2}
            />
            {h.label && (
              <text
                x={cx}
                y={cy + r * 0.9}
                textAnchor="middle"
                fill={color}
                fontSize={r * 0.38}
                fontWeight="bold"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
              >
                {h.label}
              </text>
            )}
          </motion.g>
        );
      })}
    </g>
  );
}
