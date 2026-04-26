'use client';

import { getBeginnerObjective } from '@/lib/coaching/beginner-objectives';
import { useGameStore } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';

export function BeginnerTargetOverlay() {
  const game = useGameStore((s) => s.game);
  const teachingLevel = useGameStore((s) => s.teachingLevel);

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    moveCount: game.moveHistory.length,
    currentPlayer: game.currentPlayer,
    teachingLevel,
  });

  if (!objective || objective.targetPoints.length === 0) return null;

  const radius = stoneRadius(game.board.size) * 0.72;
  const openTargetPoints = objective.targetPoints.filter(
    (point) => game.board.grid[point.y]?.[point.x] === null,
  );

  if (openTargetPoints.length === 0) return null;

  return (
    <g pointerEvents="none">
      {openTargetPoints.map((point) => {
        const { cx, cy } = pointToSvg(point, game.board.size);

        return (
          <circle
            key={`${objective.id}-${point.x}-${point.y}`}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={COLORS.ui.accent}
            strokeWidth={3}
            strokeDasharray="5 5"
            opacity={0.72}
          />
        );
      })}
    </g>
  );
}
