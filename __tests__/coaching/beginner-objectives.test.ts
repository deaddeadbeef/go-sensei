import {
  formatObjectiveTargetText,
  getBoardAreaDirectionLabel,
  getBeginnerObjective,
  getBeginnerObjectiveSuggestionReason,
  getBeginnerObjectiveProgress,
  getFreshAreaFollowUpContext,
} from '@/lib/coaching/beginner-objectives';
import { createBoard, createGame, passMove, playMove, setStone } from '@/lib/go-engine';
import type { BoardState, Point, StoneColor } from '@/lib/go-engine/types';

function boardWith(stones: Array<{ point: Point; color: StoneColor }>): BoardState {
  return stones.reduce(
    (board, stone) => setStone(board, stone.point, stone.color),
    createBoard(9),
  );
}

describe('beginner objectives', () => {
  it('names board areas from the learner view', () => {
    expect(getBoardAreaDirectionLabel({ x: 7, y: 1 }, 9)).toBe('upper-right direction');
    expect(getBoardAreaDirectionLabel({ x: 7, y: 7 }, 9)).toBe('lower-right direction');
    expect(getBoardAreaDirectionLabel({ x: 4, y: 4 }, 9)).toBe('center');
  });

  it('recommends corner play at the start of a 9x9 game', () => {
    const objective = getBeginnerObjective({
      boardSize: 9,
      moveCount: 0,
      currentPlayer: 'black',
      teachingLevel: 'guided',
    });

    expect(objective).toMatchObject({
      id: 'claim-corner',
      title: 'Start with a corner',
    });
    expect(objective?.targetPoints).toContainEqual({ x: 2, y: 2 });
    if (!objective) throw new Error('Expected opening objective');
    expect(formatObjectiveTargetText(objective, 9)).toBe('Try C7, G7, C3, or G3.');
  });

  it('does not show beginner objectives while Sensei is to move', () => {
    expect(getBeginnerObjective({
      boardSize: 9,
      moveCount: 1,
      currentPlayer: 'white',
      teachingLevel: 'guided',
    })).toBeNull();
  });

  it('does not show beginner objectives on 19x19 advanced games', () => {
    expect(getBeginnerObjective({
      boardSize: 19,
      moveCount: 0,
      currentPlayer: 'black',
      teachingLevel: 'advanced',
    })).toBeNull();
  });

  it('moves from corners to extensions after the opening moves', () => {
    const objective = getBeginnerObjective({
      boardSize: 9,
      moveCount: 6,
      currentPlayer: 'black',
      teachingLevel: 'guided',
    });

    expect(objective).toMatchObject({
      id: 'extend-from-stone',
      title: 'Make your stones work together',
    });
  });

  it('advances to real extension points after the learner claims a corner', () => {
    const board = boardWith([
      { point: { x: 2, y: 2 }, color: 'black' },
    ]);

    const objective = getBeginnerObjective({
      boardSize: 9,
      board,
      moveHistory: [{ type: 'place', point: { x: 2, y: 2 }, color: 'black', captured: [] }],
      moveCount: 2,
      currentPlayer: 'black',
      teachingLevel: 'guided',
    });

    expect(objective).toMatchObject({
      id: 'extend-from-stone',
      title: 'Make your stones work together',
    });
    expect(objective?.targetPoints).toEqual(expect.arrayContaining([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]));
    expect(objective?.targetPoints).not.toContainEqual({ x: 0, y: 2 });
    expect(objective?.targetPoints).not.toContainEqual({ x: 2, y: 0 });
    expect(objective?.targetPoints).not.toContainEqual({ x: 2, y: 2 });
    if (!objective) throw new Error('Expected extension objective');
    expect(formatObjectiveTargetText(objective, 9)).toBe('Try E7 or C5.');
  });

  it('does not suggest a one-space jump through an occupied gap', () => {
    const board = boardWith([
      { point: { x: 2, y: 2 }, color: 'black' },
      { point: { x: 3, y: 2 }, color: 'white' },
    ]);

    const objective = getBeginnerObjective({
      boardSize: 9,
      board,
      moveHistory: [
        { type: 'place', point: { x: 2, y: 2 }, color: 'black', captured: [] },
        { type: 'place', point: { x: 3, y: 2 }, color: 'white', captured: [] },
      ],
      moveCount: 2,
      currentPlayer: 'black',
      teachingLevel: 'guided',
    });

    expect(objective).toMatchObject({
      id: 'extend-from-stone',
      title: 'Make your stones work together',
    });
    expect(objective?.targetPoints).toEqual([{ x: 2, y: 4 }]);
    expect(objective?.targetPoints).not.toContainEqual({ x: 4, y: 2 });
    if (!objective) throw new Error('Expected extension objective');
    expect(formatObjectiveTargetText(objective, 9)).toBe('Try C5.');
  });

  it('keeps pointing at open corners when the learner starts in the center', () => {
    const board = boardWith([
      { point: { x: 4, y: 4 }, color: 'black' },
    ]);

    const objective = getBeginnerObjective({
      boardSize: 9,
      board,
      moveHistory: [{ type: 'place', point: { x: 4, y: 4 }, color: 'black', captured: [] }],
      moveCount: 2,
      currentPlayer: 'black',
      teachingLevel: 'guided',
    });

    expect(objective).toMatchObject({
      id: 'claim-corner',
      title: 'Start with a corner',
    });
    expect(objective?.targetPoints).toContainEqual({ x: 2, y: 2 });
  });

  it('targets liberties when a black group is weak', () => {
    const board = boardWith([
      { point: { x: 2, y: 2 }, color: 'black' },
      { point: { x: 1, y: 2 }, color: 'white' },
      { point: { x: 2, y: 1 }, color: 'white' },
    ]);

    const objective = getBeginnerObjective({
      boardSize: 9,
      board,
      moveCount: 6,
      currentPlayer: 'black',
      teachingLevel: 'guided',
    });

    expect(objective).toMatchObject({
      id: 'look-for-weak-groups',
      title: 'Give weak groups room',
    });
    expect(objective?.targetPoints).toEqual(expect.arrayContaining([
      { x: 3, y: 2 },
      { x: 2, y: 3 },
    ]));
  });

  it('switches to a new-area objective when no weak group or extension target is marked', () => {
    const board = boardWith([
      { point: { x: 2, y: 2 }, color: 'black' },
      { point: { x: 4, y: 2 }, color: 'black' },
      { point: { x: 6, y: 2 }, color: 'black' },
      { point: { x: 2, y: 4 }, color: 'black' },
      { point: { x: 3, y: 4 }, color: 'black' },
      { point: { x: 4, y: 4 }, color: 'black' },
      { point: { x: 6, y: 4 }, color: 'black' },
      { point: { x: 2, y: 6 }, color: 'black' },
      { point: { x: 4, y: 6 }, color: 'black' },
      { point: { x: 6, y: 6 }, color: 'black' },
    ]);

    const objective = getBeginnerObjective({
      boardSize: 9,
      board,
      moveCount: 20,
      currentPlayer: 'black',
      teachingLevel: 'guided',
    });

    expect(objective).toMatchObject({
      id: 'choose-new-area',
      title: 'Choose a new area',
      instruction: 'Your nearby groups are safe for now. Pick a fresh area instead of rereading the settled shape.',
    });
    expect(objective?.targetPoints).toEqual([
      { x: 7, y: 1 },
      { x: 7, y: 7 },
    ]);
    if (!objective) throw new Error('Expected new-area objective');
    expect(formatObjectiveTargetText(objective, 9)).toBe('Try H8 or H2.');
  });

  it('reports successful fresh-area choices without warning on off-target local moves', () => {
    const settledBoard = boardWith([
      { point: { x: 2, y: 2 }, color: 'black' },
      { point: { x: 4, y: 2 }, color: 'black' },
      { point: { x: 6, y: 2 }, color: 'black' },
      { point: { x: 2, y: 4 }, color: 'black' },
      { point: { x: 3, y: 4 }, color: 'black' },
      { point: { x: 4, y: 4 }, color: 'black' },
      { point: { x: 6, y: 4 }, color: 'black' },
      { point: { x: 2, y: 6 }, color: 'black' },
      { point: { x: 4, y: 6 }, color: 'black' },
      { point: { x: 6, y: 6 }, color: 'black' },
    ]);
    const settledGame = { ...createGame(9), board: settledBoard };
    const freshAreaMove = playMove(settledGame, { x: 7, y: 1 });
    const offTargetMove = playMove(settledGame, { x: 1, y: 1 });
    if (!freshAreaMove.success) throw new Error('test setup fresh-area move failed');
    if (!offTargetMove.success) throw new Error('test setup off-target move failed');

    expect(getBeginnerObjectiveProgress(freshAreaMove.newState, 'guided')).toMatchObject({
      status: 'met',
      objectiveId: 'choose-new-area',
      lastMove: { x: 7, y: 1 },
      text: 'Good: H8 chose the upper-right direction after the local shape settled. Before the next move, say what this H8 stone is trying to open so White\'s reply has context.',
    });
    expect(getBeginnerObjectiveProgress(offTargetMove.newState, 'guided')).toBeNull();
  });

  it('names fresh-area follow-up targets as extensions of the new plan', () => {
    const settledBoard = boardWith([
      { point: { x: 2, y: 2 }, color: 'black' },
      { point: { x: 4, y: 2 }, color: 'black' },
      { point: { x: 6, y: 2 }, color: 'black' },
      { point: { x: 2, y: 4 }, color: 'black' },
      { point: { x: 3, y: 4 }, color: 'black' },
      { point: { x: 4, y: 4 }, color: 'black' },
      { point: { x: 6, y: 4 }, color: 'black' },
      { point: { x: 2, y: 6 }, color: 'black' },
      { point: { x: 4, y: 6 }, color: 'black' },
      { point: { x: 6, y: 6 }, color: 'black' },
    ]);
    const settledGame = { ...createGame(9), board: settledBoard };
    const h8Move = playMove(settledGame, { x: 7, y: 1 });
    const h2Move = playMove(settledGame, { x: 7, y: 7 });
    if (!h8Move.success) throw new Error('test setup H8 move failed');
    if (!h2Move.success) throw new Error('test setup H2 move failed');

    const h8Objective = getBeginnerObjective({
      boardSize: 9,
      board: h8Move.newState.board,
      moveHistory: h8Move.newState.moveHistory,
      moveCount: h8Move.newState.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel: 'guided',
    });
    const h2Objective = getBeginnerObjective({
      boardSize: 9,
      board: h2Move.newState.board,
      moveHistory: h2Move.newState.moveHistory,
      moveCount: h2Move.newState.moveHistory.length,
      currentPlayer: 'black',
      teachingLevel: 'guided',
    });
    if (!h8Objective || !h2Objective) throw new Error('Expected follow-up objectives');

    const h8Context = getFreshAreaFollowUpContext(h8Move.newState, 'guided', h8Objective);
    const h2Context = getFreshAreaFollowUpContext(h2Move.newState, 'guided', h2Objective);

    expect(h8Context).toMatchObject({
      anchor: { x: 7, y: 1 },
      anchorCoord: 'H8',
      areaLabel: 'upper-right area',
      directionLabel: 'upper-right direction',
      targetPoints: [
        { x: 7, y: 3 },
        { x: 5, y: 1 },
      ],
    });
    expect(formatObjectiveTargetText(h8Objective, 9, 4, h8Context)).toBe('Extend H8 into the upper-right area: try H6 or F8.');
    expect(getBeginnerObjectiveSuggestionReason(h8Objective, { x: 7, y: 3 }, 9, h8Context)).toBe('Try H6 to give H8 a partner in the upper-right area while keeping a one-space gap.');

    expect(h2Context).toMatchObject({
      anchor: { x: 7, y: 7 },
      anchorCoord: 'H2',
      areaLabel: 'lower-right area',
      directionLabel: 'lower-right direction',
      targetPoints: [
        { x: 5, y: 7 },
        { x: 7, y: 5 },
      ],
    });
    expect(formatObjectiveTargetText(h2Objective, 9, 4, h2Context)).toBe('Extend H2 into the lower-right area: try F2 or H4.');
  });

  it('reports when the learner completed the marked opening objective', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterSenseiPass = passMove(firstMove.newState);

    const progress = getBeginnerObjectiveProgress(afterSenseiPass, 'guided');

    expect(progress).toMatchObject({
      status: 'met',
      objectiveId: 'claim-corner',
      lastMove: { x: 2, y: 2 },
    });
    expect(progress?.text).toBe('Good: C7 hit the marked corner goal. Next, make that stone work with another one.');
  });

  it('reports when the learner missed the marked opening objective', () => {
    const firstMove = playMove(createGame(9), { x: 4, y: 4 });
    if (!firstMove.success) throw new Error('test setup move failed');
    const afterSenseiPass = passMove(firstMove.newState);

    const progress = getBeginnerObjectiveProgress(afterSenseiPass, 'guided');

    expect(progress).toMatchObject({
      status: 'missed',
      objectiveId: 'claim-corner',
      lastMove: { x: 4, y: 4 },
    });
    expect(progress?.text).toBe('Progress check: E5 was not one of the marked corner points. Try C7, G7, C3, or G3.');
  });
});
