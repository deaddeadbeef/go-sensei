// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TeachingPanel } from '@/components/sidebar/TeachingPanel';
import { createBoard, createGame, passMove, playMove, setStone } from '@/lib/go-engine';
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

function pendingF5PressureReadGame(): GameState {
  const moves: Point[] = [
    { x: 2, y: 2 },
    { x: 4, y: 2 },
    { x: 6, y: 2 },
    { x: 6, y: 4 },
    { x: 6, y: 6 },
    { x: 4, y: 6 },
    { x: 2, y: 6 },
    { x: 2, y: 4 },
    { x: 4, y: 4 },
  ];

  return moves.reduce((game, point) => {
    const result = playMove(game, point);
    if (!result.success) throw new Error(`test setup move failed at ${point.x},${point.y}`);
    return passMove(result.newState);
  }, createGame(9));
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

  it('does not offer fresh-area analysis while a pressure read is unresolved', () => {
    act(() => {
      useGameStore.setState({
        game: pendingF5PressureReadGame(),
        appPhase: 'game',
        phase: 'playing',
        teachingLevel: 'guided',
        overlays: {
          highlights: [],
          targetHints: [],
          liberties: [],
          suggestions: [
            {
              id: 'stale-fresh-area-b8',
              point: { x: 1, y: 1 },
              rank: 1,
              reason: 'Consider B8 as a fresh upper-left direction away from the settled local shape.',
            },
            {
              id: 'stale-fresh-area-h8',
              point: { x: 7, y: 1 },
              rank: 2,
              reason: 'Consider H8 as a fresh upper-right direction away from the settled local shape.',
            },
          ],
          arrows: [],
          influence: [],
          groups: [],
        },
      });
    });

    render(<TeachingPanel />);

    expect(screen.getByText('Move Insight')).toBeTruthy();
    expect(screen.getByText('One-space jump shape')).toBeTruthy();
    expect(screen.getByText('Read F5 before choosing a new area: decide whether Black should connect, defend, or can safely move elsewhere.')).toBeTruthy();
    expect(screen.queryByText('Board Analysis')).toBeNull();
    expect(screen.queryByRole('button', {
      name: 'Play candidate A at B8: Consider B8 as a fresh upper-left direction away from the settled local shape.',
    })).toBeNull();
    expect(screen.queryByRole('button', {
      name: 'Play candidate B at H8: Consider H8 as a fresh upper-right direction away from the settled local shape.',
    })).toBeNull();
  });
});
