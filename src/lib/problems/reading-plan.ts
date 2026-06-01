import type { ProblemCategory } from '@/lib/problems/types';

export interface ProblemReadingPlan {
  focusLabel: string;
  focus: string;
  steps: string[];
  reminder: string;
}

const READING_PLANS: Record<ProblemCategory, ProblemReadingPlan> = {
  capture: {
    focusLabel: 'Target group',
    focus: 'Find the opponent stones with the fewest liberties.',
    steps: [
      'Count every liberty before choosing a move.',
      'Look for the move that removes the last escape point.',
      'Check whether the opponent can run or capture back.',
    ],
    reminder: 'Captures are about the final liberty, not just contact.',
  },
  'life-and-death': {
    focusLabel: 'Vital point',
    focus: 'Decide whether the group needs to make eyes or deny eyes.',
    steps: [
      'Mark the empty points inside the shape.',
      'Ask which point changes one eye into two eyes, or two into one.',
      'Read the opponent reply before you click.',
    ],
    reminder: 'The right move changes the whole eye shape.',
  },
  tesuji: {
    focusLabel: 'Forcing move',
    focus: 'Search for a move that makes the opponent answer badly.',
    steps: [
      'Try sacrifice, placement, and connection candidates.',
      'Prefer moves that create two threats at once.',
      'Reject pretty moves if the opponent has an easy reply.',
    ],
    reminder: 'A tesuji works because the reply is constrained.',
  },
  reading: {
    focusLabel: 'Candidate line',
    focus: 'Read the sequence before trusting the first move.',
    steps: [
      'Name two candidate moves before selecting one.',
      'Play the opponent best reply in your head.',
      'Choose the line where your follow-up still works.',
    ],
    reminder: 'Reading means testing the reply, not guessing the first move.',
  },
  endgame: {
    focusLabel: 'Point value',
    focus: 'Compare local gains and whether the move keeps sente.',
    steps: [
      'Count what each move gains or saves.',
      'Play forcing sente before quiet gote when values are close.',
      'Check the follow-up if the opponent must answer.',
    ],
    reminder: 'The biggest endgame move often wins twice: points plus initiative.',
  },
};

export function getProblemReadingPlan(category: ProblemCategory): ProblemReadingPlan {
  return READING_PLANS[category];
}
