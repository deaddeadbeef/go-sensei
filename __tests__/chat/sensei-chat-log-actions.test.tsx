// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SenseiChatLog } from '@/components/chat/SenseiChatLog';
import { useGameStore } from '@/stores/game-store';

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
});
