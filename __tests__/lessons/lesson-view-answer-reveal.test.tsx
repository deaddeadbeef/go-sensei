// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonView } from '@/components/lessons/LessonView';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe('LessonView answer reveal', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    act(() => {
      useConceptStore.getState().resetAll();
      useGameStore.getState().startNewGame(9);
      useGameStore.getState().startLesson('liberties');
      useGameStore.setState({ currentStep: 2 });
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('tells a stuck learner to click the revealed answer', () => {
    render(<LessonView />);

    act(() => {
      useGameStore.getState().checkLessonAnswer({ x: 0, y: 0 });
      useGameStore.getState().checkLessonAnswer({ x: 1, y: 0 });
      useGameStore.getState().checkLessonAnswer({ x: 2, y: 0 });
    });

    expect(screen.getByText('Answer shown. Click the highlighted point to continue.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Click highlighted answer...' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
