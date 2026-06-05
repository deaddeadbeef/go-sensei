// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StoneLayer, getRecentMoveLabels } from '@/components/board/StoneLayer';
import { useGameStore } from '@/stores/game-store';
import type { CellState, Move } from '@/lib/go-engine/types';

describe('StoneLayer', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
  });

  afterEach(() => cleanup());

  it('shows compact numbers for the five most recent surviving placed stones', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().applyAiMove({ x: 3, y: 2 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().applyAiMove({ x: 5, y: 2 });
      useGameStore.getState().placeStone({ x: 6, y: 2 });
      useGameStore.getState().applyAiMove({ x: 7, y: 2 });
    });

    render(
      <svg>
        <StoneLayer />
      </svg>,
    );

    expect(screen.queryByText('1')).toBeNull();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('does not label captured or currently hidden stones', () => {
    const grid: CellState[][] = [
      [null, null, null],
      [null, 'black', null],
      [null, 'white', null],
    ];
    const moveHistory: Move[] = [
      { type: 'place', point: { x: 0, y: 0 }, color: 'black', captured: [] },
      { type: 'place', point: { x: 1, y: 1 }, color: 'black', captured: [] },
      { type: 'place', point: { x: 1, y: 2 }, color: 'white', captured: [] },
    ];

    const labels = getRecentMoveLabels(moveHistory, grid, new Set(['1,2']));

    expect(labels.has('0,0')).toBe(false);
    expect(labels.has('1,2')).toBe(false);
    expect(labels.get('1,1')?.moveNumber).toBe(2);
  });
});
