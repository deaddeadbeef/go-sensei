// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LessonPicker } from '@/components/lessons/LessonPicker';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';

function makeReviewDue(problemId: string) {
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

describe('LessonPicker', () => {
  beforeEach(() => {
    useProgressStore.getState().resetAll();
    useReviewStore.getState().resetAll();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().showLessons();
  });

  afterEach(() => cleanup());

  it('shows progress and returns learners to the learning path', () => {
    act(() => useProgressStore.getState().completeLesson('groups'));

    render(<LessonPicker />);

    expect(screen.getByText('Learn one board idea, then continue with the next review, problem, or game.')).toBeTruthy();
    expect(screen.queryByText('Learn one board idea, then return to the path for the next step.')).toBeNull();
    expect(screen.getByText('1/10 complete')).toBeTruthy();
    expect(screen.getByText('Next lesson: Liberties: Breathing Room. 9 lessons left.')).toBeTruthy();
    expect(screen.getByText('Learning path')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Learning path from lesson library' }));

    expect(useGameStore.getState().appPhase).toBe('path');
  });

  it('does not add an extra period after question-titled lessons', () => {
    render(<LessonPicker />);

    expect(screen.getByText('Next lesson: What is a Group? 10 lessons left.')).toBeTruthy();
    expect(screen.queryByText('Next lesson: What is a Group?. 10 lessons left.')).toBeNull();
  });

  it('keeps stale lesson ids out of lesson-library progress', () => {
    useProgressStore.setState({
      completedLessons: ['groups', 'stale-lesson-id'],
    });

    render(<LessonPicker />);

    expect(screen.getByText('1/10 complete')).toBeTruthy();
    expect(screen.getByText('Next lesson: Liberties: Breathing Room. 9 lessons left.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review lesson: What is a Group?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start lesson: Liberties: Breathing Room' })).toBeTruthy();
  });

  it('starts the named next lesson from the progress panel', () => {
    act(() => useProgressStore.getState().completeLesson('groups'));

    render(<LessonPicker />);

    fireEvent.click(screen.getByRole('button', { name: 'Start next lesson: Liberties: Breathing Room' }));

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('liberties');
  });

  it('keeps due review ahead of the next lesson in the lesson library', () => {
    act(() => {
      useProgressStore.getState().completeLesson('groups');
      makeReviewDue('capture-001');
    });

    render(<LessonPicker />);

    expect(screen.getByText('Review due')).toBeTruthy();
    expect(screen.getByText('1 review position is due before new lessons.')).toBeTruthy();
    expect(screen.getByText('After review, next lesson: Liberties: Breathing Room.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start next lesson: Liberties: Breathing Room' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start lesson: Liberties: Breathing Room' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Review due before lesson: Liberties: Breathing Room' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review lesson: What is a Group?' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Review due before lesson: Liberties: Breathing Room' }));

    expect(useGameStore.getState().appPhase).toBe('review');

    act(() => useGameStore.getState().showLessons());

    fireEvent.click(screen.getByRole('button', { name: 'Start daily review from lesson library' }));

    expect(useGameStore.getState().appPhase).toBe('review');
  });

  it('returns learners to the board from the lesson library', () => {
    render(<LessonPicker />);

    expect(screen.getByText('Return to board')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Return to board from lesson library' }));

    expect(useGameStore.getState().appPhase).toBe('game');
  });

  it('uses an internally scrollable top-aligned shell for mobile lesson lists', () => {
    render(<LessonPicker />);

    const shell = screen.getByTestId('lesson-library');

    expect(shell.className).toContain('flex-1');
    expect(shell.className).toContain('min-h-0');
    expect(shell.className).toContain('items-start');
    expect(shell.className).toContain('overflow-y-auto');
    expect(shell.className).not.toContain('items-center');
    expect(shell.className).not.toContain('min-h-screen');
  });

  it('names each start action by lesson', () => {
    render(<LessonPicker />);

    fireEvent.click(screen.getByRole('button', { name: 'Start lesson: Liberties: Breathing Room' }));

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('liberties');
  });

  it('still lets learners review completed lessons', () => {
    act(() => useProgressStore.getState().completeLesson('groups'));

    render(<LessonPicker />);

    fireEvent.click(screen.getByRole('button', { name: 'Review lesson: What is a Group?' }));

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('groups');
  });
});
