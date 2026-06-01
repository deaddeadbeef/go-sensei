'use client';

import { CONCEPTS } from '@/lib/concepts/concept-data';
import { getMoveInsight } from '@/lib/coaching/move-insight';
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
  const game = useGameStore((s) => s.game);
  const teachingLevel = useGameStore((s) => s.teachingLevel);
  const boardSize = useGameStore((s) => s.game.board.size);
  const insight = getMoveInsight(game, teachingLevel);
  const conceptNames = insight
    ? [...new Set(insight.conceptIds)]
      .map((id) => CONCEPTS.find((concept) => concept.id === id)?.name ?? id)
      .slice(0, 3)
    : [];

  const labeledHighlights = highlights.filter((h) => h.label);
  const labeledArrows = arrows.filter((a) => a.label);
  const labeledGroups = groups.filter((g) => g.label);

  const hasBoardAnalysis = labeledHighlights.length + labeledArrows.length + labeledGroups.length > 0;
  const hasContent = insight !== null || hasBoardAnalysis;

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
            {insight && (
              <div className="mb-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-white/40">
                  Move Insight
                </div>
                <div className="mt-1 text-sm font-semibold text-white/90">{insight.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-white/70">{insight.observation}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-200">{insight.nextStep}</p>
                {conceptNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {conceptNames.map((name) => (
                      <span key={name} className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-200">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {hasBoardAnalysis && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
                  Board Analysis
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
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
