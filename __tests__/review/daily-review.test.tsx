// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyReview } from '@/components/review/DailyReview';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';
import { BOARD_PADDING, SVG_SIZE, cellSize } from '@/utils/coordinates';

function makeProblemDue(problemId: string) {
  useReviewStore.getState().recordReview(problemId, 5);
  useReviewStore.setState((state) => ({
    cards: {
      ...state.cards,
      [problemId]: {
        ...state.cards[problemId],
        nextReviewDate: Date.now() - 1000,
      },
    },
  }));
}

function clickReviewPoint(container: HTMLElement, x: number, y: number, boardSize = 9) {
  const board = container.querySelector('svg');
  if (!board) throw new Error('Review board not found');

  const cell = cellSize(boardSize);
  fireEvent.click(board, {
    clientX: BOARD_PADDING + x * cell,
    clientY: BOARD_PADDING + y * cell,
  });
}

describe('DailyReview', () => {
  let boardRectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useProgressStore.getState().resetAll();
    useReviewStore.getState().resetAll();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().showReview();
    boardRectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: SVG_SIZE,
      bottom: SVG_SIZE,
      width: SVG_SIZE,
      height: SVG_SIZE,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    cleanup();
    boardRectSpy.mockRestore();
  });

  it('sends all-caught-up learners to problem practice', () => {
    render(<DailyReview />);

    expect(screen.getByText('No problems due for review. Solve more problems to build your review queue.')).toBeTruthy();
    expect(screen.getByText('Best next step')).toBeTruthy();
    expect(screen.getByText("Seed tomorrow's review")).toBeTruthy();
    expect(screen.getByText(/Go Sensei will bring it back when the lesson is ready to stick/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start Corner Capture' }));

    expect(useGameStore.getState().appPhase).toBe('problem');
    expect(useGameStore.getState().currentProblemId).toBe('capture-001');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
  });

  it('starts the next unsolved seed problem when reviews are clear', () => {
    useProgressStore.getState().recordProblemAttempt({
      problemId: 'capture-001',
      solved: true,
      attempts: 1,
      moveSequence: [{ x: 0, y: 1 }],
      timestamp: Date.now(),
    });

    render(<DailyReview />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Edge Squeeze' }));

    expect(useGameStore.getState().appPhase).toBe('problem');
    expect(useGameStore.getState().currentProblemId).toBe('capture-002');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
  });

  it('seeds all-caught-up review practice from the current path category', () => {
    useProgressStore.setState({
      completedLessons: ['groups', 'liberties', 'capture', 'territory', 'eyes'],
      hasStartedIntroGame: true,
      problemAttempts: [
        { problemId: 'capture-001', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
        { problemId: 'capture-002', solved: true, attempts: 1, moveSequence: [], timestamp: 2 },
        { problemId: 'capture-003', solved: true, attempts: 1, moveSequence: [], timestamp: 3 },
      ],
    });

    render(<DailyReview />);

    expect(screen.getByText('Seed current path practice')).toBeTruthy();
    expect(screen.getByText(/Your path is asking for Life and Death problems/)).toBeTruthy();
    expect(screen.getByText('This block is complete after 2 more solved life and death problems.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start Make Two Eyes' }));

    expect(useGameStore.getState().appPhase).toBe('problem');
    expect(useGameStore.getState().currentProblemId).toBe('life-001');
    expect(useGameStore.getState().preferredProblemFilter).toBe('life-and-death');
  });

  it('lets all-caught-up learners return to the learning path', () => {
    render(<DailyReview />);

    expect(screen.getByText('Learning path')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Learning path from review summary' }));

    expect(useGameStore.getState().appPhase).toBe('path');
  });

  it('returns all-caught-up learners to the board', () => {
    render(<DailyReview />);

    fireEvent.click(screen.getByRole('button', { name: 'Return to board from review summary' }));

    expect(useGameStore.getState().appPhase).toBe('game');
  });

  it('shows a reading routine for due review problems', () => {
    makeProblemDue('capture-001');

    render(<DailyReview />);

    expect(screen.getByText('Read before you click')).toBeTruthy();
    expect(screen.getByText('Target group')).toBeTruthy();
    expect(screen.getByText('Captures are about the final liberty, not just contact.')).toBeTruthy();
    expect(screen.getByText('👆 Read first, then click your move')).toBeTruthy();
  });

  it('reveals the review hint from the action footer', () => {
    makeProblemDue('capture-001');

    render(<DailyReview />);

    const showHint = screen.getByRole('button', { name: 'Show hint' });
    expect((showHint as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(showHint);

    expect(screen.getByText(/A stone in the corner only has two liberties/)).toBeTruthy();
    const hintShown = screen.getByRole('button', { name: 'Hint shown' });
    expect((hintShown as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Show hint' })).toBeNull();
  });

  it('returns active review learners to the board', () => {
    makeProblemDue('capture-001');

    render(<DailyReview />);

    expect(screen.getByText('Return to board')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Return to board from active review' }));

    expect(useGameStore.getState().appPhase).toBe('game');
  });

  it('keeps the mobile review board square in a scrollable shell', () => {
    makeProblemDue('capture-001');

    render(<DailyReview />);

    const classTokens = (element: HTMLElement) => element.className.split(/\s+/);
    const shell = screen.getByTestId('daily-review-shell');
    const boardPanel = screen.getByTestId('daily-review-board-panel');
    const boardFrame = screen.getByTestId('daily-review-board-frame');
    const sidebar = screen.getByTestId('daily-review-sidebar');

    expect(classTokens(shell)).toEqual(expect.arrayContaining([
      'min-h-0',
      'overflow-y-auto',
      'overflow-x-hidden',
      'md:overflow-hidden',
    ]));
    expect(classTokens(boardPanel)).toEqual(expect.arrayContaining([
      'flex-none',
      'min-h-[340px]',
      'shrink-0',
      'md:flex-[7]',
      'md:min-h-0',
    ]));
    expect(classTokens(boardFrame)).toEqual(expect.arrayContaining([
      'aspect-square',
      'h-full',
      'max-h-[600px]',
      'max-w-full',
    ]));
    expect(classTokens(sidebar)).toEqual(expect.arrayContaining([
      'flex-none',
      'h-[54dvh]',
      'min-h-[300px]',
      'max-h-[600px]',
      'min-w-0',
      'md:flex-[3]',
      'md:min-h-0',
      'md:h-auto',
    ]));
  });

  it('turns missed reviews into targeted practice', () => {
    makeProblemDue('life-001');

    const { container } = render(<DailyReview />);

    clickReviewPoint(container, 1, 1);
    clickReviewPoint(container, 1, 1);
    clickReviewPoint(container, 1, 1);

    expect(screen.getByText('Study the answer')).toBeTruthy();
    expect(screen.getByText("Replay C8 before finishing, so this review becomes tomorrow's memory.")).toBeTruthy();
    expect(screen.getByText('Study routine')).toBeTruthy();
    expect(screen.getByText('First move to remember: C8. Cover the numbers and say why C8 works before moving on.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Finish Review' }));

    expect(screen.getByText('Next step')).toBeTruthy();
    expect(screen.getByText('Rebuild Life and Death')).toBeTruthy();
    expect(screen.queryByText(/Review finish line reached/)).toBeNull();
    expect(screen.getByText('Make Two Eyes')).toBeTruthy();
    expect(screen.getByText('missed - replay C8')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Replay Make Two Eyes' }));

    expect(useGameStore.getState().appPhase).toBe('problem');
    expect(useGameStore.getState().currentProblemId).toBe('life-001');
    expect(useGameStore.getState().preferredProblemFilter).toBe('life-and-death');
  });

  it('sends clean reviews back to the path recommendation', () => {
    useProgressStore.setState({
      completedLessons: ['groups', 'liberties', 'capture'],
      hasStartedIntroGame: true,
      problemAttempts: [],
    });
    makeProblemDue('capture-001');

    const { container } = render(<DailyReview />);

    clickReviewPoint(container, 0, 1);

    expect(screen.getByText('🎉 Solved!')).toBeTruthy();
    expect(screen.getByText('You found A8. Review the sequence once before finishing this card.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Finish Review' }));

    expect(screen.getByText('Ready for the next idea')).toBeTruthy();
    expect(screen.getByText('Review finish line reached: every due card landed cleanly, so the path can move to the next recommendation.')).toBeTruthy();
    expect(screen.getByText('Next on the path: Capture problems.')).toBeTruthy();
    expect(screen.getByText('Next finish line: This block is complete after 3 more solved capture problems.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Practice Capture' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Pick up next recommendation from review summary' }));

    expect(useGameStore.getState().appPhase).toBe('path');
  });
});
