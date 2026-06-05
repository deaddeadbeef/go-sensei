import { PROBLEMS } from '@/lib/problems/problem-data';
import { formatProblemPoint, getPrimarySolutionLine, getProblemSolutionTakeaway } from '@/lib/problems/solution-review';
import type { Problem } from '@/lib/problems/types';

function problemById(id: string): Problem {
  const problem = PROBLEMS.find((candidate) => candidate.id === id);
  if (!problem) {
    throw new Error(`Missing test problem: ${id}`);
  }
  return problem;
}

describe('problem solution review', () => {
  it('formats board coordinates with Go letters and top-edge numbering', () => {
    expect(formatProblemPoint({ x: 0, y: 0 }, 9)).toBe('A9');
    expect(formatProblemPoint({ x: 8, y: 0 }, 19)).toBe('J19');
    expect(formatProblemPoint({ x: 18, y: 18 }, 19)).toBe('T1');
  });

  it('extracts the primary answer line with alternating student and opponent steps', () => {
    const line = getPrimarySolutionLine(problemById('capture-003'));

    expect(line).toEqual([
      {
        order: 1,
        move: { x: 5, y: 4 },
        color: 'black',
        role: 'student',
        label: 'Atari!',
      },
      {
        order: 2,
        move: { x: 4, y: 5 },
        color: 'white',
        role: 'opponent',
        label: 'White runs',
      },
      {
        order: 3,
        move: { x: 5, y: 5 },
        color: 'black',
        role: 'student',
        label: 'Double atari — captured!',
      },
    ]);
  });

  it('uses the problem player color for the first student move', () => {
    const line = getPrimarySolutionLine(problemById('life-002'));

    expect(line[0]).toMatchObject({
      move: { x: 1, y: 1 },
      color: 'white',
      role: 'student',
    });
  });

  it('summarizes why a capture solution works', () => {
    expect(getProblemSolutionTakeaway(problemById('capture-001'))).toBe(
      'The first move at A8 works by attacking liberties. Follow the numbered sequence until the target group has no safe adjacent point left.',
    );
  });

  it('summarizes why a life-and-death solution works', () => {
    expect(getProblemSolutionTakeaway(problemById('life-002'))).toBe(
      'The first move at B8 is the vital point for eye space. Ask whether the defender can still make two separate eyes after that point is occupied.',
    );
  });
});
