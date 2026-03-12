"use client";

import { useCallback } from 'react';
import { useGameStore } from '@/stores/game-store';
import { pointToSvg, cellSize } from '@/utils/coordinates';

export function InteractionLayer() {
  const boardSize = useGameStore((s) => s.game.board.size);
  const setHover = useGameStore((s) => s.setHover);
  const placeStone = useGameStore((s) => s.placeStone);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const phase = useGameStore((s) => s.phase);
  const recordInteraction = useGameStore((s) => s.recordInteraction);

  const cell = cellSize(boardSize);
  const hitRadius = cell * 0.45;

  const handleClick = useCallback(
    (x: number, y: number) => {
      if (isAiThinking || phase !== 'playing') return;
      recordInteraction();
      placeStone({ x, y });
    },
    [isAiThinking, phase, placeStone, recordInteraction],
  );

  const handleHover = useCallback(
    (x: number, y: number) => {
      setHover({ x, y });
      recordInteraction();
    },
    [setHover, recordInteraction],
  );

  const handleLeave = useCallback(() => {
    setHover(null);
  }, [setHover]);

  const circles: React.ReactNode[] = [];

  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      const { cx, cy } = pointToSvg({ x, y }, boardSize);
      circles.push(
        <circle
          key={`hit-${x}-${y}`}
          cx={cx}
          cy={cy}
          r={hitRadius}
          fill="transparent"
          cursor={
            phase === 'playing' && !isAiThinking ? 'pointer' : 'default'
          }
          onClick={() => handleClick(x, y)}
          onMouseEnter={() => handleHover(x, y)}
          onMouseLeave={handleLeave}
        />,
      );
    }
  }

  return <g>{circles}</g>;
}
