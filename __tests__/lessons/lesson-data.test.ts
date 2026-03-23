import { LESSONS } from '@/lib/lessons/lesson-data';

describe('lesson data integrity', () => {
  it('has at least 10 lessons', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(10);
  });

  it('every lesson has unique id', () => {
    const ids = LESSONS.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every step has text', () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        expect(step.text).toBeTruthy();
      }
    }
  });

  it('interactive steps have both prompt and expectedMove', () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        if (step.prompt) {
          expect(step.expectedMove).toBeDefined();
        }
      }
    }
  });

  it('new lessons each have at least one interactive step', () => {
    const newIds = ['ko', 'ladder', 'net', 'snapback', 'territory-vs-influence'];
    for (const id of newIds) {
      const lesson = LESSONS.find(l => l.id === id);
      expect(lesson).toBeDefined();
      const hasInteractive = lesson!.steps.some(s => s.prompt);
      expect(hasInteractive).toBe(true);
    }
  });
});
