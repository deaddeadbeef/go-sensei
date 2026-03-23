import { CONCEPTS } from '@/lib/concepts/concept-data';
import type { ConceptCategory } from '@/lib/concepts/types';

describe('concept-data', () => {
  it('has at least 25 concepts', () => {
    expect(CONCEPTS.length).toBeGreaterThanOrEqual(25);
  });

  it('every concept has a unique id', () => {
    const ids = CONCEPTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all 5 categories', () => {
    const cats = new Set(CONCEPTS.map((c) => c.category));
    const expected: ConceptCategory[] = ['fundamentals', 'tactics', 'strategy', 'endgame', 'opening'];
    for (const cat of expected) {
      expect(cats.has(cat)).toBe(true);
    }
  });

  it('all prerequisites reference valid concept IDs', () => {
    const ids = new Set(CONCEPTS.map((c) => c.id));
    for (const concept of CONCEPTS) {
      for (const prereq of concept.prerequisites) {
        expect(ids.has(prereq)).toBe(true);
      }
    }
  });

  it('has no circular dependencies (DAG check)', () => {
    const map = new Map(CONCEPTS.map((c) => [c.id, c]));
    const visited = new Set<string>();
    const stack = new Set<string>();

    function hasCycle(id: string): boolean {
      if (stack.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      stack.add(id);
      const concept = map.get(id);
      if (concept) {
        for (const prereq of concept.prerequisites) {
          if (hasCycle(prereq)) return true;
        }
      }
      stack.delete(id);
      return false;
    }

    for (const c of CONCEPTS) {
      expect(hasCycle(c.id)).toBe(false);
    }
  });

  it('at least one concept has no prerequisites (root nodes)', () => {
    const roots = CONCEPTS.filter((c) => c.prerequisites.length === 0);
    expect(roots.length).toBeGreaterThan(0);
  });
});
