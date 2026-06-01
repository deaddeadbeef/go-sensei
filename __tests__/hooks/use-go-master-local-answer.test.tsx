// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGoMaster } from '@/hooks/useGoMaster';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import type { Point } from '@/lib/go-engine';

function playStoreSequence(points: Point[]) {
  for (const point of points) {
    const result = useGameStore.getState().placeStone(point);
    if (!result.success) {
      throw new Error(`test setup move failed at ${point.x},${point.y}`);
    }
  }
}

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

  it('answers next-move questions with objective suggestions without fetching', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What should I do?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('Your next job is: Start with a corner.');
    expect(state.bubble.actions).toEqual([{ id: 'lesson:territory', label: 'Review territory' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'lesson:territory', label: 'Review territory' }]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-objective-move-2,2',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-objective-move-6,2',
        point: { x: 6, y: 2 },
        rank: 2,
        reason: 'Start at G7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-objective-move-2,6',
        point: { x: 2, y: 6 },
        rank: 3,
        reason: 'Start at C3: the board edge helps this stone make territory.',
      },
      {
        id: 'local-objective-move-6,6',
        point: { x: 6, y: 6 },
        rank: 4,
        reason: 'Start at G3: the board edge helps this stone make territory.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('territory').encounterCount).toBeGreaterThan(0);
  });

  it('answers direct hint requests with local objective suggestions before fetching', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.requestHint();
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('Your next job is: Start with a corner.');
    expect(state.chatMessages.at(-1)?.text).toContain('Your next job is: Start with a corner.');
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
    expect(useConceptStore.getState().getMastery('corner-opening').encounterCount).toBeGreaterThan(0);
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
    expect(state.bubble.actions).toEqual([{ id: 'lesson:liberties', label: 'Review liberties' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'lesson:liberties', label: 'Review liberties' }]);
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

  it('answers capture questions by suggesting the final liberty on the board', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      playStoreSequence([
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 0, y: 0 },
        { x: 1, y: 2 },
        { x: 0, y: 1 },
      ]);
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('How do I capture?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('Black can capture it now by playing D7');
    expect(state.bubble.actions).toEqual([{ id: 'practice:capture', label: 'Practice capture' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'practice:capture', label: 'Practice capture' }]);
    expect(state.overlays.liberties).toEqual([{
      id: 'local-capture-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 1,
      libertyPoints: [{ x: 3, y: 2 }],
    }]);
    expect(state.overlays.groups[0]).toMatchObject({
      id: 'local-capture-group-2,2',
      color: 'white',
      liberties: 1,
      label: 'White group ready to capture: final liberty at D7.',
    });
    expect(state.overlays.suggestions).toEqual([{
      id: 'local-capture-move-3,2',
      point: { x: 3, y: 2 },
      rank: 1,
      reason: 'Capture White by filling its last liberty at D7.',
    }]);
    expect(useConceptStore.getState().getMastery('capture').encounterCount).toBeGreaterThan(0);
  });

  it('clears stale board overlays when a follow-up local answer has no board focus', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      playStoreSequence([
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 0, y: 0 },
        { x: 1, y: 2 },
        { x: 0, y: 1 },
      ]);
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('How do I capture?');
    });
    expect(useGameStore.getState().overlays.suggestions).toHaveLength(1);
    expect(useGameStore.getState().overlays.liberties).toHaveLength(1);
    expect(useGameStore.getState().overlays.groups).toHaveLength(1);

    act(() => {
      result.current.sendMessage('How does territory work?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('Territory is empty space');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'lesson:territory', label: 'Review territory' }]);
    expect(state.overlays.suggestions).toEqual([]);
    expect(state.overlays.liberties).toEqual([]);
    expect(state.overlays.groups).toEqual([]);
  });
});
