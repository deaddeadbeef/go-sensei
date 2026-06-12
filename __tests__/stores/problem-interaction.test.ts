import { act } from '@testing-library/react';
import { getRestorableAppPhase, useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { PROBLEMS } from '@/lib/problems/problem-data';
import { createGame, setStone } from '@/lib/go-engine';
import type { GameState, Point } from '@/lib/go-engine';
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
    {
      ...createGame(9),
      moveHistory: [{ type: 'pass', color: 'white' }],
      currentPlayer: 'black',
    },
  );
}

function settledStudySnapshot(): GameState {
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
    expect(useProgressStore.getState().problemAttempts).toEqual([]);
    expect(useGameStore.getState().problemAttempts).toEqual([]);

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

  it('openGuidedGame restores guided 9x9 when progress points at a stale normal game', () => {
    act(() => useGameStore.getState().startGuidedIntroGame());
    act(() => useGameStore.getState().startNewGame(19));
    act(() => useGameStore.getState().setTeachingLevel('beginner'));

    expect(useGameStore.getState().game.board.size).toBe(19);
    expect(useGameStore.getState().teachingLevel).toBe('beginner');
    expect(useProgressStore.getState().hasStartedIntroGame).toBe(true);

    act(() => useGameStore.getState().openGuidedGame());

    const state = useGameStore.getState();
    expect(state.appPhase).toBe('game');
    expect(state.phase).toBe('playing');
    expect(state.game.board.size).toBe(9);
    expect(state.game.moveHistory).toHaveLength(0);
    expect(state.teachingLevel).toBe('guided');
    expect(state.bubble.text).toContain('Your first job is: Start with a corner.');
  });

  it('openGuidedGame resumes the current guided 9x9 board without clearing moves', () => {
    act(() => useGameStore.getState().startGuidedIntroGame());
    act(() => {
      const result = useGameStore.getState().placeStone({ x: 2, y: 2 });
      expect(result.success).toBe(true);
    });
    act(() => useGameStore.getState().showLearningPath());

    act(() => useGameStore.getState().openGuidedGame());

    const state = useGameStore.getState();
    expect(state.appPhase).toBe('game');
    expect(state.game.board.size).toBe(9);
    expect(state.teachingLevel).toBe('guided');
    expect(state.game.moveHistory.length).toBeGreaterThan(0);
  });

  it('openGuidedGame restores a durable paused guided board when session game state is missing', () => {
    act(() => useGameStore.getState().startGuidedIntroGame());
    act(() => {
      const result = useGameStore.getState().placeStone({ x: 2, y: 2 });
      expect(result.success).toBe(true);
    });
    const pausedHistory = useGameStore.getState().game.moveHistory;
    expect(useGameStore.getState().game.currentPlayer).toBe('white');

    act(() => useGameStore.getState().startNewGame(19));
    act(() => useGameStore.getState().setTeachingLevel('beginner'));

    expect(useGameStore.getState().game.board.size).toBe(19);
    expect(useProgressStore.getState().hasStartedIntroGame).toBe(true);

    act(() => useGameStore.getState().openGuidedGame());

    const state = useGameStore.getState();
    expect(state.appPhase).toBe('game');
    expect(state.phase).toBe('playing');
    expect(state.teachingLevel).toBe('guided');
    expect(state.game.board.size).toBe(9);
    expect(state.game.currentPlayer).toBe('black');
    expect(state.game.board.grid[2][2]).toBe('black');
    expect(state.game.moveHistory).toEqual([
      ...pausedHistory,
      { type: 'pass', color: 'white' },
    ]);
    expect(state.overlays.highlights).toEqual([{
      id: 'guided-resume-learned-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'C7: move to learn from - beginner job met.',
    }]);
    expect(state.overlays.suggestions.map((suggestion) => ({
      point: suggestion.point,
      rank: suggestion.rank,
      reason: suggestion.reason,
    }))).toEqual([
      {
        point: { x: 4, y: 2 },
        rank: 1,
        reason: 'Try E7 as a one-space jump that works with your stones.',
      },
      {
        point: { x: 2, y: 4 },
        rank: 2,
        reason: 'Try C5 as a one-space jump that works with your stones.',
      },
    ]);
    expect(state.bubble.text).toContain('Welcome back to your guided 9x9.');
    expect(state.bubble.text).toContain('White passed while I restored this board, so it is your turn again.');
    expect(state.bubble.text).toContain('I restored your paused board with 1 learner move.');
    expect(state.bubble.text).toContain('Your next job is: Make your stones work together.');
  });

  it('openGuidedGame resumes fresh-area targets with direction-aware reasons', () => {
    act(() => useGameStore.getState().startNewGame(19));
    act(() => useGameStore.getState().setTeachingLevel('beginner'));
    act(() => {
      useProgressStore.getState().markIntroGameStarted();
      useProgressStore.getState().saveGuidedGameSnapshot(settledShapeGame());
    });

    act(() => useGameStore.getState().openGuidedGame());

    const state = useGameStore.getState();
    expect(state.bubble.text).toContain('Your next job is: Choose a new area.');
    expect(state.bubble.text).toContain('Try H8 or H2.');
    expect(state.overlays.suggestions.map((suggestion) => ({
      point: suggestion.point,
      rank: suggestion.rank,
      reason: suggestion.reason,
    }))).toEqual([
      {
        point: { x: 7, y: 1 },
        rank: 1,
        reason: 'Consider H8 as a fresh upper-right direction away from the settled local shape.',
      },
      {
        point: { x: 7, y: 7 },
        rank: 2,
        reason: 'Consider H2 as a fresh lower-right direction away from the settled local shape.',
      },
    ]);
  });

  it('openGuidedGame restores no-history study snapshots with board-aware resume copy', () => {
    act(() => useGameStore.getState().startNewGame(19));
    act(() => useGameStore.getState().setTeachingLevel('beginner'));
    act(() => {
      useProgressStore.getState().markIntroGameStarted();
      useProgressStore.getState().saveGuidedGameSnapshot(settledStudySnapshot());
    });

    act(() => useGameStore.getState().openGuidedGame());

    const state = useGameStore.getState();
    expect(state.appPhase).toBe('game');
    expect(state.teachingLevel).toBe('guided');
    expect(state.game.board.size).toBe(9);
    expect(state.game.moveHistory).toHaveLength(0);
    expect(state.game.board.grid[2][2]).toBe('black');
    expect(state.bubble.text).toContain('I restored your paused board as a study position.');
    expect(state.bubble.text).not.toContain('before your first learner move');
    expect(state.bubble.text).toContain('Your next job is: Choose a new area.');
    expect(state.overlays.suggestions.slice(0, 2).map((suggestion) => suggestion.point)).toEqual([
      { x: 7, y: 1 },
      { x: 7, y: 7 },
    ]);
  });

  it('openGuidedGame does not add a pass when the durable guided board is already the learner turn', () => {
    act(() => useGameStore.getState().startGuidedIntroGame());
    act(() => {
      const result = useGameStore.getState().placeStone({ x: 2, y: 2 });
      expect(result.success).toBe(true);
    });
    act(() => useGameStore.getState().pass());
    const pausedHistory = useGameStore.getState().game.moveHistory;
    expect(useGameStore.getState().game.currentPlayer).toBe('black');

    act(() => useGameStore.getState().startNewGame(19));
    act(() => useGameStore.getState().setTeachingLevel('beginner'));
    act(() => useGameStore.getState().openGuidedGame());

    const state = useGameStore.getState();
    expect(state.game.currentPlayer).toBe('black');
    expect(state.game.moveHistory).toEqual(pausedHistory);
    expect(state.overlays.suggestions.map((suggestion) => suggestion.point)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(state.bubble.text).not.toContain('White passed while I restored this board');
  });

  it('starts guided intro with concrete first-target coaching', () => {
    act(() => useGameStore.getState().startGuidedIntroGame());

    const bubble = useGameStore.getState().bubble;
    expect(bubble.text).toContain('Your first job is: Start with a corner.');
    expect(bubble.text).toContain('Place your next stone near an empty corner. Try C7, G7, C3, or G3.');
    expect(bubble.text).toContain('Click a marked coordinate when you are ready.');
    expect(bubble.actions).toEqual([
      { id: 'hint', label: 'Show targets' },
      { id: 'lesson:territory', label: 'Review territory' },
    ]);
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
