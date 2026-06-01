import { getProblemReadingPlan } from '@/lib/problems/reading-plan';
import type { ProblemCategory } from '@/lib/problems/types';

const CATEGORIES: ProblemCategory[] = ['capture', 'life-and-death', 'tesuji', 'reading', 'endgame'];

describe('problem reading plans', () => {
  it('gives every problem category a focused pre-move routine', () => {
    for (const category of CATEGORIES) {
      const plan = getProblemReadingPlan(category);

      expect(plan.focusLabel.length).toBeGreaterThan(0);
      expect(plan.focus.length).toBeGreaterThan(0);
      expect(plan.steps).toHaveLength(3);
      expect(plan.reminder.length).toBeGreaterThan(0);
    }
  });

  it('teaches capture problems as liberty-counting before contact', () => {
    const plan = getProblemReadingPlan('capture');

    expect(plan.focusLabel).toBe('Target group');
    expect(plan.steps).toContain('Count every liberty before choosing a move.');
    expect(plan.reminder).toBe('Captures are about the final liberty, not just contact.');
  });
});
