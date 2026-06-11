import type { ConceptMastery } from '@/lib/concepts/types';
import { LESSONS } from '@/lib/lessons/lesson-data';
import { PROBLEMS } from '@/lib/problems/problem-data';
import type { Problem, ProblemAttempt, ProblemCategory } from '@/lib/problems/types';
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
  finishLine: string;
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
      targetProblemId?: string;
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
const PROBLEM_BY_ID = new Map(PROBLEMS.map((problem) => [problem.id, problem]));

export function getLearningRecommendation(input: RecommendationInput): LearningRecommendation {
  const completedLessonIds = new Set(
    input.completedLessons.filter((lessonId) => KNOWN_LESSON_IDS.has(lessonId)),
  );
  const solvedProblemIds = getSolvedProblemIds(input.problemAttempts);
  const recentRepair = getRecentRepairCandidate(input.problemAttempts);
  const weakIntroducedConcepts = getWeakIntroducedConcepts(completedLessonIds, input.mastery);

  if (input.dueReviewCount > 0) {
    return {
      kind: 'review',
      title: 'Daily review',
      reason: `${input.dueReviewCount} review position${input.dueReviewCount === 1 ? ' is' : 's are'} due before new material.`,
      focusConcepts: weakIntroducedConcepts,
      actionLabel: 'Start daily review',
      finishLine: 'All due review cards are answered, and any miss has been replayed once.',
      practicePlan: [
        'Solve the due review positions before opening new material.',
        'Replay any missed solution line until the first move feels obvious.',
        'After the review summary, start the next recommendation while the memory is fresh.',
      ],
    };
  }

  if (recentRepair) {
    return repairProblemRecommendation(recentRepair.problem, recentRepair.attempt);
  }

  if (!input.hasStartedIntroGame && completedLessonIds.size === 0 && solvedProblemIds.size === 0) {
    return {
      kind: 'guided_intro',
      title: 'First 9x9 guided game',
      reason: 'Start on a small board with one clear goal at a time.',
      focusConcepts: ['corner-opening', 'territory', 'liberties'],
      actionLabel: 'Start guided 9x9',
      finishLine: 'The guided 9x9 is started and the first corner objective is visible on the board.',
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
    finishLine: 'The lesson is marked complete after you prove the idea on its board checkpoint.',
    practicePlan: [
      'Read the idea, then prove it on the board checkpoint.',
      'If the answer is shown, explain why it matches the hint before continuing.',
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
    finishLine:
      remaining > 0
        ? `This block is complete after ${remaining} more solved ${practiceCategoryTitle} problem${remaining === 1 ? '' : 's'}.`
        : `Solve one ${practiceCategoryTitle} problem cleanly, then review any miss.`,
    practicePlan: [
      'Look for the forcing move before tapping the board.',
      'If you miss three times, cover the numbers and explain the first solution move.',
      'Solve the same idea again later through review.',
    ],
  };
}

function repairProblemRecommendation(problem: Problem, attempt: ProblemAttempt): LearningRecommendation {
  const practiceCategoryTitle = problemCategoryTitle(problem.category);
  const practiceCategoryTitleLower = practiceCategoryTitle.toLowerCase();
  const missed = !attempt.solved;

  return {
    kind: 'problem',
    filter: problem.category,
    targetProblemId: problem.id,
    title: `${missed ? 'Repair' : 'Reinforce'} ${practiceCategoryTitle}`,
    reason: missed
      ? `Your latest miss was ${problem.title}. Repair that pattern before adding new material.`
      : `You solved ${problem.title}, but it took ${attempt.attempts} attempts. Repeat the idea while it is fresh.`,
    focusConcepts: [...PROBLEM_CATEGORY_TO_CONCEPTS[problem.category]],
    actionLabel: `${missed ? 'Replay' : 'Drill'} ${problem.title}`,
    finishLine: missed
      ? `Replay ${problem.title} once, then solve one ${practiceCategoryTitleLower} problem without a hint.`
      : `Solve one ${practiceCategoryTitleLower} problem on the first try, then continue with the next recommendation.`,
    practicePlan: [
      `Start by replaying the first solution move from ${problem.title}.`,
      `Name why the move works before trying another ${practiceCategoryTitleLower} problem.`,
      'Continue to new material only after one clean solve.',
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

function getRecentRepairCandidate(problemAttempts: ProblemAttempt[]): { problem: Problem; attempt: ProblemAttempt } | null {
  const candidate = problemAttempts
    .map((attempt, index) => ({ attempt, index }))
    .filter(({ attempt }) => PROBLEM_BY_ID.has(attempt.problemId))
    .sort((a, b) => b.attempt.timestamp - a.attempt.timestamp || b.index - a.index)[0]?.attempt;

  if (!candidate) return null;
  if (candidate.solved && candidate.attempts === 1) return null;

  const problem = PROBLEM_BY_ID.get(candidate.problemId);
  return problem ? { problem, attempt: candidate } : null;
}

function guidedGameRecommendation(focusConcepts: string[]): LearningRecommendation {
  return {
    kind: 'guided_game',
    title: 'Play a guided game',
    reason: 'You have enough lesson and problem practice to connect these ideas in play.',
    focusConcepts: [...focusConcepts],
    actionLabel: 'Continue guided game',
    finishLine: 'Play until the current objective is met and you can name why the move helped.',
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
