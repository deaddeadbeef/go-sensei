"use client";
import { useEffect, useRef } from 'react';
import {
  formatObjectiveTargetText,
  getBeginnerObjective,
  getFreshAreaFollowUpContext,
} from '@/lib/coaching/beginner-objectives';
import { useGameStore } from '@/stores/game-store';
import { HESITATION_NUDGE_TIME, HESITATION_PROACTIVE_TIME } from '@/utils/animation';
import type { GameState, StoneColor } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';
import type { AppPhase } from '@/stores/game-store';

export interface HesitationHintGateInput {
  isAiThinking: boolean;
  phase: 'welcome' | 'playing' | 'scoring' | 'finished' | 'lesson' | 'review';
  appPhase: AppPhase;
  bubbleVisible: boolean;
  currentPlayer: StoneColor;
}

export function canOfferHesitationHint(input: HesitationHintGateInput): boolean {
  return !input.isAiThinking
    && input.phase === 'playing'
    && input.appPhase === 'game'
    && input.currentPlayer === 'black'
    && !input.bubbleVisible;
}

export function buildHesitationNudge(game: GameState, teachingLevel: TeachingLevel): {
  text: string;
  actions: { id: string; label: string }[];
} {
  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: game.currentPlayer,
    teachingLevel,
  });

  if (!objective) {
    return {
      text: 'Take your time. Want me to suggest a useful move?',
      actions: [{ id: 'hint', label: 'Suggest a move' }],
    };
  }

  const followUpContext = getFreshAreaFollowUpContext(game, teachingLevel, objective);
  const targetText = formatObjectiveTargetText(objective, game.board.size, 4, followUpContext);

  return {
    text: `Your current job is ${objective.title}: ${objective.instruction}${targetText ? ` ${targetText}` : ''} Want me to mark it on the board?`,
    actions: [{ id: 'hint', label: 'Show targets' }],
  };
}

export function useHesitationDetector(onHint: () => void) {
  const lastInteractionTime = useGameStore((s) => s.lastInteractionTime);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const phase = useGameStore((s) => s.phase);
  const appPhase = useGameStore((s) => s.appPhase);
  const currentPlayer = useGameStore((s) => s.game.currentPlayer);
  const setHesitationLevel = useGameStore((s) => s.setHesitationLevel);
  const hintOffered = useGameStore((s) => s.hintOffered);
  const showBubble = useGameStore((s) => s.showBubble);
  const setHintOffered = useGameStore((s) => s.setHintOffered);
  const bubbleVisible = useGameStore((s) => s.bubble.visible);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!canOfferHesitationHint({ isAiThinking, phase, appPhase, currentPlayer, bubbleVisible })) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const checkHesitation = () => {
      const elapsed = Date.now() - lastInteractionTime;

      if (elapsed >= HESITATION_PROACTIVE_TIME && !hintOffered) {
        setHesitationLevel('stuck');
        setHintOffered(true);
        onHint();
      } else if (elapsed >= HESITATION_NUDGE_TIME && !hintOffered) {
        setHesitationLevel('mild');
        setHintOffered(true);
        const state = useGameStore.getState();
        const nudge = buildHesitationNudge(state.game, state.teachingLevel);
        showBubble({
          text: nudge.text,
          variant: 'teaching',
          anchorPoint: null,
          actions: nudge.actions,
        });
      }
    };

    timerRef.current = setInterval(checkHesitation, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lastInteractionTime, isAiThinking, phase, appPhase, currentPlayer, bubbleVisible, hintOffered, setHesitationLevel, setHintOffered, showBubble, onHint]);
}
