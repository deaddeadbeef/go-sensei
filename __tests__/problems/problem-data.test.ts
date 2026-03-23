import { PROBLEMS } from '@/lib/problems/problem-data';
import type { ProblemCategory } from '@/lib/problems/types';

describe('problem-data', () => {
  it('has at least 20 problems', () => {
    expect(PROBLEMS.length).toBeGreaterThanOrEqual(20);
  });

  it('every problem has a unique id', () => {
    const ids = PROBLEMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all 5 categories', () => {
    const categories = new Set(PROBLEMS.map((p) => p.category));
    const expected: ProblemCategory[] = ['capture', 'life-and-death', 'tesuji', 'reading', 'endgame'];
    for (const cat of expected) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it('every problem has at least one solution node', () => {
    for (const p of PROBLEMS) {
      expect(p.solutionTree.length).toBeGreaterThan(0);
    }
  });

  it('every problem has setupStones', () => {
    for (const p of PROBLEMS) {
      expect(p.setupStones.length).toBeGreaterThan(0);
    }
  });

  it('difficulties range from 1 to 5', () => {
    const diffs = new Set(PROBLEMS.map((p) => p.difficulty));
    expect(diffs.size).toBeGreaterThanOrEqual(3); // at least 3 different levels
    for (const d of diffs) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(5);
    }
  });

  it('every problem specifies a valid boardSize', () => {
    for (const p of PROBLEMS) {
      expect([9, 13, 19]).toContain(p.boardSize);
    }
  });
});
