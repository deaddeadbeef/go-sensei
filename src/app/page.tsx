"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { BoardContainer } from '@/components/board/BoardContainer';
import { SenseiBar } from '@/components/ui/SenseiBar';
import { SenseiBubble } from '@/components/ui/SenseiBubble';
import { SenseiInput } from '@/components/ui/SenseiInput';
import { SettingsModal } from '@/components/ui/SettingsModal';
import { GameControls } from '@/components/game/GameControls';
import { ScoreCard } from '@/components/game/ScoreCard';
import { useGameStore } from '@/stores/game-store';
import { useGoMaster } from '@/hooks/useGoMaster';
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
  const lastPlayerMove = useGameStore((s) => s.lastPlayerMove);
  const game = useGameStore((s) => s.game);
  const showBubble = useGameStore((s) => s.showBubble);

  const { sendPlayerMove, sendMessage, requestHint } = useGoMaster();

  // Auto-open settings if no API key on first visit
  useEffect(() => {
    const hasKey = localStorage.getItem('go-sensei-github-token');
    if (!hasKey) {
      setTimeout(() => setShowSettings(true), 1500);
    }
  }, []);

  useHesitationDetector(requestHint);

  // Welcome message on first load
  const welcomeShown = useRef(false);
  useEffect(() => {
    if (phase === 'welcome' && !welcomeShown.current) {
      welcomeShown.current = true;
      showBubble({
        text: "Welcome! I'm Go Sensei, your personal Go teacher. This is a 9×9 board — perfect for learning. Go ahead and click anywhere to place your first black stone. I'll explain everything as we play!",
        variant: 'teaching',
        anchorPoint: null,
        actions: [],
      });
      setTimeout(() => setPhase('playing'), 500);
    }
  }, [phase, showBubble, setPhase]);

  // Watch for player moves and trigger AI response
  const prevMoveCountRef = useRef(0);
  useEffect(() => {
    const currentMoveCount = game.moveHistory.length;
    if (currentMoveCount > prevMoveCountRef.current && lastPlayerMove) {
      const lastMove = game.moveHistory[currentMoveCount - 1];
      if (lastMove && lastMove.type === 'place' && lastMove.color === 'black') {
        sendPlayerMove(lastMove.captured.length > 0, lastMove.captured.length);
      }
    }
    prevMoveCountRef.current = currentMoveCount;
  }, [game.moveHistory.length, lastPlayerMove]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewGame = useCallback(() => {
    welcomeShown.current = false;
    startNewGame(game.board.size as BoardSize);
  }, [startNewGame, game.board.size]);
  const handlePass = useCallback(() => pass(), [pass]);
  const handleUndo = useCallback(() => undo(), [undo]);

  const handleSettingsSave = useCallback(
    (settings: { apiKey: string; boardSize: BoardSize }) => {
      if (settings.boardSize !== game.board.size) {
        welcomeShown.current = false;
        startNewGame(settings.boardSize);
      }
    },
    [game.board.size, startNewGame],
  );

  return (
    <div className="flex flex-col h-dvh overflow-hidden" style={{ backgroundColor: COLORS.ui.bgPrimary }}>
      <SenseiBar onSettingsClick={() => setShowSettings(true)} />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSettingsSave}
        currentBoardSize={game.board.size as BoardSize}
      />
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${COLORS.board.bg}15 0%, transparent 70%)`,
          }}
        />
        <SenseiBubble />
        <BoardContainer />
        <GameControls onNewGame={handleNewGame} onPass={handlePass} onUndo={handleUndo} />
        <ScoreCard onPlayAgain={handleNewGame} />
      </div>
      <SenseiInput onSendMessage={sendMessage} onPass={handlePass} />
    </div>
  );
}
