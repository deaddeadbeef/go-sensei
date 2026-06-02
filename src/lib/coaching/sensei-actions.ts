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
  | {
      type: 'guided_read_pressure';
      mode: 'branch' | 'recount' | 'comparison' | 'defense';
      promptKey: string;
      replyKey: string;
      comparedReplyKey?: string;
      defensePointKey?: string;
    }
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

  if (actionId.startsWith('guided:read-pressure:')) {
    const [, , mode, promptKey, replyKey, comparedReplyKey, defensePointKey] = actionId.split(':');
    if (
      (mode !== 'branch' && mode !== 'recount' && mode !== 'comparison' && mode !== 'defense')
      || !promptKey
      || !replyKey
    ) return null;
    if (mode === 'comparison' || mode === 'defense') {
      if (!comparedReplyKey || comparedReplyKey === replyKey) return null;
      if (mode === 'defense') {
        if (!defensePointKey) return null;

        return {
          type: 'guided_read_pressure',
          mode,
          promptKey,
          replyKey,
          comparedReplyKey,
          defensePointKey,
        };
      }

      return { type: 'guided_read_pressure', mode, promptKey, replyKey, comparedReplyKey };
    }

    return { type: 'guided_read_pressure', mode, promptKey, replyKey };
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
