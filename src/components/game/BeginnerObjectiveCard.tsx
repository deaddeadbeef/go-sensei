'use client';

import { getBeginnerObjective } from '@/lib/coaching/beginner-objectives';
import { useGameStore } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';

export function BeginnerObjectiveCard() {
  const game = useGameStore((s) => s.game);
  const teachingLevel = useGameStore((s) => s.teachingLevel);

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: game.currentPlayer,
    teachingLevel,
  });

  if (!objective) return null;

  return (
    <div
      className="mx-auto mb-3 w-full max-w-2xl rounded-lg border px-4 py-3 text-sm"
      style={{ backgroundColor: COLORS.ui.bgCard, borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>
        {objective.title}
      </div>
      <div className="mt-1" style={{ color: COLORS.ui.textSecondary }}>
        {objective.instruction}
      </div>
      <div className="mt-1 text-xs" style={{ color: COLORS.ui.accent }}>
        {objective.why}
      </div>
    </div>
  );
}
