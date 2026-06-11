import type { ConceptMastery } from '@/lib/concepts/types';
import {
  getLearningRecommendation,
  type RecommendationInput,
} from '@/lib/learning-path/recommendations';
import type { ProblemAttempt } from '@/lib/problems/types';

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    completedLessons: [],
    problemAttempts: [],
    dueReviewCount: 0,
    hasStartedIntroGame: true,
    mastery: [],
    ...overrides,
  };
}

function solved(problemId: string): ProblemAttempt {
  return attempt(problemId, true, 1, 1);
}

function attempt(
  problemId: string,
  solved: boolean,
  attempts: number,
  timestamp: number,
): ProblemAttempt {
  return {
    problemId,
    solved,
    attempts,
    moveSequence: [],
    timestamp,
  };
}

function conceptMastery(conceptId: string, level: ConceptMastery['level']): ConceptMastery {
  return {
    conceptId,
    level,
    lastSeen: 1,
    encounterCount: 1,
  };
}

describe('learning path recommendations', () => {
  it('brand-new student gets the first guided 9x9 game', () => {
    const recommendation = getLearningRecommendation(input({ hasStartedIntroGame: false }));

    expect(recommendation).toMatchObject({
      kind: 'guided_intro',
      title: 'First 9x9 guided game',
      actionLabel: 'Start guided 9x9',
    });
    expect(recommendation.practicePlan).toContain('Place the first stone near a corner instead of the center.');
    expect(recommendation.finishLine).toBe('The guided 9x9 is started and the first corner objective is visible on the board.');
  });

  it('student who started intro gets the first lesson next', () => {
    const recommendation = getLearningRecommendation(input({ hasStartedIntroGame: true }));

    expect(recommendation).toMatchObject({
      kind: 'lesson',
      targetId: 'groups',
      actionLabel: 'Start lesson: What is a Group?',
    });
    expect(recommendation.focusConcepts).toEqual(['stones-and-board', 'groups']);
    expect(recommendation.finishLine).toBe('The lesson is marked complete after you prove the idea on its board checkpoint.');
    expect(recommendation.practicePlan).toContain('If the answer is shown, explain why it matches the hint before continuing.');
  });

  it('due review beats new material', () => {
    const recommendation = getLearningRecommendation(input({ dueReviewCount: 2 }));

    expect(recommendation.kind).toBe('review');
    expect(recommendation.title).toBe('Daily review');
    expect(recommendation.reason).toBe('2 review positions are due before new material.');
    expect(recommendation.actionLabel).toBe('Start daily review');
    expect(recommendation.finishLine).toBe('All due review cards are answered, and any miss has been replayed once.');
    expect(recommendation.practicePlan).toContain('Solve the due review positions before opening new material.');
  });

  it('repairs the most recent failed problem before adding new material', () => {
    const recommendation = getLearningRecommendation(
      input({
        completedLessons: ['groups', 'liberties', 'capture'],
        problemAttempts: [
          solved('capture-001'),
          solved('capture-002'),
          solved('capture-003'),
          attempt('life-001', false, 3, 20),
        ],
      }),
    );

    expect(recommendation).toMatchObject({
      kind: 'problem',
      filter: 'life-and-death',
      targetProblemId: 'life-001',
      title: 'Repair Life and Death',
      actionLabel: 'Replay Make Two Eyes',
    });
    expect(recommendation.reason).toBe('Your latest miss was Make Two Eyes. Repair that pattern before adding new material.');
    expect(recommendation.finishLine).toBe('Replay Make Two Eyes once, then solve one life and death problem without a hint.');
    expect(recommendation.practicePlan).toContain('Start by replaying the first solution move from Make Two Eyes.');
  });

  it('reinforces a recently solved problem that took extra reading', () => {
    const recommendation = getLearningRecommendation(
      input({
        completedLessons: ['groups', 'liberties', 'capture'],
        problemAttempts: [
          solved('capture-001'),
          attempt('capture-002', true, 2, 30),
        ],
      }),
    );

    expect(recommendation).toMatchObject({
      kind: 'problem',
      filter: 'capture',
      targetProblemId: 'capture-002',
      title: 'Reinforce Capture',
      actionLabel: 'Drill Edge Squeeze',
    });
    expect(recommendation.reason).toBe('You solved Edge Squeeze, but it took 2 attempts. Repeat the idea while it is fresh.');
    expect(recommendation.finishLine).toBe('Solve one capture problem on the first try, then return to the path.');
  });

  it('keeps due review ahead of recent problem repair', () => {
    const recommendation = getLearningRecommendation(
      input({
        dueReviewCount: 1,
        problemAttempts: [attempt('life-001', false, 3, 20)],
      }),
    );

    expect(recommendation.kind).toBe('review');
  });

  it('lets a newer clean solve clear older repair pressure', () => {
    const recommendation = getLearningRecommendation(
      input({
        completedLessons: ['groups', 'liberties', 'capture'],
        problemAttempts: [
          solved('capture-001'),
          solved('capture-002'),
          solved('capture-003'),
          attempt('life-001', false, 3, 20),
          attempt('life-002', true, 1, 40),
        ],
      }),
    );

    expect(recommendation).toMatchObject({
      kind: 'lesson',
      targetId: 'territory',
    });
  });

  it('capture lesson completion recommends capture problems', () => {
    const recommendation = getLearningRecommendation(
      input({ completedLessons: ['groups', 'liberties', 'capture'] }),
    );

    expect(recommendation).toMatchObject({
      kind: 'problem',
      filter: 'capture',
      actionLabel: 'Open capture problems',
    });
    expect(recommendation.finishLine).toBe('This block is complete after 3 more solved capture problems.');
    expect(recommendation.practicePlan).toContain('If you miss three times, cover the numbers and explain the first solution move.');
  });

  it('eyes lesson completion recommends life-and-death problems before more guided games', () => {
    const recommendation = getLearningRecommendation(
      input({
        completedLessons: ['groups', 'liberties', 'capture', 'territory', 'eyes'],
        problemAttempts: [solved('capture-001'), solved('capture-002'), solved('capture-003')],
      }),
    );

    expect(recommendation).toMatchObject({
      kind: 'problem',
      filter: 'life-and-death',
      actionLabel: 'Open life and death problems',
    });
    expect(recommendation.reason).toBe('Practice life and death until you solve 2 more life and death problems.');
  });

  it('enough lessons and practice recommends guided game with weak eyes focus', () => {
    const recommendation = getLearningRecommendation(
      input({
        completedLessons: ['groups', 'liberties', 'capture', 'territory', 'eyes'],
        problemAttempts: [
          solved('capture-001'),
          solved('capture-002'),
          solved('capture-003'),
          solved('life-001'),
          solved('life-002'),
        ],
        mastery: [
          conceptMastery('groups', 3),
          conceptMastery('liberties', 3),
          conceptMastery('capture', 3),
          conceptMastery('territory', 3),
          conceptMastery('eyes', 1),
        ],
      }),
    );

    expect(recommendation.kind).toBe('guided_game');
    expect(recommendation.actionLabel).toBe('Continue guided game');
    expect(recommendation.focusConcepts).toContain('eyes');
    expect(recommendation.finishLine).toBe('Play until the current objective is met and you can name why the move helped.');
    expect(recommendation.practicePlan).toContain('After the tutor replies, compare the move insight with your plan.');
  });

  it('ignores stale completed lesson ids when checking guided game readiness', () => {
    const recommendation = getLearningRecommendation(
      input({
        completedLessons: ['groups', 'liberties', 'territory', 'stale-lesson-id'],
        problemAttempts: [solved('capture-001'), solved('capture-002')],
      }),
    );

    expect(recommendation).toMatchObject({
      kind: 'lesson',
      targetId: 'capture',
    });
  });
});
