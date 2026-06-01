import type { ProblemCategory } from '@/lib/problems/types';
import { LESSONS } from '@/lib/lessons/lesson-data';

export interface SenseiAction {
  id: string;
  label: string;
}

export type SenseiActionRoute =
  | { type: 'hint' }
  | { type: 'review' }
  | { type: 'guided_intro' }
  | { type: 'guided_game' }
  | { type: 'practice'; category: ProblemCategory }
  | { type: 'lesson'; lessonId: string };

const problemCategories = new Set<string>([
  'capture',
  'life-and-death',
  'tesuji',
  'reading',
  'endgame',
]);
const lessonIds = new Set(LESSONS.map((lesson) => lesson.id));

function isProblemCategory(value: string): value is ProblemCategory {
  return problemCategories.has(value);
}

export function getSenseiActionRoute(actionId: string): SenseiActionRoute | null {
  if (actionId === 'hint') {
    return { type: 'hint' };
  }

  if (actionId === 'review') {
    return { type: 'review' };
  }

  if (actionId === 'guided:intro') {
    return { type: 'guided_intro' };
  }

  if (actionId === 'guided:game') {
    return { type: 'guided_game' };
  }

  if (actionId.startsWith('practice:')) {
    const category = actionId.slice('practice:'.length);
    if (!isProblemCategory(category)) return null;
    return { type: 'practice', category };
  }

  if (actionId.startsWith('lesson:')) {
    const lessonId = actionId.slice('lesson:'.length);
    if (!lessonIds.has(lessonId)) return null;
    return { type: 'lesson', lessonId };
  }

  return null;
}
