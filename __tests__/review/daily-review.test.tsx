// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyReview } from '@/components/review/DailyReview';
import { useGameStore } from '@/stores/game-store';
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

    fireEvent.click(screen.getByRole('button', { name: 'Solve a fresh problem' }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBeNull();
  });

  it('lets all-caught-up learners return to the learning path', () => {
    render(<DailyReview />);

    fireEvent.click(screen.getByRole('button', { name: 'Learning path' }));

    expect(useGameStore.getState().appPhase).toBe('path');
  });

  it('returns all-caught-up learners to the board', () => {
    render(<DailyReview />);

    fireEvent.click(screen.getByRole('button', { name: 'Return to board' }));

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

    fireEvent.click(screen.getByRole('button', { name: 'Return to board' }));

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

    expect(screen.getByText('✕ Failed')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Finish Review' }));

    expect(screen.getByText('Next step')).toBeTruthy();
    expect(screen.getByText('Rebuild Life and death')).toBeTruthy();
    expect(screen.getByText('Make Two Eyes')).toBeTruthy();
    expect(screen.getByText('missed')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Practice Life and death' }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('life-and-death');
  });

  it('sends clean reviews back to the path recommendation', () => {
    makeProblemDue('capture-001');

    const { container } = render(<DailyReview />);

    clickReviewPoint(container, 0, 1);

    expect(screen.getByText('🎉 Solved!')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Finish Review' }));

    expect(screen.getByText('Ready for the next idea')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Practice Capture' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Pick up next recommendation' }));

    expect(useGameStore.getState().appPhase).toBe('path');
  });
});
