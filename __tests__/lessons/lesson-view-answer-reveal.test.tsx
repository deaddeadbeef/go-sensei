// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonView } from '@/components/lessons/LessonView';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';

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
      useProgressStore.getState().resetAll();
      useReviewStore.getState().resetAll();
      useGameStore.setState({ currentStep: 2 });
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('tells a stuck learner to click the revealed answer', () => {
    render(<LessonView />);

    expect((screen.getByRole('button', { name: 'Answer on board first' }) as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      useGameStore.getState().checkLessonAnswer({ x: 0, y: 0 });
      useGameStore.getState().checkLessonAnswer({ x: 1, y: 0 });
      useGameStore.getState().checkLessonAnswer({ x: 2, y: 0 });
    });

    expect(screen.getByText('Answer shown at E4. Before you click the highlighted point to continue, say why it matches the hint.')).toBeTruthy();
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

  it('shows the lesson finish line only on the final step', () => {
    act(() => {
      useGameStore.getState().startLesson('groups');
      useGameStore.setState({ currentStep: 3 });
    });

    render(<LessonView />);

    expect(screen.queryByText('Finish line')).toBeNull();

    cleanup();
    act(() => {
      useGameStore.getState().startLesson('groups');
      useGameStore.setState({ currentStep: 4 });
    });
    render(<LessonView />);

    expect(screen.getByText('Finish line')).toBeTruthy();
    expect(screen.getByText('Finish this lesson after you can explain the board checkpoint in your own words.')).toBeTruthy();
  });

  it('previews the path recommendation unlocked by finishing the lesson', () => {
    act(() => {
      useProgressStore.setState({
        completedLessons: ['groups', 'liberties'],
        hasStartedIntroGame: true,
        problemAttempts: [],
      });
      useGameStore.getState().startLesson('capture');
      useGameStore.setState({ currentStep: 3 });
    });

    render(<LessonView />);

    expect(screen.getByText('Next on the path: Capture problems.')).toBeTruthy();
    expect(screen.getByText('Next finish line: This block is complete after 3 more solved capture problems.')).toBeTruthy();
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
