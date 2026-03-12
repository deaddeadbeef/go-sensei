"use client";

import React from 'react';
import { useGameStore } from '@/stores/game-store';
import { BOARD_PADDING, cellSize } from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';

const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST'; // skip I

export const CoordinateLabels = React.memo(function CoordinateLabels() {
  const boardSize = useGameStore((s) => s.game.board.size);
  const cell = cellSize(boardSize);
  const labels: React.ReactNode[] = [];
  const fontSize = Math.min(10, cell * 0.45);
  const offset = 14;

  for (let i = 0; i < boardSize; i++) {
    const pos = BOARD_PADDING + i * cell;
    const letter = COLUMN_LETTERS[i];
    const number = String(boardSize - i);

    // Top column labels
    labels.push(
      <text
        key={`ct-${i}`}
        x={pos}
        y={BOARD_PADDING - offset}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={COLORS.ui.textSecondary}
        fontSize={fontSize}
        fontFamily="monospace"
      >
        {letter}
      </text>,
    );
    // Bottom column labels
    labels.push(
      <text
        key={`cb-${i}`}
        x={pos}
        y={BOARD_PADDING + (boardSize - 1) * cell + offset}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={COLORS.ui.textSecondary}
        fontSize={fontSize}
        fontFamily="monospace"
      >
        {letter}
      </text>,
    );
    // Left row labels
    labels.push(
      <text
        key={`rl-${i}`}
        x={BOARD_PADDING - offset}
        y={pos}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={COLORS.ui.textSecondary}
        fontSize={fontSize}
        fontFamily="monospace"
      >
        {number}
      </text>,
    );
    // Right row labels
    labels.push(
      <text
        key={`rr-${i}`}
        x={BOARD_PADDING + (boardSize - 1) * cell + offset}
        y={pos}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={COLORS.ui.textSecondary}
        fontSize={fontSize}
        fontFamily="monospace"
      >
        {number}
      </text>,
    );
  }

  return <g>{labels}</g>;
});
