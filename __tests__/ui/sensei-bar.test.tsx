// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SenseiBar } from '@/components/ui/SenseiBar';
import { useGameStore } from '@/stores/game-store';
import type { AppPhase } from '@/stores/game-store';

describe('SenseiBar status', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().startNewGame(9);
      useGameStore.setState({ phase: 'playing', appPhase: 'game' });
    });
  });

  afterEach(() => cleanup());

  it('keeps move and turn status on the game board', () => {
    render(<SenseiBar onSettingsClick={vi.fn()} isLoggedIn={false} />);

    expect(screen.getByText('Move 0')).toBeTruthy();
    expect(screen.getByText('Your turn')).toBeTruthy();
  });

  it('keeps mobile navigation compact and accessible', () => {
    const classTokens = (element: HTMLElement) => element.className.split(/\s+/);

    render(<SenseiBar onSettingsClick={vi.fn()} isLoggedIn={false} />);

    const bar = screen.getByTestId('sensei-bar');
    const actions = screen.getByTestId('sensei-bar-actions');
    const lessonsButton = screen.getByRole('button', { name: 'Learn Go' });

    expect(classTokens(bar)).toEqual(expect.arrayContaining([
      'overflow-hidden',
      'px-2',
      'sm:px-4',
    ]));
    expect(classTokens(actions)).toEqual(expect.arrayContaining([
      'shrink-0',
      'gap-0.5',
      'sm:gap-2',
    ]));
    expect(classTokens(lessonsButton)).toEqual(expect.arrayContaining([
      'h-7',
      'w-7',
      'shrink-0',
      'sm:w-auto',
    ]));

    fireEvent.click(lessonsButton);

    expect(useGameStore.getState().appPhase).toBe('lessons');
  });

  it.each([
    ['path', 'Learning path'],
    ['lessons', 'Lesson library'],
    ['lesson', 'Lesson checkpoint'],
    ['problems', 'Problem practice'],
    ['problem', 'Solving problem'],
    ['skills', 'Skill tree'],
    ['review', 'Daily review'],
    ['dashboard', 'Progress dashboard'],
  ] satisfies Array<[AppPhase, string]>)(
    'shows the %s surface instead of stale game turn state',
    (appPhase, expectedLabel) => {
      act(() => {
        useGameStore.setState({ appPhase, phase: 'playing' });
      });

      render(<SenseiBar onSettingsClick={vi.fn()} isLoggedIn={false} />);

      expect(screen.getByText(expectedLabel)).toBeTruthy();
      expect(screen.queryByText('Move 0')).toBeNull();
      expect(screen.queryByText('Your turn')).toBeNull();
    },
  );
});
