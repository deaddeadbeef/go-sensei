/**
 * SM-2 Spaced Repetition Algorithm
 * Based on: https://en.wikipedia.org/wiki/SuperMemo#SM-2
 *
 * Quality grades:
 *   0 = complete blackout
 *   1 = incorrect, but recognized on reveal
 *   2 = incorrect, but easy to recall after seeing answer
 *   3 = correct with serious difficulty
 *   4 = correct with hesitation
 *   5 = perfect response
 */

export interface SM2Card {
  easeFactor: number;     // >= 1.3
  interval: number;       // days until next review
  repetitions: number;    // consecutive correct answers
  nextReviewDate: number; // timestamp (ms)
}

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export function createCard(): SM2Card {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: Date.now(),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Process a review and return the updated card.
 */
export function reviewCard(card: SM2Card, quality: Quality): SM2Card {
  // Calculate new ease factor
  let newEF = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEF < 1.3) newEF = 1.3;

  let newInterval: number;
  let newReps: number;

  if (quality < 3) {
    // Failed — reset repetitions, review again soon
    newReps = 0;
    newInterval = 1;
  } else {
    // Passed
    newReps = card.repetitions + 1;
    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(card.interval * newEF);
    }
  }

  return {
    easeFactor: newEF,
    interval: newInterval,
    repetitions: newReps,
    nextReviewDate: Date.now() + newInterval * DAY_MS,
  };
}

/**
 * Check if a card is due for review.
 */
export function isDue(card: SM2Card, now: number = Date.now()): boolean {
  return now >= card.nextReviewDate;
}

/**
 * Convert a problem attempt result to an SM-2 quality grade.
 * solved on first try = 5, solved with hints = 4, solved after mistakes = 3, failed = 1
 */
export function attemptToQuality(solved: boolean, attempts: number, usedHint: boolean): Quality {
  if (!solved) return 1;
  if (attempts === 1 && !usedHint) return 5;
  if (attempts === 1 && usedHint) return 4;
  if (attempts <= 2) return 3;
  return 3;
}
