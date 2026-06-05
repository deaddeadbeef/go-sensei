import type { ConceptMastery } from '@/lib/concepts/types';
import { getLocalStudyPlanAnswer } from '@/lib/coaching/local-study-plan-answer';
import type { ProblemAttempt } from '@/lib/problems/types';

function problemAttempt(problemId: string, solved: boolean): ProblemAttempt {
  return {
    problemId,
    solved,
    attempts: solved ? 1 : 3,
    moveSequence: [],
    timestamp: 1,
  };
}

function mastery(conceptId: string, level: ConceptMastery['level'], encounterCount = 1): ConceptMastery {
  return {
    conceptId,
    level,
    encounterCount,
    lastSeen: encounterCount,
  };
}

describe('local study plan answer', () => {
  it('turns a brand-new progress question into the first visible action', () => {
    const answer = getLocalStudyPlanAnswer('How am I doing?', {
      completedLessons: [],
      problemAttempts: [],
      dueReviewCount: 0,
      hasStartedIntroGame: false,
      mastery: [],
    });

    expect(answer?.text).toContain('Progress check: you have completed no lessons, solved no problems, and not started a guided 9x9 game yet.');
    expect(answer?.text).toContain('That is not a failure; it means the tutor needs one visible move or lesson before it can judge your Go.');
    expect(answer?.text).toContain('Next honest step: First 9x9 guided game. Start on a small board with one clear goal at a time.');
    expect(answer?.text).toContain('Keep attention on Corner Openings, Territory, and Liberties.');
    expect(answer?.actions).toEqual([{ id: 'guided:intro', label: 'Start guided 9x9' }]);
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['corner-opening', 'territory', 'liberties']));
  });

  it('reflects concrete learning evidence before recommending the next step', () => {
    const answer = getLocalStudyPlanAnswer('What have I learned?', {
      completedLessons: ['groups', 'liberties'],
      problemAttempts: [
        problemAttempt('capture-001', true),
        problemAttempt('capture-002', false),
      ],
      dueReviewCount: 0,
      hasStartedIntroGame: true,
      mastery: [
        mastery('liberties', 2, 4),
        mastery('capture', 2, 2),
        mastery('groups', 1, 3),
      ],
    });

    expect(answer?.text).toContain('Progress check: you have completed 2 lessons, solved 1 problem, and started a guided 9x9 game.');
    expect(answer?.text).toContain('That is real evidence: lessons build vocabulary, problems test reading, and guided games connect both to live moves.');
    expect(answer?.text).toContain('Strongest evidence: Liberties and Capture are moving from vocabulary into practice.');
    expect(answer?.text).toContain('Still fragile: Groups needs more proof.');
    expect(answer?.text).toContain('Next honest step: Capturing Stones. This is the next lesson in the learning path.');
    expect(answer?.actions).toEqual([{ id: 'lesson:capture', label: 'Start lesson: Capturing Stones' }]);
    expect(answer?.conceptIds).toEqual(expect.arrayContaining(['capture', 'atari', 'liberties', 'groups']));
  });
});
