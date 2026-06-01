import { getBeginnerObjective } from '@/lib/coaching/beginner-objectives';
import { createBoard, setStone } from '@/lib/go-engine';
import type { BoardState, Point, StoneColor } from '@/lib/go-engine/types';

function boardWith(stones: Array<{ point: Point; color: StoneColor }>): BoardState {
  return stones.reduce(
    (board, stone) => setStone(board, stone.point, stone.color),
    createBoard(9),
  );
}

describe('beginner objectives', () => {
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
});
