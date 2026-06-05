"use client";
import { useGameStore } from '@/stores/game-store';
import type { AppPhase } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';
import { motion } from 'framer-motion';

interface SenseiBarProps {
  onSettingsClick: () => void;
  isLoggedIn: boolean;
}

const SURFACE_STATUS: Record<Exclude<AppPhase, 'game'>, string> = {
  path: 'Learning path',
  lessons: 'Lesson library',
  lesson: 'Lesson checkpoint',
  problems: 'Problem practice',
  problem: 'Solving problem',
  skills: 'Skill tree',
  review: 'Daily review',
  dashboard: 'Progress dashboard',
};

const NAV_BUTTON_CLASS = [
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-sm opacity-70 transition-opacity',
  'hover:opacity-100',
  'sm:h-auto sm:w-auto sm:rounded-none sm:opacity-60',
].join(' ');

function NavButton({
  label,
  mobileLabel,
  desktopLabel,
  onClick,
}: {
  label: string;
  mobileLabel: string;
  desktopLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={NAV_BUTTON_CLASS}
      style={{ color: COLORS.ui.textSecondary }}
      title={label}
      aria-label={label}
    >
      <span aria-hidden="true" className="leading-none sm:hidden">{mobileLabel}</span>
      <span className="hidden sm:inline">{desktopLabel}</span>
    </button>
  );
}

export function SenseiBar({ onSettingsClick, isLoggedIn }: SenseiBarProps) {
  const moveCount = useGameStore((s) => s.game.moveHistory.length);
  const captures = useGameStore((s) => s.game.captures);
  const currentPlayer = useGameStore((s) => s.game.currentPlayer);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const phase = useGameStore((s) => s.phase);
  const appPhase = useGameStore((s) => s.appPhase);
  const surfaceStatus = appPhase === 'game' ? null : SURFACE_STATUS[appPhase];
  const turnLabel = isAiThinking
    ? 'Sensei thinking...'
    : currentPlayer === 'black'
      ? 'Your turn'
      : 'Sensei to play';
  const mobileTurnLabel = isAiThinking
    ? 'Thinking'
    : currentPlayer === 'black'
      ? 'You'
      : 'Sensei';

  return (
    <div
      data-testid="sensei-bar"
      className="flex h-12 shrink-0 items-center gap-1 overflow-hidden px-2 sm:gap-4 sm:px-4"
      style={{ backgroundColor: COLORS.ui.bgCard, borderBottom: `1px solid ${COLORS.ui.bgPrimary}` }}
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="whitespace-nowrap text-base font-bold sm:text-lg" style={{ color: COLORS.ui.accent }}>
          碁 Go<span className="hidden sm:inline"> Sensei</span>
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-[11px] sm:gap-4 sm:text-xs" style={{ color: COLORS.ui.textSecondary }}>
        {surfaceStatus && (
          <span className="truncate font-medium" style={{ color: COLORS.ui.textPrimary }}>
            {surfaceStatus}
          </span>
        )}
        {!surfaceStatus && phase === 'playing' && (
          <>
            <span className="whitespace-nowrap">Move {moveCount}</span>
            <span className="hidden items-center gap-1 sm:flex">
              <span className="inline-block w-3 h-3 rounded-full bg-black border border-gray-600" />
              {captures.black}
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <span className="inline-block w-3 h-3 rounded-full bg-white border border-gray-400" />
              {captures.white}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {isAiThinking ? (
                <motion.div
                  className="w-3 h-3 rounded-full bg-white border border-gray-400"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              ) : (
                <span
                  className={`inline-block w-3 h-3 rounded-full border ${currentPlayer === 'black' ? 'bg-black border-gray-600' : 'bg-white border-gray-400'}`}
                />
              )}
              <span data-testid="sensei-bar-mobile-turn" className="max-w-12 truncate sm:hidden">{mobileTurnLabel}</span>
              <span data-testid="sensei-bar-desktop-turn" className="hidden sm:inline">{turnLabel}</span>
            </div>
          </>
        )}
        {!surfaceStatus && phase === 'welcome' && <span>Welcome to Go!</span>}
        {!surfaceStatus && phase === 'scoring' && <span>Scoring</span>}
        {!surfaceStatus && phase === 'finished' && <span>Game Over</span>}
      </div>
      <div data-testid="sensei-bar-actions" className="flex shrink-0 items-center gap-0.5 sm:gap-2">
        {isLoggedIn && (
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS.overlay.positive }} title="Connected to GitHub" />
        )}
        <NavButton
          onClick={() => useGameStore.getState().showLearningPath()}
          label="Learning Path"
          mobileLabel="Path"
          desktopLabel="Path"
        />
        {appPhase === 'game' && (
          <>
            <NavButton
              onClick={() => useGameStore.getState().showLessons()}
              label="Learn Go"
              mobileLabel="📚"
              desktopLabel="📚 Learn"
            />
            <NavButton
              onClick={() => useGameStore.getState().showProblems()}
              label="Solve Tsumego"
              mobileLabel="🧩"
              desktopLabel="🧩 Problems"
            />
            <NavButton
              onClick={() => useGameStore.getState().showSkillTree()}
              label="Skill Tree"
              mobileLabel="🌳"
              desktopLabel="🌳 Skills"
            />
            <NavButton
              onClick={() => useGameStore.getState().showReview()}
              label="Daily Review"
              mobileLabel="📖"
              desktopLabel="📖 Review"
            />
            <NavButton
              onClick={() => useGameStore.getState().showDashboard()}
              label="Progress Dashboard"
              mobileLabel="📊"
              desktopLabel="📊 Progress"
            />
          </>
        )}
        {appPhase !== 'game' && (
          <NavButton
            onClick={() => useGameStore.getState().returnToGame()}
            label="Back to Game"
            mobileLabel="←"
            desktopLabel="← Game"
          />
        )}
        <NavButton
          onClick={onSettingsClick}
          label="Settings"
          mobileLabel="⚙"
          desktopLabel="⚙"
        />
      </div>
    </div>
  );
}
