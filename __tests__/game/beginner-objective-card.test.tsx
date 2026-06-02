// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BeginnerObjectiveCard } from '@/components/game/BeginnerObjectiveCard';
import { useGameStore } from '@/stores/game-store';

describe('BeginnerObjectiveCard', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
  });

  afterEach(() => cleanup());

  it('names the marked opening points for coordinate learners', () => {
    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('Start with a corner')).toBeTruthy();
    expect(screen.getByText('Try C7, G7, C3, or G3.')).toBeTruthy();
  });

  it('plays a named target from the objective card', () => {
    render(<BeginnerObjectiveCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Play C7 target for Start with a corner' }));

    const state = useGameStore.getState();
    const lastMove = state.game.moveHistory.at(-1);
    expect(lastMove).toMatchObject({
      type: 'place',
      color: 'black',
      point: { x: 2, y: 2 },
    });
    expect(state.lastPlayerMove).toEqual({ x: 2, y: 2 });
    expect(state.game.currentPlayer).toBe('white');
  });

  it('names extension targets after the learner claims a corner', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('Make your stones work together')).toBeTruthy();
    expect(screen.getByText('Try E7 or C5.')).toBeTruthy();
  });

  it('shows progress when the learner completes the previous objective', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('Good: C7 hit the marked corner goal. Next, make that stone work with another one.')).toBeTruthy();
    expect(screen.getByText('Make your stones work together')).toBeTruthy();
  });

  it('keeps the last missed objective visible without blocking the next try', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 4, y: 4 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('Progress check: E5 was not one of the marked corner points. Try C7, G7, C3, or G3.')).toBeTruthy();
    expect(screen.getByText('Start with a corner')).toBeTruthy();
  });
});
