"use client";
import { useGameStore } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';

interface GameControlsProps {
  onNewGame: () => void;
  onPass: () => void;
  onUndo: () => void;
}

export function GameControls({ onNewGame, onPass, onUndo }: GameControlsProps) {
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const phase = useGameStore((s) => s.phase);
  const moveCount = useGameStore((s) => s.game.moveHistory.length);
  const disabled = isAiThinking || phase !== 'playing';

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <button
        onClick={onUndo}
        disabled={disabled || moveCount === 0}
        className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-30"
        style={{ backgroundColor: COLORS.ui.bgCard, color: COLORS.ui.textSecondary }}
      >
        ↩ Undo
      </button>
      <button
        onClick={onPass}
        disabled={disabled}
        className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-30"
        style={{ backgroundColor: COLORS.ui.bgCard, color: COLORS.ui.textSecondary }}
      >
        Pass
      </button>
      <button
        onClick={onNewGame}
        className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
        style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
      >
        New Game
      </button>
    </div>
  );
}
