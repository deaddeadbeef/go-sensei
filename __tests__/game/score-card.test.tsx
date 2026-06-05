// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScoreCard } from '@/components/game/ScoreCard';
import { useGameStore } from '@/stores/game-store';

describe('ScoreCard', () => {
  beforeEach(() => {
    useGameStore.getState().startNewGame(9);
    useGameStore.setState({
      scorecard: {
        visible: true,
        blackScore: 12,
        whiteScore: 10.5,
        blackTerritory: 10,
        whiteTerritory: 4,
        blackCaptures: 2,
        whiteCaptures: 0,
        komi: 6.5,
        winner: 'black',
      },
    });
  });

  afterEach(() => cleanup());

  it('invites learners to ask Sensei for a game review', () => {
    const onPlayAgain = vi.fn();
    const onReviewGame = vi.fn();

    render(<ScoreCard onPlayAgain={onPlayAgain} onReviewGame={onReviewGame} />);

    expect(screen.getByText('● Black wins!')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play Again' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ask Sensei to review' }));

    expect(onReviewGame).toHaveBeenCalledTimes(1);
    expect(onPlayAgain).not.toHaveBeenCalled();
  });
});
