import { useCallback } from 'react';
import { getSenseiActionRoute } from '@/lib/coaching/sensei-actions';
import { useGameStore } from '@/stores/game-store';
import { useGoMaster } from './useGoMaster';

export function useSenseiAction() {
  const dismissBubble = useGameStore((s) => s.dismissBubble);
  const showProblems = useGameStore((s) => s.showProblems);
  const showReview = useGameStore((s) => s.showReview);
  const startGuidedIntroGame = useGameStore((s) => s.startGuidedIntroGame);
  const openGuidedGame = useGameStore((s) => s.openGuidedGame);
  const startLesson = useGameStore((s) => s.startLesson);
  const requestGuidedReadReplay = useGameStore((s) => s.requestGuidedReadReplay);
  const { requestHint } = useGoMaster();

  return useCallback((actionId: string) => {
    dismissBubble();

    const route = getSenseiActionRoute(actionId);
    if (!route) return;

    if (route.type === 'hint') {
      requestHint();
      return;
    }

    if (route.type === 'review') {
      showReview();
      return;
    }

    if (route.type === 'guided_intro') {
      startGuidedIntroGame();
      return;
    }

    if (route.type === 'guided_game') {
      openGuidedGame();
      return;
    }

    if (route.type === 'guided_read_pressure') {
      openGuidedGame();
      requestGuidedReadReplay({
        type: 'read-pressure',
        mode: route.mode,
        promptKey: route.promptKey,
        replyKey: route.replyKey,
        comparedReplyKey: route.comparedReplyKey,
        defensePointKey: route.defensePointKey,
        followUpDefensePointKey: route.followUpDefensePointKey,
      });
      return;
    }

    if (route.type === 'practice') {
      showProblems(route.category);
      return;
    }

    startLesson(route.lessonId);
  }, [
    dismissBubble,
    requestGuidedReadReplay,
    requestHint,
    openGuidedGame,
    showProblems,
    showReview,
    startGuidedIntroGame,
    startLesson,
  ]);
}
