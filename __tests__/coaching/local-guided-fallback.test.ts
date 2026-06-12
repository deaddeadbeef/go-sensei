import { getLocalGuidedFallback } from '@/lib/coaching/local-guided-fallback';
import { createGame, passMove, playMove, setStone } from '@/lib/go-engine';
import type { GameState, Point } from '@/lib/go-engine';

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

describe('local guided fallback', () => {
  it('keeps a guided learner moving after a failed AI response to a first move', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const fallback = getLocalGuidedFallback(firstMove.newState, 'guided', 'auth-expired');

    expect(fallback).toMatchObject({
      shouldPassSensei: true,
      conceptIds: expect.arrayContaining(['corner-opening', 'territory', 'shape', 'direction-of-play']),
      actions: [{ id: 'hint', label: 'Show targets' }],
    });
    expect(fallback?.boardFocus?.highlights).toEqual([{
      id: 'local-fallback-learned-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'C7: move to learn from - beginner job met.',
    }]);
    expect(fallback?.boardFocus?.suggestions).toEqual([
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
    expect(fallback?.text).toContain('I can keep coaching from this board, so your practice does not have to stop.');
    expect(fallback?.text).toContain('Good: C7 hit the marked corner goal');
    expect(fallback?.text).toContain('Lesson: C7 is a useful anchor because the edge helps it surround space.');
    expect(fallback?.text).toContain('Make your stones work together');
    expect(fallback?.text).toContain('Try E7 or C5');
    expect(fallback?.text).toContain('I marked your move, gave White a teaching pass, and marked the next targets');
    expect(fallback?.text.toLowerCase()).not.toContain('cloud');
    expect(fallback?.text.toLowerCase()).not.toContain('locally');
  });

  it('names the missed visible objective before repeating the next focus', () => {
    const firstMove = playMove(createGame(9), { x: 4, y: 4 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const fallback = getLocalGuidedFallback(firstMove.newState, 'guided', 'auth-unavailable');

    expect(fallback).toMatchObject({
      shouldPassSensei: true,
      conceptIds: expect.arrayContaining(['corner-opening', 'territory']),
      actions: [
        { id: 'hint', label: 'Show targets' },
        { id: 'lesson:territory', label: 'Review territory' },
      ],
    });
    expect(fallback?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
    expect(fallback?.boardFocus?.highlights).toEqual([{
      id: 'local-fallback-learned-4,4',
      point: { x: 4, y: 4 },
      variant: 'warning',
      label: 'E5: move to learn from - beginner job missed.',
    }]);
    expect(fallback?.text).toContain('Progress check: E5 was not one of the marked corner points.');
    expect(fallback?.text).toContain('Lesson: E5 reaches in every direction, but it does not use the board edge.');
    expect(fallback?.text).toContain('Try C7, G7, C3, or G3.');
    expect(fallback?.text).toContain('Next focus: Start with a corner.');
    expect(fallback?.text).not.toContain('GitHub login');
  });

  it('explains a successful one-space jump as shape during local guided feedback', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');

    const fallback = getLocalGuidedFallback(extensionMove.newState, 'guided', 'auth-unavailable');

    expect(fallback).toMatchObject({
      shouldPassSensei: true,
      conceptIds: expect.arrayContaining(['shape', 'direction-of-play']),
      actions: [{ id: 'hint', label: 'Show targets' }],
    });
    expect(fallback?.text).toContain('Good: E7 made a one-space jump from your stone. Next, read the open gap before extending again.');
    expect(fallback?.text).toContain('Lesson: E7 is a one-space jump from C7. The empty point at D7 leaves room to grow');
    expect(fallback?.text).toContain('Next focus: Make your stones work together. Play a one-space jump from one of your stones. Try G7, E5, or C5.');
    expect(fallback?.boardFocus?.highlights).toEqual([{
      id: 'local-fallback-learned-4,2',
      point: { x: 4, y: 2 },
      variant: 'positive',
      label: 'E7: move to learn from - beginner job met.',
    }]);
    expect(fallback?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ]);
  });

  it('offers local objective guidance without passing when it is already black to play', () => {
    const fallback = getLocalGuidedFallback(createGame(9), 'guided', 'auth-unavailable');

    expect(fallback).toMatchObject({
      shouldPassSensei: false,
      conceptIds: expect.arrayContaining(['corner-opening', 'territory']),
      actions: [
        { id: 'hint', label: 'Show targets' },
        { id: 'lesson:territory', label: 'Review territory' },
      ],
    });
    expect(fallback?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
    expect(fallback?.text).toContain('I can coach this guided game from the board in front of us.');
    expect(fallback?.text).not.toContain('GitHub login');
    expect(fallback?.text.toLowerCase()).not.toContain('cloud');
    expect(fallback?.text.toLowerCase()).not.toContain('locally');
    expect(fallback?.text).toContain('Start with a corner');
    expect(fallback?.text).toContain('Use the marked targets to make the next move concrete.');
  });

  it('keeps an empty-board 19x19 learner moving after the first corner candidate', () => {
    const firstMove = playMove(createGame(19), { x: 3, y: 3 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const fallback = getLocalGuidedFallback(firstMove.newState, 'beginner', 'auth-unavailable');

    expect(fallback).toMatchObject({
      shouldPassSensei: true,
      conceptIds: expect.arrayContaining(['corner-opening', 'territory']),
      actions: [{ id: 'lesson:territory', label: 'Review territory' }],
    });
    expect(fallback?.text).toContain('Your first stone at D16 gives us a real board position to learn from.');
    expect(fallback?.text).toContain('D16 starts an upper-left corner framework.');
    expect(fallback?.text).toContain('Next focus: choose a second corner framework. Try Q16, D4, or Q4.');
    expect(fallback?.text).toContain('I marked your move, gave White a teaching pass, and marked the next corner choices.');
    expect(fallback?.boardFocus?.highlights).toEqual([{
      id: 'local-fallback-learned-3,3',
      point: { x: 3, y: 3 },
      variant: 'positive',
      label: 'D16: first corner framework started.',
    }]);
    expect(fallback?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-fallback-opening-19-move-15,3',
        point: { x: 15, y: 3 },
        rank: 1,
        reason: 'Try Q16 next: another corner gives Black a second easy framework before fighting starts.',
      },
      {
        id: 'local-fallback-opening-19-move-3,15',
        point: { x: 3, y: 15 },
        rank: 2,
        reason: 'Try D4 next: another corner gives Black a second easy framework before fighting starts.',
      },
      {
        id: 'local-fallback-opening-19-move-15,15',
        point: { x: 15, y: 15 },
        rank: 3,
        reason: 'Try Q4 next: another corner gives Black a second easy framework before fighting starts.',
      },
    ]);
  });

  it('marks fresh-area targets with direction-aware reasons during local fallback', () => {
    const fallback = getLocalGuidedFallback(settledShapeGame(), 'guided', 'auth-unavailable');

    expect(fallback).toMatchObject({
      shouldPassSensei: false,
      conceptIds: expect.arrayContaining(['direction-of-play', 'shape']),
      actions: [{ id: 'hint', label: 'Show targets' }],
    });
    expect(fallback?.text).toContain('Choose a new area');
    expect(fallback?.text).toContain('Try H8 or H2.');
    expect(fallback?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-fallback-move-7,1',
        point: { x: 7, y: 1 },
        rank: 1,
        reason: 'Consider H8 as a fresh upper-right direction away from the settled local shape.',
      },
      {
        id: 'local-fallback-move-7,7',
        point: { x: 7, y: 7 },
        rank: 2,
        reason: 'Consider H2 as a fresh lower-right direction away from the settled local shape.',
      },
    ]);
  });

  it('keeps a pending pressure read primary before local fallback offers fresh-area targets', () => {
    const fallback = getLocalGuidedFallback(pendingF5PressureReadGame(), 'guided', 'auth-unavailable');

    expect(fallback).toMatchObject({
      shouldPassSensei: false,
      actions: [],
    });
    expect(fallback?.text).toContain('Next focus: Read F5 before choosing a new area: decide whether Black should connect, defend, or can safely move elsewhere.');
    expect(fallback?.text).toContain('Use the pressure prompt to finish this read before choosing the next area.');
    expect(fallback?.text).not.toContain('Next focus: Choose a new area.');
    expect(fallback?.text).not.toContain('Try B8 or H8.');
    expect(fallback?.text).not.toContain('marked the next targets');
    expect(fallback?.boardFocus?.highlights).toEqual([{
      id: 'local-fallback-learned-4,4',
      point: { x: 4, y: 4 },
      variant: 'positive',
      label: 'E5: move to learn from - beginner job met.',
    }]);
    expect(fallback?.boardFocus?.suggestions).toBeUndefined();
  });

  it('does not take over non-beginner modes', () => {
    expect(getLocalGuidedFallback(createGame(9), 'advanced', 'server-error')).toBeNull();
  });
});
