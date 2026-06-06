// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TeachingPanel } from '@/components/sidebar/TeachingPanel';
import { createBoard, createGame, setStone } from '@/lib/go-engine';
import type { GameState, Point, StoneColor } from '@/lib/go-engine/types';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';

function boardWith(stones: Array<{ point: Point; color: StoneColor }>) {
  return stones.reduce(
    (board, stone) => setStone(board, stone.point, stone.color),
    createBoard(9),
  );
}

function settledShapeGame(): GameState {
  return {
    ...createGame(9),
    board: boardWith([
      { point: { x: 2, y: 2 }, color: 'black' },
      { point: { x: 4, y: 2 }, color: 'black' },
      { point: { x: 6, y: 2 }, color: 'black' },
      { point: { x: 2, y: 4 }, color: 'black' },
      { point: { x: 3, y: 4 }, color: 'black' },
      { point: { x: 4, y: 4 }, color: 'black' },
      { point: { x: 6, y: 4 }, color: 'black' },
      { point: { x: 2, y: 6 }, color: 'black' },
      { point: { x: 4, y: 6 }, color: 'black' },
      { point: { x: 6, y: 6 }, color: 'black' },
    ]),
  };
}

describe('TeachingPanel', () => {
  beforeEach(() => {
    act(() => {
      useProgressStore.getState().resetAll();
      useReviewStore.getState().resetAll();
      useConceptStore.getState().resetAll();
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().applySuggestions([{
        id: 'analysis-c7',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      }]);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('plays a board-analysis suggestion when the learner clicks it', () => {
    render(<TeachingPanel />);

    expect(screen.getByText('A C7')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', {
      name: /Play candidate A at C7: Start at C7: the board edge helps this stone make territory\./,
    }));

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

  it('derives current objective suggestions when restored guided overlays are empty', () => {
    act(() => {
      useGameStore.setState({
        game: settledShapeGame(),
        appPhase: 'game',
        phase: 'playing',
        teachingLevel: 'guided',
        overlays: {
          highlights: [],
          targetHints: [],
          liberties: [],
          suggestions: [],
          arrows: [],
          influence: [],
          groups: [],
        },
      });
    });

    render(<TeachingPanel />);

    expect(screen.getByText('Choose a fresh direction')).toBeTruthy();
    expect(screen.getByText('Board Analysis')).toBeTruthy();
    expect(screen.getByRole('button', {
      name: 'Play candidate A at H8: Consider H8 as a fresh upper-right direction away from the settled local shape.',
    })).toBeTruthy();
    expect(screen.getByRole('button', {
      name: 'Play candidate B at H2: Consider H2 as a fresh lower-right direction away from the settled local shape.',
    })).toBeTruthy();
  });
});
