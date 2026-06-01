// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProgressDashboard } from '@/components/dashboard/ProgressDashboard';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';

describe('ProgressDashboard', () => {
  beforeEach(() => {
    useProgressStore.getState().resetAll();
    useConceptStore.getState().resetAll();
    useReviewStore.getState().resetAll();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().showDashboard();
  });

  afterEach(() => cleanup());

  it('renders review stats without entering an update loop', () => {
    render(<ProgressDashboard />);

    expect(screen.getByRole('heading', { name: /Progress Dashboard/ })).toBeTruthy();
    expect(screen.getByText('Review Streak')).toBeTruthy();
    expect(screen.getByText('0 due today')).toBeTruthy();
  });
});
