// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SenseiChatLog } from '@/components/chat/SenseiChatLog';
import { createBoard, createGame, setStone } from '@/lib/go-engine';
import type { GameState, Point, StoneColor } from '@/lib/go-engine/types';
import { useGameStore } from '@/stores/game-store';

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

describe('SenseiChatLog actions', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().dismissBubble();
    });
  });

  afterEach(() => cleanup());

  it('keeps assistant follow-up actions available in the chat transcript', () => {
    act(() => {
      useGameStore.getState().showBubble({
        text: 'Captures need every liberty filled.',
        variant: 'teaching',
        actions: [{ id: 'practice:capture', label: 'Practice capture' }],
      });
      useGameStore.getState().dismissBubble();
    });

    render(<SenseiChatLog />);

    fireEvent.click(screen.getByRole('button', { name: 'Practice capture' }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
  });

  it('uses a board-aware empty prompt after the learner has moved', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
    });

    render(<SenseiChatLog />);

    expect(screen.getByText('Ask about the current board, a marked target, or why the last move mattered.')).toBeTruthy();
    expect(screen.queryByText('Place a stone to start learning!')).toBeNull();
  });

  it('uses a board-aware empty prompt for restored boards without move history', () => {
    act(() => {
      useGameStore.setState({
        game: settledShapeGame(),
        chatMessages: [],
      });
    });

    render(<SenseiChatLog />);

    expect(screen.getByText('Ask about the current board, a marked target, or why the last move mattered.')).toBeTruthy();
    expect(screen.queryByText('Place a stone to start learning!')).toBeNull();
  });
});
