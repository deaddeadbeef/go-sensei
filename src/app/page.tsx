"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { BoardContainer } from '@/components/board/BoardContainer';
import { SenseiBubble } from '@/components/ui/SenseiBubble';
import { SenseiBar } from '@/components/ui/SenseiBar';
import { SenseiInput } from '@/components/ui/SenseiInput';
import { SettingsModal } from '@/components/ui/SettingsModal';
import { RulesPanel } from '@/components/ui/RulesPanel';
import { SenseiChatLog } from '@/components/chat/SenseiChatLog';
import { GameControls } from '@/components/game/GameControls';
import { ScoreCard } from '@/components/game/ScoreCard';
import { useGameStore } from '@/stores/game-store';
import { useGoMaster } from '@/hooks/useGoMaster';
import { useGitHubAuth } from '@/hooks/useGitHubAuth';
import { useHesitationDetector } from '@/hooks/useHesitationDetector';
import { COLORS } from '@/utils/colors';
import type { BoardSize } from '@/lib/go-engine/types';

export default function GamePage() {
  const [showSettings, setShowSettings] = useState(false);

  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const pass = useGameStore((s) => s.pass);
  const undo = useGameStore((s) => s.undo);
  const game = useGameStore((s) => s.game);
  const showBubble = useGameStore((s) => s.showBubble);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const teachingLevel = useGameStore((s) => s.teachingLevel);
  const setTeachingLevel = useGameStore((s) => s.setTeachingLevel);

  const { sendPlayerMove, sendMessage, requestHint, requestReview } = useGoMaster();
  const { authState, isLoggedIn, startLogin, logout } = useGitHubAuth();

  useEffect(() => {
    if (!isLoggedIn) {
      setTimeout(() => setShowSettings(true), 1500);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useHesitationDetector(requestHint);

  const welcomeShown = useRef(false);
  useEffect(() => {
    if (phase === 'welcome' && !welcomeShown.current) {
      welcomeShown.current = true;
      const level = useGameStore.getState().teachingLevel;
      const welcomeMessages = {
        beginner: "I'm Go Sensei. You're here to learn Go — good. This is a 19×19 board, the same one professionals use. You're Black, you move first. Place a stone on any intersection to claim territory. I'll teach you as we play, but I won't sugarcoat your mistakes. Make a move.",
        intermediate: "Go Sensei. 19×19 board. You know the basics — show me what you've got. You're Black.",
        advanced: "19×19. You're Black. Impress me.",
      };
      showBubble({
        text: welcomeMessages[level],
        variant: 'teaching',
        anchorPoint: null,
        actions: [],
      });
      setTimeout(() => setPhase('playing'), 500);
    }
  }, [phase, showBubble, setPhase]);

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
    welcomeShown.current = false;
    startNewGame(game.board.size as BoardSize);
  }, [startNewGame, game.board.size]);
  const handleReviewGame = useCallback(() => {
    setPhase('review');
    requestReview();
  }, [setPhase, requestReview]);
  const handlePass = useCallback(() => pass(), [pass]);
  const handleUndo = useCallback(() => undo(), [undo]);
  const handleSettingsSave = useCallback(
    (settings: { boardSize: BoardSize; teachingLevel: 'beginner' | 'intermediate' | 'advanced' }) => {
      if (settings.boardSize !== game.board.size) {
        welcomeShown.current = false;
        startNewGame(settings.boardSize);
      }
      setTeachingLevel(settings.teachingLevel);
    },
    [game.board.size, startNewGame, setTeachingLevel],
  );

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

      {/* Main content: board (left) + sidebar (right) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Board area */}
        <div className="flex-[7] flex flex-col relative min-w-0 min-h-0 overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${COLORS.board.bg}15 0%, transparent 70%)`,
            }}
          />
          <SenseiBubble />
          <BoardContainer />
          <div className="shrink-0">
            <GameControls onNewGame={handleNewGame} onPass={handlePass} onUndo={handleUndo} />
          </div>
          <ScoreCard onPlayAgain={handleNewGame} onReviewGame={handleReviewGame} />
        </div>

        {/* Right: Sidebar — full-width on mobile, side panel on desktop */}
        <div
          className="flex-[3] flex flex-col md:min-w-[280px] md:max-w-[400px] border-t md:border-t-0 md:border-l"
          style={{ borderColor: COLORS.ui.bgCard, backgroundColor: COLORS.ui.bgPrimary }}
        >
          {/* Rules panel (compact, top) */}
          <div className="shrink-0 p-3 border-b" style={{ borderColor: COLORS.ui.bgCard }}>
            <RulesPanel />
          </div>

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
    </div>
  );
}
