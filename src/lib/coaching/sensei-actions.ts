import type { ProblemCategory } from '@/lib/problems/types';
import { LESSONS } from '@/lib/lessons/lesson-data';
import { PROBLEMS } from '@/lib/problems/problem-data';
import type { Point } from '@/lib/go-engine/types';

export interface SenseiActionPreviewHighlight {
  id: string;
  point: Point;
  variant: 'positive' | 'warning' | 'danger' | 'neutral';
  label?: string;
}

export interface SenseiAction {
  id: string;
  label: string;
  previewHighlights?: SenseiActionPreviewHighlight[];
}

export type SenseiActionRoute =
  | { type: 'hint' }
  | { type: 'review' }
  | { type: 'guided_intro' }
  | { type: 'guided_game' }
  | { type: 'problem'; problemId: string }
  | {
      type: 'guided_read_pressure';
      mode: 'branch' | 'recount' | 'comparison' | 'defense' | 'follow-up-defense';
      promptKey: string;
      replyKey: string;
      comparedReplyKey?: string;
      defensePointKey?: string;
      followUpDefensePointKey?: string;
      pinnedSequenceStepKey?: string;
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
const problemIds = new Set(PROBLEMS.map((problem) => problem.id));

function isProblemCategory(value: string): value is ProblemCategory {
  return problemCategories.has(value);
}

function isPressureSequenceStepKey(value: string): boolean {
  return (
    value === 'gap'
    || /^(?:reply|recount|compare|defense|follow-up|handoff)-\d+,\d+$/.test(value)
  );
}

function getPinnedPressureSequenceStepKey(segments: string[]): string | null | undefined {
  if (segments.length === 0) return undefined;
  if (segments.length !== 2 || segments[0] !== 'pin' || !isPressureSequenceStepKey(segments[1])) return null;

  return segments[1];
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
    const segments = actionId.split(':');
    const [, , mode, promptKey, replyKey] = segments;
    if (
      (
        mode !== 'branch'
        && mode !== 'recount'
        && mode !== 'comparison'
        && mode !== 'defense'
        && mode !== 'follow-up-defense'
      )
      || !promptKey
      || !replyKey
    ) return null;

    const withPinnedSequenceStep = <T extends Extract<SenseiActionRoute, { type: 'guided_read_pressure' }>>(
      route: T,
      rest: string[],
    ): T | null => {
      const pinnedSequenceStepKey = getPinnedPressureSequenceStepKey(rest);
      if (pinnedSequenceStepKey === null) return null;
      if (!pinnedSequenceStepKey) return route;

      return { ...route, pinnedSequenceStepKey };
    };

    if (mode === 'comparison' || mode === 'defense' || mode === 'follow-up-defense') {
      const comparedReplyKey = segments[5];
      if (!comparedReplyKey || comparedReplyKey === replyKey) return null;
      if (mode === 'defense' || mode === 'follow-up-defense') {
        const defensePointKey = segments[6];
        if (!defensePointKey) return null;
        if (mode === 'follow-up-defense') {
          const followUpDefensePointKey = segments[7];
          if (!followUpDefensePointKey) return null;

          return withPinnedSequenceStep({
            type: 'guided_read_pressure',
            mode,
            promptKey,
            replyKey,
            comparedReplyKey,
            defensePointKey,
            followUpDefensePointKey,
          }, segments.slice(8));
        }

        return withPinnedSequenceStep({
          type: 'guided_read_pressure',
          mode,
          promptKey,
          replyKey,
          comparedReplyKey,
          defensePointKey,
        }, segments.slice(7));
      }

      return withPinnedSequenceStep({
        type: 'guided_read_pressure',
        mode,
        promptKey,
        replyKey,
        comparedReplyKey,
      }, segments.slice(6));
    }

    return withPinnedSequenceStep({
      type: 'guided_read_pressure',
      mode,
      promptKey,
      replyKey,
    }, segments.slice(5));
  }

  if (actionId.startsWith('practice:')) {
    const category = actionId.slice('practice:'.length);
    if (!isProblemCategory(category)) return null;
    return { type: 'practice', category };
  }

  if (actionId.startsWith('problem:')) {
    const problemId = actionId.slice('problem:'.length);
    if (!problemIds.has(problemId)) return null;
    return { type: 'problem', problemId };
  }

  if (actionId.startsWith('lesson:')) {
    const lessonId = actionId.slice('lesson:'.length);
    if (!lessonIds.has(lessonId)) return null;
    return { type: 'lesson', lessonId };
  }

  return null;
}
