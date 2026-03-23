import { act } from '@testing-library/react';
import { useGameStore } from '@/stores/game-store';
import type { Problem } from '@/lib/problems/types';

const testProblem: Problem = {
  id: 'test-capture',
  title: 'Test Capture',
  category: 'capture',
  difficulty: 1,
  boardSize: 9,
  description: 'Capture the stone',
  hint: 'Look at liberties',
  playerColor: 'black',
  setupStones: [
    { point: { x: 0, y: 0 }, color: 'white' },
    { point: { x: 1, y: 0 }, color: 'black' },
  ],
  solutionTree: [
    { move: { x: 0, y: 1 }, isCorrect: true, label: 'Captured!', responses: [] },
    { move: { x: 5, y: 5 }, isCorrect: false, label: 'Wrong spot', responses: [] },
  ],
};

const multiStepProblem: Problem = {
  id: 'test-multi',
  title: 'Multi Step',
  category: 'reading',
  difficulty: 2,
  boardSize: 9,
  description: 'Two-move sequence',
  playerColor: 'black',
  setupStones: [{ point: { x: 4, y: 4 }, color: 'white' }],
  solutionTree: [
    {
      move: { x: 3, y: 4 }, isCorrect: true, label: 'First move',
      responses: [
        {
          move: { x: 5, y: 4 }, isCorrect: true, label: 'Opponent',
          responses: [
            { move: { x: 4, y: 5 }, isCorrect: true, label: 'Solved!', responses: [] },
          ],
        },
      ],
    },
  ],
};

beforeEach(() => {
  act(() => useGameStore.getState().startNewGame(9));
});

describe('problem interaction store', () => {
  it('startProblem sets up interaction state', () => {
    act(() => useGameStore.getState().startProblem(testProblem));
    const s = useGameStore.getState();
    expect(s.appPhase).toBe('problem');
    expect(s.currentProblemId).toBe('test-capture');
    expect(s.problemInteraction.active).toBe(true);
    expect(s.problemInteraction.status).toBe('playing');
    expect(s.problemInteraction.currentNodes.length).toBe(2);
  });

  it('submitProblemMove returns solved for correct move', () => {
    act(() => useGameStore.getState().startProblem(testProblem));
    let result: any;
    act(() => { result = useGameStore.getState().submitProblemMove({ x: 0, y: 1 }); });
    expect(result.status).toBe('solved');
    expect(useGameStore.getState().problemInteraction.status).toBe('solved');
    expect(useGameStore.getState().problemAttempts.length).toBe(1);
    expect(useGameStore.getState().problemAttempts[0].solved).toBe(true);
  });

  it('submitProblemMove returns wrong for incorrect move', () => {
    act(() => useGameStore.getState().startProblem(testProblem));
    let result: any;
    act(() => { result = useGameStore.getState().submitProblemMove({ x: 5, y: 5 }); });
    expect(result.status).toBe('wrong');
    expect(result.message).toBe('Wrong spot');
    expect(useGameStore.getState().problemInteraction.attempts).toBe(1);
    expect(useGameStore.getState().problemInteraction.status).toBe('playing');
  });

  it('fails after 3 wrong attempts', () => {
    act(() => useGameStore.getState().startProblem(testProblem));
    act(() => useGameStore.getState().submitProblemMove({ x: 5, y: 5 }));
    act(() => useGameStore.getState().submitProblemMove({ x: 5, y: 5 }));
    act(() => useGameStore.getState().submitProblemMove({ x: 5, y: 5 }));
    const s = useGameStore.getState();
    expect(s.problemInteraction.status).toBe('failed');
    expect(s.problemAttempts.length).toBe(1);
    expect(s.problemAttempts[0].solved).toBe(false);
  });

  it('multi-step problem: correct → continue → solved', () => {
    act(() => useGameStore.getState().startProblem(multiStepProblem));
    let r1: any;
    act(() => { r1 = useGameStore.getState().submitProblemMove({ x: 3, y: 4 }); });
    expect(r1.status).toBe('correct');
    expect(r1.opponentResponse).toBeDefined();
    expect(useGameStore.getState().problemInteraction.opponentMoves.length).toBe(1);

    let r2: any;
    act(() => { r2 = useGameStore.getState().submitProblemMove({ x: 4, y: 5 }); });
    expect(r2.status).toBe('solved');
    expect(useGameStore.getState().problemInteraction.playerMoves.length).toBe(2);
  });

  it('showProblems navigates to problems list', () => {
    act(() => useGameStore.getState().showProblems());
    expect(useGameStore.getState().appPhase).toBe('problems');
  });

  it('requestProblemHint sets showHint', () => {
    act(() => useGameStore.getState().startProblem(testProblem));
    act(() => useGameStore.getState().requestProblemHint());
    expect(useGameStore.getState().problemInteraction.showHint).toBe(true);
  });

  it('resetProblem clears interaction but keeps problemId', () => {
    act(() => useGameStore.getState().startProblem(testProblem));
    act(() => useGameStore.getState().submitProblemMove({ x: 5, y: 5 }));
    act(() => useGameStore.getState().resetProblem());
    const s = useGameStore.getState();
    expect(s.problemInteraction.attempts).toBe(0);
    expect(s.problemInteraction.status).toBe('playing');
    expect(s.problemInteraction.problemId).toBe('test-capture');
  });

  it('startNewGame resets problem state', () => {
    act(() => useGameStore.getState().startProblem(testProblem));
    act(() => useGameStore.getState().startNewGame(9));
    const s = useGameStore.getState();
    expect(s.currentProblemId).toBeNull();
    expect(s.problemInteraction.active).toBe(false);
  });
});
