"use client";
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/game-store';
import { HESITATION_NUDGE_TIME, HESITATION_PROACTIVE_TIME } from '@/utils/animation';

export function useHesitationDetector(onHint: () => void) {
  const lastInteractionTime = useGameStore((s) => s.lastInteractionTime);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const phase = useGameStore((s) => s.phase);
  const setHesitationLevel = useGameStore((s) => s.setHesitationLevel);
  const hintOffered = useGameStore((s) => s.hintOffered);
  const showBubble = useGameStore((s) => s.showBubble);
  const setHintOffered = useGameStore((s) => s.setHintOffered);
  const bubbleVisible = useGameStore((s) => s.bubble.visible);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Don't run hints while: AI is thinking, not playing, or bubble is showing
    if (isAiThinking || phase !== 'playing' || bubbleVisible) {
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
        showBubble({
          text: 'Take your time! Would you like me to suggest some good moves?',
          variant: 'teaching',
          anchorPoint: null,
          actions: [{ id: 'hint', label: 'Show me' }],
        });
      }
    };

    timerRef.current = setInterval(checkHesitation, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lastInteractionTime, isAiThinking, phase, bubbleVisible, hintOffered, setHesitationLevel, setHintOffered, showBubble, onHint]);
}
