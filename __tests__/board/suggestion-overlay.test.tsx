// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SuggestionOverlay,
  getSuggestionMarkerLabel,
} from '@/components/board/overlays/SuggestionOverlay';
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

  it('uses lettered candidate markers instead of move-like rank numbers', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().applySuggestions([
        {
          id: 'suggestion-test-c7',
          point: { x: 2, y: 2 },
          rank: 1,
          reason: 'Start at C7.',
        },
        {
          id: 'suggestion-test-e7',
          point: { x: 4, y: 2 },
          rank: 2,
          reason: 'Extend at E7.',
        },
        {
          id: 'suggestion-test-g7',
          point: { x: 6, y: 2 },
          rank: 3,
          reason: 'Compare G7.',
        },
      ]);
    });

    const { container } = render(
      <svg>
        <SuggestionOverlay />
      </svg>,
    );

    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
    expect(screen.queryByText('1')).toBeNull();
    expect(container.querySelector('[aria-label="Candidate A, suggestion rank 1: Start at C7."]')).toBeTruthy();
  });

  it('continues labels alphabetically past Z', () => {
    expect(getSuggestionMarkerLabel(1)).toBe('A');
    expect(getSuggestionMarkerLabel(26)).toBe('Z');
    expect(getSuggestionMarkerLabel(27)).toBe('AA');
  });
});
