// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InteractionLayer } from '@/components/board/InteractionLayer';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';

describe('InteractionLayer illegal move feedback', () => {
  beforeEach(() => {
    act(() => {
      useConceptStore.getState().resetAll();
      useGameStore.getState().startGuidedIntroGame();
      const result = useGameStore.getState().placeStone({ x: 2, y: 2 });
      if (!result.success) throw new Error('test setup move failed');
      useGameStore.getState().pass();
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('turns an occupied-point click into visible local teaching feedback', () => {
    const { container } = render(
      <svg>
        <InteractionLayer />
      </svg>,
    );
    const occupiedC7 = container.querySelectorAll('circle')[20];
    expect(occupiedC7).toBeTruthy();

    act(() => {
      fireEvent.click(occupiedC7);
    });

    const state = useGameStore.getState();

    expect(state.game.moveHistory).toHaveLength(2);
    expect(state.bubble.variant).toBe('warning');
    expect(state.bubble.text).toContain('C7 already has a Black stone, so you cannot play there.');
    expect(state.bubble.text).toContain('Try E7 or C5.');
    expect(state.bubble.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.chatMessages.at(-1)?.text).toContain('C7 already has a Black stone');
    expect(state.overlays.highlights).toEqual([{
      id: 'illegal-occupied-2,2',
      point: { x: 2, y: 2 },
      variant: 'warning',
      label: 'C7 is occupied by Black.',
    }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('stones-and-board').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });
});
