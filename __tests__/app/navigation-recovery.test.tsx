// @vitest-environment jsdom

import { act, cleanup, render, waitFor } from '@testing-library/react';
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

  afterEach(() => cleanup());

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
});
