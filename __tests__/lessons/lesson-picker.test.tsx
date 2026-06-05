// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LessonPicker } from '@/components/lessons/LessonPicker';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';

describe('LessonPicker', () => {
  beforeEach(() => {
    useProgressStore.getState().resetAll();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().showLessons();
  });

  afterEach(() => cleanup());

  it('shows progress and returns learners to the learning path', () => {
    act(() => useProgressStore.getState().completeLesson('groups'));

    render(<LessonPicker />);

    expect(screen.getByText('1/10 complete')).toBeTruthy();
    expect(screen.getByText('Next lesson: Liberties: Breathing Room. 9 lessons left.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Learning path' }));

    expect(useGameStore.getState().appPhase).toBe('path');
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

  it('still lets learners review completed lessons', () => {
    act(() => useProgressStore.getState().completeLesson('groups'));

    render(<LessonPicker />);

    fireEvent.click(screen.getByRole('button', { name: 'Review →' }));

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('groups');
  });
});
