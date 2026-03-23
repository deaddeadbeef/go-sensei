import type { LessonStep } from '@/lib/lessons/types';

describe('LessonStep type', () => {
  it('accepts interactive step fields', () => {
    const step: LessonStep = {
      stones: [],
      highlights: [],
      text: 'Click the star point',
      prompt: 'Click the star point at the center of the board',
      expectedMove: { x: 4, y: 4 },
      wrongMoveHint: "That's not the center — look for the dot in the middle",
      branchOnFail: 0,
      acceptRadius: 0,
      boardSize: 9,
    };
    expect(step.prompt).toBe('Click the star point at the center of the board');
    expect(step.wrongMoveHint).toBeDefined();
    expect(step.branchOnFail).toBe(0);
    expect(step.acceptRadius).toBe(0);
  });

  it('works without interactive fields (backward compatible)', () => {
    const step: LessonStep = {
      stones: [],
      highlights: [],
      text: 'A non-interactive step',
    };
    expect(step.prompt).toBeUndefined();
    expect(step.expectedMove).toBeUndefined();
    expect(step.wrongMoveHint).toBeUndefined();
  });
});
