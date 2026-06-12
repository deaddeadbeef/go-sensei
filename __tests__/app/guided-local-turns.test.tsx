// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GamePage from '@/app/page';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';

vi.mock('@/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({
    authState: { status: 'logged_out' },
    isLoggedIn: false,
    startLogin: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('guided local turn loop', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });

    act(() => {
      useProgressStore.getState().resetAll();
      useConceptStore.getState().resetAll();
      useReviewStore.getState().resetAll();
      useGameStore.getState().startGuidedIntroGame();
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps no-auth guided learners moving after the second learner move', async () => {
    render(<GamePage />);

    act(() => {
      const result = useGameStore.getState().placeStone({ x: 2, y: 2 });
      expect(result.success).toBe(true);
    });

    await waitFor(() => {
      const state = useGameStore.getState();
      expect(state.game.currentPlayer).toBe('black');
      expect(state.game.moveHistory).toHaveLength(2);
      expect(state.game.moveHistory[1]).toMatchObject({ type: 'pass', color: 'white' });
    });

    act(() => {
      const result = useGameStore.getState().placeStone({ x: 4, y: 2 });
      expect(result.success).toBe(true);
    });

    await waitFor(() => {
      const state = useGameStore.getState();
      expect(state.game.currentPlayer).toBe('black');
      expect(state.game.moveHistory).toHaveLength(4);
      expect(state.game.moveHistory[3]).toMatchObject({ type: 'pass', color: 'white' });
    });

    expect(useGameStore.getState().bubble.text).toContain('Good: E7 made a one-space jump from your stone.');
    expect(useGameStore.getState().bubble.text).toContain('Try G7, E5, or C5.');
  });
});
