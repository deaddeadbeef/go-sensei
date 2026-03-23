import { act } from '@testing-library/react';
import { useReviewStore } from '@/stores/review-store';

beforeEach(() => {
  act(() => useReviewStore.getState().resetAll());
});

describe('review store', () => {
  it('getCard returns default for unseen problem', () => {
    const card = useReviewStore.getState().getCard('capture-001');
    expect(card.easeFactor).toBe(2.5);
    expect(card.repetitions).toBe(0);
  });

  it('recordReview updates the card', () => {
    act(() => useReviewStore.getState().recordReview('capture-001', 5));
    const card = useReviewStore.getState().getCard('capture-001');
    expect(card.repetitions).toBe(1);
    expect(card.interval).toBe(1);
  });

  it('recordReview adds to history', () => {
    act(() => useReviewStore.getState().recordReview('capture-001', 5));
    expect(useReviewStore.getState().history.length).toBe(1);
    expect(useReviewStore.getState().history[0].problemId).toBe('capture-001');
    expect(useReviewStore.getState().history[0].quality).toBe(5);
  });

  it('recordAttempt converts attempt to quality and records', () => {
    act(() => useReviewStore.getState().recordAttempt('life-001', true, 1, false));
    const card = useReviewStore.getState().getCard('life-001');
    expect(card.repetitions).toBe(1);
    // quality 5 (solved first try, no hint) → EF should increase
    expect(card.easeFactor).toBeGreaterThan(2.5);
  });

  it('getDueProblems returns empty when no cards exist', () => {
    expect(useReviewStore.getState().getDueProblems()).toEqual([]);
  });

  it('getDueProblems returns problems with past due dates', () => {
    // Record a review, then manually set the card's nextReviewDate to the past
    act(() => useReviewStore.getState().recordReview('capture-001', 5));
    act(() => {
      useReviewStore.setState((state) => ({
        cards: {
          ...state.cards,
          'capture-001': {
            ...state.cards['capture-001'],
            nextReviewDate: Date.now() - 1000,
          },
        },
      }));
    });
    const due = useReviewStore.getState().getDueProblems();
    expect(due).toContain('capture-001');
  });

  it('getDueCount matches getDueProblems length', () => {
    act(() => useReviewStore.getState().recordReview('capture-001', 5));
    act(() => {
      useReviewStore.setState((state) => ({
        cards: {
          ...state.cards,
          'capture-001': {
            ...state.cards['capture-001'],
            nextReviewDate: Date.now() - 1000,
          },
        },
      }));
    });
    expect(useReviewStore.getState().getDueCount()).toBe(
      useReviewStore.getState().getDueProblems().length,
    );
  });

  it('getReviewStats returns correct totals', () => {
    act(() => {
      useReviewStore.getState().recordReview('capture-001', 5);
      useReviewStore.getState().recordReview('life-001', 3);
      useReviewStore.getState().recordReview('capture-001', 4); // same problem again
    });
    const stats = useReviewStore.getState().getReviewStats();
    expect(stats.totalReviewed).toBe(2); // unique problems
    expect(stats.streak).toBeGreaterThanOrEqual(1); // reviewed today
  });

  it('resetAll clears everything', () => {
    act(() => useReviewStore.getState().recordReview('capture-001', 5));
    act(() => useReviewStore.getState().resetAll());
    expect(useReviewStore.getState().history.length).toBe(0);
    expect(Object.keys(useReviewStore.getState().cards).length).toBe(0);
  });
});
