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

export function getProblemSolutionTakeaway(
  problem: Problem,
  steps: ProblemSolutionStep[] = getPrimarySolutionLine(problem),
): string {
  const firstStudentStep = steps.find((step) => step.role === 'student') ?? null;
  const firstMove = firstStudentStep
    ? `The first move at ${formatProblemPoint(firstStudentStep.move, problem.boardSize as BoardSize)}`
    : 'The first move';

  switch (problem.category) {
    case 'capture':
      return `${firstMove} works by attacking liberties. Follow the numbered sequence until the target group has no safe adjacent point left.`;
    case 'life-and-death':
      return `${firstMove} is the vital point for eye space. Ask whether the defender can still make two separate eyes after that point is occupied.`;
    case 'tesuji':
      return `${firstMove} is a shape tactic, not just a contact move. It creates an immediate threat the opponent cannot answer cleanly.`;
    case 'reading':
      return `${firstMove} works because the replies stay forcing. Read the marked sequence before playing so you know the target cannot escape.`;
    case 'endgame':
      return `${firstMove} is the urgent value move. Compare it with smaller gote points, then notice how the sequence keeps the bigger point under control.`;
  }
}
