"use client";

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';

export function DeadStoneMarker() {
  const deadStones = useGameStore((s) => s.deadStones);
  const boardSize = useGameStore((s) => s.game.board.size);
  const phase = useGameStore((s) => s.phase);
  const toggleDeadStone = useGameStore((s) => s.toggleDeadStone);
  const grid = useGameStore((s) => s.game.board.grid);

  if (phase !== 'scoring') return null;

  const r = stoneRadius(boardSize);

  return (
    <g>
      {/* Click targets for all stones during scoring phase */}
      {Array.from({ length: boardSize }, (_, y) =>
        Array.from({ length: boardSize }, (_, x) => {
          const cell = grid[y][x];
          if (!cell) return null;
          const { cx, cy } = pointToSvg({ x, y }, boardSize);
          return (
            <circle
              key={`dead-target-${x}-${y}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="transparent"
              cursor="pointer"
              onClick={() => toggleDeadStone({ x, y })}
            />
          );
        }),
      )}
      {/* X markers on dead stones */}
      {deadStones.map((ds) => {
        const { cx, cy } = pointToSvg(ds, boardSize);
        const sz = r * 0.5;
        return (
          <g key={`dead-${ds.x}-${ds.y}`}>
            <line
              x1={cx - sz} y1={cy - sz}
              x2={cx + sz} y2={cy + sz}
              stroke="#ff4444"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <line
              x1={cx + sz} y1={cy - sz}
              x2={cx - sz} y2={cy + sz}
              stroke="#ff4444"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </g>
  );
}
