import type { Point } from '@/lib/go-engine/types';

export type HighlightColor = 'green' | 'red' | 'blue';

export interface LessonHighlight {
  point: Point;
  color: HighlightColor;
  label?: string;
}

export interface LessonStone {
  point: Point;
  color: 'black' | 'white';
}

export interface LessonStep {
  stones: LessonStone[];
  highlights: LessonHighlight[];
  text: string;
  prompt?: string;        // ask user to click a position
  expectedMove?: Point;   // correct answer for the prompt
  wrongMoveHint?: string;      // hint shown on wrong click
  branchOnFail?: number;       // step index to jump to on repeated failure
  acceptRadius?: number;       // how many intersections away still counts (0 = exact)
  boardSize?: number;     // override, default 9
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: string;
  steps: LessonStep[];
}
