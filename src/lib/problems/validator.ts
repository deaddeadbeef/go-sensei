import type { Point } from '@/lib/go-engine/types';
import type { MoveNode } from './types';

export interface ValidationResult {
  status: 'correct' | 'wrong' | 'continue' | 'solved';
  message?: string;
  nextNodes?: MoveNode[];
  opponentResponse?: MoveNode;
}

/**
 * Check if two points match (exact equality).
 */
function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Find the node in `nodes` whose move matches `played`.
 */
function findMatchingNode(nodes: MoveNode[], played: Point): MoveNode | undefined {
  return nodes.find((n) => pointsEqual(n.move, played));
}

/**
 * Validate a player's move against the current solution-tree nodes.
 *
 * Returns:
 * - `solved`    if the move is correct and the path is complete (no more responses)
 * - `correct`   if the move is correct but the opponent has a response (continue playing)
 * - `continue`  if the move is correct (path not yet fully resolved — multiple branches remain)
 * - `wrong`     if the move is not in the tree
 */
export function validateMove(
  currentNodes: MoveNode[],
  played: Point,
): ValidationResult {
  const match = findMatchingNode(currentNodes, played);

  if (!match) {
    return { status: 'wrong', message: 'That move is not in the solution tree.' };
  }

  if (!match.isCorrect) {
    return { status: 'wrong', message: match.label ?? 'Incorrect — try again.' };
  }

  // Correct move — check what's next
  if (match.responses.length === 0) {
    return { status: 'solved', message: match.label ?? 'Correct! Problem solved.' };
  }

  // The first response is the opponent's reply
  const opponentReply = match.responses[0];

  // After opponent responds, what are the next player options?
  if (opponentReply.responses.length === 0) {
    // Opponent has no further responses — puzzle solved after this exchange
    return {
      status: 'solved',
      message: match.label ?? 'Correct! Problem solved.',
      opponentResponse: opponentReply,
    };
  }

  return {
    status: 'correct',
    message: match.label ?? 'Good move!',
    opponentResponse: opponentReply,
    nextNodes: opponentReply.responses,
  };
}

/**
 * Walk a full sequence of moves against a solution tree.
 * Useful for batch validation and testing.
 */
export function validateSequence(
  rootNodes: MoveNode[],
  moves: Point[],
): ValidationResult {
  let current = rootNodes;
  let lastResult: ValidationResult = { status: 'wrong', message: 'No moves provided.' };

  for (const move of moves) {
    lastResult = validateMove(current, move);
    if (lastResult.status === 'wrong' || lastResult.status === 'solved') {
      return lastResult;
    }
    if (lastResult.nextNodes) {
      current = lastResult.nextNodes;
    } else {
      break;
    }
  }

  return lastResult;
}
