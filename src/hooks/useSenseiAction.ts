import { useCallback } from 'react';
import { getSenseiActionRoute } from '@/lib/coaching/sensei-actions';
import { useGameStore } from '@/stores/game-store';
import { useGoMaster } from './useGoMaster';

export function useSenseiAction() {
  const dismissBubble = useGameStore((s) => s.dismissBubble);
  const showProblems = useGameStore((s) => s.showProblems);
  const startLesson = useGameStore((s) => s.startLesson);
  const { requestHint } = useGoMaster();

  return useCallback((actionId: string) => {
    dismissBubble();

    const route = getSenseiActionRoute(actionId);
    if (!route) return;

    if (route.type === 'hint') {
      requestHint();
      return;
    }

    if (route.type === 'practice') {
      showProblems(route.category);
      return;
    }

    startLesson(route.lessonId);
  }, [dismissBubble, requestHint, showProblems, startLesson]);
}
