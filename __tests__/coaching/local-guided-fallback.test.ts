import { getLocalGuidedFallback } from '@/lib/coaching/local-guided-fallback';
import { createGame, playMove } from '@/lib/go-engine';

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
    expect(fallback?.text).toContain('cloud Sensei session expired');
    expect(fallback?.text).toContain('Good: C7 hit the marked corner goal');
    expect(fallback?.text).toContain('Lesson: C7 is a useful anchor because the edge helps it surround space.');
    expect(fallback?.text).toContain('Make your stones work together');
    expect(fallback?.text).toContain('Try E7 or C5');
    expect(fallback?.text).toContain('I marked your move, passed for White, and marked the next targets');
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
    expect(fallback?.text).toContain('Start with a corner');
    expect(fallback?.text).toContain('Use the marked targets to make the next move concrete.');
  });

  it('does not take over non-beginner modes', () => {
    expect(getLocalGuidedFallback(createGame(9), 'advanced', 'server-error')).toBeNull();
  });
});
