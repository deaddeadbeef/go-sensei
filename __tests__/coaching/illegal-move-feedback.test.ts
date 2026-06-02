import { getIllegalMoveFeedback } from '@/lib/coaching/illegal-move-feedback';
import { createGame, passMove, playMove } from '@/lib/go-engine';
import type { GameState, Point } from '@/lib/go-engine';

function playSequence(points: Point[]): GameState {
  let game = createGame(9);

  for (const point of points) {
    const result = playMove(game, point);
    if (!result.success) throw new Error(`test setup move failed at ${point.x},${point.y}: ${result.reason}`);
    game = result.newState;
  }

  return game;
}

describe('illegal move feedback', () => {
  it('explains occupied intersections and re-marks legal beginner targets', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const game = passMove(firstMove.newState);

    const feedback = getIllegalMoveFeedback(game, { x: 2, y: 2 }, 'guided');

    expect(feedback?.text).toContain('C7 already has a Black stone, so you cannot play there.');
    expect(feedback?.text).toContain('Go stones stay fixed once placed; choose an empty intersection instead.');
    expect(feedback?.text).toContain('For the current beginner goal, play a legal target: Make your stones work together.');
    expect(feedback?.text).toContain('Try E7 or C5.');
    expect(feedback?.text).toContain('I marked the legal targets again.');
    expect(feedback?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'shape', 'direction-of-play']));
    expect(feedback?.boardFocus.highlights).toEqual([{
      id: 'illegal-occupied-2,2',
      point: { x: 2, y: 2 },
      variant: 'warning',
      label: 'C7 is occupied by Black.',
    }]);
    expect(feedback?.boardFocus.suggestions).toEqual([
      {
        id: 'illegal-move-target-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'illegal-move-target-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(feedback?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('explains suicide moves with a danger highlight', () => {
    const game = playSequence([
      { x: 3, y: 0 },
      { x: 1, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 1 },
      { x: 5, y: 0 },
      { x: 2, y: 1 },
      { x: 6, y: 0 },
      { x: 1, y: 2 },
    ]);

    const feedback = getIllegalMoveFeedback(game, { x: 1, y: 1 }, 'guided');

    expect(feedback?.text).toContain('B8 would have no liberties and would not capture anything, so it is suicide.');
    expect(feedback?.text).toContain('A legal Go move must leave the new stone or its connected group with breathing room.');
    expect(feedback?.conceptIds).toEqual(expect.arrayContaining(['liberties', 'groups', 'capture']));
    expect(feedback?.boardFocus.highlights).toEqual([{
      id: 'illegal-suicide-1,1',
      point: { x: 1, y: 1 },
      variant: 'danger',
      label: 'B8 has no liberties.',
    }]);
  });
});
