// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemView } from '@/components/problems/ProblemView';
import { PROBLEMS } from '@/lib/problems/problem-data';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';

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
      useReviewStore.getState().resetAll();
      useConceptStore.getState().resetAll();
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
    expect(screen.getByText('Why this worked')).toBeTruthy();
    expect(screen.getByText(/The first move at A8 works by attacking liberties/)).toBeTruthy();
  });

  it('keeps the mobile problem board below the app bar in a scrollable shell', () => {
    act(() => {
      useGameStore.getState().startProblem(problemById('capture-001'));
    });

    render(<ProblemView />);

    const classTokens = (element: HTMLElement) => element.className.split(/\s+/);
    const shell = screen.getByTestId('problem-shell');
    const boardPanel = screen.getByTestId('problem-board-panel');
    const sidebar = screen.getByTestId('problem-sidebar');

    expect(classTokens(shell)).toEqual(expect.arrayContaining([
      'min-h-0',
      'overflow-y-auto',
      'overflow-x-hidden',
      'md:overflow-hidden',
    ]));
    expect(classTokens(boardPanel)).toEqual(expect.arrayContaining([
      'flex-none',
      'min-h-[300px]',
      'shrink-0',
      'md:flex-[7]',
      'md:min-h-0',
    ]));
    expect(classTokens(sidebar)).toEqual(expect.arrayContaining([
      'flex-none',
      'h-[58dvh]',
      'min-h-[340px]',
      'max-h-[600px]',
      'min-w-0',
      'md:flex-[3]',
      'md:min-h-0',
      'md:h-auto',
    ]));
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

  it('returns learners to the path when recommended filtered practice is satisfied', () => {
    act(() => {
      useProgressStore.setState({
        completedLessons: ['groups', 'liberties', 'capture', 'territory', 'eyes'],
        hasStartedIntroGame: true,
        problemAttempts: [
          { problemId: 'capture-001', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
          { problemId: 'capture-002', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
          { problemId: 'capture-003', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
          { problemId: 'life-001', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
        ],
      });
      useGameStore.getState().showProblems('life-and-death');
      useGameStore.getState().startProblem(problemById('life-002'));
      useGameStore.getState().submitProblemMove({ x: 1, y: 1 });
    });

    render(<ProblemView />);

    expect(screen.getByText('Practice goal met')).toBeTruthy();
    expect(screen.getByText(/Return to the path for:/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Continue: Play a guided game' }));

    expect(useGameStore.getState().appPhase).toBe('path');
  });
});
