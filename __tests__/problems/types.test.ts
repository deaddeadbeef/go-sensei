import type { Problem, MoveNode, ProblemCategory, ProblemDifficulty } from '@/lib/problems/types';

describe('Problem types', () => {
  it('MoveNode supports branching solution trees', () => {
    const tree: MoveNode = {
      move: { x: 4, y: 4 },
      isCorrect: true,
      label: 'Key move',
      responses: [
        {
          move: { x: 5, y: 4 },
          isCorrect: false,
          responses: [],
        },
        {
          move: { x: 3, y: 4 },
          isCorrect: true,
          label: 'Alternative',
          responses: [],
        },
      ],
    };
    expect(tree.responses.length).toBe(2);
    expect(tree.responses[1].isCorrect).toBe(true);
  });

  it('Problem has required fields', () => {
    const problem: Problem = {
      id: 'tsumego-001',
      title: 'Corner Life',
      category: 'life-and-death',
      difficulty: 3,
      boardSize: 9,
      description: 'Black to live',
      setupStones: [
        { point: { x: 0, y: 0 }, color: 'black' },
        { point: { x: 1, y: 0 }, color: 'white' },
      ],
      solutionTree: [
        { move: { x: 0, y: 1 }, isCorrect: true, label: 'Make the eye', responses: [] },
      ],
      hint: 'Think about eye shape',
      playerColor: 'black',
    };
    expect(problem.category).toBe('life-and-death');
    expect(problem.solutionTree.length).toBe(1);
  });

  it('ProblemCategory covers all types', () => {
    const categories: ProblemCategory[] = ['capture', 'life-and-death', 'tesuji', 'reading', 'endgame'];
    expect(categories.length).toBe(5);
  });

  it('ProblemDifficulty range is 1-5', () => {
    const diffs: ProblemDifficulty[] = [1, 2, 3, 4, 5];
    expect(diffs.length).toBe(5);
  });
});
