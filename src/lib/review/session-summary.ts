import { problemCategoryTitle } from '@/lib/learning-path/concept-practice';
import type { BoardSize } from '@/lib/go-engine/types';
import { PROBLEMS } from '@/lib/problems/problem-data';
import { formatProblemPoint, getPrimarySolutionLine } from '@/lib/problems/solution-review';
import type { Problem, ProblemCategory } from '@/lib/problems/types';

export interface ReviewSessionResult {
  problemId: string;
  solved: boolean;
  attempts: number;
}

export interface ReviewSessionSummary {
  solvedCount: number;
  totalCount: number;
  accuracy: number;
  tone: 'repair' | 'reinforce' | 'advance';
  headline: string;
  nextStep: string;
  practiceCategory: ProblemCategory | null;
  practiceCategoryTitle: string | null;
  practiceLabel: string | null;
  attentionProblems: Array<{
    problem: Problem;
    solved: boolean;
    attempts: number;
    replayMoveLabel: string | null;
  }>;
}

const PROBLEM_BY_ID = new Map(PROBLEMS.map((problem) => [problem.id, problem]));

function resultProblem(result: ReviewSessionResult): Problem | null {
  return PROBLEM_BY_ID.get(result.problemId) ?? null;
}

function getReplayMoveLabel(problem: Problem): string | null {
  const firstStudentStep = getPrimarySolutionLine(problem).find((step) => step.role === 'student') ?? null;
  return firstStudentStep
    ? formatProblemPoint(firstStudentStep.move, problem.boardSize as BoardSize)
    : null;
}

export function buildReviewSessionSummary(results: ReviewSessionResult[]): ReviewSessionSummary {
  const solvedCount = results.filter((result) => result.solved).length;
  const totalCount = results.length;
  const accuracy = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  const missedResults = results.filter((result) => !result.solved);
  const attentionResults = results.filter((result) => !result.solved || result.attempts > 1);
  const focusResult = missedResults[0] ?? attentionResults[0] ?? null;
  const focusProblem = focusResult ? resultProblem(focusResult) : null;
  const practiceCategory = focusProblem?.category ?? null;
  const practiceCategoryTitle = practiceCategory ? problemCategoryTitle(practiceCategory) : null;
  const attentionProblems = attentionResults
    .map((result) => {
      const problem = resultProblem(result);
      return problem
        ? {
            problem,
            solved: result.solved,
            attempts: result.attempts,
            replayMoveLabel: getReplayMoveLabel(problem),
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (missedResults.length > 0 && practiceCategoryTitle) {
    return {
      solvedCount,
      totalCount,
      accuracy,
      tone: 'repair',
      headline: `Rebuild ${practiceCategoryTitle}`,
      nextStep: 'Review the missed pattern now, then try a filtered set before adding new material.',
      practiceCategory,
      practiceCategoryTitle,
      practiceLabel: `Practice ${practiceCategoryTitle}`,
      attentionProblems,
    };
  }

  if (attentionResults.length > 0 && practiceCategoryTitle) {
    return {
      solvedCount,
      totalCount,
      accuracy,
      tone: 'reinforce',
      headline: `Make ${practiceCategoryTitle} automatic`,
      nextStep: 'You found the answer, but it took extra reading. Repeat the pattern once while it is fresh.',
      practiceCategory,
      practiceCategoryTitle,
      practiceLabel: `Drill ${practiceCategoryTitle}`,
      attentionProblems,
    };
  }

  return {
    solvedCount,
    totalCount,
    accuracy,
    tone: 'advance',
    headline: 'Ready for the next idea',
    nextStep: 'Every review landed cleanly. Move back to the path and pick up the next recommendation.',
    practiceCategory: null,
    practiceCategoryTitle: null,
    practiceLabel: null,
    attentionProblems: [],
  };
}
