"use client";

import React from 'react';
import { useGameStore } from '@/stores/game-store';
import { BOARD_PADDING, cellSize, pointToSvg, getStarPoints } from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';

export const BoardGrid = React.memo(function BoardGrid() {
  const boardSize = useGameStore((s) => s.game.board.size);
  const cell = cellSize(boardSize);

  const lines: React.ReactNode[] = [];

  // Grid lines
  for (let i = 0; i < boardSize; i++) {
    const pos = BOARD_PADDING + i * cell;
    const start = BOARD_PADDING;
    const end = BOARD_PADDING + (boardSize - 1) * cell;

    // Horizontal line
    lines.push(
      <line
        key={`h-${i}`}
        x1={start}
        y1={pos}
        x2={end}
        y2={pos}
        stroke={COLORS.board.line}
        strokeWidth={i === 0 || i === boardSize - 1 ? 1.2 : 0.8}
      />,
    );
    // Vertical line
    lines.push(
      <line
        key={`v-${i}`}
        x1={pos}
        y1={start}
        x2={pos}
        y2={end}
        stroke={COLORS.board.line}
        strokeWidth={i === 0 || i === boardSize - 1 ? 1.2 : 0.8}
      />,
    );
  }

  // Star points (hoshi)
  const starPoints = getStarPoints(boardSize);
  const stars = starPoints.map((p) => {
    const { cx, cy } = pointToSvg(p, boardSize);
    return (
      <circle
        key={`star-${p.x}-${p.y}`}
        cx={cx}
        cy={cy}
        r={3}
        fill={COLORS.board.star}
      />
    );
  });

  return (
    <g>
      {lines}
      {stars}
    </g>
  );
});
