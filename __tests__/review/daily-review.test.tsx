// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DailyReview } from '@/components/review/DailyReview';
import { useGameStore } from '@/stores/game-store';
import { useReviewStore } from '@/stores/review-store';

describe('DailyReview', () => {
  beforeEach(() => {
    useReviewStore.getState().resetAll();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().showReview();
  });

  afterEach(() => cleanup());

  it('sends all-caught-up learners to problem practice', () => {
    render(<DailyReview />);

    expect(screen.getByText('No problems due for review. Solve more problems to build your review queue.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Solve a problem' }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBeNull();
  });

  it('lets all-caught-up learners return to the learning path', () => {
    render(<DailyReview />);

    fireEvent.click(screen.getByRole('button', { name: 'Learning path' }));

    expect(useGameStore.getState().appPhase).toBe('path');
  });

  it('shows a reading routine for due review problems', () => {
    useReviewStore.getState().recordReview('capture-001', 5);
    useReviewStore.setState((state) => ({
      cards: {
        ...state.cards,
        'capture-001': {
          ...state.cards['capture-001'],
          nextReviewDate: Date.now() - 1000,
        },
      },
    }));

    render(<DailyReview />);

    expect(screen.getByText('Read before you click')).toBeTruthy();
    expect(screen.getByText('Target group')).toBeTruthy();
    expect(screen.getByText('Captures are about the final liberty, not just contact.')).toBeTruthy();
  });
});
