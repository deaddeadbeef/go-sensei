import { getLocalQuestionAnswer } from '@/lib/coaching/local-question-answer';
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
    expect(answer?.text).toContain('I highlighted E7 on the board.');
    expect(answer?.text).toContain('For the current beginner goal, Try E7 or C5.');
    expect(answer?.text).toContain('I kept the current target points marked');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'shape']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-coordinate-4,2',
      point: { x: 4, y: 2 },
      variant: 'neutral',
      label: 'E7: column E, row 7.',
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
