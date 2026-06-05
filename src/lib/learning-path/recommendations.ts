import type { ConceptMastery } from '@/lib/concepts/types';
import { LESSONS } from '@/lib/lessons/lesson-data';
import { PROBLEMS } from '@/lib/problems/problem-data';
import type { ProblemAttempt, ProblemCategory } from '@/lib/problems/types';
import {
  LESSON_TO_CONCEPTS,
  LESSON_TO_PROBLEM_CATEGORY,
  PROBLEM_CATEGORY_TO_CONCEPTS,
  problemCategoryTitle,
} from '@/lib/learning-path/concept-practice';

interface RecommendationGuidance {
  title: string;
  reason: string;
  focusConcepts: string[];
  actionLabel: string;
  practicePlan: string[];
}

export type LearningRecommendation =
  | ({
      kind: 'guided_intro';
    } & RecommendationGuidance)
  | ({
      kind: 'lesson';
      targetId: string;
    } & RecommendationGuidance)
  | ({
      kind: 'problem';
      filter: ProblemCategory;
    } & RecommendationGuidance)
  | ({
      kind: 'review';
    } & RecommendationGuidance)
  | ({
      kind: 'guided_game';
    } & RecommendationGuidance);

export interface RecommendationInput {
  completedLessons: string[];
  problemAttempts: ProblemAttempt[];
  dueReviewCount: number;
  hasStartedIntroGame: boolean;
  mastery: ConceptMastery[];
}

const PRACTICE_TARGET_BY_CATEGORY: Record<ProblemCategory, number> = {
  capture: 3,
  'life-and-death': 2,
  reading: 2,
  tesuji: 2,
  endgame: 2,
};
const GUIDED_GAME_MIN_COMPLETED_LESSONS = 4;
const GUIDED_GAME_MIN_SOLVED_PROBLEMS = 2;
const WEAK_MASTERY_LEVEL = 2;

const KNOWN_LESSON_IDS = new Set(LESSONS.map((lesson) => lesson.id));

export function getLearningRecommendation(input: RecommendationInput): LearningRecommendation {
  const completedLessonIds = new Set(
    input.completedLessons.filter((lessonId) => KNOWN_LESSON_IDS.has(lessonId)),
  );
  const solvedProblemIds = getSolvedProblemIds(input.problemAttempts);
  const weakIntroducedConcepts = getWeakIntroducedConcepts(completedLessonIds, input.mastery);

  if (input.dueReviewCount > 0) {
    return {
      kind: 'review',
      title: 'Review due concepts',
      reason: `${input.dueReviewCount} review item${input.dueReviewCount === 1 ? ' is' : 's are'} due before new material.`,
      focusConcepts: weakIntroducedConcepts,
      actionLabel: 'Review due cards',
      practicePlan: [
        'Solve the due positions before opening new material.',
        'Replay any missed solution line until the first move feels obvious.',
        'Return here when reviews are clear for the day.',
      ],
    };
  }

  if (!input.hasStartedIntroGame && completedLessonIds.size === 0 && solvedProblemIds.size === 0) {
    return {
      kind: 'guided_intro',
      title: 'First 9x9 guided game',
      reason: 'Start on a small board with one clear goal at a time.',
      focusConcepts: ['corner-opening', 'territory', 'liberties'],
      actionLabel: 'Start guided 9x9',
      practicePlan: [
        'Place the first stone near a corner instead of the center.',
        'Use the glowing target as the next board idea to test.',
        'Read the move insight after each turn and connect it to the board.',
      ],
    };
  }

  const firstIncompleteLesson = LESSONS.find((lesson) => !completedLessonIds.has(lesson.id));

  if (completedLessonIds.size === 0 && solvedProblemIds.size === 0 && firstIncompleteLesson) {
    return lessonRecommendation(firstIncompleteLesson.id, firstIncompleteLesson.title);
  }

  const pendingPractice = getPendingLessonPractice(completedLessonIds, solvedProblemIds);
  if (pendingPractice) {
    return problemRecommendation(
      pendingPractice.category,
      pendingPractice.solvedCount,
      pendingPractice.targetCount,
    );
  }

  if (
    completedLessonIds.size >= GUIDED_GAME_MIN_COMPLETED_LESSONS &&
    solvedProblemIds.size >= GUIDED_GAME_MIN_SOLVED_PROBLEMS
  ) {
    return guidedGameRecommendation(
      weakIntroducedConcepts.length > 0
        ? weakIntroducedConcepts
        : getIntroducedConcepts(completedLessonIds),
    );
  }

  if (firstIncompleteLesson) {
    return lessonRecommendation(firstIncompleteLesson.id, firstIncompleteLesson.title);
  }

  const practiceCategory = getLatestPracticeCategory(completedLessonIds);
  if (practiceCategory) {
    return problemRecommendation(
      practiceCategory,
      countSolvedProblemsForCategory(solvedProblemIds, practiceCategory),
    );
  }

  return guidedGameRecommendation(weakIntroducedConcepts);
}

function lessonRecommendation(targetId: string, lessonTitle: string): LearningRecommendation {
  return {
    kind: 'lesson',
    targetId,
    title: lessonTitle,
    reason: 'This is the next lesson in the learning path.',
    focusConcepts: [...(LESSON_TO_CONCEPTS[targetId] ?? [])],
    actionLabel: `Start lesson: ${lessonTitle}`,
    practicePlan: [
      'Read the idea, then prove it on the board checkpoint.',
      'Use the hint only after choosing your first answer.',
      'Finish the lesson to unlock the next recommendation.',
    ],
  };
}

function problemRecommendation(
  filter: ProblemCategory,
  solvedCount: number,
  targetCount = PRACTICE_TARGET_BY_CATEGORY[filter],
): LearningRecommendation {
  const remaining = Math.max(targetCount - solvedCount, 0);
  const practiceCategoryTitle = problemCategoryTitle(filter).toLowerCase();

  return {
    kind: 'problem',
    filter,
    title: `${problemCategoryTitle(filter)} problems`,
    reason:
      remaining > 0
        ? `Practice ${practiceCategoryTitle} until you solve ${remaining} more ${practiceCategoryTitle} problem${remaining === 1 ? '' : 's'}.`
        : 'Practice problems reinforce the lessons you have already completed.',
    focusConcepts: [...PROBLEM_CATEGORY_TO_CONCEPTS[filter]],
    actionLabel: `Open ${problemCategoryTitle(filter).toLowerCase()} problems`,
    practicePlan: [
      'Look for the forcing move before tapping the board.',
      'If you miss three times, study the shown solution line.',
      'Solve the same idea again later through review.',
    ],
  };
}

function getPendingLessonPractice(
  completedLessonIds: Set<string>,
  solvedProblemIds: Set<string>,
): { category: ProblemCategory; solvedCount: number; targetCount: number } | null {
  for (const lesson of LESSONS) {
    if (!completedLessonIds.has(lesson.id)) {
      continue;
    }

    const category = LESSON_TO_PROBLEM_CATEGORY[lesson.id];
    if (!category) {
      continue;
    }

    const targetCount = PRACTICE_TARGET_BY_CATEGORY[category];
    const solvedCount = countSolvedProblemsForCategory(solvedProblemIds, category);
    if (solvedCount < targetCount) {
      return { category, solvedCount, targetCount };
    }
  }

  return null;
}

function guidedGameRecommendation(focusConcepts: string[]): LearningRecommendation {
  return {
    kind: 'guided_game',
    title: 'Play a guided game',
    reason: 'You have enough lesson and problem practice to connect these ideas in play.',
    focusConcepts: [...focusConcepts],
    actionLabel: 'Continue guided game',
    practicePlan: [
      'Choose a move that matches the current objective.',
      'After the tutor replies, compare the move insight with your plan.',
      'Keep weak groups connected before expanding territory.',
    ],
  };
}

function getSolvedProblemIds(problemAttempts: ProblemAttempt[]): Set<string> {
  const knownProblemIds = new Set(PROBLEMS.map((problem) => problem.id));
  const solvedProblemIds = new Set<string>();

  for (const attempt of problemAttempts) {
    if (attempt.solved && knownProblemIds.has(attempt.problemId)) {
      solvedProblemIds.add(attempt.problemId);
    }
  }

  return solvedProblemIds;
}

function countSolvedProblemsForCategory(
  solvedProblemIds: Set<string>,
  category: ProblemCategory,
): number {
  return PROBLEMS.filter(
    (problem) => problem.category === category && solvedProblemIds.has(problem.id),
  ).length;
}

function getWeakIntroducedConcepts(
  completedLessonIds: Set<string>,
  mastery: ConceptMastery[],
): string[] {
  const masteryByConceptId = new Map(mastery.map((item) => [item.conceptId, item]));

  return getIntroducedConcepts(completedLessonIds).filter((conceptId) => {
    const level = masteryByConceptId.get(conceptId)?.level ?? 0;
    return level < WEAK_MASTERY_LEVEL;
  });
}

function getIntroducedConcepts(completedLessonIds: Set<string>): string[] {
  const introducedConcepts: string[] = [];
  const seenConcepts = new Set<string>();

  for (const lesson of LESSONS) {
    if (!completedLessonIds.has(lesson.id)) {
      continue;
    }

    for (const conceptId of LESSON_TO_CONCEPTS[lesson.id] ?? []) {
      if (!seenConcepts.has(conceptId)) {
        introducedConcepts.push(conceptId);
        seenConcepts.add(conceptId);
      }
    }
  }

  return introducedConcepts;
}

function getLatestPracticeCategory(completedLessonIds: Set<string>): ProblemCategory | null {
  for (let index = LESSONS.length - 1; index >= 0; index -= 1) {
    const lessonId = LESSONS[index].id;
    if (!completedLessonIds.has(lessonId)) {
      continue;
    }

    const category = LESSON_TO_PROBLEM_CATEGORY[lessonId];
    if (category) {
      return category;
    }
  }

  return null;
}
