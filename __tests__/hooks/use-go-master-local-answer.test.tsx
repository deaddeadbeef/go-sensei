// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGoMaster } from '@/hooks/useGoMaster';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';

describe('useGoMaster local answers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useConceptStore.getState().resetAll();
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().placeStone({ x: 2, y: 2 });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('answers beginner liberty questions with visible board overlays without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What is a liberty?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Your group at C7 currently has 4 liberties');
    expect(state.overlays.liberties).toEqual([{
      id: 'local-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 4,
      libertyPoints: [
        { x: 2, y: 1 },
        { x: 2, y: 3 },
        { x: 1, y: 2 },
        { x: 3, y: 2 },
      ],
    }]);
    expect(state.overlays.groups).toHaveLength(1);
    expect(state.overlays.groups[0].label).toContain('This connected group has 4 liberties');
    expect(state.chatMessages.some((message) => message.variant === 'user' && message.text === 'What is a liberty?')).toBe(true);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
  });
});
