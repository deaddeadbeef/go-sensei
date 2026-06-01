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
  return {
    problemId,
    solved: true,
    attempts: 1,
    moveSequence: [],
    timestamp: 1,
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
  });

  it('student who started intro gets the first lesson next', () => {
    const recommendation = getLearningRecommendation(input({ hasStartedIntroGame: true }));

    expect(recommendation).toMatchObject({
      kind: 'lesson',
      targetId: 'groups',
      actionLabel: 'Start lesson',
    });
    expect(recommendation.practicePlan.length).toBeGreaterThan(0);
  });

  it('due review beats new material', () => {
    const recommendation = getLearningRecommendation(input({ dueReviewCount: 2 }));

    expect(recommendation.kind).toBe('review');
    expect(recommendation.actionLabel).toBe('Review due cards');
    expect(recommendation.practicePlan).toContain('Solve the due positions before opening new material.');
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
    expect(recommendation.practicePlan).toContain('If you miss three times, study the shown solution line.');
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
