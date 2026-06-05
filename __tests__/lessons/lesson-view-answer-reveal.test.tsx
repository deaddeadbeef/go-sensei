// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

    expect(screen.getByText('Answer shown at E4. Click that highlighted point to continue.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Answer shown on board' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('credits board basics when the first groups lesson is completed', () => {
    act(() => {
      useGameStore.getState().startLesson('groups');
      useGameStore.setState({ currentStep: 4 });
    });

    render(<LessonView />);

    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));

    expect(useConceptStore.getState().getMastery('stones-and-board').level).toBe(2);
    expect(useConceptStore.getState().getMastery('groups').level).toBe(2);
  });

  it('credits companion concepts from the shared lesson map', () => {
    act(() => {
      useGameStore.getState().startLesson('capture');
      useGameStore.setState({ currentStep: 3 });
    });

    render(<LessonView />);

    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));

    expect(useConceptStore.getState().getMastery('capture').level).toBe(2);
    expect(useConceptStore.getState().getMastery('atari').level).toBe(2);
  });
});
