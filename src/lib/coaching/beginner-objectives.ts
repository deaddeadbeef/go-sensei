import type { BoardSize, Point, StoneColor } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';

export interface BeginnerObjectiveInput {
  boardSize: BoardSize;
  moveCount: number;
  currentPlayer: StoneColor;
  teachingLevel: TeachingLevel;
}

export interface BeginnerObjective {
  id: 'claim-corner' | 'extend-from-stone' | 'look-for-weak-groups';
  title: string;
  instruction: string;
  why: string;
  targetPoints: Point[];
  conceptIds: string[];
}

const CORNER_TARGETS_9X9: Point[] = [
  { x: 2, y: 2 },
  { x: 6, y: 2 },
  { x: 2, y: 6 },
  { x: 6, y: 6 },
];

const SIDE_TARGETS_9X9: Point[] = [
  { x: 2, y: 4 },
  { x: 4, y: 2 },
  { x: 6, y: 4 },
  { x: 4, y: 6 },
];

export function getBeginnerObjective(input: BeginnerObjectiveInput): BeginnerObjective | null {
  if (input.boardSize !== 9) return null;
  if (input.currentPlayer !== 'black') return null;
  if (input.teachingLevel !== 'beginner' && input.teachingLevel !== 'guided') return null;

  if (input.moveCount <= 2) {
    return {
      id: 'claim-corner',
      title: 'Start with a corner',
      instruction: 'Place your next stone near an empty corner.',
      why: 'Corners are easier to surround because the board edge helps you.',
      targetPoints: CORNER_TARGETS_9X9,
      conceptIds: ['corner-opening', 'territory'],
    };
  }

  if (input.moveCount <= 8) {
    return {
      id: 'extend-from-stone',
      title: 'Make your stones work together',
      instruction: 'Play near one of your stones without touching it directly.',
      why: 'Nearby stones support each other and sketch out future territory.',
      targetPoints: SIDE_TARGETS_9X9,
      conceptIds: ['shape', 'direction-of-play'],
    };
  }

  return {
    id: 'look-for-weak-groups',
    title: 'Check weak groups',
    instruction: 'Before playing, ask which stones have little room to escape.',
    why: 'Groups with few liberties need help or can become targets.',
    targetPoints: [],
    conceptIds: ['liberties', 'groups'],
  };
}
