// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RulesPanel } from '@/components/ui/RulesPanel';
import { createGame, setStone } from '@/lib/go-engine';
import { useGameStore } from '@/stores/game-store';

describe('RulesPanel', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
  });

  afterEach(() => cleanup());

  it('starts open for a fresh guided board', () => {
    render(<RulesPanel />);

    const panel = screen.getByTestId('rules-panel') as HTMLDetailsElement;

    expect(panel.open).toBe(true);
    expect(screen.getByText('Players alternate placing black and white stones')).toBeTruthy();
  });

  it('collapses after the learner starts playing but remains reopenable', () => {
    const { rerender } = render(<RulesPanel />);

    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
    });
    rerender(<RulesPanel />);

    const panel = screen.getByTestId('rules-panel') as HTMLDetailsElement;
    expect(panel.open).toBe(false);

    fireEvent.click(screen.getByText('Rules of Go'));

    expect(panel.open).toBe(true);
    expect(screen.getByText('Stones go on intersections, not squares')).toBeTruthy();
  });

  it('collapses for restored study boards with stones but no move history', () => {
    const game = createGame(9);

    act(() => {
      useGameStore.setState({
        game: {
          ...game,
          board: setStone(game.board, { x: 2, y: 2 }, 'black'),
        },
      });
    });

    render(<RulesPanel />);

    const panel = screen.getByTestId('rules-panel') as HTMLDetailsElement;
    expect(panel.open).toBe(false);

    fireEvent.click(screen.getByText('Rules of Go'));

    expect(panel.open).toBe(true);
    expect(screen.getByText('Players alternate placing black and white stones')).toBeTruthy();
  });
});
