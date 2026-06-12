// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SenseiInput } from '@/components/ui/SenseiInput';
import { createGame, setStone } from '@/lib/go-engine';
import { useGameStore } from '@/stores/game-store';

describe('SenseiInput prompt', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().startNewGame(9);
    });
  });

  afterEach(() => cleanup());

  it('prompts brand-new learners to ask for a starting move', () => {
    render(<SenseiInput onSendMessage={vi.fn()} />);

    expect(screen.getByPlaceholderText('Ask: Where should I start?')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Ask Sensei anything...')).toBeNull();
  });

  it('prompts learners to ask what their last move changed', () => {
    act(() => {
      useGameStore.setState({ phase: 'playing' });
      useGameStore.getState().placeStone({ x: 2, y: 2 });
    });

    render(<SenseiInput onSendMessage={vi.fn()} />);

    expect(screen.getByPlaceholderText('Ask: What did C7 change?')).toBeTruthy();
  });

  it('prompts restored study positions toward group safety', () => {
    const game = createGame(9);

    act(() => {
      useGameStore.setState({
        game: {
          ...game,
          board: setStone(game.board, { x: 2, y: 2 }, 'black'),
        },
      });
    });

    render(<SenseiInput onSendMessage={vi.fn()} />);

    expect(screen.getByPlaceholderText('Ask: Which group needs help?')).toBeTruthy();
  });

  it('keeps the thinking placeholder while disabled', () => {
    act(() => {
      useGameStore.getState().setAiThinking(true);
    });

    render(<SenseiInput onSendMessage={vi.fn()} />);

    const input = screen.getByPlaceholderText('Sensei is thinking...') as HTMLInputElement;
    const button = screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement;
    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
  });

  it('sends the suggested question when the input is empty', () => {
    const onSendMessage = vi.fn();

    render(<SenseiInput onSendMessage={onSendMessage} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask suggested question' }));

    expect(onSendMessage).toHaveBeenCalledWith('Where should I start?');
  });

  it('sends typed text instead of the suggested question', () => {
    const onSendMessage = vi.fn();

    render(<SenseiInput onSendMessage={onSendMessage} />);

    const input = screen.getByPlaceholderText('Ask: Where should I start?') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'What is a liberty?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSendMessage).toHaveBeenCalledWith('What is a liberty?');
    expect(input.value).toBe('');
  });

  it('submits the suggested question with Enter when the input is empty', () => {
    const onSendMessage = vi.fn();

    render(<SenseiInput onSendMessage={onSendMessage} />);

    const input = screen.getByPlaceholderText('Ask: Where should I start?');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSendMessage).toHaveBeenCalledWith('Where should I start?');
  });
});
