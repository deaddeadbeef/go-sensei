// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemPicker } from '@/components/problems/ProblemPicker';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';

const scrollIntoViewMock = vi.fn();

describe('ProblemPicker', () => {
  beforeEach(() => {
    scrollIntoViewMock.mockReset();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });
    act(() => {
      useProgressStore.getState().resetAll();
      useReviewStore.getState().resetAll();
      useConceptStore.getState().resetAll();
      useGameStore.getState().startNewGame(9);
      useGameStore.getState().showProblems();
    });
  });

  afterEach(() => cleanup());

  it('recommends the first unsolved problem and starts it', () => {
    render(<ProblemPicker />);

    expect(screen.getByText('Recommended next')).toBeTruthy();
    expect(screen.getByText('Start here: it is the gentlest unsolved problem in the library.')).toBeTruthy();
    expect(screen.getByText('0/20 problems solved')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Solve: Corner Capture' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start Corner Capture' }));

    expect(useGameStore.getState().appPhase).toBe('problem');
    expect(useGameStore.getState().currentProblemId).toBe('capture-001');
  });

  it('resets the picker to the top so the recommendation stays visible after returning', () => {
    render(<ProblemPicker />);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'start' });

    fireEvent.click(screen.getByRole('button', { name: 'Reading' }));

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);
  });

  it('returns learners to the board from the problem library', () => {
    render(<ProblemPicker />);

    expect(screen.getByText('Return to board')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Return to board from problem library' }));

    expect(useGameStore.getState().appPhase).toBe('game');
  });

  it('continues through the all-problems list after progress', () => {
    act(() => {
      useProgressStore.getState().recordProblemAttempt({
        problemId: 'capture-001',
        solved: true,
        attempts: 1,
        moveSequence: [{ x: 0, y: 1 }],
        timestamp: Date.now(),
      });
    });

    render(<ProblemPicker />);

    expect(screen.getByText('Continue with the next unsolved problem in the library.')).toBeTruthy();
    expect(screen.getByText('1/20 problems solved')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Edge Squeeze' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry: Corner Capture' })).toBeTruthy();
  });

  it('keeps stale problem ids out of problem-library progress', () => {
    act(() => {
      useProgressStore.setState({
        problemAttempts: [
          { problemId: 'missing-problem-id', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
        ],
      });
    });

    render(<ProblemPicker />);

    expect(screen.getByText('Start here: it is the gentlest unsolved problem in the library.')).toBeTruthy();
    expect(screen.getByText('0/20 problems solved')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Corner Capture' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Solve: Corner Capture' })).toBeTruthy();
  });

  it('uses the active filter and progress to choose the next visible problem', () => {
    act(() => {
      useProgressStore.getState().recordProblemAttempt({
        problemId: 'capture-001',
        solved: true,
        attempts: 1,
        moveSequence: [{ x: 0, y: 1 }],
        timestamp: Date.now(),
      });
      useGameStore.getState().showProblems('capture');
    });

    render(<ProblemPicker />);

    expect(screen.getByText('Continue with the next unsolved capture problem.')).toBeTruthy();
    expect(screen.getByText('1/4 capture problems solved')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start Edge Squeeze' }));

    expect(useGameStore.getState().currentProblemId).toBe('capture-002');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
  });

  it('keeps the learning path practice target visible in recommended filtered practice', () => {
    act(() => {
      useProgressStore.setState({
        completedLessons: ['groups', 'liberties', 'capture', 'territory', 'eyes'],
        hasStartedIntroGame: true,
        problemAttempts: [
          { problemId: 'capture-001', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
          { problemId: 'capture-002', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
          { problemId: 'capture-003', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
        ],
      });
      useGameStore.getState().showProblems('life-and-death');
    });

    render(<ProblemPicker />);

    expect(screen.getByText('Path goal')).toBeTruthy();
    expect(screen.getByText('Practice life and death until you solve 2 more life and death problems.')).toBeTruthy();
    expect(screen.getByText('Finish line:')).toBeTruthy();
    expect(screen.getByText('This block is complete after 2 more solved life and death problems.')).toBeTruthy();
  });

  it('explains why a manually filtered problem set is worth practicing', () => {
    act(() => {
      useGameStore.getState().showProblems('reading');
    });

    render(<ProblemPicker />);

    expect(screen.getByText('Focused practice')).toBeTruthy();
    expect(screen.getByText('Reading problems train you to follow forcing moves before touching the board.')).toBeTruthy();
  });
});
