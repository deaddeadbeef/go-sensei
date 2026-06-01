// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('turns dashboard metrics into a recommended next move', () => {
    render(<ProgressDashboard />);

    expect(screen.getByText('Next best move')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'First 9x9 guided game' })).toBeTruthy();
    expect(screen.getByText('Start on a small board with one clear goal at a time.')).toBeTruthy();
    expect(screen.getByText('Corner Openings')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start guided 9x9' })).toBeTruthy();
  });

  it('starts the recommended guided game from the dashboard', () => {
    render(<ProgressDashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'Start guided 9x9' }));

    expect(useGameStore.getState().appPhase).toBe('game');
    expect(useGameStore.getState().teachingLevel).toBe('guided');
    expect(useProgressStore.getState().hasStartedIntroGame).toBe(true);
  });
});
