import { validateMove, validateSequence, type ValidationResult } from '@/lib/problems/validator';
import type { MoveNode } from '@/lib/problems/types';

// Simple linear problem: play (2,2) → opponent (3,3) → play (4,4) → solved
const linearTree: MoveNode[] = [
  {
    move: { x: 2, y: 2 },
    isCorrect: true,
    label: 'First correct',
    responses: [
      {
        move: { x: 3, y: 3 },
        isCorrect: true,
        label: 'Opponent responds',
        responses: [
          {
            move: { x: 4, y: 4 },
            isCorrect: true,
            label: 'Solved!',
            responses: [],
          },
        ],
      },
    ],
  },
  {
    move: { x: 0, y: 0 },
    isCorrect: false,
    label: 'Wrong — not the vital point',
    responses: [],
  },
];

// Branching: two correct first moves
const branchingTree: MoveNode[] = [
  {
    move: { x: 1, y: 1 },
    isCorrect: true,
    label: 'Path A',
    responses: [],
  },
  {
    move: { x: 2, y: 2 },
    isCorrect: true,
    label: 'Path B',
    responses: [],
  },
  {
    move: { x: 5, y: 5 },
    isCorrect: false,
    responses: [],
  },
];

describe('validateMove', () => {
  it('returns wrong for a move not in the tree', () => {
    const result = validateMove(linearTree, { x: 9, y: 9 });
    expect(result.status).toBe('wrong');
  });

  it('returns wrong for an incorrect move in the tree', () => {
    const result = validateMove(linearTree, { x: 0, y: 0 });
    expect(result.status).toBe('wrong');
    expect(result.message).toBe('Wrong — not the vital point');
  });

  it('returns correct with opponent response for a mid-sequence move', () => {
    const result = validateMove(linearTree, { x: 2, y: 2 });
    expect(result.status).toBe('correct');
    expect(result.opponentResponse).toBeDefined();
    expect(result.opponentResponse!.move).toEqual({ x: 3, y: 3 });
    expect(result.nextNodes).toBeDefined();
    expect(result.nextNodes!.length).toBe(1);
  });

  it('returns solved when the path is complete (no more responses)', () => {
    const result = validateMove(branchingTree, { x: 1, y: 1 });
    expect(result.status).toBe('solved');
    expect(result.message).toBe('Path A');
  });

  it('returns solved for alternate correct path', () => {
    const result = validateMove(branchingTree, { x: 2, y: 2 });
    expect(result.status).toBe('solved');
    expect(result.message).toBe('Path B');
  });

  it('returns solved after opponent reply with no further moves', () => {
    // Build a tree: player → opponent → done
    const tree: MoveNode[] = [
      {
        move: { x: 1, y: 0 },
        isCorrect: true,
        responses: [
          {
            move: { x: 2, y: 0 },
            isCorrect: true,
            label: 'Opponent last move',
            responses: [],
          },
        ],
      },
    ];
    const result = validateMove(tree, { x: 1, y: 0 });
    expect(result.status).toBe('solved');
    expect(result.opponentResponse).toBeDefined();
    expect(result.opponentResponse!.move).toEqual({ x: 2, y: 0 });
  });
});

describe('validateSequence', () => {
  it('validates a full correct sequence to solved', () => {
    const result = validateSequence(linearTree, [
      { x: 2, y: 2 },
      { x: 4, y: 4 },
    ]);
    expect(result.status).toBe('solved');
  });

  it('stops at first wrong move', () => {
    const result = validateSequence(linearTree, [
      { x: 2, y: 2 },
      { x: 9, y: 9 },
    ]);
    expect(result.status).toBe('wrong');
  });

  it('returns wrong for empty moves', () => {
    const result = validateSequence(linearTree, []);
    expect(result.status).toBe('wrong');
    expect(result.message).toBe('No moves provided.');
  });

  it('returns correct (in-progress) for partial sequence', () => {
    const result = validateSequence(linearTree, [{ x: 2, y: 2 }]);
    expect(result.status).toBe('correct');
  });
});
