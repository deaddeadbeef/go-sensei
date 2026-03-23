import { createCard, reviewCard, isDue, attemptToQuality, type SM2Card, type Quality } from '@/lib/review/sm2';

describe('SM-2 scheduler', () => {
  it('createCard returns default values', () => {
    const card = createCard();
    expect(card.easeFactor).toBe(2.5);
    expect(card.interval).toBe(0);
    expect(card.repetitions).toBe(0);
    expect(card.nextReviewDate).toBeLessThanOrEqual(Date.now());
  });

  it('first correct review sets interval to 1 day', () => {
    const card = createCard();
    const result = reviewCard(card, 5);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it('second correct review sets interval to 6 days', () => {
    let card = createCard();
    card = reviewCard(card, 5);
    card = reviewCard(card, 5);
    expect(card.interval).toBe(6);
    expect(card.repetitions).toBe(2);
  });

  it('third correct review uses ease factor', () => {
    let card = createCard();
    card = reviewCard(card, 5);
    card = reviewCard(card, 5);
    card = reviewCard(card, 5);
    expect(card.interval).toBeGreaterThan(6);
    expect(card.repetitions).toBe(3);
  });

  it('failed review resets repetitions and interval', () => {
    let card = createCard();
    card = reviewCard(card, 5);
    card = reviewCard(card, 5);
    card = reviewCard(card, 2);
    expect(card.repetitions).toBe(0);
    expect(card.interval).toBe(1);
  });

  it('ease factor never goes below 1.3', () => {
    let card = createCard();
    for (let i = 0; i < 10; i++) {
      card = reviewCard(card, 0);
    }
    expect(card.easeFactor).toBe(1.3);
  });

  it('perfect reviews increase ease factor', () => {
    let card = createCard();
    const initialEF = card.easeFactor;
    card = reviewCard(card, 5);
    expect(card.easeFactor).toBeGreaterThan(initialEF);
  });

  it('isDue returns true for overdue cards', () => {
    const card: SM2Card = { ...createCard(), nextReviewDate: Date.now() - 1000 };
    expect(isDue(card)).toBe(true);
  });

  it('isDue returns false for future cards', () => {
    const card: SM2Card = { ...createCard(), nextReviewDate: Date.now() + 86400000 };
    expect(isDue(card)).toBe(false);
  });

  it('attemptToQuality maps correctly', () => {
    expect(attemptToQuality(true, 1, false)).toBe(5);
    expect(attemptToQuality(true, 1, true)).toBe(4);
    expect(attemptToQuality(true, 2, false)).toBe(3);
    expect(attemptToQuality(false, 3, false)).toBe(1);
  });
});
