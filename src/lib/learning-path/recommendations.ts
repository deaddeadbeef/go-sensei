import type { ConceptMastery } from '@/lib/concepts/types';
import { LESSONS } from '@/lib/lessons/lesson-data';
import { PROBLEMS } from '@/lib/problems/problem-data';
import type { ProblemAttempt, ProblemCategory } from '@/lib/problems/types';

export type LearningRecommendation =
  | {
      kind: 'guided_intro';
      title: string;
      reason: string;
      focusConcepts: string[];
    }
  | {
      kind: 'lesson';
      targetId: string;
      title: string;
      reason: string;
      focusConcepts: string[];
    }
  | {
      kind: 'problem';
      filter: ProblemCategory;
      title: string;
      reason: string;
      focusConcepts: string[];
    }
  | {
      kind: 'review';
      title: string;
      reason: string;
      focusConcepts: string[];
    }
  | {
      kind: 'guided_game';
      title: string;
      reason: string;
      focusConcepts: string[];
    };

export interface RecommendationInput {
  completedLessons: string[];
  problemAttempts: ProblemAttempt[];
  dueReviewCount: number;
  hasStartedIntroGame: boolean;
  mastery: ConceptMastery[];
}

const CAPTURE_PRACTICE_TARGET = 3;
const GUIDED_GAME_MIN_COMPLETED_LESSONS = 4;
const GUIDED_GAME_MIN_SOLVED_PROBLEMS = 2;
const WEAK_MASTERY_LEVEL = 2;

const KNOWN_LESSON_IDS = new Set(LESSONS.map((lesson) => lesson.id));

const LESSON_TO_CONCEPTS: Record<string, string[]> = {
  groups: ['groups'],
  liberties: ['liberties'],
  capture: ['capture', 'atari'],
  territory: ['territory'],
  eyes: ['eyes', 'life-and-death'],
  ko: ['ko'],
  ladder: ['ladder', 'reading'],
  net: ['net'],
  snapback: ['snapback', 'tesuji'],
  'territory-vs-influence': ['territory', 'influence', 'thickness'],
};

const LESSON_TO_PROBLEM_CATEGORY: Partial<Record<string, ProblemCategory>> = {
  capture: 'capture',
  eyes: 'life-and-death',
  ladder: 'reading',
  net: 'reading',
  snapback: 'tesuji',
  'territory-vs-influence': 'endgame',
};

const PROBLEM_CATEGORY_TO_CONCEPTS: Record<ProblemCategory, string[]> = {
  capture: ['capture', 'atari', 'liberties'],
  'life-and-death': ['eyes', 'life-and-death'],
  tesuji: ['tesuji', 'snapback', 'throw-in'],
  reading: ['reading', 'ladder', 'net'],
  endgame: ['sente-gote', 'endgame-counting', 'territory'],
};

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
    };
  }

  if (!input.hasStartedIntroGame && completedLessonIds.size === 0 && solvedProblemIds.size === 0) {
    return {
      kind: 'guided_intro',
      title: 'First 9x9 guided game',
      reason: 'Start on a small board with one clear goal at a time.',
      focusConcepts: ['corner-opening', 'territory', 'liberties'],
    };
  }

  const firstIncompleteLesson = LESSONS.find((lesson) => !completedLessonIds.has(lesson.id));

  if (completedLessonIds.size === 0 && solvedProblemIds.size === 0 && firstIncompleteLesson) {
    return lessonRecommendation(firstIncompleteLesson.id, firstIncompleteLesson.title);
  }

  const captureCategory = LESSON_TO_PROBLEM_CATEGORY.capture;
  if (completedLessonIds.has('capture') && captureCategory) {
    const solvedCaptureProblems = countSolvedProblemsForCategory(solvedProblemIds, captureCategory);
    if (solvedCaptureProblems < CAPTURE_PRACTICE_TARGET) {
      return problemRecommendation(captureCategory, solvedCaptureProblems);
    }
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
  };
}

function problemRecommendation(
  filter: ProblemCategory,
  solvedCount: number,
): LearningRecommendation {
  const remaining = Math.max(CAPTURE_PRACTICE_TARGET - solvedCount, 0);

  return {
    kind: 'problem',
    filter,
    title: `${problemCategoryTitle(filter)} problems`,
    reason:
      filter === 'capture' && remaining > 0
        ? `Practice capture until you solve ${remaining} more capture problem${remaining === 1 ? '' : 's'}.`
        : 'Practice problems reinforce the lessons you have already completed.',
    focusConcepts: [...PROBLEM_CATEGORY_TO_CONCEPTS[filter]],
  };
}

function guidedGameRecommendation(focusConcepts: string[]): LearningRecommendation {
  return {
    kind: 'guided_game',
    title: 'Play a guided game',
    reason: 'You have enough lesson and problem practice to connect these ideas in play.',
    focusConcepts: [...focusConcepts],
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

function problemCategoryTitle(category: ProblemCategory): string {
  switch (category) {
    case 'capture':
      return 'Capture';
    case 'life-and-death':
      return 'Life and death';
    case 'tesuji':
      return 'Tesuji';
    case 'reading':
      return 'Reading';
    case 'endgame':
      return 'Endgame';
  }
}
