import { getLocalGameReviewAnswer, getLocalQuestionAnswer } from '@/lib/coaching/local-question-answer';
import { createGame, passMove, playMove, setStone } from '@/lib/go-engine';
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

  it('answers natural first-move orientation questions with the opening objective', () => {
    const bestMove = getLocalQuestionAnswer('What is the best first move?', createGame(9), 'guided');
    const start = getLocalQuestionAnswer('Where should I start?', createGame(9), 'guided');
    const cornerChoice = getLocalQuestionAnswer('Which corner should I choose?', createGame(9), 'guided');

    for (const answer of [bestMove, start, cornerChoice]) {
      expect(answer?.text).toContain('Your next job is: Start with a corner.');
      expect(answer?.text).toContain('Try C7, G7, C3, or G3.');
      expect(answer?.text).toContain('I marked the best beginner targets on the board.');
      expect(answer?.conceptIds).toEqual(expect.arrayContaining(['corner-opening', 'territory']));
      expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
        { x: 2, y: 2 },
        { x: 6, y: 2 },
        { x: 2, y: 6 },
        { x: 6, y: 6 },
      ]);
    }
  });

  it('explains board star points without confusing them with numbered targets', () => {
    const answer = getLocalQuestionAnswer('What are the dots on the board?', createGame(9), 'guided');

    expect(answer?.text).toContain('The small printed dots are star points, also called hoshi.');
    expect(answer?.text).toContain('They are visual reference points, not stones and not mandatory moves.');
    expect(answer?.text).toContain('On this 9x9 board, the star points are C7, G7, E5, C3, and G3.');
    expect(answer?.text).toContain('For your first guided move, use a corner star point: C7, G7, C3, or G3.');
    expect(answer?.text).toContain('I highlighted the star points and marked the beginner corner targets.');
    expect(answer?.text).not.toContain('glowing numbered circles');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'corner-opening', 'territory']));
    expect(answer?.boardFocus?.highlights).toEqual([
      {
        id: 'local-star-point-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: corner star point and beginner target.',
      },
      {
        id: 'local-star-point-6,2',
        point: { x: 6, y: 2 },
        variant: 'positive',
        label: 'G7: corner star point and beginner target.',
      },
      {
        id: 'local-star-point-4,4',
        point: { x: 4, y: 4 },
        variant: 'neutral',
        label: 'E5: center star point; useful later, not the first guided target.',
      },
      {
        id: 'local-star-point-2,6',
        point: { x: 2, y: 6 },
        variant: 'positive',
        label: 'C3: corner star point and beginner target.',
      },
      {
        id: 'local-star-point-6,6',
        point: { x: 6, y: 6 },
        variant: 'positive',
        label: 'G3: corner star point and beginner target.',
      },
    ]);
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
  });

  it('answers star-point move questions with the current beginner target', () => {
    const answer = getLocalQuestionAnswer('Should I play a star point?', createGame(9), 'guided');

    expect(answer?.text).toContain('A star point is a printed reference dot on the board.');
    expect(answer?.text).toContain('Yes: for this opening, choose one of the corner star points: C7, G7, C3, or G3.');
    expect(answer?.text).toContain('Skip the center star point E5 for now');
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
  });

  it('explains center-versus-corner opening choice from the current board', () => {
    const answer = getLocalQuestionAnswer('Center or corner?', createGame(9), 'guided');

    expect(answer?.text).toContain('For a first beginner move, choose a corner before the center.');
    expect(answer?.text).toContain('The center reaches many directions, but it has to build every border itself before it becomes points.');
    expect(answer?.text).toContain('A corner already has two board edges helping it make territory.');
    expect(answer?.text).toContain('Try C7, G7, C3, or G3.');
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
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

  it('answers natural plan questions with the current post-opening objective', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('What is my plan now?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('Your next job is: Make your stones work together.');
    expect(answer?.text).toContain('Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(answer?.text).toContain('I marked the best beginner targets on the board.');
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it('answers tenuki and play-away questions during the extension objective', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const tenuki = getLocalQuestionAnswer('Can I tenuki?', afterWhitePass, 'guided');
    const playAway = getLocalQuestionAnswer('Should I play far away?', afterWhitePass, 'guided');

    for (const answer of [tenuki, playAway]) {
      expect(answer?.text).toContain('Tenuki means playing away from the local area.');
      expect(answer?.text).toContain('On this guided board, do not drift away yet: C7 is your anchor, and the useful play-away is a nearby one-space jump.');
      expect(answer?.text).toContain('Try E7 or C5.');
      expect(answer?.conceptIds).toEqual(expect.arrayContaining(['direction-of-play', 'shape', 'sente-gote']));
      expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
        { x: 4, y: 2 },
        { x: 2, y: 4 },
      ]);
      expect(answer?.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
    }
  });

  it('defines sente from the current quiet extension position', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('What is sente?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('Sente means a move that strongly asks the opponent to answer.');
    expect(answer?.text).toContain('Right now there is no urgent forcing move on this simple board.');
    expect(answer?.text).toContain('Your sente-like habit is to make a move with purpose: extend from C7 with E7 or C5, then see how White has to deal with the growing shape.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['sente-gote', 'shape', 'direction-of-play']));
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it('answers whether to defend first before the second guided move', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('Should I defend first?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('Defend first when one of your groups is short on liberties or a cutting point is under attack.');
    expect(answer?.text).toContain('C7 still has room, and White just passed for teaching, so there is no emergency to defend.');
    expect(answer?.text).toContain('Keep extending with E7 or C5.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['liberties', 'shape', 'direction-of-play']));
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it('reframes center questions after the learner already has a corner anchor', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('Can I play the center now?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('You already started from a corner, so this is no longer a first-move center choice.');
    expect(answer?.text).toContain('A center move like E5 is playable later, but it does not help C7 as directly as the marked one-space jumps.');
    expect(answer?.text).toContain('For this board, keep building from C7 with E7 or C5.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['influence', 'shape', 'direction-of-play']));
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
  });

  it('explains coordinates that are outside the current 9x9 board', () => {
    const answer = getLocalQuestionAnswer('Can I play T19?', createGame(9), 'guided');

    expect(answer?.text).toContain('T19 is outside this 9x9 board.');
    expect(answer?.text).toContain('On this board, valid columns are A through J, skipping I, and valid rows are 1 through 9.');
    expect(answer?.text).toContain('For this guided position, start with one of the marked 9x9 targets: C7, G7, C3, or G3.');
    expect(answer?.text).toContain('I marked the legal beginner targets so the board size is visible.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['stones-and-board', 'corner-opening', 'territory']));
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 2, y: 6 },
      { x: 6, y: 6 },
    ]);
  });

  it('answers connect-at-coordinate phrasing as a candidate move question', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterWhitePass = passMove(firstMove.newState);

    const answer = getLocalQuestionAnswer('Can I connect at D7?', afterWhitePass, 'guided');

    expect(answer?.text).toContain('D7 touches C7 directly.');
    expect(answer?.text).toContain('this beginner goal is practicing a one-space jump');
    expect(answer?.text).toContain('For this board, I would prefer E7 or C5.');
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-candidate-question-3,2',
      point: { x: 3, y: 2 },
      variant: 'warning',
      label: 'D7: open, but not the current beginner target.',
    }]);
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
    expect(answer?.text).toContain('The center reaches many directions, but it has to build every border itself before it becomes points.');
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

  it('answers next-move questions with a fresh-area prompt after local shape settles', () => {
    const answer = getLocalQuestionAnswer('What should I do?', settledShapeGame(), 'guided');

    expect(answer?.text).toContain('Your next job is: Choose a new area.');
    expect(answer?.text).toContain('Your nearby groups are safe for now. Pick a fresh area instead of rereading the settled shape.');
    expect(answer?.text).toContain('Try H8 or H2.');
    expect(answer?.text).not.toContain('Give weak groups room');
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-objective-move-7,1',
        point: { x: 7, y: 1 },
        rank: 1,
        reason: 'Consider H8 as a fresh upper-right direction away from the settled local shape.',
      },
      {
        id: 'local-objective-move-7,7',
        point: { x: 7, y: 7 },
        rank: 2,
        reason: 'Consider H2 as a fresh lower-right direction away from the settled local shape.',
      },
    ]);
  });

  it('compares fresh-area target directions after local shape settles', () => {
    const answer = getLocalQuestionAnswer('H8 or H2?', settledShapeGame(), 'guided');

    expect(answer?.text).toContain('Both choices fit the current goal: Choose a new area.');
    expect(answer?.text).toContain('H8 opens the upper-right direction and H2 opens the lower-right direction.');
    expect(answer?.text).toContain("Both stay away from the settled local shape; choose the direction you want Black's next plan to explore.");
    expect(answer?.boardFocus?.highlights).toBeUndefined();
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-candidate-comparison-move-7,1',
        point: { x: 7, y: 1 },
        rank: 1,
        reason: 'Consider H8 as a fresh upper-right direction away from the settled local shape.',
      },
      {
        id: 'local-candidate-comparison-move-7,7',
        point: { x: 7, y: 7 },
        rank: 2,
        reason: 'Consider H2 as a fresh lower-right direction away from the settled local shape.',
      },
    ]);
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

  it('reviews a successful fresh-area move as a named new plan', () => {
    const freshAreaMove = playMove(settledShapeGame(), { x: 7, y: 1 });
    if (!freshAreaMove.success) throw new Error('test setup fresh-area move failed');

    const answer = getLocalQuestionAnswer('Was that good?', freshAreaMove.newState, 'guided');

    expect(answer?.text).toContain('Yes. Good: H8 chose the upper-right direction after the local shape settled.');
    expect(answer?.text).toContain("Before the next move, say what this H8 stone is trying to open so White's reply has context.");
    expect(answer?.text).toContain('H8 opens the upper-right direction away from the settled local shape.');
    expect(answer?.text).toContain('Next: Before extending from H8, name the new upper-right area you want Black to build.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['direction-of-play', 'territory']));
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

  it('explains why an unmarked coordinate is not the current beginner target', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('Why D7?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('D7 is not one of the current marked beginner targets.');
    expect(answer?.text).toContain('D7 touches C7 directly.');
    expect(answer?.text).toContain('this beginner goal is practicing a one-space jump');
    expect(answer?.text).toContain('E7 is marked because it is a one-space jump from C7');
    expect(answer?.text).toContain('I highlighted D7 and marked the current targets again; compare it with E7.');
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-target-reason-question-3,2',
      point: { x: 3, y: 2 },
      variant: 'warning',
      label: 'D7: open, but not the current beginner target.',
    }]);
    expect(answer?.boardFocus?.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
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

  it('answers natural good-move coordinate questions locally', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('Is D7 a good move?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('D7 touches C7 directly.');
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

  it('answers what is wrong with an off-goal coordinate locally', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');

    const answer = getLocalQuestionAnswer('What is wrong with D7?', firstMove.newState, 'guided');

    expect(answer?.text).toContain('D7 touches C7 directly.');
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

  it('does not call occupied comparison points open', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');
    const game = passMove(extensionMove.newState);

    const answer = getLocalQuestionAnswer('Why is E7 better than D7?', game, 'guided');

    expect(answer?.text).toContain('Neither mentioned point is one of the current marked beginner targets.');
    expect(answer?.text).toContain('E7 is already occupied by your Black stone, so do not evaluate it as a new move to play now.');
    expect(answer?.text).toContain('D7 touches E7 directly.');
    expect(answer?.text).not.toContain('E7 is open');
    expect(answer?.boardFocus?.highlights).toEqual([
      {
        id: 'local-candidate-comparison-4,2',
        point: { x: 4, y: 2 },
        variant: 'danger',
        label: 'E7: already occupied.',
      },
      {
        id: 'local-candidate-comparison-3,2',
        point: { x: 3, y: 2 },
        variant: 'warning',
        label: 'D7: open, but not the current beginner target.',
      },
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

  it('turns capture-race plan questions into a count-save-recount sequence', () => {
    const game = playSequence([
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 4, y: 4 },
      { x: 1, y: 2 },
    ]);

    const answer = getLocalQuestionAnswer('What should I read next in this race?', game, 'guided');

    expect(answer?.text).toContain('Read this capture race as count, save, recount.');
    expect(answer?.text).toContain('Step 1: Black is behind, so first add a liberty at C6 or D7.');
    expect(answer?.text).toContain('Step 2: after White answers, count again: Black started with 2 liberties and White started with 3.');
    expect(answer?.text).toContain('Step 3: if Black is still behind, add another liberty; when Black catches up, start filling White liberties at C9, B8, or D8.');
    expect(answer?.text).not.toContain('Defend first by playing one of the marked Black liberties.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['reading', 'liberties', 'groups', 'capture']));
    expect(answer?.boardFocus?.groups).toEqual([
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
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-capture-race-plan-save-2,3',
        point: { x: 2, y: 3 },
        rank: 1,
        reason: 'Step 1: save Black by adding a liberty at C6.',
      },
      {
        id: 'local-capture-race-plan-save-3,2',
        point: { x: 3, y: 2 },
        rank: 2,
        reason: 'Step 1 backup: save Black by adding a liberty at D7.',
      },
    ]);
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

  it('explains whether to fill the open one-space jump gap', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');
    const game = passMove(extensionMove.newState);

    const answer = getLocalQuestionAnswer('Should I fill the gap at D7?', game, 'guided');

    expect(answer?.text).toContain('D7 is the one-point gap between C7 and E7.');
    expect(answer?.text).toContain('That gap is not automatically wrong; it is what makes the one-space jump reach farther than a solid connection.');
    expect(answer?.text).toContain('Do not fill D7 just because it is empty. Keep extending unless White attacks that gap or your stones become short on liberties.');
    expect(answer?.text).toContain('For this board, I would prefer G7, E5, or C5.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['shape', 'direction-of-play', 'liberties']));
    expect(answer?.boardFocus?.highlights).toEqual([
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
    expect(answer?.boardFocus?.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:groups', label: 'Review groups' },
    ]);
  });

  it('explains solid-connection phrasing for an open one-space jump gap', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');
    const game = passMove(extensionMove.newState);

    const answer = getLocalQuestionAnswer('Should I connect solidly at D7?', game, 'guided');

    expect(answer?.text).toContain('D7 is the one-point gap between C7 and E7.');
    expect(answer?.text).toContain('That gap is not automatically wrong; it is what makes the one-space jump reach farther than a solid connection.');
    expect(answer?.text).toContain('Do not fill D7 just because it is empty.');
    expect(answer?.boardFocus?.highlights.map((highlight) => highlight.point)).toEqual([
      { x: 2, y: 2 },
      { x: 4, y: 2 },
      { x: 3, y: 2 },
    ]);
    expect(answer?.boardFocus?.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ]);
  });

  it('explains White pressure on an open one-space jump gap', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');
    const game = passMove(extensionMove.newState);

    const answer = getLocalQuestionAnswer('Can White cut at D7?', game, 'guided');

    expect(answer?.text).toContain('D7 is the one-point gap between C7 and E7.');
    expect(answer?.text).toContain('White can test that gap by playing D7, but that is pressure, not an immediate capture.');
    expect(answer?.text).toContain('If White actually attacks D7, count liberties before reacting');
    expect(answer?.text).toContain('if both stones still have room, keep building with G7, E5, or C5.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['shape', 'reading', 'liberties', 'groups']));
    expect(answer?.boardFocus?.highlights).toEqual([
      {
        id: 'local-gap-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: one side of the jump White could test.',
      },
      {
        id: 'local-gap-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: one side of the jump White could test.',
      },
      {
        id: 'local-gap-pressure-open-3,2',
        point: { x: 3, y: 2 },
        variant: 'warning',
        label: 'D7: gap White could pressure; count liberties before answering.',
      },
    ]);
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
  });

  it('answers when White occupies the one-space jump gap between two Black stones', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');
    const whiteCut = playMove(extensionMove.newState, { x: 3, y: 2 });
    if (!whiteCut.success) throw new Error('test setup white cut failed');

    const answer = getLocalQuestionAnswer('Did White cut me?', whiteCut.newState, 'guided');

    expect(answer?.text).toContain('White has played into the one-space jump gap at D7.');
    expect(answer?.text).toContain('C7 and E7 are separate Black groups by the rules now, but neither is captured.');
    expect(answer?.text).toContain('Black at C7 has 3 liberties: C8, C6, and B7.');
    expect(answer?.text).toContain('Black at E7 has 3 liberties: E8, E6, and F7.');
    expect(answer?.text).toContain('The White cutting stone at D7 has 2 liberties: D8 and D6.');
    expect(answer?.text).toContain('Answer the cut by attacking the marked White liberties, starting with D8 or D6.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['connect-and-cut', 'reading', 'liberties', 'groups']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-occupied-cut-stone-3,2',
      point: { x: 3, y: 2 },
      variant: 'danger',
      label: 'D7: White occupies the gap between C7 and E7.',
    }]);
    expect(answer?.boardFocus?.groups).toEqual([
      {
        id: 'local-occupied-cut-black-left-2,2',
        stones: [{ x: 2, y: 2 }],
        color: 'black',
        liberties: 3,
        label: 'Black group at C7: 3 liberties at C8, C6, and B7.',
      },
      {
        id: 'local-occupied-cut-black-right-4,2',
        stones: [{ x: 4, y: 2 }],
        color: 'black',
        liberties: 3,
        label: 'Black group at E7: 3 liberties at E8, E6, and F7.',
      },
      {
        id: 'local-occupied-cut-white-3,2',
        stones: [{ x: 3, y: 2 }],
        color: 'white',
        liberties: 2,
        label: 'White cutting stone at D7: 2 liberties at D8 and D6.',
      },
    ]);
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 3, y: 1 },
      { x: 3, y: 3 },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
  });

  it('keeps White follow-up questions grounded in an occupied one-space jump cut', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');
    const whiteCut = playMove(extensionMove.newState, { x: 3, y: 2 });
    if (!whiteCut.success) throw new Error('test setup white cut failed');

    const answer = getLocalQuestionAnswer('What if White answers now?', whiteCut.newState, 'guided');

    expect(answer?.text).toContain('White has played into the one-space jump gap at D7.');
    expect(answer?.text).toContain('Answer the cut by attacking the marked White liberties, starting with D8 or D6.');
    expect(answer?.text).not.toContain('Read White from your Black stone');
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-occupied-cut-stone-3,2',
      point: { x: 3, y: 2 },
      variant: 'danger',
      label: 'D7: White occupies the gap between C7 and E7.',
    }]);
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 3, y: 1 },
      { x: 3, y: 3 },
    ]);
  });

  it('turns occupied-cut plan questions into a short reading sequence', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');
    const whiteCut = playMove(extensionMove.newState, { x: 3, y: 2 });
    if (!whiteCut.success) throw new Error('test setup white cut failed');

    const answer = getLocalQuestionAnswer('What should I read next after this cut?', whiteCut.newState, 'guided');

    expect(answer?.text).toContain('Read the cut as a three-step plan.');
    expect(answer?.text).toContain('Step 1: attack the White cutting stone at D7 by playing D8 or D6.');
    expect(answer?.text).toContain('Step 2: after White answers, recount both Black groups: C7 has 3 liberties and E7 has 3 liberties.');
    expect(answer?.text).toContain('Step 3: if one Black group drops to two liberties or fewer, defend it first; otherwise fill the next White liberty.');
    expect(answer?.text).toContain('I marked the cut, both Black groups, and the two first reading points so the plan stays visible.');
    expect(answer?.text).not.toContain('Read White from your Black stone');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['connect-and-cut', 'reading', 'liberties', 'groups', 'capture']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-occupied-cut-plan-stone-3,2',
      point: { x: 3, y: 2 },
      variant: 'danger',
      label: 'D7: White cutting stone; start the reading plan here.',
    }]);
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-occupied-cut-plan-1-3,1',
        point: { x: 3, y: 1 },
        rank: 1,
        reason: 'Step 1: attack the cutting stone at D8.',
      },
      {
        id: 'local-occupied-cut-plan-2-3,3',
        point: { x: 3, y: 3 },
        rank: 2,
        reason: 'Step 1 backup: attack the cutting stone at D6.',
      },
    ]);
  });

  it('answers how to respond if White attacks the one-space jump gap', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');
    const game = passMove(extensionMove.newState);

    const answer = getLocalQuestionAnswer('What should I do if White attacks D7?', game, 'guided');

    expect(answer?.text).toContain('D7 is the one-point gap between C7 and E7.');
    expect(answer?.text).toContain('If White actually attacks D7, count liberties before reacting');
    expect(answer?.text).not.toContain('Your next job is: Make your stones work together.');
    expect(answer?.boardFocus?.highlights?.[2]).toMatchObject({
      point: { x: 3, y: 2 },
      variant: 'warning',
    });
  });

  it('explains whether two one-space jump stones are connected by rules and shape', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');
    const game = passMove(extensionMove.newState);

    const answer = getLocalQuestionAnswer('Are C7 and E7 connected?', game, 'guided');

    expect(answer?.text).toContain('C7 and E7 are not one solid group by the rules yet.');
    expect(answer?.text).toContain('D7 is the open point between them.');
    expect(answer?.text).toContain('They are connected in shape: a one-space jump that usually works together unless White attacks the gap.');
    expect(answer?.text).toContain('For now, keep building with G7, E5, or C5.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['groups', 'shape', 'liberties']));
    expect(answer?.boardFocus?.highlights).toEqual([
      {
        id: 'local-gap-connection-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: first stone in the one-space jump.',
      },
      {
        id: 'local-gap-connection-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: second stone in the one-space jump.',
      },
      {
        id: 'local-gap-connection-open-3,2',
        point: { x: 3, y: 2 },
        variant: 'neutral',
        label: 'D7: open gap; shape connection, not a solid group.',
      },
    ]);
    expect(answer?.boardFocus?.suggestions?.map((suggestion) => suggestion.point)).toEqual([
      { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ]);
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

  it('answers snapback questions with the current recapture point', () => {
    const game = snapbackGameAfterWhiteCapture();

    const answer = getLocalQuestionAnswer('Can I snapback now?', game, 'guided');

    expect(answer?.text).toContain('White just captured E5 by playing E6.');
    expect(answer?.text).toContain('That capture is cramped: the White stones connected to E6 have only one liberty, E5.');
    expect(answer?.text).toContain('Black can snap back at E5 and recapture E6, D6, D5, E4, and F5.');
    expect(answer?.text).toContain('Play the marked snapback point before White gets another liberty.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['snapback', 'tesuji', 'capture', 'reading']));
    expect(answer?.boardFocus?.highlights).toEqual([{
      id: 'local-snapback-white-capture-4,3',
      point: { x: 4, y: 3 },
      variant: 'danger',
      label: 'E6: White captured into a snapback shape.',
    }]);
    expect(answer?.boardFocus?.liberties).toEqual([{
      id: 'local-snapback-liberties-4,3',
      point: { x: 4, y: 3 },
      count: 1,
      libertyPoints: [{ x: 4, y: 4 }],
    }]);
    expect(answer?.boardFocus?.suggestions).toEqual([{
      id: 'local-snapback-recapture-4,4',
      point: { x: 4, y: 4 },
      rank: 1,
      reason: 'Snap back at E5: recapture the cramped White stones.',
    }]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:snapback', label: 'Review snapback' },
      { id: 'practice:tesuji', label: 'Practice tesuji' },
    ]);
  });

  it('turns snapback plan follow-ups into a capture-count-continue sequence', () => {
    const game = snapbackGameAfterWhiteCapture();

    const answer = getLocalQuestionAnswer('What should I read next after this snapback?', game, 'guided');

    expect(answer?.text).toContain('Read this snapback as capture, count, continue.');
    expect(answer?.text).toContain('Step 1: snap back at E5 and remove E6, D6, D5, E4, and F5.');
    expect(answer?.text).toContain("Step 2: after those stones come off, Black's new stone at E5 has 4 liberties: E6, E4, D5, and F5.");
    expect(answer?.text).toContain('Step 3: if White keeps fighting nearby, use that count before choosing the next forcing move; if White plays away, the snapback already won this local tactic.');
    expect(answer?.text).not.toContain('Play the marked snapback point before White gets another liberty.');
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['snapback', 'tesuji', 'capture', 'reading', 'liberties']));
    expect(answer?.boardFocus?.highlights).toEqual([
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
    expect(answer?.boardFocus?.liberties).toEqual([
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
    expect(answer?.boardFocus?.groups).toEqual([
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
    expect(answer?.boardFocus?.suggestions).toEqual([
      {
        id: 'local-snapback-plan-recapture-4,4',
        point: { x: 4, y: 4 },
        rank: 1,
        reason: 'Step 1: snap back at E5 and remove E6, D6, D5, E4, and F5.',
      },
    ]);
    expect(answer?.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'practice:reading', label: 'Practice reading' },
    ]);
  });

  it('keeps natural snapback follow-ups on the immediate recapture point', () => {
    const game = snapbackGameAfterWhiteCapture();

    const answer = getLocalQuestionAnswer('What happens if White responds?', game, 'guided');

    expect(answer?.text).toContain('White just captured E5 by playing E6.');
    expect(answer?.text).toContain('Black can snap back at E5 and recapture E6, D6, D5, E4, and F5.');
    expect(answer?.text).not.toContain('Read White from your Black stone');
    expect(answer?.boardFocus?.suggestions).toEqual([{
      id: 'local-snapback-recapture-4,4',
      point: { x: 4, y: 4 },
      rank: 1,
      reason: 'Snap back at E5: recapture the cramped White stones.',
    }]);
  });

  it('leaves unrecognized questions to cloud Sensei', () => {
    expect(getLocalQuestionAnswer('Should I invade now?', createGame(9), 'guided')).toBeNull();
  });

  it('stays out of advanced mode', () => {
    expect(getLocalQuestionAnswer('What is a liberty?', createGame(9), 'advanced')).toBeNull();
  });
});
