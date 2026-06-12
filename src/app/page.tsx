"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { BoardContainer } from '@/components/board/BoardContainer';
import { SenseiBubble } from '@/components/ui/SenseiBubble';
import { SenseiBar } from '@/components/ui/SenseiBar';
import { SenseiInput } from '@/components/ui/SenseiInput';
import { SettingsModal } from '@/components/ui/SettingsModal';
import { RulesPanel } from '@/components/ui/RulesPanel';
import { TeachingPanel } from '@/components/sidebar/TeachingPanel';
import { SenseiChatLog } from '@/components/chat/SenseiChatLog';
import { GameControls } from '@/components/game/GameControls';
import { BeginnerObjectiveCard } from '@/components/game/BeginnerObjectiveCard';
import { ScoreCard } from '@/components/game/ScoreCard';
import { LessonPicker } from '@/components/lessons/LessonPicker';
import { LessonView } from '@/components/lessons/LessonView';
import { ProblemPicker } from '@/components/problems/ProblemPicker';
import { ProblemView } from '@/components/problems/ProblemView';
import { SkillTree } from '@/components/concepts/SkillTree';
import { DailyReview } from '@/components/review/DailyReview';
import { ProgressDashboard } from '@/components/dashboard/ProgressDashboard';
import { LearningPath } from '@/components/hub/LearningPath';
import { useGameStore } from '@/stores/game-store';
import { useGoMaster } from '@/hooks/useGoMaster';
import { useGitHubAuth } from '@/hooks/useGitHubAuth';
import { useHesitationDetector } from '@/hooks/useHesitationDetector';
import { COLORS } from '@/utils/colors';
import type { BoardSize } from '@/lib/go-engine/types';

const subscribeToClientHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function useHasMountedClient() {
  return useSyncExternalStore(
    subscribeToClientHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
}

export default function GamePage() {
  const [showSettings, setShowSettings] = useState(false);
  const hasMounted = useHasMountedClient();

  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const appPhase = useGameStore((s) => s.appPhase);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const openGuidedGame = useGameStore((s) => s.openGuidedGame);
  const startGuidedIntroGame = useGameStore((s) => s.startGuidedIntroGame);
  const pass = useGameStore((s) => s.pass);
  const undo = useGameStore((s) => s.undo);
  const game = useGameStore((s) => s.game);
  const showBubble = useGameStore((s) => s.showBubble);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const teachingLevel = useGameStore((s) => s.teachingLevel);
  const setTeachingLevel = useGameStore((s) => s.setTeachingLevel);
  const currentLessonId = useGameStore((s) => s.currentLessonId);
  const currentProblemId = useGameStore((s) => s.currentProblemId);
  const showLearningPath = useGameStore((s) => s.showLearningPath);
  const showProblems = useGameStore((s) => s.showProblems);

  const { sendPlayerMove, sendMessage, requestHint, requestReview } = useGoMaster();
  const { authState, isLoggedIn, startLogin, logout } = useGitHubAuth();

  useHesitationDetector(requestHint);

  useEffect(() => {
    if (appPhase === 'lesson' && !currentLessonId) {
      showLearningPath();
    } else if (appPhase === 'problem' && !currentProblemId) {
      showProblems();
    }
  }, [appPhase, currentLessonId, currentProblemId, showLearningPath, showProblems]);

  const welcomeShown = useRef(false);
  useEffect(() => {
    if (appPhase !== 'game') return;
    if (phase === 'welcome' && !welcomeShown.current) {
      welcomeShown.current = true;
      const { teachingLevel: level, game: currentGame } = useGameStore.getState();
      if (level === 'guided') {
        startGuidedIntroGame();
        return;
      }

      const boardSizeLabel = `${currentGame.board.size}×${currentGame.board.size}`;
      const welcomeMessages: Record<string, string> = {
        beginner: `I'm Go Sensei. Go is a 4,000-year-old strategy game — two players, black and white stones, one simple goal: surround more territory than your opponent. Stones go on intersections, not squares. Once placed, they don't move. You capture enemy stones by surrounding them completely. That's it — those are the rules. Everything else, you'll learn by doing.\n\nThis is a ${boardSizeLabel} board. You're Black, you move first. Click any intersection. I'll be direct when a move misses its purpose, and I'll always show the next repair so you know how to improve.`,
        intermediate: `Go Sensei. ${boardSizeLabel} board. You're Black. I will assume you know the rules, then focus on shape, direction, and the priority behind each move.`,
        advanced: `${boardSizeLabel}. You're Black. I will keep the review concise: identify the point of the position, call out the highest-value mistake, and show the cleanest repair.`,
      };
      showBubble({
        text: welcomeMessages[level],
        variant: 'teaching',
        anchorPoint: null,
        actions: [],
      });
      setTimeout(() => setPhase('playing'), 500);
    }
  }, [appPhase, phase, showBubble, setPhase, startGuidedIntroGame]);

  const prevMoveCountRef = useRef(0);
  useEffect(() => {
    const currentMoveCount = game.moveHistory.length;
    if (currentMoveCount > prevMoveCountRef.current) {
      const lastMove = game.moveHistory[currentMoveCount - 1];
      if (lastMove && lastMove.color === 'black') {
        if (lastMove.type === 'place') {
          sendPlayerMove(lastMove.captured.length > 0, lastMove.captured.length);
        } else if (lastMove.type === 'pass') {
          sendPlayerMove(false, 0);
        }
      }
    }
    prevMoveCountRef.current = currentMoveCount;
  }, [game.moveHistory.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewGame = useCallback(() => {
    if (teachingLevel === 'guided') {
      startGuidedIntroGame();
      return;
    }

    welcomeShown.current = false;
    startNewGame(game.board.size as BoardSize);
  }, [game.board.size, startGuidedIntroGame, startNewGame, teachingLevel]);
  const handleReviewGame = useCallback(() => {
    setPhase('review');
    requestReview();
  }, [setPhase, requestReview]);
  const handlePass = useCallback(() => pass(), [pass]);
  const handleUndo = useCallback(() => undo(), [undo]);
  const handleSettingsSave = useCallback(
    (settings: { boardSize: BoardSize; teachingLevel: 'beginner' | 'intermediate' | 'advanced' | 'guided' }) => {
      if (settings.teachingLevel === 'guided') {
        welcomeShown.current = false;
        openGuidedGame();
        return;
      }

      if (settings.boardSize !== game.board.size) {
        welcomeShown.current = false;
        startNewGame(settings.boardSize);
      }
      setTeachingLevel(settings.teachingLevel);
    },
    [game.board.size, openGuidedGame, startNewGame, setTeachingLevel],
  );

  if (!hasMounted) {
    return <AppHydrationShell />;
  }

  return (
    <div className="flex flex-col h-dvh overflow-hidden" style={{ backgroundColor: COLORS.ui.bgPrimary }}>
      <SenseiBar onSettingsClick={() => setShowSettings(true)} isLoggedIn={isLoggedIn} />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSettingsSave}
        currentBoardSize={game.board.size as BoardSize}
        currentTeachingLevel={teachingLevel}
        isLoggedIn={isLoggedIn}
        authState={authState}
        onLogin={startLogin}
        onLogout={logout}
      />

      {/* Main content: conditionally render based on appPhase */}
      {appPhase === 'path' && <LearningPath />}
      {appPhase === 'lessons' && <LessonPicker />}
      {appPhase === 'lesson' && <LessonView />}
      {appPhase === 'problems' && <ProblemPicker />}
      {appPhase === 'problem' && <ProblemView />}
      {appPhase === 'skills' && <SkillTree />}
      {appPhase === 'review' && <DailyReview />}
      {appPhase === 'dashboard' && <ProgressDashboard />}
      {appPhase === 'game' && (
        <div
          data-testid="game-shell"
          className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden md:flex-row md:overflow-hidden"
        >
          {/* Left: Board area */}
          <div className="flex-none flex flex-col relative min-w-0 md:flex-[7] md:min-h-0 md:overflow-hidden">
            <div data-testid="board-bubble-layer" className="relative flex min-h-[300px] shrink-0 overflow-hidden md:flex-1">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at center, ${COLORS.board.bg}15 0%, transparent 70%)`,
                }}
              />
              <SenseiBubble />
              <BoardContainer />
            </div>
            <div data-testid="guided-control-panel" className="flex shrink-0 flex-col md:min-h-0 md:shrink md:overflow-hidden">
              <div data-testid="guided-objective-scroll" className="md:min-h-0 md:overflow-y-auto">
                <BeginnerObjectiveCard />
              </div>
              <GameControls onNewGame={handleNewGame} onPass={handlePass} onUndo={handleUndo} />
            </div>
            <ScoreCard
              onPlayAgain={handleNewGame}
              onReviewGame={handleReviewGame}
              onLearningPath={showLearningPath}
            />
          </div>

          {/* Right: Sidebar — full-width on mobile, side panel on desktop */}
          <div
            data-testid="game-sidebar"
            className="flex-none flex h-[62dvh] min-h-[360px] max-h-[620px] min-w-0 flex-col border-t md:flex-[3] md:min-h-0 md:h-auto md:max-h-none md:min-w-[280px] md:max-w-[400px] md:border-t-0 md:border-l"
            style={{ borderColor: COLORS.ui.bgCard, backgroundColor: COLORS.ui.bgPrimary }}
          >
            {/* Rules panel (compact, top) */}
            <div className="shrink-0 p-3 border-b" style={{ borderColor: COLORS.ui.bgCard }}>
              <RulesPanel />
            </div>

            <TeachingPanel />

            {/* Chat log (scrollable, fills remaining space) */}
            <div className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
              <SenseiChatLog />

              {/* Thinking indicator */}
              {isAiThinking && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                  style={{ backgroundColor: COLORS.ui.bgCard, color: COLORS.ui.textSecondary }}>
                  <span className="animate-pulse">🤔</span>
                  Sensei is thinking...
                </div>
              )}
            </div>

            {/* Input at bottom of sidebar */}
            <div className="shrink-0 border-t" style={{ borderColor: COLORS.ui.bgCard }}>
              <SenseiInput onSendMessage={sendMessage} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppHydrationShell() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden" style={{ backgroundColor: COLORS.ui.bgPrimary }}>
      <div
        className="flex h-12 shrink-0 items-center px-4"
        style={{ backgroundColor: COLORS.ui.bgCard, borderBottom: `1px solid ${COLORS.ui.bgPrimary}` }}
      >
        <span className="text-lg font-bold" style={{ color: COLORS.ui.accent }}>
          碁 Go Sensei
        </span>
      </div>
      <main
        aria-busy="true"
        className="flex flex-1 items-center justify-center text-sm font-medium"
        style={{ color: COLORS.ui.textSecondary }}
      >
        Loading Go Sensei
      </main>
    </div>
  );
}
