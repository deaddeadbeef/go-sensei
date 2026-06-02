import { getLocalGameReviewAnswer, getLocalQuestionAnswer } from '@/lib/coaching/local-question-answer';
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

describe('local question answer', () => {
  it('answers next-move questions with the current beginner objective', () => {
    const answer = getLocalQuestionAnswer('What should I do?', createGame(9), 'guided');

    expect(answer?.text).toContain('Your next job is: Start with a corner.');
    expect(answer?.text).toContain('Try C7, G7, C3, or G3.');
    expect(answer?.text).toContain('I marked the best beginner targets on the board.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['corner-opening', 'territory']));
    expect(answer?.boardFocus?.suggestions).toEqual([
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
    expect(answer?.actions).toEqual([{ id: 'lesson:territory', label: 'Review territory' }]);
  });

  it('answers next-move questions from the learner perspective after a just-played move', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('What should I do?', firstMove.newState, 'guided');

    expect(firstMove.newState.currentPlayer).toBe('white');
    expect(answer?.text).toContain('Your next job is: Make your stones work together.');
    expect(answer?.text).toContain('Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it('steadies a confused beginner with one visible board job', () => {
    const answer = getLocalQuestionAnswer("I'm confused", createGame(9), 'guided');

    expect(answer?.text).toContain('Slow down to one board job.');
    expect(answer?.text).toContain('Your current job is: Start with a corner.');
    expect(answer?.text).toContain('Place your next stone near an empty corner. Try C7, G7, C3, or G3.');
    expect(answer?.text).toContain('Do not try to solve the whole board yet: choose one marked coordinate, then ask what it changed.');
    expect(answer?.text).toContain('I marked the targets again so your next action is visible.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['direction-of-play', 'corner-opening', 'territory']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-confusion-move-2,2',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-confusion-move-6,2',
        point: { x: 6, y: 2 },
        rank: 2,
        reason: 'Start at G7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-confusion-move-2,6',
        point: { x: 2, y: 6 },
        rank: 3,
        reason: 'Start at C3: the board edge helps this stone make territory.',
      },
      {
        id: 'local-confusion-move-6,6',
        point: { x: 6, y: 6 },
        rank: 4,
        reason: 'Start at G3: the board edge helps this stone make territory.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
  });

  it('turns resignation questions into a concrete salvage target', () => {
    const answer = getLocalQuestionAnswer('Should I resign?', createGame(9), 'guided');

    expect(answer?.text).toContain('Resigning or starting over is allowed, but do it deliberately');
    expect(answer?.text).toContain('For guided learning, first try to rescue one useful idea from the board.');
    expect(answer?.text).toContain('Your current salvage job is: Start with a corner.');
    expect(answer?.text).toContain('Place your next stone near an empty corner. Try C7, G7, C3, or G3.');
    expect(answer?.text).toContain('play one of them before deciding to throw this board away');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'direction-of-play', 'corner-opening', 'territory']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-resign-restart-move-2,2',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-resign-restart-move-6,2',
        point: { x: 6, y: 2 },
        rank: 2,
        reason: 'Start at G7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-resign-restart-move-2,6',
        point: { x: 2, y: 6 },
        rank: 3,
        reason: 'Start at C3: the board edge helps this stone make territory.',
      },
      {
        id: 'local-resign-restart-move-6,6',
        point: { x: 6, y: 6 },
        rank: 4,
        reason: 'Start at G3: the board edge helps this stone make territory.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'guided:intro', label: 'Start fresh guided game' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
  });

  it('answers start-over questions with the current post-move target', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('Should I start over?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Your current salvage job is: Make your stones work together.');
    expect(answer?.text).toContain('Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'guided:intro', label: 'Start fresh guided game' },
    ]);
  });

  it('explains why beginners start near a corner instead of the center', () => {
    const answer = getLocalQuestionAnswer('Why not the center?', createGame(9), 'guided');

    expect(answer?.text).toContain('Corners are the easiest place for beginners to make territory because two board edges already act like walls.');
    expect(answer?.text).toContain('A center stone reaches in every direction, but it has to build all four sides itself before it becomes points.');
    expect(answer?.text).toContain('That is why the first guided goal starts near a corner instead of the open center.');
    expect(answer?.text).toContain('Try C7, G7, C3, or G3.');
    expect(answer?.text).toContain('I marked the corner starts again.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['corner-opening', 'territory', 'influence']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-corner-opening-move-2,2',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-corner-opening-move-6,2',
        point: { x: 6, y: 2 },
        rank: 2,
        reason: 'Start at G7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-corner-opening-move-2,6',
        point: { x: 2, y: 6 },
        rank: 3,
        reason: 'Start at C3: the board edge helps this stone make territory.',
      },
      {
        id: 'local-corner-opening-move-6,6',
        point: { x: 6, y: 6 },
        rank: 4,
        reason: 'Start at G3: the board edge helps this stone make territory.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
  });

  it('explains influence as future pressure with current beginner targets', () => {
    const answer = getLocalQuestionAnswer('What is influence?', createGame(9), 'guided');

    expect(answer?.text).toContain('Influence is future pressure, not territory you can count yet.');
    expect(answer?.text).toContain('A center stone can reach many directions, so it may help later fights, connections, or extensions, but by itself it does not surround points.');
    expect(answer?.text).toContain('Try C7, G7, C3, or G3. Corners turn into visible territory faster because the board edges already help form the border.');
    expect(answer?.text).toContain('I marked the practical next target so influence turns into a board action.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['influence', 'territory', 'direction-of-play', 'corner-opening']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-influence-move-2,2',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-influence-move-6,2',
        point: { x: 6, y: 2 },
        rank: 2,
        reason: 'Start at G7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-influence-move-2,6',
        point: { x: 2, y: 6 },
        rank: 3,
        reason: 'Start at C3: the board edge helps this stone make territory.',
      },
      {
        id: 'local-influence-move-6,6',
        point: { x: 6, y: 6 },
        rank: 4,
        reason: 'Start at G3: the board edge helps this stone make territory.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
  });

  it('explains the goal of Go with current board targets', () => {
    const answer = getLocalQuestionAnswer('How do I win?', createGame(9), 'guided');

    expect(answer?.text).toContain('To win Go, finish with more points than your opponent.');
    expect(answer?.text).toContain("Points come from empty territory you surround, captured stones, and White's 6.5 komi bonus.");
    expect(answer?.text).toContain('Stones are the tools: they claim space, keep liberties, connect into strong groups');
    expect(answer?.text).toContain('For this beginner board, translate that big goal into one job: Start with a corner.');
    expect(answer?.text).toContain('Try C7, G7, C3, or G3.');
    expect(answer?.text).toContain('I marked moves that turn the win condition into your next board decision.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['scoring', 'territory', 'capture', 'liberties', 'corner-opening']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-game-goal-move-2,2',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-game-goal-move-6,2',
        point: { x: 6, y: 2 },
        rank: 2,
        reason: 'Start at G7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-game-goal-move-2,6',
        point: { x: 2, y: 6 },
        rank: 3,
        reason: 'Start at C3: the board edge helps this stone make territory.',
      },
      {
        id: 'local-game-goal-move-6,6',
        point: { x: 6, y: 6 },
        rank: 4,
        reason: 'Start at G3: the board edge helps this stone make territory.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
  });

  it('explains the basic rules with current board targets', () => {
    const answer = getLocalQuestionAnswer('What are the rules?', createGame(9), 'guided');

    expect(answer?.text).toContain('The basic rules of Go are small: players alternate placing Black and White stones on empty intersections, not squares.');
    expect(answer?.text).toContain('Stones that touch up, down, left, or right become one group; empty points touching that group are liberties.');
    expect(answer?.text).toContain('If a group loses every liberty, it is captured and removed from the board.');
    expect(answer?.text).toContain("surrounded territory, captures, and White's 6.5 komi decide who has more points.");
    expect(answer?.text).toContain('In this guided game, use those rules by following one concrete job: Start with a corner.');
    expect(answer?.text).toContain('Try C7, G7, C3, or G3.');
    expect(answer?.text).toContain('I marked the legal beginner targets so the rules connect to your next move.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining([
      'stones-and-board',
      'groups',
      'liberties',
      'capture',
      'territory',
      'scoring',
      'corner-opening',
    ]));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-rules-move-2,2',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-rules-move-6,2',
        point: { x: 6, y: 2 },
        rank: 2,
        reason: 'Start at G7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-rules-move-2,6',
        point: { x: 2, y: 6 },
        rank: 3,
        reason: 'Start at C3: the board edge helps this stone make territory.',
      },
      {
        id: 'local-rules-move-6,6',
        point: { x: 6, y: 6 },
        rank: 4,
        reason: 'Start at G3: the board edge helps this stone make territory.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
  });

  it('answers next-move questions by pointing weak groups at liberties', () => {
    const game = playSequence([
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 6, y: 2 },
      { x: 1, y: 2 },
    ]);

    const answer = getLocalQuestionAnswer('hint', game, 'guided');

    expect(answer?.text).toContain('Your next job is: Give weak groups room.');
    expect(answer?.text).toContain('Try C6 or D7.');
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-objective-move-2,3',
        point: { x: 2, y: 3 },
        rank: 1,
        reason: 'Give your group room by playing its liberty at C6.',
      },
      {
        id: 'local-objective-move-3,2',
        point: { x: 3, y: 2 },
        rank: 2,
        reason: 'Give your group room by playing its liberty at D7.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'lesson:liberties', label: 'Review liberties' }]);
  });

  it('reviews a successful beginner move without cloud help', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('Was that good?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Yes. Good: C7 hit the marked corner goal.');
    expect(answer?.text).toContain('C7 is a useful anchor');
    expect(answer?.text).toContain('Next: Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.text).toContain('I marked the next beginner targets on the board.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['corner-opening', 'territory', 'shape']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-review-next-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-review-next-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
  });

  it('reviews a missed beginner goal constructively', () => {
    const firstMove = playMove(createGame(9), { x: 4, y: 4 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('Did I make a mistake?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Not for this beginner goal.');
    expect(answer?.text).toContain('E5 was not one of the marked corner points.');
    expect(answer?.text).toContain('E5 reaches in every direction');
    expect(answer?.text).toContain('Next: Place your next stone near an empty corner. Try C7, G7, C3, or G3.');
    expect(answer?.actions).toEqual([{ id: 'lesson:territory', label: 'Review territory' }]);
    expect(answer?.boardFocus?.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
  });

  it('explains what the last successful move changed', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('What did that change?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('That move changed the position around C7.');
    expect(answer?.text).toContain('It completed the beginner job: Good: C7 hit the marked corner goal.');
    expect(answer?.text).toContain('C7 is a useful anchor because the edge helps it surround space.');
    expect(answer?.text).toContain('The board now asks for: Make your stones work together. Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.text).toContain('I highlighted C7 and marked the next targets so the cause-and-effect is visible.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['direction-of-play', 'corner-opening', 'territory', 'shape']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-move-impact-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'C7: met the current beginner job.',
    }]);
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-move-impact-next-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-move-impact-next-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('turns the last move into a local learning takeaway', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('What should I learn from this?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Lesson from C7: your move worked because it followed the beginner job.');
    expect(answer?.text).toContain('Good: C7 hit the marked corner goal.');
    expect(answer?.text).toContain('Board idea: C7 is a useful anchor because the edge helps it surround space.');
    expect(answer?.text).toContain('Practice it now by playing the next job: Make your stones work together. Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.text).toContain('I highlighted C7 and marked the practice targets so the lesson has a next move.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['direction-of-play', 'corner-opening', 'territory', 'shape']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-learning-takeaway-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'C7: move to learn from - beginner job met.',
    }]);
    expect(answer?.boardFocus?.suggestions).toEqual([
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
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('explains what a missed opening move changed and marks the repair targets', () => {
    const firstMove = playMove(createGame(9), { x: 4, y: 4 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('What changed?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('That move changed the position around E5.');
    expect(answer?.text).toContain('It missed the beginner job: Progress check: E5 was not one of the marked corner points.');
    expect(answer?.text).toContain('E5 reaches in every direction, but it does not use the board edge.');
    expect(answer?.text).toContain('The board now asks for: Start with a corner. Place your next stone near an empty corner. Try C7, G7, C3, or G3.');
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-move-impact-4,4',
      point: { x: 4, y: 4 },
      variant: 'warning',
      label: 'E5: missed the current beginner job.',
    }]);
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
  });

  it('builds a local beginner game review from objective progress', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalGameReviewAnswer(firstMove.newState, 'guided');

    expect(answer?.text).toContain('Local beginner review: here are the board moments I can verify without cloud help.');
    expect(answer?.text).toContain('Best move: Move 1 C7 followed "Start with a corner".');
    expect(answer?.text).toContain('Main fix: after Move 1 C7, do not stop at "good"; ask what the stone helps next.');
    expect(answer?.text).toContain('Next practice target: Make your stones work together. Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'corner-opening', 'territory', 'shape']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-game-review-best-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'Move 1 C7 followed: Start with a corner.',
    }]);
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-game-review-next-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-game-review-next-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'guided:intro', label: 'Start fresh guided game' },
    ]);
  });

  it('answers typed game-review requests locally', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('Review this game', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Local beginner review');
    expect(answer?.text).toContain('Best move: Move 1 C7 followed "Start with a corner".');
    expect(answer?.boardFocus?.highlights?.[0]).toMatchObject({
      point: { x: 2, y: 2 },
      variant: 'positive',
    });
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it('turns a local beginner game review miss into a concrete replay target', () => {
    const firstMove = playMove(createGame(9), { x: 4, y: 4 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalGameReviewAnswer(firstMove.newState, 'guided');

    expect(answer?.text).toContain('Best habit to keep: you played 1 Black move');
    expect(answer?.text).toContain('Main fix: Move 1 E5 missed "Start with a corner".');
    expect(answer?.text).toContain('Next time, Place your next stone near an empty corner. Try C7, G7, C3, or G3.');
    expect(answer?.text).toContain('Next practice target: Start with a corner.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'corner-opening', 'territory']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-game-review-fix-4,4',
      point: { x: 4, y: 4 },
      variant: 'warning',
      label: 'Move 1 E5 missed: Start with a corner.',
    }]);
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'guided:intro', label: 'Start fresh guided game' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
  });

  it('explains one-space jumps with current shape targets', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('What is a one-space jump?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Shape means your stones are arranged so they help each other');
    expect(answer?.text).toContain('A one-space jump leaves one empty point between friendly stones.');
    expect(answer?.text).toContain('On this board, C7 is your anchor. Try E7 or C5.');
    expect(answer?.text).toContain('I marked the current shape targets on the board.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['shape', 'direction-of-play']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-shape-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-shape-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('teaches a reusable reading routine with the current targets', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('How do I read ahead?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Use a three-question reading routine before you play.');
    expect(answer?.text).toContain('First: count liberties. If one of your groups has one or two liberties, read that emergency before expanding.');
    expect(answer?.text).toContain('Second: name the purpose: territory, connection, shape, or capture.');
    expect(answer?.text).toContain("Third: imagine White's reply next to that move; if your stone still has room and your goal is clearer, the move is worth testing.");
    expect(answer?.text).toContain('On this board, apply the routine to: Make your stones work together. Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.text).toContain('Start by reading E7: what Black gains, how White might touch it, and whether C7 still has enough liberties.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['reading', 'direction-of-play', 'liberties', 'shape']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-reading-anchor-2,2',
      point: { x: 2, y: 2 },
      variant: 'neutral',
      label: 'C7: use this stone as the anchor for your reading routine.',
    }]);
    expect(answer?.boardFocus?.suggestions).toEqual([
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
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
  });

  it("reads White's likely reply from the learner's last stone", () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('What can White do?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Read White from your Black stone at C7.');
    expect(answer?.text).toContain("White's simplest reply is to play on one of its liberties: C8, C6, B7, or D7.");
    expect(answer?.text).toContain("That would not capture C7 yet, but it would reduce Black's room; do not panic, count.");
    expect(answer?.text).toContain('Your practical answer is: Make your stones work together. Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.text).toContain('Start by reading E7: if White touches C7, Black should still have room and a clearer shape.');
    expect(answer?.text).toContain('I marked the reply anchor, its liberties, and the current targets so you can practice that reading on the board.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['reading', 'direction-of-play', 'liberties', 'groups', 'shape']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-white-reply-anchor-2,2',
      point: { x: 2, y: 2 },
      variant: 'neutral',
      label: "C7: read White's reply against this Black group.",
    }]);
    expect(answer?.boardFocus?.liberties).toEqual([{
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
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-white-reply-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 4,
      label: 'Black group White could pressure: 4 liberties at C8, C6, B7, and D7.',
    });
    expect(answer?.boardFocus?.suggestions).toEqual([
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
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
  });

  it('explains the learner threat honestly when there is no capture yet', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('What am I threatening?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Not a capture threat yet.');
    expect(answer?.text).toContain('C7 threatens future shape: it gives you an anchor to extend from, not an immediate kill.');
    expect(answer?.text).toContain('That Black group has 4 liberties: C8, C6, B7, and D7, so it has room to build.');
    expect(answer?.text).toContain('A useful beginner threat is a move White should respect because it builds territory, connection, safety, or pressure.');
    expect(answer?.text).toContain('On this board, turn the threat into: Make your stones work together. Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['direction-of-play', 'reading', 'liberties', 'shape']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-threat-anchor-2,2',
      point: { x: 2, y: 2 },
      variant: 'neutral',
      label: 'C7: current Black stone creating a future threat.',
    }]);
    expect(answer?.boardFocus?.liberties).toEqual([{
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
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-threat-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 4,
      label: 'Black group creating a future threat: 4 liberties at C8, C6, B7, and D7.',
    });
    expect(answer?.boardFocus?.suggestions).toEqual([
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
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
  });

  it('explains solid connection versus one-space jump shape', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('How do I connect my stones?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('Stones become one solid group only when they touch up, down, left, or right.');
    expect(answer?.text).toContain('Diagonals do not connect.');
    expect(answer?.text).toContain('A cut is the empty point or line where the opponent can separate stones that are only loosely related.');
    expect(answer?.text).toContain('Your group at C7 currently has 4 liberties');
    expect(answer?.text).toContain('E7 and C5 are not solid connections to C7 yet. They are one-space jumps');
    expect(answer?.text).toContain('I marked your current group and the connection-shape targets.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['groups', 'liberties', 'shape', 'direction-of-play']));
    expect(answer?.boardFocus?.liberties).toEqual([{
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
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 4,
    });
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-connection-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-connection-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:groups', label: 'Review groups' },
    ]);
  });

  it('explains a White cut through a one-space jump gap from the learner anchor', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const whiteMove = playMove(firstMove.newState, { x: 3, y: 2 });
    if (!whiteMove.success) throw new Error('test setup white move failed');

    const answer = getLocalQuestionAnswer('Did White cut me?', whiteMove.newState, 'guided');

    expect(answer?.text).toContain('Your group at C7 currently has 3 liberties: C8, C6, and B7.');
    expect(answer?.text).toContain('White is occupying D7, the gap between C7 and E7.');
    expect(answer?.text).toContain('E7 is blocked as a one-space jump right now, so use the clean marked extension instead: C5.');
    expect(answer?.text).toContain('I marked your current group, the blocked gap, and the clean connection-shape target.');
    expect(answer?.text).not.toContain('to D7 yet');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['groups', 'liberties', 'shape', 'direction-of-play']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-connection-blocked-gap-3,2',
      point: { x: 3, y: 2 },
      variant: 'danger',
      label: 'D7: White occupies the one-space jump gap toward E7.',
    }]);
    expect(answer?.boardFocus?.liberties).toEqual([{
      id: 'local-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 3,
      libertyPoints: [
        { x: 2, y: 1 },
        { x: 2, y: 3 },
        { x: 1, y: 2 },
      ],
    }]);
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 3,
    });
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-connection-move-2,4',
        point: { x: 2, y: 4 },
        rank: 1,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
  });

  it('explains the latest White move as board pressure with a practical reply', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const whiteMove = playMove(firstMove.newState, { x: 3, y: 2 });
    if (!whiteMove.success) throw new Error('test setup white move failed');

    const answer = getLocalQuestionAnswer('Why did White play there?', whiteMove.newState, 'guided');

    expect(answer?.text).toContain('White just played D7.');
    expect(answer?.text).toContain('It touches your Black group at C7 and leaves it with 3 liberties: C8, C6, and B7.');
    expect(answer?.text).toContain('That is pressure, not a mystery: White is making your group easier to attack if you ignore its liberties.');
    expect(answer?.text).toContain('Your reply should still be practical: Make your stones work together. Play a one-space jump from one of your stones. Try C5.');
    expect(answer?.text).toContain("I highlighted White's move and marked Black's practical replies.");
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['direction-of-play', 'groups', 'liberties', 'shape']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-opponent-move-3,2',
      point: { x: 3, y: 2 },
      variant: 'warning',
      label: 'D7: latest White move pressures a Black group.',
    }]);
    expect(answer?.boardFocus?.liberties).toEqual([{
      id: 'local-opponent-pressure-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 3,
      libertyPoints: [
        { x: 2, y: 1 },
        { x: 2, y: 3 },
        { x: 1, y: 2 },
      ],
    }]);
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-opponent-pressure-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 3,
      label: "Black group pressured by White's D7: 3 liberties at C8, C6, and B7.",
    });
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-opponent-response-move-2,4',
        point: { x: 2, y: 4 },
        rank: 1,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('identifies the current weak group and marks rescue liberties', () => {
    const game = playSequence([
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 4, y: 4 },
      { x: 1, y: 2 },
    ]);

    const answer = getLocalQuestionAnswer('Which group is weak?', game, 'guided');

    expect(answer?.text).toContain('The weak group is your Black group at C7.');
    expect(answer?.text).toContain('It has only 2 liberties: C6 and D7.');
    expect(answer?.text).toContain('if White fills those liberties, it will be captured.');
    expect(answer?.text).toContain('Play one marked liberty to give it breathing room.');
    expect(answer?.text).toContain('I marked the weak group, its liberties, and the rescue moves.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['groups', 'liberties', 'capture']));
    expect(answer?.boardFocus?.liberties).toEqual([{
      id: 'local-weak-group-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 2,
      libertyPoints: [
        { x: 2, y: 3 },
        { x: 3, y: 2 },
      ],
    }]);
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-weak-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 2,
      label: 'Weak Black group: 2 liberties at C6 and D7.',
    });
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-weak-group-move-2,3',
        point: { x: 2, y: 3 },
        rank: 1,
        reason: 'Give the weak group another liberty by playing C6.',
      },
      {
        id: 'local-weak-group-move-3,2',
        point: { x: 3, y: 2 },
        rank: 2,
        reason: 'Give the weak group another liberty by playing D7.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:liberties', label: 'Review liberties' },
    ]);
  });

  it('answers danger questions by counting pressure before calling a group weak', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const whiteMove = playMove(firstMove.newState, { x: 3, y: 2 });
    if (!whiteMove.success) throw new Error('test setup white move failed');

    const answer = getLocalQuestionAnswer('Is my group in danger?', whiteMove.newState, 'guided');

    expect(answer?.text).toContain('A weak group is a connected group with very little room, usually one or two liberties.');
    expect(answer?.text).toContain('Your Black group at C7 is under pressure, but it is not in immediate danger: it has 3 liberties: C8, C6, and B7.');
    expect(answer?.text).toContain('Immediate danger usually starts at one or two liberties; with 3 liberties, keep building while you keep counting.');
    expect(answer?.text).toContain('Your current guided job is: Make your stones work together. Play a one-space jump from one of your stones. Try C5.');
    expect(answer?.text).toContain('I marked that group, its liberties, and the useful next target so the safety check is visible.');
    expect(answer?.text).not.toContain('Diagonals do not connect.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['groups', 'liberties', 'shape', 'direction-of-play']));
    expect(answer?.boardFocus?.liberties).toEqual([{
      id: 'local-weak-group-current-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 3,
      libertyPoints: [
        { x: 2, y: 1 },
        { x: 2, y: 3 },
        { x: 1, y: 2 },
      ],
    }]);
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-weak-group-current-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 3,
      label: 'Black group under pressure, not weak yet: 3 liberties at C8, C6, and B7.',
    });
    expect(answer?.boardFocus?.suggestions).toEqual([{
      id: 'local-weak-group-current-move-2,4',
      point: { x: 2, y: 4 },
      rank: 1,
      reason: 'Try C5 as a one-space jump that works with your stones.',
    }]);
  });

  it('answers safety questions about a named Black group coordinate', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const secondMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!secondMove.success) throw new Error('test setup second move failed');

    const answer = getLocalQuestionAnswer('Is E7 safe?', secondMove.newState, 'guided');

    expect(answer?.text).toContain('A weak group is a connected group with very little room, usually one or two liberties.');
    expect(answer?.text).toContain('Your Black group at E7 is not in immediate danger: it has 4 liberties: E8, E6, D7, and F7.');
    expect(answer?.text).toContain('Immediate danger usually starts at one or two liberties; with 4 liberties, keep building while you keep counting.');
    expect(answer?.text).toContain('Your current guided job is: Make your stones work together. Play a one-space jump from one of your stones. Try G7, E5, or C5.');
    expect(answer?.text).not.toContain('Your Black group at C7');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['groups', 'liberties', 'shape', 'direction-of-play']));
    expect(answer?.boardFocus?.liberties).toEqual([{
      id: 'local-weak-group-current-liberties-4,2',
      point: { x: 4, y: 2 },
      count: 4,
      libertyPoints: [
        { x: 4, y: 1 },
        { x: 4, y: 3 },
        { x: 3, y: 2 },
        { x: 5, y: 2 },
      ],
    }]);
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-weak-group-current-4,2',
      stones: [{ x: 4, y: 2 }],
      color: 'black',
      liberties: 4,
      label: 'Black group with room: 4 liberties at E8, E6, D7, and F7.',
    });
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ]);
  });

  it('answers empty-point safety questions as candidate move checks', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('Is D7 safe?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('D7 touches C7 directly.');
    expect(answer?.text).toContain('this beginner goal is practicing a one-space jump');
    expect(answer?.text).toContain('For this board, I would prefer E7 or C5.');
    expect(answer?.text).toContain('I highlighted D7 and re-marked the better beginner targets.');
    expect(answer?.text).not.toContain('D7 is not one of your Black groups');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['shape', 'direction-of-play']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-candidate-question-3,2',
      point: { x: 3, y: 2 },
      variant: 'warning',
      label: 'D7: open, but not the current beginner target.',
    }]);
    expect(answer?.boardFocus?.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it('explains why a marked target move matters', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('Why E7?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('E7 is marked because it is a one-space jump from C7');
    expect(answer?.text).toContain('close enough to work with that stone');
    expect(answer?.text).toContain('C5 works for the same beginner goal.');
    expect(answer?.text).toContain('I marked the current targets again; E7 is the one I explained.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['shape', 'direction-of-play']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-target-reason-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-target-reason-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('does not explain a target through a White-occupied one-space jump gap', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const whiteReply = playMove(firstMove.newState, { x: 3, y: 2 });
    if (!whiteReply.success) throw new Error('test setup white reply failed');

    const answer = getLocalQuestionAnswer('Why E7?', whiteReply.newState, 'guided');

    expect(answer?.text).toContain('E7 is not one of the current marked beginner targets.');
    expect(answer?.text).toContain('E7 would normally be a one-space jump from C7, but White is already on D7, the gap between them.');
    expect(answer?.text).toContain('That gap is what lets the shape work, so E7 is not a clean teamwork target now.');
    expect(answer?.text).toContain('C5 is marked because it is a one-space jump from C7');
    expect(answer?.text).not.toContain('one-space jump from D7');
    expect(answer?.boardFocus?.highlights).toEqual([
      {
        id: 'local-target-reason-blocked-target-4,2',
        point: { x: 4, y: 2 },
        variant: 'warning',
        label: 'E7: not a clean jump while D7 is occupied.',
      },
      {
        id: 'local-target-reason-blocked-gap-3,2',
        point: { x: 3, y: 2 },
        variant: 'danger',
        label: 'D7: White occupies the one-space jump gap.',
      },
    ]);
    expect(answer?.boardFocus?.suggestions).toEqual([{
      id: 'local-target-reason-move-2,4',
      point: { x: 2, y: 4 },
      rank: 1,
      reason: 'Try C5 as a one-space jump that works with your stones.',
    }]);
  });

  it('affirms a marked candidate move before the learner plays it', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('Should I play E7?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Yes. E7 fits the current goal: Make your stones work together.');
    expect(answer?.text).toContain('E7 is marked because it is a one-space jump from C7');
    expect(answer?.text).toContain('I marked the current targets again so you can compare the options before playing.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['shape', 'direction-of-play']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-candidate-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-candidate-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('redirects an unmarked candidate move to the current beginner target', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('What about D7?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('D7 touches C7 directly.');
    expect(answer?.text).toContain('this beginner goal is practicing a one-space jump');
    expect(answer?.text).toContain('For this board, I would prefer E7 or C5.');
    expect(answer?.text).toContain('I highlighted D7 and re-marked the better beginner targets.');
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-candidate-question-3,2',
      point: { x: 3, y: 2 },
      variant: 'warning',
      label: 'D7: open, but not the current beginner target.',
    }]);
    expect(answer?.boardFocus?.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it('compares two marked target moves locally', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('E7 or C5?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('Both choices fit the current goal: Make your stones work together.');
    expect(answer?.text).toContain('E7 and C5 are both one-space jumps from C7.');
    expect(answer?.text).toContain('same idea in different directions');
    expect(answer?.text).toContain('I marked both choices again; choose the side where you want your next area to grow.');
    expect(answer?.boardFocus?.highlights).toBeUndefined();
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-candidate-comparison-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-candidate-comparison-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('chooses the marked target when a comparison includes an off-goal point', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('E7 or D7?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('I would choose E7 for this beginner goal.');
    expect(answer?.text).toContain('E7 is marked because it is a one-space jump from C7');
    expect(answer?.text).toContain('D7 touches C7 directly.');
    expect(answer?.text).toContain('I highlighted the off-goal option and re-marked the better beginner target.');
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-candidate-comparison-3,2',
      point: { x: 3, y: 2 },
      variant: 'warning',
      label: 'D7: open, but not the current beginner target.',
    }]);
    expect(answer?.boardFocus?.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it('explains a local guided White pass without cloud help', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('Why did White pass?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('White passed because I am keeping this guided practice moving locally');
    expect(answer?.text).toContain('you get the next turn right away');
    expect(answer?.text).toContain('In a real game, players usually pass near the end');
    expect(answer?.text).toContain('two passes in a row move the game to scoring');
    expect(answer?.text).toContain("do not treat White's pass as endgame strategy");
    expect(answer?.text).toContain('Your next focus is: Make your stones work together.');
    expect(answer?.text).toContain('I marked the next beginner targets on the board.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'scoring', 'shape']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-pass-explanation-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-pass-explanation-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('discourages early learner passes and marks a better target', () => {
    const answer = getLocalQuestionAnswer('Should I pass?', createGame(9), 'guided');

    expect(answer?.text).toContain('Not yet. Passing is usually an endgame decision');
    expect(answer?.text).toContain('Early in this guided game, passing would skip useful practice and hand the turn away.');
    expect(answer?.text).toContain('Your better move is: Start with a corner.');
    expect(answer?.text).toContain('Try C7, G7, C3, or G3.');
    expect(answer?.text).toContain('I marked the moves that keep the game useful right now.');
    expect(answer?.text).not.toContain("do not treat White's pass as endgame strategy");
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'scoring', 'corner-opening', 'territory']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-pass-explanation-move-2,2',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-pass-explanation-move-6,2',
        point: { x: 6, y: 2 },
        rank: 2,
        reason: 'Start at G7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-pass-explanation-move-2,6',
        point: { x: 2, y: 6 },
        rank: 3,
        reason: 'Start at C3: the board edge helps this stone make territory.',
      },
      {
        id: 'local-pass-explanation-move-6,6',
        point: { x: 6, y: 6 },
        rank: 4,
        reason: 'Start at G3: the board edge helps this stone make territory.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
  });

  it('explains undo before any move and keeps first targets visible', () => {
    const answer = getLocalQuestionAnswer('Can I take that back?', createGame(9), 'guided');

    expect(answer?.text).toContain('There is nothing to undo yet; no stones have been played.');
    expect(answer?.text).toContain('In guided practice, your next useful move is: Start with a corner.');
    expect(answer?.text).toContain('Try C7, G7, C3, or G3.');
    expect(answer?.text).toContain('I marked the first targets again.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'corner-opening', 'territory']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-undo-move-2,2',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-undo-move-6,2',
        point: { x: 6, y: 2 },
        rank: 2,
        reason: 'Start at G7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-undo-move-2,6',
        point: { x: 2, y: 6 },
        rank: 3,
        reason: 'Start at C3: the board edge helps this stone make territory.',
      },
      {
        id: 'local-undo-move-6,6',
        point: { x: 6, y: 6 },
        rank: 4,
        reason: 'Start at G3: the board edge helps this stone make territory.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
  });

  it('answers early score questions without pretending territory is settled', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('Am I winning?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('It is too early for a real score');
    expect(answer?.text).toContain('Black has 1 stone on the board and 0 captures');
    expect(answer?.text).toContain('White has 0 stones and 0 captures, plus 6.5 komi');
    expect(answer?.text).toContain('A better beginner position check is');
    expect(answer?.text).toContain('your next useful test is: Make your stones work together.');
    expect(answer?.text).toContain('I marked the next targets so you can improve the position instead of only counting it.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['scoring', 'territory', 'shape']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-position-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-position-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('explains komi as a scoring bonus without treating it as territory', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('What is komi?', afterWhitePass, 'guided');

    expect(answer?.text).toContain("Komi is 6.5 points added to White's score because Black moves first.");
    expect(answer?.text).toContain('balances the first-move advantage');
    expect(answer?.text).toContain('Komi is not territory White has surrounded');
    expect(answer?.text).toContain('For now, improve the board before counting it: Make your stones work together.');
    expect(answer?.text).toContain('I marked the next targets so you can keep building a position worth scoring later.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['scoring', 'territory', 'shape']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-komi-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-komi-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('explains how to find a board coordinate and highlights it', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('Where is E7?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('Go coordinates name intersections, not squares.');
    expect(answer?.text).toContain('Letters run left to right across the board and skip I');
    expect(answer?.text).toContain('row 9 is the top edge and row 1 is the bottom edge');
    expect(answer?.text).toContain('E7 means column E, row 7.');
    expect(answer?.text).toContain('E7 is also one of the marked targets for Make your stones work together.');
    expect(answer?.text).toContain('E7 is marked because it is a one-space jump from C7');
    expect(answer?.text).toContain('I highlighted E7 on the board.');
    expect(answer?.text).toContain('For the current beginner goal, Try E7 or C5.');
    expect(answer?.text).toContain('I kept the current target points marked');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'shape']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-coordinate-4,2',
      point: { x: 4, y: 2 },
      variant: 'positive',
      label: 'E7: marked target for Make your stones work together.',
    }]);
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-coordinate-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-coordinate-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('explains when a requested coordinate is already occupied by the learner', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('Where is C7?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('C7 means column C, row 7.');
    expect(answer?.text).toContain('C7 currently has your Black stone');
    expect(answer?.text).toContain('use it as an anchor for the next idea');
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-coordinate-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'C7: your Black stone.',
    }]);
    expect(answer?.boardFocus?.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it('explains the learner color and turn after the local White pass', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('Why do I move again?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('You are playing Black in this guided beginner game.');
    expect(answer?.text).toContain('Black moves first; Sensei is White.');
    expect(answer?.text).toContain('It is your turn now');
    expect(answer?.text).toContain('White just passed locally so you can keep practicing right away');
    expect(answer?.text).toContain('that teaching shortcut is why you move again');
    expect(answer?.text).toContain('Your next move should follow the current goal: Make your stones work together. Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.text).toContain('I marked the next targets so the turn status connects to the board.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'shape']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-turn-move-4,2',
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        id: 'local-turn-move-2,4',
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('explains what the numbered board targets mean', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('What are these numbered targets?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('The glowing numbered circles are suggested moves, not stones already on the board.');
    expect(answer?.text).toContain('The number is the suggestion rank: #1 is the first idea to try');
    expect(answer?.text).toContain('Right now the marked target goal is: Make your stones work together. Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.text).toContain('E7 and C5 are marked because they are one-space jumps');
    expect(answer?.text).toContain('Click one marked intersection to play there');
    expect(answer?.text).toContain('I marked the targets again and kept the reasons in Board Analysis.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'shape']));
    expect(answer?.boardFocus?.suggestions).toEqual([
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
    expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('answers liberty questions with current board context', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('What is a liberty?', firstMove.newState, 'guided');

    expect(answer).toMatchObject({
      conceptIds: expect.arrayContaining(['liberties', 'groups', 'capture']),
    });
    expect(answer?.text).toContain('empty point directly next to a stone');
    expect(answer?.text).toContain('Diagonals do not count');
    expect(answer?.text).toContain('Your group at C7 currently has 4 liberties');
    expect(answer?.text).toContain('C8');
    expect(answer?.text).toContain('C6');
    expect(answer?.text).toContain('B7');
    expect(answer?.text).toContain('D7');
    expect(answer?.boardFocus?.liberties).toEqual([{
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
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 4,
    });
    expect(answer?.boardFocus?.groups?.[0].label).toContain('C8');
    expect(answer?.actions).toEqual([{ id: 'lesson:liberties', label: 'Review liberties' }]);
  });

  it('answers atari questions with a concrete warning', () => {
    const answer = getLocalQuestionAnswer('What does atari mean?', createGame(9), 'beginner');

    expect(answer?.text).toContain('exactly one liberty left');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['atari', 'liberties']));
    expect(answer?.boardFocus).toBeUndefined();
    expect(answer?.actions).toEqual([{ id: 'practice:capture', label: 'Practice capture' }]);
  });

  it('marks the current atari group when the board has one', () => {
    const game = playSequence([
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 0, y: 0 },
      { x: 2, y: 3 },
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ]);

    const answer = getLocalQuestionAnswer('What does atari mean?', game, 'guided');

    expect(answer?.text).toContain('I marked the black group at C7');
    expect(answer?.text).toContain('only liberty is D7');
    expect(answer?.boardFocus?.liberties).toEqual([{
      id: 'local-atari-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 1,
      libertyPoints: [{ x: 3, y: 2 }],
    }]);
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-atari-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'black',
      liberties: 1,
      label: 'Black group in atari: only liberty at D7.',
    });
  });

  it('points to the actual capturing move when a white group has one liberty', () => {
    const game = playSequence([
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 0, y: 1 },
    ]);

    const answer = getLocalQuestionAnswer('How do I capture?', game, 'guided');

    expect(answer?.text).toContain('Black can capture it now by playing D7');
    expect(answer?.boardFocus?.liberties).toEqual([{
      id: 'local-capture-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 1,
      libertyPoints: [{ x: 3, y: 2 }],
    }]);
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-capture-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'white',
      liberties: 1,
      label: 'White group ready to capture: final liberty at D7.',
    });
    expect(answer?.boardFocus?.suggestions).toEqual([{
      id: 'local-capture-move-3,2',
      point: { x: 3, y: 2 },
      rank: 1,
      reason: 'Capture White by filling its last liberty at D7.',
    }]);
    expect(answer?.actions).toEqual([{ id: 'practice:capture', label: 'Practice capture' }]);
  });

  it('answers threat questions with an actual capture when White is in atari', () => {
    const game = playSequence([
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 0, y: 1 },
    ]);

    const answer = getLocalQuestionAnswer('Can I capture anything?', game, 'guided');

    expect(answer?.text).toContain('Yes: White has a group at C7 in atari.');
    expect(answer?.text).toContain("Your threat is capture: Black can play D7, the group's final liberty.");
    expect(answer?.text).toContain('I marked the White group, its last liberty, and the capture move.');
    expect(answer?.conceptIds).toEqual(['capture', 'atari', 'liberties', 'reading']);
    expect(answer?.boardFocus?.liberties).toEqual([{
      id: 'local-threat-liberties-2,2',
      point: { x: 2, y: 2 },
      count: 1,
      libertyPoints: [{ x: 3, y: 2 }],
    }]);
    expect(answer?.boardFocus?.groups?.[0]).toMatchObject({
      id: 'local-threat-group-2,2',
      stones: [{ x: 2, y: 2 }],
      color: 'white',
      liberties: 1,
      label: 'White group in atari: capture by playing D7.',
    });
    expect(answer?.boardFocus?.suggestions).toEqual([{
      id: 'local-threat-capture-move-3,2',
      point: { x: 3, y: 2 },
      rank: 1,
      reason: 'Capture White by filling its last liberty at D7.',
    }]);
    expect(answer?.actions).toEqual([{ id: 'practice:capture', label: 'Practice capture' }]);
  });

  it('answers territory questions with corner guidance', () => {
    const answer = getLocalQuestionAnswer('How does territory work?', createGame(9), 'guided');

    expect(answer?.text).toContain('empty space your stones surround');
    expect(answer?.text).toContain('corners and edges');
    expect(answer?.text).toContain('I marked the easiest territory starting points on this board');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['territory', 'corner-opening']));
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-territory-move-2,2',
        point: { x: 2, y: 2 },
        rank: 1,
        reason: 'Start at C7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-territory-move-6,2',
        point: { x: 6, y: 2 },
        rank: 2,
        reason: 'Start at G7: the board edge helps this stone make territory.',
      },
      {
        id: 'local-territory-move-2,6',
        point: { x: 2, y: 6 },
        rank: 3,
        reason: 'Start at C3: the board edge helps this stone make territory.',
      },
      {
        id: 'local-territory-move-6,6',
        point: { x: 6, y: 6 },
        rank: 4,
        reason: 'Start at G3: the board edge helps this stone make territory.',
      },
    ]);
    expect(answer?.actions).toEqual([{ id: 'lesson:territory', label: 'Review territory' }]);
  });

  it('explains a one-space jump framework when asking if territory is mine', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');
    const game = passMove(extensionMove.newState);

    const answer = getLocalQuestionAnswer('Is this territory mine?', game, 'guided');

    expect(answer?.text).toContain('C7 and E7 are starting to sketch a top-side framework');
    expect(answer?.text).toContain('D7 is only a gap in that framework, not safe territory yet');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining([
      'territory',
      'corner-opening',
      'shape',
      'direction-of-play',
    ]));
    expect(answer?.boardFocus?.highlights).toEqual([
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
    expect(answer?.boardFocus?.suggestions).toEqual([
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
    expect(answer?.actions).toEqual([{ id: 'lesson:territory', label: 'Review territory' }]);
  });

  it('answers ko questions with the current forbidden point when a ko is active', () => {
    const game = playSequence([
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

    const answer = getLocalQuestionAnswer('What is ko?', game, 'guided');

    expect(answer?.text).toContain('Ko is the rule');
    expect(answer?.text).toContain('The marked ko point is B8');
    expect(answer?.text).toContain('White cannot immediately play there');
    expect(answer?.conceptIds).toEqual(['ko']);
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-ko-point-1,1',
      point: { x: 1, y: 1 },
      variant: 'danger',
      label: 'Ko: White cannot immediately recapture at B8.',
    }]);
    expect(answer?.actions).toEqual([{ id: 'lesson:ko', label: 'Review ko' }]);
  });

  it('answers eye questions with lesson review before life-and-death practice', () => {
    const answer = getLocalQuestionAnswer('What is an eye?', createGame(9), 'guided');

    expect(answer?.text).toContain('An eye is internal empty space');
    expect(answer?.conceptIds).toEqual(['eyes', 'life-and-death']);
    expect(answer?.actions).toEqual([
      { id: 'lesson:eyes', label: 'Review eyes' },
      { id: 'practice:life-and-death', label: 'Practice life & death' },
    ]);
  });

  it('answers ladder questions with lesson review before reading practice', () => {
    const answer = getLocalQuestionAnswer('How does a ladder work?', createGame(9), 'guided');

    expect(answer?.text).toContain('A ladder is a forcing chase');
    expect(answer?.conceptIds).toEqual(['ladder', 'reading', 'atari']);
    expect(answer?.actions).toEqual([
      { id: 'lesson:ladder', label: 'Review ladders' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
  });

  it('leaves unrecognized questions to cloud Sensei', () => {
    expect(getLocalQuestionAnswer('Should I invade now?', createGame(9), 'guided')).toBeNull();
  });

  it('stays out of advanced mode', () => {
    expect(getLocalQuestionAnswer('What is a liberty?', createGame(9), 'advanced')).toBeNull();
  });
});
