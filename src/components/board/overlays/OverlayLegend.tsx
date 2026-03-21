"use client";

import { useGameStore } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';
import { AnimatePresence, motion } from 'framer-motion';

const legendItems = [
  { color: COLORS.overlay.positive, label: 'Good / Key point', variant: 'positive' },
  { color: COLORS.overlay.suggestion, label: 'Informational', variant: 'neutral' },
  { color: COLORS.overlay.warning, label: 'Caution', variant: 'warning' },
  { color: COLORS.overlay.danger, label: 'Danger / Mistake', variant: 'danger' },
];

export function OverlayLegend() {
  const highlights = useGameStore((s) => s.overlays.highlights);
  const liberties = useGameStore((s) => s.overlays.liberties);
  const hasOverlays = highlights.length > 0 || liberties.length > 0;

  // Get unique variants currently shown
  const activeVariants = new Set(highlights.map((h) => h.variant));
  const visibleItems = legendItems.filter((item) => {
    if (item.variant === 'positive') return activeVariants.has('positive') || liberties.length > 0;
    if (item.variant === 'neutral') return activeVariants.has('neutral');
    if (item.variant === 'warning') return activeVariants.has('warning') || liberties.length > 0;
    if (item.variant === 'danger') return activeVariants.has('danger') || liberties.length > 0;
    return false;
  });

  return (
    <AnimatePresence>
      {hasOverlays && visibleItems.length > 0 && (
        <motion.div
          className="absolute bottom-2 left-2 flex gap-3 px-2.5 py-1.5 rounded-md z-10"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
        >
          {visibleItems.map((item) => (
            <div key={item.variant} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[10px] text-white/80 whitespace-nowrap">
                {item.label}
              </span>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
