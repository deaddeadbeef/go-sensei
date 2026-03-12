"use client";

import React from 'react';
import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';
import { STONE_DROP } from '@/utils/animation';
import { motion, AnimatePresence } from 'framer-motion';
import type { BoardSize } from '@/lib/go-engine/types';

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

/** Last-move marker — small square on the stone */
function LastMoveMarker({
  x,
  y,
  color,
  boardSize,
}: {
  x: number;
  y: number;
  color: 'black' | 'white';
  boardSize: BoardSize;
}) {
  const { cx, cy } = pointToSvg({ x, y }, boardSize);
  const size = stoneRadius(boardSize) * 0.35;

  return (
    <motion.rect
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      fill={color === 'black' ? '#fff' : '#000'}
      opacity={0.7}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.1 }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    />
  );
}

export function StoneLayer() {
  const grid = useGameStore((s) => s.game.board.grid);
  const boardSize = useGameStore((s) => s.game.board.size);
  const lastPlayerMove = useGameStore((s) => s.lastPlayerMove);
  const lastAiMove = useGameStore((s) => s.lastAiMove);
  const pendingCaptures = useGameStore((s) => s.pendingCaptures);

  // Build set of pending capture positions to exclude from rendering
  const pendingSet = new Set(
    pendingCaptures.map((c) => `${c.point.x},${c.point.y}`),
  );

  const stones: React.ReactNode[] = [];
  const lastMove = lastAiMove || lastPlayerMove;

  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      const cell = grid[y][x];
      if (cell && !pendingSet.has(`${x},${y}`)) {
        const isLast = lastMove
          ? lastMove.x === x && lastMove.y === y
          : false;
        stones.push(
          <Stone
            key={`stone-${x}-${y}`}
            x={x}
            y={y}
            color={cell}
            boardSize={boardSize}
          />,
        );
        if (isLast) {
          stones.push(
            <LastMoveMarker
              key={`last-${x}-${y}`}
              x={x}
              y={y}
              color={cell}
              boardSize={boardSize}
            />,
          );
        }
      }
    }
  }

  return (
    <AnimatePresence>
      {stones}
    </AnimatePresence>
  );
}
