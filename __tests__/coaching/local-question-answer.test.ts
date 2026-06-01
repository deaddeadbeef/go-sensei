import { getLocalQuestionAnswer } from '@/lib/coaching/local-question-answer';
import { createGame, playMove } from '@/lib/go-engine';
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
