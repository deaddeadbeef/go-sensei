import { boardHash } from '@/lib/go-engine';
import { PROBLEMS } from '@/lib/problems/problem-data';
import {
  applyProblemMove,
  buildProblemGame,
  validateProblemTree,
} from '@/lib/problems/runtime';
import type { GameState } from '@/lib/go-engine';
import type { Problem } from '@/lib/problems/types';

function replayPrimarySolvedPath(problem: Problem): GameState {
  let game = buildProblemGame(problem);
  let currentNodes = problem.solutionTree;

  while (true) {
    const next = currentNodes.find((node) => node.isCorrect);
    if (!next) {
      throw new Error(`No correct move in primary path for ${problem.id}`);
    }

    const result = applyProblemMove(problem, game, currentNodes, next.move);
    game = result.game;

    if (result.status === 'solved') {
      return game;
    }

    if (result.status !== 'correct' || !result.nextNodes) {
      throw new Error(`Primary path did not continue for ${problem.id}`);
    }

    currentNodes = result.nextNodes;
  }
}

function problemById(id: string): Problem {
  const problem = PROBLEMS.find((candidate) => candidate.id === id);
  if (!problem) {
    throw new Error(`Missing test problem: ${id}`);
  }
  return problem;
}

describe('problem runtime', () => {
  it('constructs a game from setup stones', () => {
    const problem = PROBLEMS.find((p) => p.id === 'capture-001')!;
    const game = buildProblemGame(problem);

    expect(game.board.size).toBe(problem.boardSize);
    expect(game.currentPlayer).toBe(problem.playerColor);
    expect(game.board.grid[0][0]).toBe('white');
    expect(game.board.grid[0][1]).toBe('black');
    expect(game.moveHistory).toHaveLength(0);
    expect(game.positionHistory.has(boardHash(game.board))).toBe(true);
  });

  it('keeps all bundled problem trees legal and reachable', () => {
    const issues = PROBLEMS.flatMap((problem) => validateProblemTree(problem));

    expect(issues).toEqual([]);
  });

  it('requires capture problem primary solved paths to capture stones for the player', () => {
    for (const problem of PROBLEMS.filter((candidate) => candidate.category === 'capture')) {
      const finalGame = replayPrimarySolvedPath(problem);

      expect(finalGame.captures[problem.playerColor]).toBeGreaterThan(0);
    }
  });

  it('applies a correct capture-003 move and opponent response', () => {
    const problem = problemById('capture-003');
    const game = buildProblemGame(problem);

    const result = applyProblemMove(problem, game, problem.solutionTree, { x: 5, y: 4 });

    expect(result.status).toBe('correct');
    expect(result.opponentResponse?.move).toEqual({ x: 4, y: 5 });
    expect(result.nextNodes).toHaveLength(1);
    expect(result.game.board.grid[4][5]).toBe('black');
    expect(result.game.board.grid[5][4]).toBe('white');
    expect(result.game.currentPlayer).toBe(problem.playerColor);
    expect(result.game.moveHistory).toHaveLength(2);
  });

  it('leaves the board unchanged for a wrong move', () => {
    const problem = PROBLEMS.find((p) => p.id === 'capture-003')!;
    const game = buildProblemGame(problem);
    const before = boardHash(game.board);

    const result = applyProblemMove(problem, game, problem.solutionTree, { x: 0, y: 0 });

    expect(result.status).toBe('wrong');
    expect(result.game).toBe(game);
    expect(boardHash(result.game.board)).toBe(before);
    expect(result.game.moveHistory).toHaveLength(0);
  });
});
