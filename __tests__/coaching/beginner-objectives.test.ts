import { getBeginnerObjective } from '@/lib/coaching/beginner-objectives';

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
});
