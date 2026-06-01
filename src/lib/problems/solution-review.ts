import type { BoardSize, Point, StoneColor } from '@/lib/go-engine/types';
import type { MoveNode, Problem } from './types';

const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST';

export interface ProblemSolutionStep {
  order: number;
  move: Point;
  color: StoneColor;
  role: 'student' | 'opponent';
  label: string | null;
}

function oppositeColor(color: StoneColor): StoneColor {
  return color === 'black' ? 'white' : 'black';
}

function firstCorrectNode(nodes: MoveNode[]): MoveNode | null {
  return nodes.find((node) => node.isCorrect) ?? null;
}

export function formatProblemPoint(point: Point, boardSize: BoardSize): string {
  return `${COLUMN_LETTERS[point.x] ?? '?'}${boardSize - point.y}`;
}

export function getPrimarySolutionLine(problem: Problem): ProblemSolutionStep[] {
  const steps: ProblemSolutionStep[] = [];
  let currentNodes = problem.solutionTree;
  const studentColor = problem.playerColor;
  const opponentColor = oppositeColor(studentColor);

  for (let guard = 0; guard < 64; guard++) {
    const studentMove = firstCorrectNode(currentNodes);
    if (!studentMove) break;

    steps.push({
      order: steps.length + 1,
      move: studentMove.move,
      color: studentColor,
      role: 'student',
      label: studentMove.label ?? null,
    });

    const opponentReply = studentMove.responses[0] ?? null;
    if (!opponentReply) break;

    steps.push({
      order: steps.length + 1,
      move: opponentReply.move,
      color: opponentColor,
      role: 'opponent',
      label: opponentReply.label ?? null,
    });

    if (opponentReply.responses.length === 0) break;
    currentNodes = opponentReply.responses;
  }

  return steps;
}
