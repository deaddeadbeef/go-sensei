"use client";

import { useGameStore } from '@/stores/game-store';
import { pointToSvg, cellSize } from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';
import { TERRITORY_FILL_PER_CELL } from '@/utils/animation';
import { motion, AnimatePresence } from 'framer-motion';
import type { Point } from '@/lib/go-engine/types';

export function TerritoryOverlay() {
  const territory = useGameStore((s) => s.territory);
  const boardSize = useGameStore((s) => s.game.board.size);

  if (!territory) return null;

  const cell = cellSize(boardSize);
  const rectSize = cell * 0.6;

  const renderPoints = (points: Point[], fill: string) =>
    points.map((p, i) => {
      const { cx, cy } = pointToSvg(p, boardSize);
      return (
        <motion.rect
          key={`terr-${p.x}-${p.y}`}
          x={cx - rectSize / 2}
          y={cy - rectSize / 2}
          width={rectSize}
          height={rectSize}
          rx={2}
          fill={fill}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: i * TERRITORY_FILL_PER_CELL }}
        />
      );
    });

  return (
    <AnimatePresence>
      <g>
        {renderPoints(territory.black, COLORS.overlay.territoryBlack)}
        {renderPoints(territory.white, COLORS.overlay.territoryWhite)}
        {renderPoints(territory.dame, COLORS.overlay.dame)}
      </g>
    </AnimatePresence>
  );
}
