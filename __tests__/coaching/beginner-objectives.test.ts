import {
  formatObjectiveTargetText,
  getBoardAreaDirectionLabel,
  getBeginnerObjective,
  getBeginnerObjectiveProgress,
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
