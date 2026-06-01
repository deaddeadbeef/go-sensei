import { act } from '@testing-library/react';
import { getRestorableAppPhase, useGameStore } from '@/stores/game-store';
import { PROBLEMS } from '@/lib/problems/problem-data';
import type { Problem } from '@/lib/problems/types';
import type { ValidationResult } from '@/lib/problems/validator';

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

const bundledProblem = (id: string): Problem => {
  const problem = PROBLEMS.find((candidate) => candidate.id === id);
  if (!problem) {
    throw new Error(`Missing test problem: ${id}`);
  }
  return problem;
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
    expect(s.problemInteraction.problem).toBe(testProblem);
    expect(s.problemInteraction.game?.board.size).toBe(testProblem.boardSize);
    expect(s.problemInteraction.game?.currentPlayer).toBe(testProblem.playerColor);
  });

  it('submitProblemMove returns solved for correct move', () => {
    const problem = bundledProblem('capture-001');
    act(() => useGameStore.getState().startProblem(problem));
    let result: ValidationResult = { status: 'wrong' };
    act(() => { result = useGameStore.getState().submitProblemMove({ x: 0, y: 1 }); });
    expect(result.status).toBe('solved');
    expect(useGameStore.getState().problemInteraction.status).toBe('solved');
    expect(useGameStore.getState().problemAttempts.length).toBe(1);
    expect(useGameStore.getState().problemAttempts[0].solved).toBe(true);
    expect(useGameStore.getState().problemAttempts[0].attempts).toBe(1);
  });

  it('records solved attempt count as wrong attempts plus final solve', () => {
    const problem = bundledProblem('capture-001');
    act(() => useGameStore.getState().startProblem(problem));

    act(() => { useGameStore.getState().submitProblemMove({ x: 5, y: 5 }); });
    act(() => { useGameStore.getState().submitProblemMove({ x: 0, y: 1 }); });

    const attempt = useGameStore.getState().problemAttempts[0];
    expect(attempt.solved).toBe(true);
    expect(attempt.attempts).toBe(2);
  });

  it('submitProblemMove applies a solved move to runtime board for capture-001', () => {
    const problem = bundledProblem('capture-001');
    act(() => useGameStore.getState().startProblem(problem));

    act(() => {
      useGameStore.getState().submitProblemMove({ x: 0, y: 1 });
    });

    const game = useGameStore.getState().problemInteraction.game;
    expect(game?.board.grid[0][0]).toBeNull();
    expect(game?.board.grid[1][0]).toBe('black');
    expect(game?.currentPlayer).toBe('white');
    expect(game?.moveHistory).toHaveLength(1);
    expect(game?.captures.black).toBe(1);
  });

  it('supports submit and reset for an inline problem not present in PROBLEMS', () => {
    expect(PROBLEMS.some((problem) => problem.id === testProblem.id)).toBe(false);

    act(() => useGameStore.getState().startProblem(testProblem));

    let result: ValidationResult = { status: 'wrong' };
    act(() => {
      result = useGameStore.getState().submitProblemMove({ x: 0, y: 1 });
    });
    expect(result.status).toBe('solved');
    expect(useGameStore.getState().problemInteraction.game?.board.grid[0][0]).toBeNull();
    expect(useGameStore.getState().problemInteraction.game?.board.grid[1][0]).toBe('black');

    act(() => useGameStore.getState().resetProblem());

    const pi = useGameStore.getState().problemInteraction;
    expect(pi.active).toBe(true);
    expect(pi.problem).toBe(testProblem);
    expect(pi.problemId).toBe(testProblem.id);
    expect(pi.currentNodes).toBe(testProblem.solutionTree);
    expect(pi.game?.board.grid[0][0]).toBe('white');
    expect(pi.game?.board.grid[0][1]).toBe('black');
    expect(pi.game?.board.grid[1][0]).toBeNull();
    expect(pi.game?.moveHistory).toHaveLength(0);
  });

  it('submitProblemMove returns wrong for incorrect move', () => {
    const problem = bundledProblem('capture-001');
    act(() => useGameStore.getState().startProblem(problem));
    let result: ValidationResult = { status: 'wrong' };
    act(() => { result = useGameStore.getState().submitProblemMove({ x: 5, y: 5 }); });
    expect(result.status).toBe('wrong');
    expect(result.message).toBe('That move is not in the solution tree.');
    expect(useGameStore.getState().problemInteraction.attempts).toBe(1);
    expect(useGameStore.getState().problemInteraction.status).toBe('playing');
  });

  it('fails after 3 wrong attempts', () => {
    const problem = bundledProblem('capture-001');
    act(() => useGameStore.getState().startProblem(problem));
    act(() => useGameStore.getState().submitProblemMove({ x: 5, y: 5 }));
    act(() => useGameStore.getState().submitProblemMove({ x: 5, y: 5 }));
    act(() => useGameStore.getState().submitProblemMove({ x: 5, y: 5 }));
    const s = useGameStore.getState();
    expect(s.problemInteraction.status).toBe('failed');
    expect(s.problemAttempts.length).toBe(1);
    expect(s.problemAttempts[0].solved).toBe(false);
  });

  it('multi-step problem: correct → continue → solved', () => {
    const problem = bundledProblem('capture-003');
    act(() => useGameStore.getState().startProblem(problem));
    let r1: ValidationResult = { status: 'wrong' };
    act(() => { r1 = useGameStore.getState().submitProblemMove({ x: 5, y: 4 }); });
    expect(r1.status).toBe('correct');
    expect(r1.opponentResponse).toBeDefined();
    expect(useGameStore.getState().problemInteraction.opponentMoves.length).toBe(1);

    let r2: ValidationResult = { status: 'wrong' };
    act(() => { r2 = useGameStore.getState().submitProblemMove({ x: 5, y: 5 }); });
    expect(r2.status).toBe('solved');
    expect(useGameStore.getState().problemInteraction.playerMoves.length).toBe(2);
  });

  it('showProblems navigates to problems list', () => {
    act(() => useGameStore.getState().showProblems());
    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBeNull();
  });

  it('showProblems can carry a recommended category filter', () => {
    act(() => useGameStore.getState().showProblems('capture'));
    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
  });

  it('showLearningPath navigates to learning path', () => {
    act(() => useGameStore.getState().showLearningPath());
    expect(useGameStore.getState().appPhase).toBe('path');
  });

  it('maps unsafe persisted detail phases to recoverable surfaces', () => {
    expect(getRestorableAppPhase('lesson')).toBe('path');
    expect(getRestorableAppPhase('problem')).toBe('problems');
    expect(getRestorableAppPhase('review')).toBe('review');
    expect(getRestorableAppPhase(undefined)).toBe('path');
  });

  it('startGuidedIntroGame starts a playable 9x9 guided beginner game', () => {
    act(() => useGameStore.getState().startGuidedIntroGame());

    const state = useGameStore.getState();
    expect(state.appPhase).toBe('game');
    expect(state.phase).toBe('playing');
    expect(state.game.board.size).toBe(9);
    expect(state.game.moveHistory).toHaveLength(0);
    expect(state.teachingLevel).toBe('guided');
    expect(state.hasStartedIntroGame).toBe(true);
    expect(state.bubble.visible).toBe(true);
    expect(state.bubble.text).toContain('9x9');
  });

  it('startNewGame preserves the intro-started flag', () => {
    act(() => useGameStore.getState().startGuidedIntroGame());
    act(() => useGameStore.getState().startNewGame(9));

    expect(useGameStore.getState().hasStartedIntroGame).toBe(true);
  });

  it('startNewGame preserves solved problem progress', () => {
    const problem = bundledProblem('capture-001');
    act(() => useGameStore.getState().startProblem(problem));
    act(() => { useGameStore.getState().submitProblemMove({ x: 0, y: 1 }); });
    act(() => useGameStore.getState().startNewGame(9));

    expect(useGameStore.getState().problemAttempts).toHaveLength(1);
    expect(useGameStore.getState().problemAttempts[0]).toMatchObject({
      problemId: 'capture-001',
      solved: true,
    });
  });

  it('requestProblemHint sets showHint', () => {
    act(() => useGameStore.getState().startProblem(testProblem));
    act(() => useGameStore.getState().requestProblemHint());
    expect(useGameStore.getState().problemInteraction.showHint).toBe(true);
  });

  it('resetProblem clears interaction but keeps problemId', () => {
    const problem = bundledProblem('capture-001');
    act(() => useGameStore.getState().startProblem(problem));
    act(() => useGameStore.getState().submitProblemMove({ x: 5, y: 5 }));
    act(() => useGameStore.getState().resetProblem());
    const s = useGameStore.getState();
    expect(s.problemInteraction.attempts).toBe(0);
    expect(s.problemInteraction.status).toBe('playing');
    expect(s.problemInteraction.problemId).toBe('capture-001');
  });

  it('resetProblem restores original setup board and clears runtime move history', () => {
    const problem = bundledProblem('capture-001');
    act(() => useGameStore.getState().startProblem(problem));
    act(() => useGameStore.getState().submitProblemMove({ x: 0, y: 1 }));
    expect(useGameStore.getState().problemInteraction.game?.moveHistory).toHaveLength(1);

    act(() => useGameStore.getState().resetProblem());

    const pi = useGameStore.getState().problemInteraction;
    expect(pi.game?.board.grid[0][0]).toBe('white');
    expect(pi.game?.board.grid[0][1]).toBe('black');
    expect(pi.game?.board.grid[1][0]).toBeNull();
    expect(pi.game?.moveHistory).toHaveLength(0);
    expect(pi.currentNodes).toBe(problem.solutionTree);
  });

  it('startNewGame resets problem state', () => {
    act(() => useGameStore.getState().startProblem(testProblem));
    act(() => useGameStore.getState().startNewGame(9));
    const s = useGameStore.getState();
    expect(s.currentProblemId).toBeNull();
    expect(s.problemInteraction.active).toBe(false);
  });
});
