import type { ConceptMastery } from '@/lib/concepts/types';
import { CONCEPTS } from '@/lib/concepts/concept-data';
import {
  getLearningRecommendation,
  type LearningRecommendation,
} from '@/lib/learning-path/recommendations';
import { LESSONS } from '@/lib/lessons/lesson-data';
import { PROBLEMS } from '@/lib/problems/problem-data';
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
const lessonIds = new Set(LESSONS.map((lesson) => lesson.id));
const problemIds = new Set(PROBLEMS.map((problem) => problem.id));

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

function uniqueConceptIds(conceptIds: string[]): string[] {
  return [...new Set(conceptIds)];
}

function isProgressReflectionQuestionText(q: string): boolean {
  return /\bhow\s+(am|m)\s+i\s+doing\b/.test(q)
    || /\bam\s+i\s+(doing\s+)?(well|ok|okay|improving|getting\s+better)\b/.test(q)
    || /\bhow\s+is\s+my\s+progress\b/.test(q)
    || /\bwhat\s+progress\s+have\s+i\s+made\b/.test(q)
    || /\bwhat\s+(have|did)\s+i\s+learn(ed)?\b/.test(q)
    || /\bwhat\s+am\s+i\s+learning\b/.test(q)
    || /\bwhat\s+do\s+i\s+know\b/.test(q);
}

function isStudyPlanQuestionText(q: string): boolean {
  return /\bwhat\s+should\s+i\s+(study|learn|practice)\b/.test(q)
    || /\bwhat\s+should\s+i\s+(focus|work)\s+on\b/.test(q)
    || /\bwhat\s+do\s+i\s+need\s+to\s+work\s+on\b/.test(q)
    || /\bwhat\s+should\s+i\s+do\s+next\b/.test(q)
    || /\bwhere\s+should\s+i\s+go\s+next\b/.test(q)
    || /\bwhat\s+do\s+i\s+do\s+next\b/.test(q)
    || /\b(study|learn|practice)\s+next\b/.test(q)
    || /\bnext\s+(lesson|study|practice|focus)\b/.test(q)
    || /\brecommended\s+(next|focus|lesson|practice)\b/.test(q)
    || /\blearning\s+path\b/.test(q);
}

export function isStudyPlanQuestion(question: string): boolean {
  const q = normalizedQuestion(question);

  return isProgressReflectionQuestionText(q) || isStudyPlanQuestionText(q);
}

function actionForRecommendation(recommendation: LearningRecommendation): SenseiAction {
  switch (recommendation.kind) {
    case 'guided_intro':
      return { id: 'guided:intro', label: recommendation.actionLabel };
    case 'lesson':
      return { id: `lesson:${recommendation.targetId}`, label: recommendation.actionLabel };
    case 'problem':
      if (recommendation.targetProblemId) {
        return { id: `problem:${recommendation.targetProblemId}`, label: recommendation.actionLabel };
      }
      return { id: `practice:${recommendation.filter}`, label: recommendation.actionLabel };
    case 'review':
      return { id: 'review', label: recommendation.actionLabel };
    case 'guided_game':
      return { id: 'guided:game', label: recommendation.actionLabel };
  }
}

function plural(count: number, singular: string, pluralWord = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function completedLessonCount(completedLessons: string[]): number {
  return completedLessons.filter((lessonId) => lessonIds.has(lessonId)).length;
}

function knownProblemAttempts(problemAttempts: ProblemAttempt[]): ProblemAttempt[] {
  return problemAttempts.filter((attempt) => problemIds.has(attempt.problemId));
}

function solvedProblemCount(problemAttempts: ProblemAttempt[]): number {
  return new Set(problemAttempts
    .filter((attempt) => attempt.solved && problemIds.has(attempt.problemId))
    .map((attempt) => attempt.problemId)).size;
}

function progressSummary(input: LocalStudyPlanInput): string {
  const completedCount = completedLessonCount(input.completedLessons);
  const lessonText = completedCount === 0
    ? 'completed no lessons'
    : `completed ${plural(completedCount, 'lesson')}`;
  const solvedCount = solvedProblemCount(input.problemAttempts);
  const problemText = solvedCount === 0
    ? 'solved no problems'
    : `solved ${plural(solvedCount, 'problem')}`;
  const guidedText = input.hasStartedIntroGame
    ? 'started a guided 9x9 game'
    : 'not started a guided 9x9 game yet';

  return `${lessonText}, ${problemText}, and ${guidedText}`;
}

function strongestConcepts(mastery: ConceptMastery[]): ConceptMastery[] {
  return mastery
    .filter((item) => item.level >= 2)
    .sort((a, b) => b.level - a.level
      || b.encounterCount - a.encounterCount
      || b.lastSeen - a.lastSeen
      || a.conceptId.localeCompare(b.conceptId))
    .slice(0, 3);
}

function introducedConcepts(mastery: ConceptMastery[]): ConceptMastery[] {
  return mastery
    .filter((item) => item.level === 1)
    .sort((a, b) => b.encounterCount - a.encounterCount
      || b.lastSeen - a.lastSeen
      || a.conceptId.localeCompare(b.conceptId))
    .slice(0, 3);
}

function buildProgressReflectionAnswer(
  input: LocalStudyPlanInput,
  recommendation: LearningRecommendation,
): LocalQuestionAnswer {
  const strongConcepts = strongestConcepts(input.mastery);
  const introduced = introducedConcepts(input.mastery);
  const strongLabels = strongConcepts.map((item) => conceptLabel(item.conceptId));
  const introducedLabels = introduced.map((item) => conceptLabel(item.conceptId));
  const focusLabels = recommendation.focusConcepts.map(conceptLabel).slice(0, 4);
  const firstStep = recommendation.practicePlan[0];
  const hasEvidence = completedLessonCount(input.completedLessons) > 0
    || knownProblemAttempts(input.problemAttempts).length > 0
    || input.hasStartedIntroGame
    || input.mastery.length > 0;

  return {
    text: [
      `Progress check: you have ${progressSummary(input)}.`,
      hasEvidence
        ? 'That is real evidence: lessons build vocabulary, problems test reading, and guided games connect both to live moves.'
        : 'That is not a failure; it means the tutor needs one visible move or lesson before it can judge your Go.',
      strongLabels.length > 0
        ? `Strongest evidence: ${joinList(strongLabels)} ${strongLabels.length === 1 ? 'is' : 'are'} moving from vocabulary into practice.`
        : '',
      introducedLabels.length > 0
        ? `Still fragile: ${joinList(introducedLabels)} ${introducedLabels.length === 1 ? 'needs' : 'need'} more proof.`
        : '',
      `Next honest step: ${recommendation.title}. ${recommendation.reason}`,
      `Finish line: ${recommendation.finishLine}`,
      focusLabels.length ? `Keep attention on ${joinList(focusLabels)}.` : '',
      firstStep ? `First: ${firstStep}` : '',
    ].filter(Boolean).join(' '),
    conceptIds: uniqueConceptIds([
      ...recommendation.focusConcepts,
      ...strongConcepts.map((item) => item.conceptId),
      ...introduced.map((item) => item.conceptId),
    ]),
    actions: [actionForRecommendation(recommendation)],
  };
}

export function getLocalStudyPlanAnswer(
  question: string,
  input: LocalStudyPlanInput,
): LocalQuestionAnswer | null {
  if (!isStudyPlanQuestion(question)) return null;

  const recommendation = getLearningRecommendation(input);
  const q = normalizedQuestion(question);

  if (isProgressReflectionQuestionText(q)) {
    return buildProgressReflectionAnswer(input, recommendation);
  }

  const focusLabels = recommendation.focusConcepts.map(conceptLabel).slice(0, 4);
  const firstStep = recommendation.practicePlan[0];
  const secondStep = recommendation.practicePlan[1];

  return {
    text: [
      `Study plan: ${recommendation.title}.`,
      recommendation.reason,
      `Finish line: ${recommendation.finishLine}`,
      focusLabels.length ? `Focus on ${joinList(focusLabels)}.` : '',
      firstStep ? `First: ${firstStep}` : '',
      secondStep ? `Then: ${secondStep}` : '',
    ].filter(Boolean).join(' '),
    conceptIds: recommendation.focusConcepts,
    actions: [actionForRecommendation(recommendation)],
  };
}
