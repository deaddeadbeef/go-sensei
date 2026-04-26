import {
  boardHash,
  createBoard,
  isOnBoard,
  playMove,
  setStone,
} from '@/lib/go-engine';
import type { GameState, Point } from '@/lib/go-engine/types';
import { validateMove, type ValidationResult } from './validator';
import type { MoveNode, Problem } from './types';

export interface ProblemTreeIssue {
  problemId: string;
  path: Point[];
  move: Point;
  reason: string;
}

export interface RuntimeValidationResult extends ValidationResult {
  game: GameState;
}

export function buildProblemGame(problem: Problem): GameState {
  let board = createBoard(problem.boardSize);

  for (const stone of problem.setupStones) {
    if (isOnBoard(board, stone.point)) {
      board = setStone(board, stone.point, stone.color);
    }
  }

  return {
    board,
    currentPlayer: problem.playerColor,
    moveHistory: [],
    captures: { black: 0, white: 0 },
    koPoint: null,
    consecutivePasses: 0,
    phase: 'playing',
    komi: 6.5,
    winner: null,
    positionHistory: new Set([boardHash(board)]),
  };
}

export function validateProblemTree(problem: Problem): ProblemTreeIssue[] {
  const issues: ProblemTreeIssue[] = [];
  const initialGame = buildProblemGame(problem);

  function walk(game: GameState, nodes: MoveNode[], path: Point[]): void {
    for (const node of nodes) {
      const result = playMove(game, node.move);
      const nextPath = [...path, node.move];

      if (!result.success) {
        issues.push({
          problemId: problem.id,
          path: nextPath,
          move: node.move,
          reason: result.reason,
        });
        continue;
      }

      walk(result.newState, node.responses, nextPath);
    }
  }

  walk(initialGame, problem.solutionTree, []);
  return issues;
}

export function applyProblemMove(
  problem: Problem,
  game: GameState,
  currentNodes: MoveNode[],
  played: Point,
): RuntimeValidationResult {
  const validation = validateMove(currentNodes, played);

  if (validation.status === 'wrong') {
    return { ...validation, game };
  }

  const playerMove = playMove(game, played);
  if (!playerMove.success) {
    return {
      status: 'wrong',
      message: `Illegal problem move in ${problem.id}: ${playerMove.reason}`,
      game,
    };
  }

  let nextGame = playerMove.newState;
  if (validation.opponentResponse) {
    const opponentMove = playMove(nextGame, validation.opponentResponse.move);
    if (!opponentMove.success) {
      return {
        status: 'wrong',
        message: `Illegal opponent response in ${problem.id}: ${opponentMove.reason}`,
        game,
      };
    }
    nextGame = opponentMove.newState;
  }

  return { ...validation, game: nextGame };
}
