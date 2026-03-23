import type { Point, StoneColor, BoardSize } from '@/lib/go-engine/types';

export type ProblemCategory =
  | 'capture'
  | 'life-and-death'
  | 'tesuji'
  | 'reading'
  | 'endgame';

export type ProblemDifficulty = 1 | 2 | 3 | 4 | 5;

export interface MoveNode {
  move: Point;
  isCorrect: boolean;
  label?: string;
  responses: MoveNode[];
}

export interface ProblemStone {
  point: Point;
  color: StoneColor;
}

export interface Problem {
  id: string;
  title: string;
  category: ProblemCategory;
  difficulty: ProblemDifficulty;
  boardSize: BoardSize;
  description: string;
  setupStones: ProblemStone[];
  solutionTree: MoveNode[];
  hint?: string;
  playerColor: StoneColor;
}

export interface ProblemAttempt {
  problemId: string;
  solved: boolean;
  attempts: number;
  moveSequence: Point[];
  timestamp: number;
}

export interface ProblemProgress {
  problemId: string;
  bestResult: 'unseen' | 'failed' | 'solved' | 'mastered';
  attempts: number;
  lastAttempted: number | null;
}
