import { describe, expect, it } from 'vitest';
import { buildReviewSessionSummary } from '@/lib/review/session-summary';

describe('review session summary', () => {
  it('focuses the next step on the first missed pattern', () => {
    const summary = buildReviewSessionSummary([
      { problemId: 'capture-001', solved: true, attempts: 1 },
      { problemId: 'life-001', solved: false, attempts: 3 },
    ]);

    expect(summary.tone).toBe('repair');
    expect(summary.headline).toBe('Rebuild Life and Death');
    expect(summary.practiceCategory).toBe('life-and-death');
    expect(summary.practiceLabel).toBe('Practice Life and Death');
    expect(summary.attentionProblems.map(({ problem }) => problem.title)).toEqual(['Make Two Eyes']);
    expect(summary.attentionProblems[0].replayMoveLabel).toBe('C8');
  });

  it('recommends reinforcement when answers took extra reading', () => {
    const summary = buildReviewSessionSummary([
      { problemId: 'capture-001', solved: true, attempts: 2 },
    ]);

    expect(summary.tone).toBe('reinforce');
    expect(summary.headline).toBe('Make Capture automatic');
    expect(summary.practiceCategory).toBe('capture');
    expect(summary.practiceLabel).toBe('Drill Capture');
    expect(summary.accuracy).toBe(100);
    expect(summary.attentionProblems[0].replayMoveLabel).toBe('A8');
  });

  it('continues learners to the next recommendation after clean reviews', () => {
    const summary = buildReviewSessionSummary([
      { problemId: 'capture-001', solved: true, attempts: 1 },
    ]);

    expect(summary.tone).toBe('advance');
    expect(summary.headline).toBe('Ready for the next idea');
    expect(summary.nextStep).toBe('Every review landed cleanly. Continue with the next recommendation while the review memory is fresh.');
    expect(summary.practiceCategory).toBeNull();
    expect(summary.practiceLabel).toBeNull();
    expect(summary.attentionProblems).toEqual([]);
  });
});
