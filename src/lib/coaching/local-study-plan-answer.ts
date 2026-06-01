import type { ConceptMastery } from '@/lib/concepts/types';
import { CONCEPTS } from '@/lib/concepts/concept-data';
import {
  getLearningRecommendation,
  type LearningRecommendation,
} from '@/lib/learning-path/recommendations';
import type { ProblemAttempt } from '@/lib/problems/types';
import type { LocalQuestionAnswer } from '@/lib/coaching/local-question-answer';
import type { SenseiAction } from '@/lib/coaching/sensei-actions';

interface LocalStudyPlanInput {
  completedLessons: string[];
  problemAttempts: ProblemAttempt[];
  dueReviewCount: number;
  hasStartedIntroGame: boolean;
  mastery: ConceptMastery[];
}

const conceptNameById = new Map(CONCEPTS.map((concept) => [concept.id, concept.name]));

function normalizedQuestion(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
}

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function conceptLabel(conceptId: string): string {
  return conceptNameById.get(conceptId) ?? conceptId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function isStudyPlanQuestion(question: string): boolean {
  const q = normalizedQuestion(question);

  return /\bwhat\s+should\s+i\s+(study|learn|practice)\b/.test(q)
    || /\bwhat\s+am\s+i\s+(learning|practicing)\b/.test(q)
    || /\b(study|learn|practice)\s+next\b/.test(q)
    || /\bnext\s+(lesson|study|practice|focus)\b/.test(q)
    || /\brecommended\s+(next|focus|lesson|practice)\b/.test(q)
    || /\blearning\s+path\b/.test(q);
}

function actionForRecommendation(recommendation: LearningRecommendation): SenseiAction {
  switch (recommendation.kind) {
    case 'guided_intro':
      return { id: 'guided:intro', label: recommendation.actionLabel };
    case 'lesson':
      return { id: `lesson:${recommendation.targetId}`, label: recommendation.actionLabel };
    case 'problem':
      return { id: `practice:${recommendation.filter}`, label: recommendation.actionLabel };
    case 'review':
      return { id: 'review', label: recommendation.actionLabel };
    case 'guided_game':
      return { id: 'guided:game', label: recommendation.actionLabel };
  }
}

export function getLocalStudyPlanAnswer(
  question: string,
  input: LocalStudyPlanInput,
): LocalQuestionAnswer | null {
  if (!isStudyPlanQuestion(question)) return null;

  const recommendation = getLearningRecommendation(input);
  const focusLabels = recommendation.focusConcepts.map(conceptLabel).slice(0, 4);
  const firstStep = recommendation.practicePlan[0];
  const secondStep = recommendation.practicePlan[1];

  return {
    text: [
      `Study plan: ${recommendation.title}.`,
      recommendation.reason,
      focusLabels.length ? `Focus on ${joinList(focusLabels)}.` : '',
      firstStep ? `First: ${firstStep}` : '',
      secondStep ? `Then: ${secondStep}` : '',
    ].filter(Boolean).join(' '),
    conceptIds: recommendation.focusConcepts,
    actions: [actionForRecommendation(recommendation)],
  };
}
