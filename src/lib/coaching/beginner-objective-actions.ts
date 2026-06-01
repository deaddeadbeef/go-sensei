import type { BeginnerObjective } from '@/lib/coaching/beginner-objectives';
import type { SenseiAction } from '@/lib/coaching/sensei-actions';

export function getBeginnerObjectiveLessonAction(objective: BeginnerObjective): SenseiAction | null {
  if (objective.conceptIds.includes('liberties') || objective.conceptIds.includes('groups')) {
    return { id: 'lesson:liberties', label: 'Review liberties' };
  }

  if (objective.conceptIds.includes('territory') || objective.conceptIds.includes('corner-opening')) {
    return { id: 'lesson:territory', label: 'Review territory' };
  }

  return null;
}

export function getBeginnerObjectiveActions(objective: BeginnerObjective): SenseiAction[] {
  const actions: SenseiAction[] = objective.targetPoints.length > 0
    ? [{ id: 'hint', label: 'Show targets' }]
    : [];
  const lessonAction = getBeginnerObjectiveLessonAction(objective);

  if (lessonAction) actions.push(lessonAction);

  return actions;
}
