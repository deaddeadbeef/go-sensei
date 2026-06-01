// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemView } from '@/components/problems/ProblemView';
import { PROBLEMS } from '@/lib/problems/problem-data';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

function problemById(problemId: string) {
  const problem = PROBLEMS.find((candidate) => candidate.id === problemId);
  if (!problem) throw new Error(`Missing test problem ${problemId}`);
  return problem;
}

describe('ProblemView filtered practice flow', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    act(() => {
      useProgressStore.getState().resetAll();
      useGameStore.getState().startNewGame(9);
      useGameStore.getState().showProblems('capture');
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps next problem inside the active problem filter', () => {
    act(() => {
      useGameStore.getState().startProblem(problemById('capture-003'));
      useGameStore.getState().submitProblemMove({ x: 5, y: 4 });
      useGameStore.getState().submitProblemMove({ x: 5, y: 5 });
    });

    render(<ProblemView />);

    fireEvent.click(screen.getByRole('button', { name: 'Next capture problem →' }));

    expect(useGameStore.getState().currentProblemId).toBe('capture-004');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
  });

  it('shows a reading routine while the learner is solving', () => {
    act(() => {
      useGameStore.getState().startProblem(problemById('capture-001'));
    });

    render(<ProblemView />);

    expect(screen.getByText('Read before you click')).toBeTruthy();
    expect(screen.getByText('Target group')).toBeTruthy();
    expect(screen.getByText('Count every liberty before choosing a move.')).toBeTruthy();

    act(() => {
      useGameStore.getState().submitProblemMove({ x: 0, y: 1 });
    });

    expect(screen.queryByText('Read before you click')).toBeNull();
    expect(screen.getByText('Solution line')).toBeTruthy();
  });

  it('returns to the active filtered problem list after the last filtered problem', () => {
    act(() => {
      useGameStore.getState().startProblem(problemById('capture-004'));
      useGameStore.getState().submitProblemMove({ x: 2, y: 2 });
      useGameStore.getState().submitProblemMove({ x: 2, y: 2 });
    });

    render(<ProblemView />);

    expect(screen.queryByRole('button', { name: 'Next Problem →' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '✕ Back to capture problems' }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
  });
});
