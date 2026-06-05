"use client";

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';
import { SUGGESTION_PULSE_CYCLE } from '@/utils/animation';
import { motion, AnimatePresence } from 'framer-motion';

const CANDIDATE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function getSuggestionMarkerLabel(rank: number): string {
  if (!Number.isInteger(rank) || rank < 1) return '?';

  let remaining = rank;
  let label = '';

  while (remaining > 0) {
    remaining -= 1;
    label = `${CANDIDATE_LABELS[remaining % CANDIDATE_LABELS.length]}${label}`;
    remaining = Math.floor(remaining / CANDIDATE_LABELS.length);
  }

  return label;
}

function diamondPath(cx: number, cy: number, r: number): string {
  return [
    `M ${cx} ${cy - r}`,
    `L ${cx + r} ${cy}`,
    `L ${cx} ${cy + r}`,
    `L ${cx - r} ${cy}`,
    'Z',
  ].join(' ');
}

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
        const markerLabel = getSuggestionMarkerLabel(sg.rank);
        const markerRadius = r * 0.74;
        const accessibleLabel = `Candidate ${markerLabel}, suggestion rank ${sg.rank}: ${sg.reason}`;

        return (
          <g
            key={sg.id}
            pointerEvents="none"
            role="img"
            aria-label={accessibleLabel}
          >
            <title>{accessibleLabel}</title>
            <motion.circle
              cx={cx}
              cy={cy}
              r={r * 1.04}
              fill={COLORS.overlay.suggestion}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: [0, isBest ? 0.32 : 0.22, isBest ? 0.2 : 0.14],
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
            <motion.path
              d={diamondPath(cx, cy, markerRadius)}
              fill={COLORS.overlay.suggestion}
              stroke="#fff"
              strokeWidth={isBest ? 2 : 1.5}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: isBest ? 0.92 : 0.78, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
            <motion.text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#fff"
              fontSize={Math.max(9, r * 0.64)}
              fontWeight="bold"
              fontFamily="sans-serif"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              exit={{ opacity: 0 }}
              aria-hidden="true"
              pointerEvents="none"
            >
              {markerLabel}
            </motion.text>
          </g>
        );
      })}
    </AnimatePresence>
  );
}
