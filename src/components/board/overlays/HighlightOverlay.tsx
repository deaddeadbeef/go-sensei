"use client";

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';
import { OVERLAY_FADE_IN, OVERLAY_STAGGER, DANGER_PULSE_CYCLE } from '@/utils/animation';
import { motion, AnimatePresence } from 'framer-motion';

const variantColors: Record<string, string> = {
  positive: COLORS.overlay.positive,
  warning: COLORS.overlay.warning,
  danger: COLORS.overlay.danger,
  neutral: COLORS.overlay.suggestion,
};

export function HighlightOverlay() {
  const highlights = useGameStore((s) => s.overlays.highlights);
  const boardSize = useGameStore((s) => s.game.board.size);

  if (highlights.length === 0) return null;

  return (
    <AnimatePresence>
      {highlights.map((h, i) => {
        const { cx, cy } = pointToSvg(h.point, boardSize);
        const r = stoneRadius(boardSize) * 1.1;
        const color = variantColors[h.variant] || COLORS.overlay.suggestion;
        const isDanger = h.variant === 'danger' || h.variant === 'warning';

        return (
          <motion.circle
            key={h.id}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: [0, 0.8, isDanger ? 0.4 : 0.7],
              scale: isDanger ? [0.5, 1.1, 0.95, 1.05] : [0.5, 1],
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{
              duration: isDanger ? DANGER_PULSE_CYCLE : OVERLAY_FADE_IN,
              delay: i * OVERLAY_STAGGER,
              repeat: isDanger ? Infinity : 0,
              repeatType: 'reverse',
            }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
        );
      })}
    </AnimatePresence>
  );
}
