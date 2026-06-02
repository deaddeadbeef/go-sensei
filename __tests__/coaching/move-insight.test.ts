import { getMoveInsight } from '@/lib/coaching/move-insight';
import { createBoard, createGame, passMove, playMove, setStone } from '@/lib/go-engine';
import type { GameState, Point, StoneColor } from '@/lib/go-engine/types';

function boardWith(stones: Array<{ point: Point; color: StoneColor }>) {
  return stones.reduce(
    (board, stone) => setStone(board, stone.point, stone.color),
    createBoard(9),
  );
}

function gameWithBoard(board: GameState['board'], moveCount: number): GameState {
  return {
    ...createGame(9),
    board,
    currentPlayer: 'black',
    moveHistory: Array.from({ length: moveCount }, (_, i) => ({
      type: 'pass' as const,
      color: i % 2 === 0 ? 'black' as const : 'white' as const,
    })),
  };
}

describe('move insight', () => {
  it('starts a guided game with a concrete corner reason', () => {
    const insight = getMoveInsight(createGame(9), 'guided');

    expect(insight).toMatchObject({
      title: 'Start from the easiest territory',
      conceptIds: expect.arrayContaining(['corner-opening', 'territory']),
    });
    expect(insight?.observation).toContain('Corners use two board edges');
    expect(insight?.nextStep).toContain('corner');
  });

  it('explains a first corner move and points to extension work', () => {
    const result = playMove(createGame(9), { x: 2, y: 2 });
    if (!result.success) throw new Error('test setup move failed');

    const insight = getMoveInsight(result.newState, 'guided');

    expect(insight).toMatchObject({
      title: 'Corner anchor',
      conceptIds: expect.arrayContaining(['corner-opening', 'shape']),
    });
    expect(insight?.observation).toContain('C7');
    expect(insight?.nextStep).toContain('one-space jump');
    expect(insight?.nextStep).toContain('Try E7 or C5');
  });

  it('explains a completed one-space jump by naming the anchor and gap', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('test setup first move failed');
    const afterWhitePass = passMove(firstMove.newState);
    const extensionMove = playMove(afterWhitePass, { x: 4, y: 2 });
    if (!extensionMove.success) throw new Error('test setup extension move failed');

    const insight = getMoveInsight(extensionMove.newState, 'guided');

    expect(insight).toMatchObject({
      title: 'One-space jump shape',
      conceptIds: expect.arrayContaining(['shape', 'direction-of-play']),
    });
    expect(insight?.observation).toContain('E7 is a one-space jump from C7.');
    expect(insight?.observation).toContain('The empty point at D7 leaves room to grow');
    expect(insight?.nextStep).toContain('Try G7, E5, or C5');
  });

  it('coaches center openings toward corners', () => {
    const result = playMove(createGame(9), { x: 4, y: 4 });
    if (!result.success) throw new Error('test setup move failed');

    const insight = getMoveInsight(result.newState, 'guided');

    expect(insight).toMatchObject({
      title: 'Center is influence, not territory',
      conceptIds: expect.arrayContaining(['influence', 'territory']),
    });
    expect(insight?.observation).toContain('E5');
    expect(insight?.nextStep).toContain('corner');
  });

  it('prioritizes weak group breathing room when a group is short on liberties', () => {
    const board = boardWith([
      { point: { x: 2, y: 2 }, color: 'black' },
      { point: { x: 1, y: 2 }, color: 'white' },
      { point: { x: 2, y: 1 }, color: 'white' },
    ]);

    const insight = getMoveInsight(gameWithBoard(board, 4), 'guided');

    expect(insight).toMatchObject({
      title: 'Your group needs air',
      conceptIds: expect.arrayContaining(['liberties', 'groups']),
    });
    expect(insight?.observation).toContain('C7 has only 2 liberties');
    expect(insight?.nextStep).toContain('marked liberty');
  });

  it('stays out of advanced games', () => {
    expect(getMoveInsight(createGame(9), 'advanced')).toBeNull();
  });
});
