// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SenseiBubble } from '@/components/ui/SenseiBubble';
import { useGameStore } from '@/stores/game-store';

describe('SenseiBubble actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().dismissBubble();
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function finishTypewriter() {
    act(() => {
      vi.advanceTimersByTime(5000);
    });
  }

  it('routes practice actions to the matching problem category', () => {
    act(() => {
      useGameStore.getState().showBubble({
        text: 'Try a capture problem next.',
        variant: 'teaching',
        actions: [{ id: 'practice:capture', label: 'Practice capture' }],
      });
    });

    render(<SenseiBubble />);
    finishTypewriter();

    fireEvent.click(screen.getByRole('button', { name: 'Practice capture' }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
    expect(useGameStore.getState().bubble.visible).toBe(false);
  });

  it('routes lesson actions to the matching lesson checkpoint', () => {
    act(() => {
      useGameStore.getState().showBubble({
        text: 'Review territory next.',
        variant: 'teaching',
        actions: [{ id: 'lesson:territory', label: 'Review territory' }],
      });
    });

    render(<SenseiBubble />);
    finishTypewriter();

    fireEvent.click(screen.getByRole('button', { name: 'Review territory' }));

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('territory');
    expect(useGameStore.getState().bubble.visible).toBe(false);
  });

  it('routes later concept lesson actions to the matching checkpoint', () => {
    act(() => {
      useGameStore.getState().showBubble({
        text: 'Review eyes before trying life and death.',
        variant: 'teaching',
        actions: [{ id: 'lesson:eyes', label: 'Review eyes' }],
      });
    });

    render(<SenseiBubble />);
    finishTypewriter();

    fireEvent.click(screen.getByRole('button', { name: 'Review eyes' }));

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('eyes');
    expect(useGameStore.getState().bubble.visible).toBe(false);
  });

  it('routes recommendation review actions to daily review', () => {
    act(() => {
      useGameStore.getState().showBubble({
        text: 'Reviews are due before new material.',
        variant: 'teaching',
        actions: [{ id: 'review', label: 'Review due cards' }],
      });
    });

    render(<SenseiBubble />);
    finishTypewriter();

    fireEvent.click(screen.getByRole('button', { name: 'Review due cards' }));

    expect(useGameStore.getState().appPhase).toBe('review');
    expect(useGameStore.getState().bubble.visible).toBe(false);
  });

  it('routes generic practice actions to every problem category', () => {
    act(() => {
      useGameStore.getState().showBubble({
        text: 'Practice the endgame next.',
        variant: 'teaching',
        actions: [{ id: 'practice:endgame', label: 'Open endgame problems' }],
      });
    });

    render(<SenseiBubble />);
    finishTypewriter();

    fireEvent.click(screen.getByRole('button', { name: 'Open endgame problems' }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('endgame');
    expect(useGameStore.getState().bubble.visible).toBe(false);
  });

  it('routes hint actions to local board guidance in guided games', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    act(() => {
      useGameStore.getState().showBubble({
        text: 'Need a move?',
        variant: 'teaching',
        actions: [{ id: 'hint', label: 'Show me' }],
      });
    });

    render(<SenseiBubble />);
    finishTypewriter();

    fireEvent.click(screen.getByRole('button', { name: 'Show me' }));

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('Your next job is: Start with a corner.');
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
  });
});
