import { act } from '@testing-library/react';
import { compactChatMessages, useGameStore, type ChatMessage } from '@/stores/game-store';

beforeEach(() => {
  act(() => useGameStore.getState().startNewGame(9));
});

describe('chat hygiene', () => {
  it('suppresses exact duplicate tutor messages even when another message is between them', () => {
    act(() => {
      useGameStore.getState().showBubble({ text: 'Take your time.', variant: 'teaching' });
      useGameStore.getState().addChatMessage('Sensei used local guidance and passed for White.', 'system');
      useGameStore.getState().showBubble({ text: 'Take your time.', variant: 'teaching' });
    });

    const matchingMessages = useGameStore
      .getState()
      .chatMessages
      .filter((message) => message.text === 'Take your time.');

    expect(matchingMessages).toHaveLength(1);
    expect(useGameStore.getState().bubble.text).toBe('Take your time.');
  });

  it('keeps repeated user messages because they are learner intent, not tutor noise', () => {
    act(() => {
      useGameStore.getState().addChatMessage('What should I read?', 'user');
      useGameStore.getState().addChatMessage('What should I read?', 'user');
    });

    expect(useGameStore.getState().chatMessages.filter((message) => message.variant === 'user')).toHaveLength(2);
  });

  it('compacts duplicate non-user messages from an old persisted chat log', () => {
    const oldLog: ChatMessage[] = [
      { id: 'm1', text: 'Welcome to Guided Mode.', variant: 'teaching', timestamp: 1 },
      { id: 'm2', text: 'What is atari?', variant: 'user', timestamp: 2 },
      { id: 'm3', text: 'Welcome to Guided Mode.', variant: 'teaching', timestamp: 3 },
      { id: 'm4', text: 'What is atari?', variant: 'user', timestamp: 4 },
      { id: 'm5', text: 'Sensei used local guidance and passed for White.', variant: 'system', timestamp: 5 },
      { id: 'm6', text: 'Sensei used local guidance and passed for White.', variant: 'system', timestamp: 6 },
    ];

    expect(compactChatMessages(oldLog).map((message) => message.id)).toEqual(['m2', 'm3', 'm4', 'm6']);
  });
});
