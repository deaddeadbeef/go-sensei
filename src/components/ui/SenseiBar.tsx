"use client";
import { useGameStore } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';
import { motion } from 'framer-motion';

interface SenseiBarProps {
  onSettingsClick: () => void;
  isLoggedIn: boolean;
}

export function SenseiBar({ onSettingsClick, isLoggedIn }: SenseiBarProps) {
  const moveCount = useGameStore((s) => s.game.moveHistory.length);
  const captures = useGameStore((s) => s.game.captures);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const phase = useGameStore((s) => s.phase);
  const appPhase = useGameStore((s) => s.appPhase);

  return (
    <div
      className="flex items-center justify-between px-4 h-12 shrink-0"
      style={{ backgroundColor: COLORS.ui.bgCard, borderBottom: `1px solid ${COLORS.ui.bgPrimary}` }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold" style={{ color: COLORS.ui.accent }}>碁 Go Sensei</span>
      </div>
      <div className="flex items-center gap-4 text-xs" style={{ color: COLORS.ui.textSecondary }}>
        {phase === 'playing' && (
          <>
            <span>Move {moveCount}</span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-black border border-gray-600" />
              {captures.black}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-white border border-gray-400" />
              {captures.white}
            </span>
            <div className="flex items-center gap-1">
              {isAiThinking ? (
                <motion.div
                  className="w-3 h-3 rounded-full bg-white border border-gray-400"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              ) : (
                <span className="inline-block w-3 h-3 rounded-full bg-black border border-gray-600" />
              )}
              <span>{isAiThinking ? 'Sensei thinking...' : 'Your turn'}</span>
            </div>
          </>
        )}
        {phase === 'welcome' && <span>Welcome to Go!</span>}
        {phase === 'scoring' && <span>Scoring</span>}
        {phase === 'finished' && <span>Game Over</span>}
      </div>
      <div className="flex items-center gap-2">
        {isLoggedIn && (
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS.overlay.positive }} title="Connected to GitHub" />
        )}
        {appPhase === 'game' && (
          <button
            onClick={() => useGameStore.getState().showLessons()}
            className="text-sm opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: COLORS.ui.textSecondary }}
            title="Learn Go"
          >
            📚 Learn
          </button>
        )}
        <button
          onClick={onSettingsClick}
          className="text-sm opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: COLORS.ui.textSecondary }}
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
