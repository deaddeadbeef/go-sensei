'use client';

import { useGameStore } from '@/stores/game-store';
import { motion, AnimatePresence } from 'framer-motion';

const variantColors: Record<string, string> = {
  positive: '#4ade80',
  warning: '#f59e0b',
  danger: '#ef4444',
  neutral: '#818cf8',
};
const ARROW_COLOR = '#fbbf24';
const GROUP_COLORS: Record<string, string> = { black: '#3b82f6', white: '#f97316' };
const GO_COLS = 'ABCDEFGHJKLMNOPQRST';

function coordLabel(x: number, y: number, boardSize: number): string {
  return `${GO_COLS[x]}${boardSize - y}`;
}

export function TeachingPanel() {
  const highlights = useGameStore((s) => s.overlays.highlights);
  const arrows = useGameStore((s) => s.overlays.arrows);
  const groups = useGameStore((s) => s.overlays.groups);
  const boardSize = useGameStore((s) => s.game.board.size);

  const labeledHighlights = highlights.filter((h) => h.label);
  const labeledArrows = arrows.filter((a) => a.label);
  const labeledGroups = groups.filter((g) => g.label);

  const hasContent = labeledHighlights.length + labeledArrows.length + labeledGroups.length > 0;

  return (
    <AnimatePresence>
      {hasContent && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="border-y border-white/10 overflow-hidden"
        >
          <div className="px-3 py-2 max-h-48 overflow-y-auto thin-scrollbar">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
              📋 Board Analysis
            </div>
            <div className="space-y-1">
              {labeledHighlights.map((h) => (
                <div key={h.id} className="flex items-start gap-1.5">
                  <span
                    className="shrink-0 rounded px-1 py-0.5 text-[10px] font-mono font-bold leading-none"
                    style={{
                      backgroundColor: `${variantColors[h.variant] ?? variantColors.neutral}33`,
                      color: variantColors[h.variant] ?? variantColors.neutral,
                    }}
                  >
                    {coordLabel(h.point.x, h.point.y, boardSize)}
                  </span>
                  <span className="text-xs text-white/70 leading-tight">{h.label}</span>
                </div>
              ))}
              {labeledArrows.map((a) => (
                <div key={a.id} className="flex items-start gap-1.5">
                  <span
                    className="shrink-0 rounded px-1 py-0.5 text-[10px] font-mono font-bold leading-none"
                    style={{ backgroundColor: `${ARROW_COLOR}33`, color: ARROW_COLOR }}
                  >
                    {a.order}→
                  </span>
                  <span className="text-xs text-white/70 leading-tight">{a.label}</span>
                </div>
              ))}
              {labeledGroups.map((g) => (
                <div key={g.id} className="flex items-start gap-1.5">
                  <span
                    className="shrink-0 text-[10px] leading-none"
                    style={{ color: GROUP_COLORS[g.color] ?? '#818cf8' }}
                  >
                    ●
                  </span>
                  <span className="text-xs text-white/70 leading-tight">{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
