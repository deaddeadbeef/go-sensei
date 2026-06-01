import { getLocalGuidedFallback } from '@/lib/coaching/local-guided-fallback';
import { createGame, playMove } from '@/lib/go-engine';

describe('local guided fallback', () => {
  it('keeps a guided learner moving after a failed AI response to a first move', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const fallback = getLocalGuidedFallback(firstMove.newState, 'guided', 'auth-expired');

    expect(fallback).toMatchObject({
      shouldPassSensei: true,
      conceptIds: expect.arrayContaining(['shape', 'direction-of-play']),
      actions: [{ id: 'hint', label: 'Show targets' }],
    });
    expect(fallback?.text).toContain('cloud Sensei session expired');
    expect(fallback?.text).toContain('Good: C7 hit the marked corner goal');
    expect(fallback?.text).toContain('Make your stones work together');
    expect(fallback?.text).toContain('Try E7 or C5');
    expect(fallback?.text).toContain('passing for White');
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
    expect(fallback?.text).toContain('Progress check: E5 was not one of the marked corner points.');
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
    expect(fallback?.text).toContain('teach this beginner path locally');
    expect(fallback?.text).not.toContain('GitHub login');
    expect(fallback?.text).toContain('Start with a corner');
    expect(fallback?.text).toContain('marked board guidance');
  });

  it('does not take over non-beginner modes', () => {
    expect(getLocalGuidedFallback(createGame(9), 'advanced', 'server-error')).toBeNull();
  });
});
