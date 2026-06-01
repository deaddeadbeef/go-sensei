// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SenseiBubble } from '@/components/ui/SenseiBubble';
import { useGameStore } from '@/stores/game-store';

describe('SenseiBubble actions', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().dismissBubble();
    });
  });

  afterEach(() => cleanup());

  it('routes practice actions to the matching problem category', async () => {
    act(() => {
      useGameStore.getState().showBubble({
        text: 'Try a capture problem next.',
        variant: 'teaching',
        actions: [{ id: 'practice:capture', label: 'Practice capture' }],
      });
    });

    render(<SenseiBubble />);

    fireEvent.click(await screen.findByRole('button', { name: 'Practice capture' }, { timeout: 3000 }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
    expect(useGameStore.getState().bubble.visible).toBe(false);
  });

  it('routes lesson actions to the matching lesson checkpoint', async () => {
    act(() => {
      useGameStore.getState().showBubble({
        text: 'Review territory next.',
        variant: 'teaching',
        actions: [{ id: 'lesson:territory', label: 'Review territory' }],
      });
    });

    render(<SenseiBubble />);

    fireEvent.click(await screen.findByRole('button', { name: 'Review territory' }, { timeout: 3000 }));

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('territory');
    expect(useGameStore.getState().bubble.visible).toBe(false);
  });
});
