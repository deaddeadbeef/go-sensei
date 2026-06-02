// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGoMaster } from '@/hooks/useGoMaster';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';
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
      useProgressStore.getState().resetAll();
      useReviewStore.getState().resetAll();
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

  it('explains corner starts locally without fetching', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Why not the center?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Corners are the easiest place for beginners to make territory because two board edges already act like walls.');
    expect(state.bubble.text).toContain('A center stone reaches in every direction, but it has to build all four sides itself before it becomes points.');
    expect(state.bubble.text).toContain('Try C7, G7, C3, or G3.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
    expect(useConceptStore.getState().getMastery('corner-opening').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('territory').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('influence').encounterCount).toBeGreaterThan(0);
  });

  it('explains the game goal locally without fetching', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('How do I win?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('To win Go, finish with more points than your opponent.');
    expect(state.bubble.text).toContain("Points come from empty territory you surround, captured stones, and White's 6.5 komi bonus.");
    expect(state.bubble.text).toContain('For this beginner board, translate that big goal into one job: Start with a corner.');
    expect(state.bubble.text).toContain('I marked moves that turn the win condition into your next board decision.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
    expect(useConceptStore.getState().getMastery('scoring').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('territory').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('capture').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
  });

  it('explains the basic rules locally without fetching', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What are the rules?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('The basic rules of Go are small: players alternate placing Black and White stones on empty intersections, not squares.');
    expect(state.bubble.text).toContain('Stones that touch up, down, left, or right become one group; empty points touching that group are liberties.');
    expect(state.bubble.text).toContain('If a group loses every liberty, it is captured and removed from the board.');
    expect(state.bubble.text).toContain('In this guided game, use those rules by following one concrete job: Start with a corner.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
    expect(useConceptStore.getState().getMastery('stones-and-board').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('groups').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('capture').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('territory').encounterCount).toBeGreaterThan(0);
  });

  it('keeps logged-out guided player moves local instead of fetching and warning about auth', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.game.currentPlayer).toBe('black');
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('teach this beginner path locally');
    expect(state.bubble.text).toContain('Good: C7 hit the marked corner goal');
    expect(state.bubble.text).toContain('Make your stones work together');
    expect(state.bubble.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.bubble.text).not.toContain('GitHub login');
    expect(state.chatMessages.some((message) => message.text.includes('Cloud Sensei needs'))).toBe(false);
    expect(state.chatMessages.some((message) => message.text === 'White passes so you can try the next idea.')).toBe(true);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('explains the local White pass without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
    });
    expect(useGameStore.getState().game.currentPlayer).toBe('black');

    act(() => {
      result.current.sendMessage('Why did White pass?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('White passed because I am keeping this guided practice moving locally');
    expect(state.bubble.text).toContain('In a real game, players usually pass near the end');
    expect(state.bubble.text).toContain('two passes in a row move the game to scoring');
    expect(state.bubble.text).toContain('Your next focus is: Make your stones work together.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('scoring').encounterCount).toBeGreaterThan(0);
  });

  it('explains undo locally after the guided White pass without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
    });
    expect(useGameStore.getState().game.currentPlayer).toBe('black');

    act(() => {
      result.current.sendMessage('Can I undo?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('The Undo button will take back the local White pass and your previous Black move');
    expect(state.bubble.text).toContain('Use it for misclicks');
    expect(state.bubble.text).toContain('Your current guided target is: Make your stones work together.');
    expect(state.bubble.text).toContain('I marked the current targets again.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('stones-and-board').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('discourages early learner passes locally without fetching', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Should I pass?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Not yet. Passing is usually an endgame decision');
    expect(state.bubble.text).toContain('Early in this guided game, passing would skip useful practice and hand the turn away.');
    expect(state.bubble.text).toContain('Your better move is: Start with a corner.');
    expect(state.bubble.text).toContain('I marked the moves that keep the game useful right now.');
    expect(state.bubble.text).not.toContain("do not treat White's pass as endgame strategy");
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
    expect(useConceptStore.getState().getMastery('scoring').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('territory').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('corner-opening').encounterCount).toBeGreaterThan(0);
  });

  it('answers early position questions locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
    });
    expect(useGameStore.getState().game.currentPlayer).toBe('black');

    act(() => {
      result.current.sendMessage('Am I winning?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('It is too early for a real score');
    expect(state.bubble.text).toContain('Black has 1 stone on the board and 0 captures');
    expect(state.bubble.text).toContain('White has 0 stones and 0 captures, plus 6.5 komi');
    expect(state.bubble.text).toContain('your next useful test is: Make your stones work together.');
    expect(state.bubble.text).toContain('I marked the next targets so you can improve the position instead of only counting it.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('scoring').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('territory').encounterCount).toBeGreaterThan(0);
  });

  it('explains komi locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
    });
    expect(useGameStore.getState().game.currentPlayer).toBe('black');

    act(() => {
      result.current.sendMessage('What is komi?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain("Komi is 6.5 points added to White's score because Black moves first.");
    expect(state.bubble.text).toContain('Komi is not territory White has surrounded');
    expect(state.bubble.text).toContain('For now, improve the board before counting it: Make your stones work together.');
    expect(state.bubble.text).toContain('I marked the next targets so you can keep building a position worth scoring later.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('scoring').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('territory').encounterCount).toBeGreaterThan(0);
  });

  it('explains a requested coordinate locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
    });
    expect(useGameStore.getState().game.currentPlayer).toBe('black');

    act(() => {
      result.current.sendMessage('Where is E7?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Go coordinates name intersections, not squares.');
    expect(state.bubble.text).toContain('E7 means column E, row 7.');
    expect(state.bubble.text).toContain('For the current beginner goal, Try E7 or C5.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-coordinate-4,2',
      point: { x: 4, y: 2 },
      variant: 'neutral',
      label: 'E7: column E, row 7.',
    }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('stones-and-board').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('explains the learner color and turn locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
    });
    expect(useGameStore.getState().game.currentPlayer).toBe('black');

    act(() => {
      result.current.sendMessage('Why do I move again?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('You are playing Black in this guided beginner game.');
    expect(state.bubble.text).toContain('White just passed locally so you can keep practicing right away');
    expect(state.bubble.text).toContain('Your next move should follow the current goal: Make your stones work together.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('stones-and-board').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('explains numbered board targets locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
    });
    expect(useGameStore.getState().game.currentPlayer).toBe('black');

    act(() => {
      result.current.sendMessage('What are these numbered targets?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('The glowing numbered circles are suggested moves, not stones already on the board.');
    expect(state.bubble.text).toContain('The number is the suggestion rank: #1 is the first idea to try');
    expect(state.bubble.text).toContain('Right now the marked target goal is: Make your stones work together.');
    expect(state.bubble.text).toContain('I marked the targets again and kept the reasons in Board Analysis.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-marker-guide-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-marker-guide-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('stones-and-board').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
  });

  it('reviews the last beginner move locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Was that good?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Yes. Good: C7 hit the marked corner goal.');
    expect(state.bubble.text).toContain('Next: Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(state.chatMessages.some((message) => message.text.includes('Cloud Sensei needs'))).toBe(false);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('explains the current shape instruction locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What is a one-space jump?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Shape means your stones are arranged so they help each other');
    expect(state.bubble.text).toContain('On this board, C7 is your anchor. Try E7 or C5.');
    expect(state.bubble.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
  });

  it('explains marked target choices locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Why E7?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('E7 is marked because it is a one-space jump from C7');
    expect(state.bubble.text).toContain('I marked the current targets again; E7 is the one I explained.');
    expect(state.bubble.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('evaluates a specific candidate move locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What about D7?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('D7 touches C7 directly.');
    expect(state.bubble.text).toContain('For this board, I would prefer E7 or C5.');
    expect(state.bubble.text).toContain('I highlighted D7 and re-marked the better beginner targets.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-candidate-question-3,2',
      point: { x: 3, y: 2 },
      variant: 'warning',
      label: 'D7: open, but not the current beginner target.',
    }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
  });

  it('compares marked target moves locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('E7 or C5?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Both choices fit the current goal: Make your stones work together.');
    expect(state.bubble.text).toContain('E7 and C5 are both one-space jumps from C7.');
    expect(state.bubble.text).toContain('I marked both choices again; choose the side where you want your next area to grow.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.highlights).toEqual([]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
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
      result.current.sendMessage('What is ko?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('Ko is the rule');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'lesson:ko', label: 'Review ko' }]);
    expect(state.overlays.suggestions).toEqual([]);
    expect(state.overlays.liberties).toEqual([]);
    expect(state.overlays.groups).toEqual([]);
  });

  it('answers ko questions by highlighting the forbidden recapture point', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      playStoreSequence([
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 3, y: 1 },
        { x: 8, y: 8 },
        { x: 2, y: 2 },
        { x: 2, y: 1 },
      ]);
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What is ko?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('The marked ko point is B8');
    expect(state.overlays.highlights).toEqual([{
      id: 'local-ko-point-1,1',
      point: { x: 1, y: 1 },
      variant: 'danger',
      label: 'Ko: White cannot immediately recapture at B8.',
    }]);
    expect(useConceptStore.getState().getMastery('ko').encounterCount).toBeGreaterThan(0);
  });

  it('answers study-plan questions from the learning recommendation without fetching', () => {
    act(() => {
      useProgressStore.setState({
        completedLessons: ['groups', 'liberties', 'capture', 'territory', 'eyes'],
        hasStartedIntroGame: true,
        problemAttempts: [
          { problemId: 'capture-001', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
          { problemId: 'capture-002', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
          { problemId: 'capture-003', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
        ],
      });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What should I study next?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('Study plan: Life and death problems.');
    expect(state.bubble.text).toContain('Practice life and death until you solve 2 more life and death problems.');
    expect(state.bubble.text).toContain('Focus on Eyes and Life & Death.');
    expect(state.bubble.actions).toEqual([
      { id: 'practice:life-and-death', label: 'Open life and death problems' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'practice:life-and-death', label: 'Open life and death problems' },
    ]);
    expect(useConceptStore.getState().getMastery('life-and-death').encounterCount).toBeGreaterThan(0);
  });
});
