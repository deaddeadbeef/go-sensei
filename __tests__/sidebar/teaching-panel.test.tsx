// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TeachingPanel } from '@/components/sidebar/TeachingPanel';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';

describe('TeachingPanel', () => {
  beforeEach(() => {
    act(() => {
      useProgressStore.getState().resetAll();
      useReviewStore.getState().resetAll();
      useConceptStore.getState().resetAll();
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().applySuggestions([{
        id: 'analysis-c7',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      }]);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('plays a board-analysis suggestion when the learner clicks it', () => {
    render(<TeachingPanel />);

    fireEvent.click(screen.getByRole('button', {
      name: /Play C7 suggestion: Start at C7: the board edge helps this stone make territory\./,
    }));

    const state = useGameStore.getState();
    const lastMove = state.game.moveHistory.at(-1);

    expect(lastMove).toMatchObject({
      type: 'place',
      color: 'black',
      point: { x: 2, y: 2 },
    });
    expect(state.lastPlayerMove).toEqual({ x: 2, y: 2 });
    expect(state.game.currentPlayer).toBe('white');
  });
});
