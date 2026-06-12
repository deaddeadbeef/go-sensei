// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGoMaster } from '@/hooks/useGoMaster';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';
import { createGame, passMove, playMove, setStone } from '@/lib/go-engine';
import type { GameState, Point } from '@/lib/go-engine';

function playStoreSequence(points: Point[]) {
  for (const point of points) {
    const result = useGameStore.getState().placeStone(point);
    if (!result.success) {
      throw new Error(`test setup move failed at ${point.x},${point.y}`);
    }
  }
}

function snapbackGameAfterWhiteCapture(): GameState {
  let game = createGame(9);
  const setup = [
    { point: { x: 4, y: 4 }, color: 'black' },
    { point: { x: 3, y: 3 }, color: 'white' },
    { point: { x: 3, y: 4 }, color: 'white' },
    { point: { x: 4, y: 5 }, color: 'white' },
    { point: { x: 5, y: 4 }, color: 'white' },
    { point: { x: 4, y: 2 }, color: 'black' },
    { point: { x: 5, y: 3 }, color: 'black' },
    { point: { x: 3, y: 2 }, color: 'black' },
    { point: { x: 2, y: 3 }, color: 'black' },
    { point: { x: 2, y: 4 }, color: 'black' },
    { point: { x: 3, y: 5 }, color: 'black' },
    { point: { x: 4, y: 6 }, color: 'black' },
    { point: { x: 5, y: 5 }, color: 'black' },
    { point: { x: 6, y: 4 }, color: 'black' },
  ] as const;

  for (const stone of setup) {
    game = { ...game, board: setStone(game.board, stone.point, stone.color) };
  }

  const whiteCapture = playMove({ ...game, currentPlayer: 'white' }, { x: 4, y: 3 });
  if (!whiteCapture.success) throw new Error(`test setup snapback capture failed: ${whiteCapture.reason}`);

  return whiteCapture.newState;
}

function settledShapeGame(): GameState {
  const stones: Point[] = [
    { x: 2, y: 2 },
    { x: 4, y: 2 },
    { x: 6, y: 2 },
    { x: 2, y: 4 },
    { x: 3, y: 4 },
    { x: 4, y: 4 },
    { x: 6, y: 4 },
    { x: 2, y: 6 },
    { x: 4, y: 6 },
    { x: 6, y: 6 },
  ];

  return stones.reduce(
    (game, point) => ({ ...game, board: setStone(game.board, point, 'black') }),
    createGame(9),
  );
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
    sessionStorage.removeItem('go-sensei-github-token');
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

  it('answers confused beginner messages with one board job without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage("I'm stuck");
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Slow down to one board job.');
    expect(state.bubble.text).toContain('Your current job is: Make your stones work together.');
    expect(state.bubble.text).toContain('Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(state.bubble.text).toContain('choose one marked coordinate, then ask what it changed');
    expect(state.bubble.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-confusion-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-confusion-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
  });

  it('answers tenuki locally from the current extension objective without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Can I tenuki?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Tenuki means playing away from the local area.');
    expect(state.bubble.text).toContain('C7 is your anchor, and the useful play-away is a nearby one-space jump.');
    expect(state.bubble.text).toContain('Try E7 or C5.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('sente-gote').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('answers give-up messages with a recovery target without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('I want to give up');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Resigning or starting over is allowed, but do it deliberately');
    expect(state.bubble.text).toContain('Your current recovery job is: Make your stones work together.');
    expect(state.bubble.text).toContain('Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(state.bubble.text).toContain('play one of them before deciding to restart');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'guided:intro', label: 'Start fresh guided game' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'guided:intro', label: 'Start fresh guided game' },
    ]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-resign-restart-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-resign-restart-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
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
    expect(state.bubble.text).toContain('The center reaches many directions, but it has to build every border itself before it becomes points.');
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

  it('explains influence locally with current extension targets', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What is influence?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Influence is future pressure, not territory you can count yet.');
    expect(state.bubble.text).toContain('A center stone can reach many directions, so it may help later fights, connections, or extensions, but by itself it does not surround points.');
    expect(state.bubble.text).toContain('C7 already has some influence; it becomes useful when the next stone works with it.');
    expect(state.bubble.text).toContain('Try E7 or C5.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-influence-anchor-2,2',
      point: { x: 2, y: 2 },
      variant: 'neutral',
      label: 'C7: current Black stone creating future pressure.',
    }]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-influence-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-influence-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('influence').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
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

  it('answers snapback concept questions locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What is snapback?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('A snapback is a capture trick');
    expect(state.bubble.text).toContain('you let the opponent capture one stone, then immediately recapture the whole cramped group');
    expect(state.bubble.actions).toEqual([
      { id: 'lesson:snapback', label: 'Review snapback' },
      { id: 'practice:tesuji', label: 'Practice tesuji' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'lesson:snapback', label: 'Review snapback' },
      { id: 'practice:tesuji', label: 'Practice tesuji' },
    ]);
    expect(useConceptStore.getState().getMastery('snapback').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('tesuji').encounterCount).toBeGreaterThan(0);
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
    expect(state.bubble.text).toContain('I can coach this guided game from the board in front of us.');
    expect(state.bubble.text).toContain('Good: C7 hit the marked corner goal');
    expect(state.bubble.text).toContain('Lesson: C7 is a useful anchor because the edge helps it surround space.');
    expect(state.bubble.text).toContain('Make your stones work together');
    expect(state.bubble.text).toContain('I marked your move, gave White a teaching pass, and marked the next targets');
    expect(state.bubble.text.toLowerCase()).not.toContain('cloud');
    expect(state.bubble.text.toLowerCase()).not.toContain('locally');
    expect(state.bubble.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-fallback-learned-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'C7: move to learn from - beginner job met.',
    }]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-fallback-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-fallback-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(state.bubble.text).not.toContain('GitHub login');
    expect(state.chatMessages.some((message) => message.text.includes('Cloud Sensei needs'))).toBe(false);
    expect(state.chatMessages.some((message) => message.text === 'White takes a teaching pass so you can try the next idea.')).toBe(true);
    expect(useConceptStore.getState().getMastery('corner-opening').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('explains the second guided move as one-space jump shape without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
      const move = useGameStore.getState().placeStone({ x: 4, y: 2 });
      if (!move.success) throw new Error('test setup extension move failed');
      result.current.sendPlayerMove(false, 0);
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.game.currentPlayer).toBe('black');
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Good: E7 made a one-space jump from your stone. Next, read the open gap before extending again.');
    expect(state.bubble.text).toContain('Lesson: E7 is a one-space jump from C7. The empty point at D7 leaves room to grow');
    expect(state.bubble.text).toContain('Try G7, E5, or C5.');
    expect(state.overlays.highlights).toEqual([{
      id: 'local-fallback-learned-4,2',
      point: { x: 4, y: 2 },
      variant: 'positive',
      label: 'E7: move to learn from - beginner job met.',
    }]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-fallback-move-6,2',
        point: { x: 6, y: 2 },
        rank: 1,
        reason: 'Try G7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-fallback-move-4,4',
        point: { x: 4, y: 4 },
        rank: 2,
        reason: 'Try E5 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-fallback-move-2,4',
        point: { x: 2, y: 4 },
        rank: 3,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
  });

  it('answers territory ownership from the current one-space jump framework without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
      const move = useGameStore.getState().placeStone({ x: 4, y: 2 });
      if (!move.success) throw new Error('test setup extension move failed');
      result.current.sendPlayerMove(false, 0);
    });

    act(() => {
      result.current.sendMessage('Is this territory mine?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('C7 and E7 are starting to sketch a top-side framework');
    expect(state.bubble.text).toContain('D7 is only a gap in that framework, not safe territory yet');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'lesson:territory', label: 'Review territory' }]);
    expect(state.overlays.highlights).toEqual([
      {
        id: 'local-territory-framework-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: framework stone helping sketch territory.',
      },
      {
        id: 'local-territory-framework-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: one-space jump stone extending the framework.',
      },
      {
        id: 'local-territory-gap-3,2',
        point: { x: 3, y: 2 },
        variant: 'neutral',
        label: 'D7: open gap; useful shape, not settled territory.',
      },
    ]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-territory-move-6,2',
        point: { x: 6, y: 2 },
        rank: 1,
        reason: 'Try G7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-territory-move-4,4',
        point: { x: 4, y: 4 },
        rank: 2,
        reason: 'Try E5 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-territory-move-2,4',
        point: { x: 2, y: 4 },
        rank: 3,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('territory').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('explains open one-space jump gaps without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendPlayerMove(false, 0);
      const move = useGameStore.getState().placeStone({ x: 4, y: 2 });
      if (!move.success) throw new Error('test setup extension move failed');
      result.current.sendPlayerMove(false, 0);
    });

    act(() => {
      result.current.sendMessage('Should I fill the gap at D7?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('D7 is the one-point gap between C7 and E7.');
    expect(state.bubble.text).toContain('Do not fill D7 just because it is empty.');
    expect(state.bubble.text).toContain('For this board, I would prefer G7, E5, or C5.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:groups', label: 'Review groups' },
    ]);
    expect(state.overlays.highlights).toEqual([
      {
        id: 'local-gap-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: one side of the one-space jump.',
      },
      {
        id: 'local-gap-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: one side of the one-space jump.',
      },
      {
        id: 'local-gap-open-3,2',
        point: { x: 3, y: 2 },
        variant: 'neutral',
        label: 'D7: intentional gap; answer it if White attacks.',
      },
    ]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('explains the guided White pass without implementation-mode wording', () => {
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
    expect(state.bubble.text).toContain('White passed as a guided teaching shortcut');
    expect(state.bubble.text).not.toContain('locally');
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

  it('explains undo after the guided White pass without implementation-mode wording', () => {
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
    expect(state.bubble.text).toContain('The Undo button will take back the guided White pass and your previous Black move');
    expect(state.bubble.text).not.toContain('local White pass');
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
    expect(state.bubble.text).toContain('E7 is also one of the marked targets for Make your stones work together.');
    expect(state.bubble.text).toContain('E7 is marked because it is a one-space jump from C7');
    expect(state.bubble.text).toContain('For the current beginner goal, Try E7 or C5.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-coordinate-4,2',
      point: { x: 4, y: 2 },
      variant: 'positive',
      label: 'E7: marked target for Make your stones work together.',
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
    expect(state.bubble.text).toContain('White just passed as a guided teaching shortcut');
    expect(state.bubble.text).toContain('so you can keep practicing right away');
    expect(state.bubble.text).not.toContain('locally');
    expect(state.bubble.text).toContain('Your next move should follow the current goal: Make your stones work together.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('stones-and-board').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('explains the latest White move locally without fetching', () => {
    act(() => {
      const result = useGameStore.getState().applyAiMove({ x: 3, y: 2 });
      if (!result.success) throw new Error('test setup white move failed');
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Why did White play there?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('White just played D7.');
    expect(state.bubble.text).toContain('It touches your Black group at C7 and leaves it with 3 liberties: C8, C6, and B7.');
    expect(state.bubble.text).toContain('Your reply should still be practical: Make your stones work together.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-opponent-move-3,2',
      point: { x: 3, y: 2 },
      variant: 'warning',
      label: 'D7: latest White move pressures a Black group.',
    }]);
    expect(state.overlays.groups?.[0]).toMatchObject({
      id: 'local-opponent-pressure-group-2,2',
      color: 'black',
      liberties: 3,
    });
    expect(state.overlays.liberties).toEqual([{
      id: 'local-opponent-pressure-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 3,
      libertyPoints: [
        { x: 2, y: 1 },
        { x: 2, y: 3 },
        { x: 1, y: 2 },
      ],
    }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
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

  it('routes blunder wording to local move review without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Did I blunder?');
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
  });

  it('answers natural biggest-mistake review questions locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What was my biggest mistake?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Beginner game review: here are the board moments to learn from.');
    expect(state.bubble.text).toContain('Best move: Move 1 C7 followed "Start with a corner".');
    expect(state.bubble.text).toContain('Main fix: after Move 1 C7, do not stop at "good"; ask what the stone helps next.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'guided:intro', label: 'Start fresh guided game' },
    ]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-game-review-best-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'Move 1 C7 followed: Start with a corner.',
    }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('corner-opening').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('explains what the last move changed locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What did that change?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('That move changed the position around C7.');
    expect(state.bubble.text).toContain('It completed the beginner job: Good: C7 hit the marked corner goal.');
    expect(state.bubble.text).toContain('The board now asks for: Make your stones work together.');
    expect(state.bubble.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-move-impact-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'C7: met the current beginner job.',
    }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('turns the last move into a local takeaway without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What did this teach me?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Lesson from C7: your move worked because it followed the beginner job.');
    expect(state.bubble.text).toContain('Practice it now by playing the next job: Make your stones work together.');
    expect(state.bubble.text).toContain('I highlighted C7 and marked the practice targets so the lesson has a next move.');
    expect(state.bubble.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-learning-takeaway-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'C7: move to learn from - beginner job met.',
    }]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-learning-takeaway-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-learning-takeaway-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('corner-opening').encounterCount).toBeGreaterThan(0);
  });

  it('teaches a reading routine locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('How do I think before I move?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Use a three-question reading routine before you play.');
    expect(state.bubble.text).toContain('First: count liberties.');
    expect(state.bubble.text).toContain('On this board, apply the routine to: Make your stones work together.');
    expect(state.bubble.text).toContain('Start by reading E7: what Black gains, how White might touch it, and whether C7 still has enough liberties.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-reading-anchor-2,2',
      point: { x: 2, y: 2 },
      variant: 'neutral',
      label: 'C7: use this stone as the anchor for your reading routine.',
    }]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-reading-routine-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-reading-routine-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
  });

  it("reads White's likely reply locally without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What can White do?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Read White from your Black stone at C7.');
    expect(state.bubble.text).toContain("White's simplest reply is to play on one of its liberties: C8, C6, B7, or D7.");
    expect(state.bubble.text).toContain('Your practical answer is: Make your stones work together.');
    expect(state.bubble.text).toContain('Start by reading E7: if White touches C7, Black should still have room and a clearer shape.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-white-reply-anchor-2,2',
      point: { x: 2, y: 2 },
      variant: 'neutral',
      label: "C7: read White's reply against this Black group.",
    }]);
    expect(state.overlays.liberties).toEqual([{
      id: 'local-white-reply-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 4,
      libertyPoints: [
        { x: 2, y: 1 },
        { x: 2, y: 3 },
        { x: 1, y: 2 },
        { x: 3, y: 2 },
      ],
    }]);
    expect(state.overlays.groups[0]).toMatchObject({
      id: 'local-white-reply-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 4,
      label: 'Black group White could pressure: 4 liberties at C8, C6, B7, and D7.',
    });
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-white-reply-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-white-reply-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
  });

  it('explains learner threats locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What am I threatening?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Not a capture threat yet.');
    expect(state.bubble.text).toContain('C7 threatens future shape: it gives you an anchor to extend from, not an immediate kill.');
    expect(state.bubble.text).toContain('That Black group has 4 liberties: C8, C6, B7, and D7, so it has room to build.');
    expect(state.bubble.text).toContain('On this board, turn the threat into: Make your stones work together.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-threat-anchor-2,2',
      point: { x: 2, y: 2 },
      variant: 'neutral',
      label: 'C7: current Black stone creating a future threat.',
    }]);
    expect(state.overlays.liberties).toEqual([{
      id: 'local-threat-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 4,
      libertyPoints: [
        { x: 2, y: 1 },
        { x: 2, y: 3 },
        { x: 1, y: 2 },
        { x: 3, y: 2 },
      ],
    }]);
    expect(state.overlays.groups[0]).toMatchObject({
      id: 'local-threat-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 4,
      label: 'Black group creating a future threat: 4 liberties at C8, C6, B7, and D7.',
    });
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-threat-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-threat-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
  });

  it('reviews the guided game locally from the review control without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.requestReview();
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Beginner game review: here are the board moments to learn from.');
    expect(state.bubble.text).not.toContain('cloud help');
    expect(state.bubble.text).toContain('Best move: Move 1 C7 followed "Start with a corner".');
    expect(state.bubble.text).toContain('Next practice target: Make your stones work together.');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'guided:intro', label: 'Start fresh guided game' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'guided:intro', label: 'Start fresh guided game' },
    ]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-game-review-best-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'Move 1 C7 followed: Start with a corner.',
    }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('corner-opening').encounterCount).toBeGreaterThan(0);
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

  it('explains connection locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('How do I connect my stones?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Stones become one solid group only when they touch up, down, left, or right.');
    expect(state.bubble.text).toContain('Diagonals do not connect.');
    expect(state.bubble.text).toContain('E7 and C5 are not solid connections to C7 yet. They are one-space jumps');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:groups', label: 'Review groups' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:groups', label: 'Review groups' },
    ]);
    expect(state.overlays.groups[0]).toMatchObject({
      id: 'local-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 4,
    });
    expect(state.overlays.liberties[0].libertyPoints).toEqual([
      { x: 2, y: 1 },
      { x: 2, y: 3 },
      { x: 1, y: 2 },
      { x: 3, y: 2 },
    ]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('groups').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('shape').encounterCount).toBeGreaterThan(0);
  });

  it('identifies a weak group locally without fetching', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      playStoreSequence([
        { x: 2, y: 2 },
        { x: 2, y: 1 },
        { x: 4, y: 4 },
        { x: 1, y: 2 },
      ]);
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Which group is weak?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('The weak group is your Black group at C7.');
    expect(state.bubble.text).toContain('It has only 2 liberties: C6 and D7.');
    expect(state.bubble.text).toContain('I marked the weak group, its liberties, and the rescue moves.');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
    expect(state.overlays.groups[0]).toMatchObject({
      id: 'local-weak-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 2,
      label: 'Weak Black group: 2 liberties at C6 and D7.',
    });
    expect(state.overlays.liberties[0]).toEqual({
      id: 'local-weak-group-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 2,
      libertyPoints: [
        { x: 2, y: 3 },
        { x: 3, y: 2 },
      ],
    });
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 2 },
    ]);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('groups').encounterCount).toBeGreaterThan(0);
  });

  it('chooses defense before attack when a Black group is short on liberties', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      playStoreSequence([
        { x: 2, y: 2 },
        { x: 2, y: 1 },
        { x: 4, y: 4 },
        { x: 1, y: 2 },
      ]);
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Should I attack or defend?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Defend first.');
    expect(state.bubble.text).toContain('Your Black group at C7 has only 2 liberties: C6 and D7.');
    expect(state.bubble.text).toContain('Attack later, after this group has room.');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
    expect(state.overlays.groups[0]).toMatchObject({
      id: 'local-attack-defense-weak-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 2,
      label: 'Defend Black group first: 2 liberties at C6 and D7.',
    });
    expect(state.overlays.liberties[0]).toEqual({
      id: 'local-attack-defense-weak-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 2,
      libertyPoints: [
        { x: 2, y: 3 },
        { x: 3, y: 2 },
      ],
    });
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 2 },
    ]);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
  });

  it('answers capture-race questions by defending the Black group that is behind on liberties', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      playStoreSequence([
        { x: 2, y: 2 },
        { x: 2, y: 1 },
        { x: 4, y: 4 },
        { x: 1, y: 2 },
      ]);
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Who gets captured first?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('This is a capture race, and Black is behind on liberties.');
    expect(state.bubble.text).toContain('Your Black group at C7 has 2 liberties: C6 and D7.');
    expect(state.bubble.text).toContain('White group at C8 has 3 liberties: C9, B8, and D8.');
    expect(state.bubble.text).toContain('Defend first by playing one of the marked Black liberties.');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
    expect(state.overlays.groups).toEqual([
      {
        id: 'local-capture-race-black-group-2,2',
        stones: [{ x: 2, y: 2 }],
        color: 'black',
        liberties: 2,
        label: 'Black group in the race: 2 liberties at C6 and D7.',
      },
      {
        id: 'local-capture-race-white-group-2,1',
        stones: [{ x: 2, y: 1 }],
        color: 'white',
        liberties: 3,
        label: 'White group in the race: 3 liberties at C9, B8, and D8.',
      },
    ]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 2 },
    ]);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
  });

  it('answers capture-race plan follow-ups locally from the guided chat', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      playStoreSequence([
        { x: 2, y: 2 },
        { x: 2, y: 1 },
        { x: 4, y: 4 },
        { x: 1, y: 2 },
      ]);
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What should I read next in this race?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('Read this capture race as count, save, recount.');
    expect(state.bubble.text).toContain('Step 1: Black is behind, so first add a liberty at C6 or D7.');
    expect(state.bubble.text).toContain('Step 2: after White answers, count again: Black started with 2 liberties and White started with 3.');
    expect(state.bubble.text).toContain('Step 3: if Black is still behind, add another liberty; when Black catches up, start filling White liberties at C9, B8, or D8.');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.overlays.groups).toEqual([
      {
        id: 'local-capture-race-plan-black-group-2,2',
        stones: [{ x: 2, y: 2 }],
        color: 'black',
        liberties: 2,
        label: 'Black group to save first: 2 liberties at C6 and D7.',
      },
      {
        id: 'local-capture-race-plan-white-group-2,1',
        stones: [{ x: 2, y: 1 }],
        color: 'white',
        liberties: 3,
        label: 'White group to chase after Black catches up: 3 liberties at C9, B8, and D8.',
      },
    ]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 2 },
    ]);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
  });

  it('answers snapback plan follow-ups locally from the guided chat', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.setState({
        game: snapbackGameAfterWhiteCapture(),
        appPhase: 'game',
        phase: 'playing',
        teachingLevel: 'guided',
      });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What should I read next after this snapback?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('Read this snapback as capture, count, continue.');
    expect(state.bubble.text).toContain('Step 1: snap back at E5 and remove E6, D6, D5, E4, and F5.');
    expect(state.bubble.text).toContain("Step 2: after those stones come off, Black's new stone at E5 has 4 liberties: E6, E4, D5, and F5.");
    expect(state.bubble.text).toContain('Step 3: if White keeps fighting nearby, use that count before choosing the next forcing move; if White plays away, the snapback already won this local tactic.');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.overlays.highlights).toEqual([
      {
        id: 'local-snapback-plan-white-capture-4,3',
        point: { x: 4, y: 3 },
        variant: 'danger',
        label: 'E6: White captured into the snapback shape.',
      },
      {
        id: 'local-snapback-plan-recapture-point-4,4',
        point: { x: 4, y: 4 },
        variant: 'positive',
        label: 'E5: Step 1 snapback and remove the cramped White stones.',
      },
    ]);
    expect(state.overlays.liberties).toEqual([
      {
        id: 'local-snapback-plan-white-liberties-4,3',
        point: { x: 4, y: 3 },
        count: 1,
        libertyPoints: [{ x: 4, y: 4 }],
      },
      {
        id: 'local-snapback-plan-black-after-4,4',
        point: { x: 4, y: 4 },
        count: 4,
        libertyPoints: [
          { x: 4, y: 3 },
          { x: 4, y: 5 },
          { x: 3, y: 4 },
          { x: 5, y: 4 },
        ],
      },
    ]);
    expect(state.overlays.groups).toEqual([
      {
        id: 'local-snapback-plan-white-group-4,3',
        stones: [
          { x: 4, y: 3 },
          { x: 3, y: 3 },
          { x: 3, y: 4 },
        ],
        color: 'white',
        liberties: 1,
        label: 'White stones to remove at E6, D6, and D5: 1 liberty at E5.',
      },
      {
        id: 'local-snapback-plan-white-group-4,5',
        stones: [{ x: 4, y: 5 }],
        color: 'white',
        liberties: 1,
        label: 'White stone to remove at E4: 1 liberty at E5.',
      },
      {
        id: 'local-snapback-plan-white-group-5,4',
        stones: [{ x: 5, y: 4 }],
        color: 'white',
        liberties: 1,
        label: 'White stone to remove at F5: 1 liberty at E5.',
      },
    ]);
    expect(state.overlays.suggestions).toEqual([
      {
        id: 'local-snapback-plan-recapture-4,4',
        point: { x: 4, y: 4 },
        rank: 1,
        reason: 'Step 1: snap back at E5 and remove E6, D6, D5, E4, and F5.',
      },
    ]);
    expect(useConceptStore.getState().getMastery('snapback').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
  });

  it('sends fresh-area follow-up target context to the cloud tutor', async () => {
    const freshAreaMove = playMove(settledShapeGame(), { x: 7, y: 1 });
    if (!freshAreaMove.success) throw new Error('test setup fresh-area move failed');
    const afterWhitePass = passMove(freshAreaMove.newState);
    sessionStorage.setItem('go-sensei-github-token', 'test-token');
    act(() => {
      useGameStore.setState({
        game: afterWhitePass,
        appPhase: 'game',
        phase: 'playing',
        teachingLevel: 'guided',
      });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ text: 'Cloud tutor response' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const { result } = renderHook(() => useGoMaster());

    await act(async () => {
      result.current.sendMessage('Give me a vivid proverb for this board');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const request = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { gameState: { guidedContext: string } };

    expect(body.gameState.guidedContext).toContain('Current visible objective: Make your stones work together');
    expect(body.gameState.guidedContext).toContain('Suggested board points: Extend H8 into the upper-right area: try H6 or F8.');
    expect(body.gameState.guidedContext).not.toContain('Suggested board points: Try H6 or F8.');

    sessionStorage.removeItem('go-sensei-github-token');
  });

  it('sends lower-right fresh-area follow-up target context to the cloud tutor', async () => {
    const freshAreaMove = playMove(settledShapeGame(), { x: 7, y: 7 });
    if (!freshAreaMove.success) throw new Error('test setup fresh-area move failed');
    const afterWhitePass = passMove(freshAreaMove.newState);
    sessionStorage.setItem('go-sensei-github-token', 'test-token');
    act(() => {
      useGameStore.setState({
        game: afterWhitePass,
        appPhase: 'game',
        phase: 'playing',
        teachingLevel: 'guided',
      });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ text: 'Cloud tutor response' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const { result } = renderHook(() => useGoMaster());

    await act(async () => {
      result.current.sendMessage('Give me a vivid proverb for this board');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const request = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as { gameState: { guidedContext: string } };

    expect(body.gameState.guidedContext).toContain('Current visible objective: Make your stones work together');
    expect(body.gameState.guidedContext).toContain('Suggested board points: Extend H2 into the lower-right area: try F2 or H4.');
    expect(body.gameState.guidedContext).not.toContain('Suggested board points: Try F2 or H4.');

    sessionStorage.removeItem('go-sensei-github-token');
  });

  it('sends the current board snapshot for restored no-history study positions', async () => {
    sessionStorage.setItem('go-sensei-github-token', 'test-token');
    act(() => {
      useGameStore.setState({
        game: settledShapeGame(),
        appPhase: 'game',
        phase: 'playing',
        teachingLevel: 'guided',
      });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ text: 'Cloud tutor response' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const { result } = renderHook(() => useGoMaster());

    await act(async () => {
      result.current.sendMessage('Give me a vivid proverb for this board');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const request = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      gameState: {
        board: { grid: Array<Array<'black' | 'white' | null>> };
        currentPlayer: string;
        moveHistory: unknown[];
      };
    };

    expect(body.gameState.moveHistory).toHaveLength(0);
    expect(body.gameState.board.grid[2][2]).toBe('black');
    expect(body.gameState.board.grid[4][3]).toBe('black');
    expect(body.gameState.currentPlayer).toBe('black');

    sessionStorage.removeItem('go-sensei-github-token');
  });

  it('hides raw tutor errors when no local fallback is available', async () => {
    sessionStorage.setItem('go-sensei-github-token', 'test-token');
    act(() => {
      useGameStore.getState().startNewGame(9);
      useGameStore.setState({
        appPhase: 'game',
        phase: 'playing',
        teachingLevel: 'advanced',
      });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'provider exploded with sk-secret-test-value' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    ));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useGoMaster());

    await act(async () => {
      result.current.sendMessage('Give me a vivid proverb for this board');
      await Promise.resolve();
      await Promise.resolve();
    });

    const state = useGameStore.getState();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(state.bubble.variant).toBe('warning');
    expect(state.bubble.text).toContain('The tutor could not answer this turn.');
    expect(state.bubble.text).toContain('Use the board for now');
    expect(state.bubble.text.toLowerCase()).not.toContain('cloud');
    expect(state.bubble.text).not.toContain('provider exploded');
    expect(state.bubble.text).not.toContain('sk-secret-test-value');

    consoleErrorSpy.mockRestore();
    sessionStorage.removeItem('go-sensei-github-token');
  });

  it('uses learner-facing sign-in copy when no local fallback is available', async () => {
    act(() => {
      useGameStore.getState().startNewGame(9);
      useGameStore.setState({
        appPhase: 'game',
        phase: 'playing',
        teachingLevel: 'advanced',
      });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'missing token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ));
    const { result } = renderHook(() => useGoMaster());

    await act(async () => {
      result.current.sendMessage('Can you read this position?');
      await Promise.resolve();
      await Promise.resolve();
    });

    const state = useGameStore.getState();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(state.bubble.variant).toBe('warning');
    expect(state.bubble.text).toBe('Open Settings and sign in with GitHub to use live Sensei coaching.');
    expect(state.bubble.text.toLowerCase()).not.toContain('cloud');
    expect(state.chatMessages.some((message) => message.text === 'Sign in with GitHub from Settings to use live Sensei coaching.')).toBe(true);
    expect(state.chatMessages.some((message) => message.text.includes('Cloud Sensei needs'))).toBe(false);
  });

  it('keeps even capture-race questions grounded in the current guided objective', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      playStoreSequence([
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ]);
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Who wins this fight?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('This is a capture race, but it is even on liberties right now.');
    expect(state.bubble.text).toContain('Both groups have 3 liberties.');
    expect(state.bubble.text).toContain('No one gets captured immediately.');
    expect(state.bubble.text).toContain('Use the current guided job as the priority: Make your stones work together.');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.overlays.groups).toEqual([
      {
        id: 'local-capture-race-black-group-2,2',
        stones: [{ x: 2, y: 2 }],
        color: 'black',
        liberties: 3,
        label: 'Black group in the race: 3 liberties at C8, C6, and B7.',
      },
      {
        id: 'local-capture-race-white-group-3,2',
        stones: [{ x: 3, y: 2 }],
        color: 'white',
        liberties: 3,
        label: 'White group in the race: 3 liberties at D8, D6, and E7.',
      },
    ]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('direction-of-play').encounterCount).toBeGreaterThan(0);
  });

  it('answers occupied cut questions locally from the guided chat', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().placeStone({ x: 3, y: 2 });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Did White cut me?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('White has played into the one-space jump gap at D7.');
    expect(state.bubble.text).toContain('C7 and E7 are separate Black groups by the rules now, but neither is captured.');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-occupied-cut-stone-3,2',
      point: { x: 3, y: 2 },
      variant: 'danger',
      label: 'D7: White occupies the gap between C7 and E7.',
    }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 3, y: 1 },
      { x: 3, y: 3 },
    ]);
    expect(useConceptStore.getState().getMastery('connect-and-cut').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
  });

  it('answers occupied-cut follow-ups locally from the guided chat', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().placeStone({ x: 3, y: 2 });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What if White answers now?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('White has played into the one-space jump gap at D7.');
    expect(state.bubble.text).toContain('Answer the cut by attacking the marked White liberties, starting with D8 or D6.');
    expect(state.bubble.text).not.toContain('Read White from your Black stone');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-occupied-cut-stone-3,2',
      point: { x: 3, y: 2 },
      variant: 'danger',
      label: 'D7: White occupies the gap between C7 and E7.',
    }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 3, y: 1 },
      { x: 3, y: 3 },
    ]);
    expect(useConceptStore.getState().getMastery('connect-and-cut').encounterCount).toBeGreaterThan(0);
  });

  it('answers occupied-cut plan follow-ups locally from the guided chat', () => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().placeStone({ x: 3, y: 2 });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What should I read next after this cut?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.text).toContain('Read the cut as a three-step plan.');
    expect(state.bubble.text).toContain('Step 1: attack the White cutting stone at D7 by playing D8 or D6.');
    expect(state.bubble.text).toContain('Step 2: after White answers, recount both Black groups: C7 has 3 liberties and E7 has 3 liberties.');
    expect(state.bubble.text).toContain('Step 3: if one Black group drops to two liberties or fewer, defend it first; otherwise fill the next White liberty.');
    expect(state.bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
    expect(state.overlays.highlights).toEqual([{
      id: 'local-occupied-cut-plan-stone-3,2',
      point: { x: 3, y: 2 },
      variant: 'danger',
      label: 'D7: White cutting stone; start the reading plan here.',
    }]);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 3, y: 1 },
      { x: 3, y: 3 },
    ]);
    expect(useConceptStore.getState().getMastery('connect-and-cut').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
  });

  it('answers learner danger questions locally without fetching', () => {
    act(() => {
      const result = useGameStore.getState().applyAiMove({ x: 3, y: 2 });
      if (!result.success) throw new Error('test setup white move failed');
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Is my group in danger?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Your Black group at C7 is under pressure, but it is not in immediate danger');
    expect(state.bubble.text).toContain('it has 3 liberties: C8, C6, and B7.');
    expect(state.bubble.text).toContain('Immediate danger usually starts at one or two liberties');
    expect(state.bubble.text).toContain('Try C5.');
    expect(state.bubble.text).not.toContain('Diagonals do not connect.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
    expect(state.overlays.groups[0]).toMatchObject({
      id: 'local-weak-group-current-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 3,
      label: 'Black group under pressure, not weak yet: 3 liberties at C8, C6, and B7.',
    });
    expect(state.overlays.liberties[0]).toEqual({
      id: 'local-weak-group-current-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 3,
      libertyPoints: [
        { x: 2, y: 1 },
        { x: 2, y: 3 },
        { x: 1, y: 2 },
      ],
    });
    expect(state.overlays.suggestions).toEqual([{
      id: 'local-weak-group-current-move-2,4',
      point: { x: 2, y: 4 },
      rank: 1,
      reason: 'Try C5 as a one-space jump that works with your stones.',
    }]);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('groups').encounterCount).toBeGreaterThan(0);
  });

  it('answers named group safety questions locally without fetching', () => {
    act(() => {
      useGameStore.getState().pass();
      const result = useGameStore.getState().placeStone({ x: 4, y: 2 });
      if (!result.success) throw new Error('test setup second move failed');
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Is E7 safe?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Your Black group at E7 is not in immediate danger');
    expect(state.bubble.text).toContain('it has 4 liberties: E8, E6, D7, and F7.');
    expect(state.bubble.text).toContain('Try G7, E5, or C5.');
    expect(state.bubble.text).not.toContain('Your Black group at C7');
    expect(state.chatMessages.at(-1)?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
    expect(state.overlays.groups[0]).toMatchObject({
      id: 'local-weak-group-current-4,2',
      stones: [{ x: 4, y: 2 }],
      color: 'black',
      liberties: 4,
      label: 'Black group with room: 4 liberties at E8, E6, D7, and F7.',
    });
    expect(state.overlays.liberties[0]).toEqual({
      id: 'local-weak-group-current-liberties-4,2',
      point: { x: 4, y: 2 },
      count: 4,
      libertyPoints: [
        { x: 4, y: 1 },
        { x: 4, y: 3 },
        { x: 3, y: 2 },
        { x: 5, y: 2 },
      ],
    });
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ]);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('groups').encounterCount).toBeGreaterThan(0);
  });

  it('answers empty-point safety questions as candidate checks without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Is D7 safe?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('D7 touches C7 directly.');
    expect(state.bubble.text).toContain('For this board, I would prefer E7 or C5.');
    expect(state.bubble.text).not.toContain('D7 is not one of your Black groups');
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

  it('answers what is wrong with a candidate coordinate locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What is wrong with D7?');
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

  it('answers natural coordinate good-move questions locally without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('Is D7 a good move?');
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

  it('explains when a candidate jump is blocked by White in the gap without fetching', () => {
    act(() => {
      const result = useGameStore.getState().applyAiMove({ x: 3, y: 2 });
      if (!result.success) throw new Error('test setup white move failed');
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('What about E7?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('E7 would normally be a one-space jump from C7, but White is already on D7, the gap between them.');
    expect(state.bubble.text).toContain('That gap is what lets the shape work, so E7 is not a clean teamwork target now.');
    expect(state.bubble.text).toContain('For this board, I would prefer C5.');
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    expect(state.overlays.highlights).toEqual([
      {
        id: 'local-candidate-move-blocked-target-4,2',
        point: { x: 4, y: 2 },
        variant: 'warning',
        label: 'E7: not a clean jump while D7 is occupied.',
      },
      {
        id: 'local-candidate-move-blocked-gap-3,2',
        point: { x: 3, y: 2 },
        variant: 'danger',
        label: 'D7: White occupies the one-space jump gap.',
      },
    ]);
    expect(state.overlays.suggestions).toEqual([{
      id: 'local-candidate-move-2,4',
      point: { x: 2, y: 4 },
      rank: 1,
      reason: 'Try C5 as a one-space jump that works with your stones.',
    }]);
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

  it('chooses capture when White is in atari and Black is not weak', () => {
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
      result.current.sendMessage('Attack or defend?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Attack now.');
    expect(state.bubble.text).toContain('White has a group at C7 in atari.');
    expect(state.bubble.text).toContain('Black can capture by playing D7.');
    expect(state.bubble.actions).toEqual([{ id: 'practice:capture', label: 'Practice capture' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'practice:capture', label: 'Practice capture' }]);
    expect(state.overlays.liberties).toEqual([{
      id: 'local-attack-defense-capture-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 1,
      libertyPoints: [{ x: 3, y: 2 }],
    }]);
    expect(state.overlays.groups[0]).toMatchObject({
      id: 'local-attack-defense-capture-group-2,2',
      color: 'white',
      liberties: 1,
      label: 'Attack White group now: capture by playing D7.',
    });
    expect(state.overlays.suggestions).toEqual([{
      id: 'local-attack-defense-capture-move-3,2',
      point: { x: 3, y: 2 },
      rank: 1,
      reason: 'Capture White by filling its last liberty at D7.',
    }]);
    expect(useConceptStore.getState().getMastery('capture').encounterCount).toBeGreaterThan(0);
    expect(useConceptStore.getState().getMastery('reading').encounterCount).toBeGreaterThan(0);
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
    expect(state.bubble.text).toContain('Study plan: Life and Death problems.');
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

  it('answers progress reflection questions from tracked evidence without fetching', () => {
    act(() => {
      useProgressStore.setState({
        completedLessons: ['groups', 'liberties'],
        hasStartedIntroGame: true,
        problemAttempts: [
          { problemId: 'capture-001', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
        ],
      });
      useConceptStore.getState().recordEvidence('liberties', 'lesson_completed');
      useConceptStore.getState().recordEvidence('capture', 'problem_solved');
      useConceptStore.getState().recordEvidence('groups', 'ai_tag_success');
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useGoMaster());

    act(() => {
      result.current.sendMessage('How am I doing?');
    });

    const state = useGameStore.getState();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.bubble.variant).toBe('teaching');
    expect(state.bubble.text).toContain('Progress check: you have completed 2 lessons, solved 1 problem, and started a guided 9x9 game.');
    expect(state.bubble.text).toContain('Strongest evidence: Capture and Liberties are moving from vocabulary into practice.');
    expect(state.bubble.text).toContain('Still fragile: Groups and Stones & Board need more proof.');
    expect(state.bubble.text).toContain('Next honest step: Capturing Stones. This is the next lesson in the learning path.');
    expect(state.bubble.actions).toEqual([{ id: 'lesson:capture', label: 'Start lesson: Capturing Stones' }]);
    expect(state.chatMessages.at(-1)?.actions).toEqual([{ id: 'lesson:capture', label: 'Start lesson: Capturing Stones' }]);
    expect(useConceptStore.getState().getMastery('capture').encounterCount).toBeGreaterThan(1);
    expect(useConceptStore.getState().getMastery('liberties').encounterCount).toBeGreaterThan(1);
  });
});
