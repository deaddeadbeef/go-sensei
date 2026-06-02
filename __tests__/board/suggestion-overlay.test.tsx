// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SuggestionOverlay } from '@/components/board/overlays/SuggestionOverlay';
import { useGameStore } from '@/stores/game-store';

describe('SuggestionOverlay', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not intercept clicks on suggested board points', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().applySuggestions([{
        id: 'suggestion-test-c7',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7.',
      }]);
    });

    const { container } = render(
      <svg>
        <SuggestionOverlay />
      </svg>,
    );

    expect(container.querySelector('g[pointer-events="none"]')).toBeTruthy();
  });
});
