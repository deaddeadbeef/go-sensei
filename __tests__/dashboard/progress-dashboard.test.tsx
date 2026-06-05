// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProgressDashboard } from '@/components/dashboard/ProgressDashboard';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';
import type { ProblemAttempt } from '@/lib/problems/types';

function solved(problemId: string): ProblemAttempt {
  return {
    problemId,
    solved: true,
    attempts: 1,
    moveSequence: [],
    timestamp: 1,
  };
}

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

  it('opens the full learning path from the recommendation panel', () => {
    render(<ProgressDashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'See full learning path' }));

    expect(useGameStore.getState().appPhase).toBe('path');
  });

  it('restores guided 9x9 from a guided-game recommendation when the current game is stale', () => {
    useGameStore.getState().startGuidedIntroGame();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().setTeachingLevel('beginner');
    useGameStore.getState().showDashboard();
    for (const lessonId of ['groups', 'liberties', 'capture', 'territory', 'eyes']) {
      useProgressStore.getState().completeLesson(lessonId);
    }
    for (const attempt of [
      solved('capture-001'),
      solved('capture-002'),
      solved('capture-003'),
      solved('life-001'),
      solved('life-002'),
    ]) {
      useProgressStore.getState().recordProblemAttempt(attempt);
    }

    render(<ProgressDashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue guided game' }));

    expect(useProgressStore.getState().hasStartedIntroGame).toBe(true);
    expect(useGameStore.getState().appPhase).toBe('game');
    expect(useGameStore.getState().teachingLevel).toBe('guided');
    expect(useGameStore.getState().game.board.size).toBe(9);
    expect(useGameStore.getState().bubble.text).toContain('Your first job is: Start with a corner.');
  });
});
