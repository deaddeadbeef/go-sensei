"use client";

import { useCallback, useRef, useState } from 'react';
import { useGameStore } from '@/stores/game-store';
import { pointToSvg, cellSize } from '@/utils/coordinates';

export function InteractionLayer() {
  const boardSize = useGameStore((s) => s.game.board.size);
  const setHover = useGameStore((s) => s.setHover);
  const placeStone = useGameStore((s) => s.placeStone);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const phase = useGameStore((s) => s.phase);
  const currentPlayer = useGameStore((s) => s.game.currentPlayer);
  const recordInteraction = useGameStore((s) => s.recordInteraction);

  const cell = cellSize(boardSize);
  const hitRadius = cell * 0.45;
  const lastInteractionRef = useRef(0);
  const [focusedPoint, setFocusedPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleClick = useCallback(
    (x: number, y: number) => {
      if (isAiThinking || phase !== 'playing' || currentPlayer !== 'black') return;
      recordInteraction();
      placeStone({ x, y });
    },
    [isAiThinking, phase, currentPlayer, placeStone, recordInteraction],
  );

  const handleHover = useCallback(
    (x: number, y: number) => {
      setHover({ x, y });
      const now = Date.now();
      if (now - lastInteractionRef.current > 200) {
        lastInteractionRef.current = now;
        recordInteraction();
      }
    },
    [setHover, recordInteraction],
  );

  const handleLeave = useCallback(() => {
    setHover(null);
  }, [setHover]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let { x, y } = focusedPoint;
      switch (e.key) {
        case 'ArrowUp':
          y = Math.max(0, y - 1);
          e.preventDefault();
          break;
        case 'ArrowDown':
          y = Math.min(boardSize - 1, y + 1);
          e.preventDefault();
          break;
        case 'ArrowLeft':
          x = Math.max(0, x - 1);
          e.preventDefault();
          break;
        case 'ArrowRight':
          x = Math.min(boardSize - 1, x + 1);
          e.preventDefault();
          break;
        case 'Enter':
        case ' ':
          handleClick(x, y);
          e.preventDefault();
          return;
        default:
          return;
      }
      setFocusedPoint({ x, y });
      setHover({ x, y });
    },
    [focusedPoint, boardSize, handleClick, setHover],
  );

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
            phase === 'playing' && !isAiThinking && currentPlayer === 'black' ? 'pointer' : 'default'
          }
          onClick={() => handleClick(x, y)}
          onMouseEnter={() => handleHover(x, y)}
          onMouseLeave={handleLeave}
        />,
      );
    }
  }

  return (
    <g
      tabIndex={0}
      style={{ outline: 'none' }}
      role="grid"
      aria-label={`${boardSize}×${boardSize} Go board`}
      onKeyDown={handleKeyDown}
    >
      {circles}
    </g>
  );
}
