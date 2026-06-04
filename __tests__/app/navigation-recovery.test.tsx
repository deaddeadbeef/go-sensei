// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GamePage from '@/app/page';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useConceptStore } from '@/stores/concept-store';
import { useReviewStore } from '@/stores/review-store';

vi.mock('@/hooks/useGoMaster', () => ({
  useGoMaster: () => ({
    sendPlayerMove: vi.fn(),
    sendMessage: vi.fn(),
    requestHint: vi.fn(),
    requestReview: vi.fn(),
  }),
}));

vi.mock('@/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({
    authState: { status: 'logged_out' },
    isLoggedIn: false,
    startLogin: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('app navigation recovery', () => {
  beforeEach(() => {
    act(() => {
      useProgressStore.getState().resetAll();
      useConceptStore.getState().resetAll();
      useReviewStore.getState().resetAll();
      useGameStore.getState().startNewGame(9);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('recovers a lesson detail phase with no lesson id to the learning path', async () => {
    act(() => {
      useGameStore.setState({ appPhase: 'lesson', currentLessonId: null });
    });

    render(<GamePage />);

    await waitFor(() => expect(useGameStore.getState().appPhase).toBe('path'));
  });

  it('recovers a problem detail phase with no problem id to the problem picker', async () => {
    act(() => {
      useGameStore.setState({ appPhase: 'problem', currentProblemId: null });
    });

    render(<GamePage />);

    await waitFor(() => expect(useGameStore.getState().appPhase).toBe('problems'));
  });

  it('server-renders a stable shell before persisted stores choose the next recommendation', () => {
    act(() => {
      useGameStore.setState({ appPhase: 'path' });
      useReviewStore.setState({
        cards: {
          'capture-001': {
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            nextReviewDate: Date.now() - 1000,
          },
        },
        history: [],
      });
    });

    const html = renderToString(<GamePage />);

    expect(html).toContain('Loading Go Sensei');
    expect(html).not.toContain('Review due concepts');
    expect(html).not.toContain('First 9x9 guided game');
  });

  it('scopes the floating Sensei bubble to the board area', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });

    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });

    render(<GamePage />);

    const boardBubbleLayer = screen.getByTestId('board-bubble-layer');

    expect(boardBubbleLayer.className).toContain('overflow-hidden');
    expect(boardBubbleLayer.contains(screen.getByText('Go Sensei'))).toBe(true);
  });
});
