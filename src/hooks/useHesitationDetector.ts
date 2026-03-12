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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isAiThinking || phase !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const checkHesitation = () => {
      const elapsed = Date.now() - lastInteractionTime;

      if (elapsed >= HESITATION_PROACTIVE_TIME && !hintOffered) {
        setHesitationLevel('stuck');
        onHint();
      } else if (elapsed >= HESITATION_NUDGE_TIME && !hintOffered) {
        setHesitationLevel('mild');
        showBubble({
          text: 'Would you like a hint? I can suggest some good moves.',
          variant: 'teaching',
          anchorPoint: null,
          actions: [{ id: 'hint', label: 'Show me' }],
        });
      }
    };

    timerRef.current = setInterval(checkHesitation, 2000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lastInteractionTime, isAiThinking, phase, hintOffered, setHesitationLevel, showBubble, onHint]);
}
