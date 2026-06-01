import type { ProblemCategory } from '@/lib/problems/types';

export interface SenseiAction {
  id: string;
  label: string;
}

export type SenseiActionRoute =
  | { type: 'hint' }
  | { type: 'practice'; category: ProblemCategory }
  | { type: 'lesson'; lessonId: string };

const practiceActionToCategory: Record<string, ProblemCategory> = {
  'practice:capture': 'capture',
  'practice:life-and-death': 'life-and-death',
  'practice:reading': 'reading',
};

const lessonActionToId: Record<string, string> = {
  'lesson:liberties': 'liberties',
  'lesson:territory': 'territory',
  'lesson:eyes': 'eyes',
  'lesson:ko': 'ko',
  'lesson:ladder': 'ladder',
};

export function getSenseiActionRoute(actionId: string): SenseiActionRoute | null {
  if (actionId === 'hint') {
    return { type: 'hint' };
  }

  const category = practiceActionToCategory[actionId];
  if (category) {
    return { type: 'practice', category };
  }

  const lessonId = lessonActionToId[actionId];
  if (lessonId) {
    return { type: 'lesson', lessonId };
  }

  return null;
}
