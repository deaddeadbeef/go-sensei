'use client';

import { useGameStore } from '@/stores/game-store';
import { AnimatePresence, motion } from 'framer-motion';

const variantColors: Record<string, string> = {
  positive: '#4ade80',
  warning: '#f59e0b',
  danger: '#ef4444',
  neutral: '#818cf8',
};

const ARROW_COLOR = '#fbbf24';
const GROUP_COLORS = { black: '#3b82f6', white: '#f97316' } as const;

const GO_COLS = 'ABCDEFGHJKLMNOPQRST';

export function OverlayLegend() {
  const highlights = useGameStore((s) => s.overlays.highlights);
  const arrows = useGameStore((s) => s.overlays.arrows);
  const groups = useGameStore((s) => s.overlays.groups);
  const boardSize = useGameStore((s) => s.game.board.size);

  const labeledHighlights = highlights.filter((h) => h.label);
  const labeledArrows = arrows.filter((a) => a.label);
  const labeledGroups = groups.filter((g) => g.label);

  if (
    labeledHighlights.length === 0 &&
    labeledArrows.length === 0 &&
    labeledGroups.length === 0
  )
    return null;

  return (
    <AnimatePresence>
      <motion.div
        className="absolute bottom-2 left-2 flex flex-col gap-1 px-3 py-2 rounded-lg z-10"
        style={{
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          maxWidth: 220,
          maxHeight: 200,
          overflowY: 'auto',
          pointerEvents: 'auto',
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Highlight labels */}
        {labeledHighlights.map((h) => {
          const color = variantColors[h.variant] || variantColors.neutral;
          const coord = `${GO_COLS[h.point.x]}${boardSize - h.point.y}`;
          return (
            <div key={h.id} className="flex items-center gap-1.5">
              <span
                className="font-mono font-bold text-[11px] shrink-0"
                style={{ color, minWidth: 28 }}
              >
                {coord}
              </span>
              <span className="text-[11px] text-slate-200 leading-tight">
                {h.label}
              </span>
            </div>
          );
        })}

        {/* Arrow labels */}
        {labeledArrows.map((a) => (
          <div key={a.id} className="flex items-center gap-1.5">
            <span
              className="font-mono font-bold text-[11px] shrink-0"
              style={{ color: ARROW_COLOR, minWidth: 28 }}
            >
              {a.order}→
            </span>
            <span className="text-[11px] text-slate-200 leading-tight">
              {a.label}
            </span>
          </div>
        ))}

        {/* Group labels */}
        {labeledGroups.map((g) => (
          <div key={g.id} className="flex items-center gap-1.5">
            <span
              className="text-[11px] shrink-0"
              style={{ color: GROUP_COLORS[g.color], minWidth: 28 }}
            >
              ●
            </span>
            <span className="text-[11px] text-slate-200 leading-tight">
              {g.label}
            </span>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
