"use client";

import React, { useMemo } from 'react';
import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';
import { STONE_DROP } from '@/utils/animation';
import { motion, AnimatePresence } from 'framer-motion';
import type { BoardSize, CellState, Move } from '@/lib/go-engine/types';

const RECENT_MOVE_LABEL_LIMIT = 5;

interface RecentMoveLabel {
  moveNumber: number;
  color: 'black' | 'white';
  isLatest: boolean;
}

interface StoneProps {
  x: number;
  y: number;
  color: 'black' | 'white';
  boardSize: BoardSize;
}

function Stone({ x, y, color, boardSize }: StoneProps) {
  const { cx, cy } = pointToSvg({ x, y }, boardSize);
  const r = stoneRadius(boardSize);

  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={r}
      fill={
        color === 'black'
          ? 'url(#black-stone-gradient)'
          : 'url(#white-stone-gradient)'
      }
      filter="url(#stone-shadow)"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.3, opacity: 0 }}
      transition={{
        type: 'spring',
        stiffness: STONE_DROP.stiffness,
        damping: STONE_DROP.damping,
      }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    />
  );
}

export function getRecentMoveLabels(
  moveHistory: Move[],
  grid: CellState[][],
  hiddenPoints = new Set<string>(),
  limit = RECENT_MOVE_LABEL_LIMIT,
): Map<string, RecentMoveLabel> {
  const labels = new Map<string, RecentMoveLabel>();

  for (let index = moveHistory.length - 1; index >= 0 && labels.size < limit; index -= 1) {
    const move = moveHistory[index];
    if (move.type !== 'place') continue;

    const key = `${move.point.x},${move.point.y}`;
    if (hiddenPoints.has(key) || labels.has(key)) continue;
    if (grid[move.point.y]?.[move.point.x] !== move.color) continue;

    labels.set(key, {
      moveNumber: index + 1,
      color: move.color,
      isLatest: labels.size === 0,
    });
  }

  return labels;
}

function RecentMoveNumber({
  x,
  y,
  boardSize,
  label,
}: {
  x: number;
  y: number;
  boardSize: BoardSize;
  label: RecentMoveLabel;
}) {
  const { cx, cy } = pointToSvg({ x, y }, boardSize);
  const r = stoneRadius(boardSize);
  const backgroundRadius = label.isLatest ? r * 0.52 : r * 0.42;
  const fontSize = Math.max(8, Math.min(13, r * 0.72));
  const textColor = label.color === 'black' ? '#fff' : '#111827';
  const backgroundColor = label.color === 'black' ? '#0f172a' : '#f8fafc';

  return (
    <motion.g
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.1 }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={backgroundRadius}
        fill={backgroundColor}
        opacity={label.isLatest ? 0.9 : 0.72}
        stroke={label.isLatest ? '#e2b55a' : 'transparent'}
        strokeWidth={label.isLatest ? 2 : 0}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={textColor}
        fontSize={fontSize}
        fontWeight={label.isLatest ? 800 : 700}
        aria-label={`Move ${label.moveNumber}`}
        pointerEvents="none"
      >
        {label.moveNumber}
      </text>
    </motion.g>
  );
}

export const StoneLayer = React.memo(function StoneLayer() {
  const grid = useGameStore((s) => s.game.board.grid);
  const boardSize = useGameStore((s) => s.game.board.size);
  const moveHistory = useGameStore((s) => s.game.moveHistory);
  const pendingCaptures = useGameStore((s) => s.pendingCaptures);

  const stones = useMemo(() => {
    const pendingSet = new Set(
      pendingCaptures.map((c) => `${c.point.x},${c.point.y}`),
    );
    const recentMoveLabels = getRecentMoveLabels(moveHistory, grid, pendingSet);

    const result: React.ReactNode[] = [];

    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        const cell = grid[y][x];
        if (cell && !pendingSet.has(`${x},${y}`)) {
          const label = recentMoveLabels.get(`${x},${y}`);
          result.push(
            <Stone
              key={`stone-${x}-${y}`}
              x={x}
              y={y}
              color={cell}
              boardSize={boardSize}
            />,
          );
          if (label) {
            result.push(
              <RecentMoveNumber
                key={`move-number-${x}-${y}`}
                x={x}
                y={y}
                boardSize={boardSize}
                label={label}
              />,
            );
          }
        }
      }
    }

    return result;
  }, [grid, boardSize, moveHistory, pendingCaptures]);

  return (
    <AnimatePresence>
      {stones}
    </AnimatePresence>
  );
});
