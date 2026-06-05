import { PROBLEMS } from '@/lib/problems/problem-data';
import type { Problem, ProblemAttempt } from '@/lib/problems/types';

const PROBLEM_IDS = new Set(PROBLEMS.map((problem) => problem.id));

export function getSolvedProblemIds(problemAttempts: ProblemAttempt[]): Set<string> {
  return new Set(
    problemAttempts
      .filter((attempt) => attempt.solved && PROBLEM_IDS.has(attempt.problemId))
      .map((attempt) => attempt.problemId),
  );
}

export function getRecommendedProblem(
  problemAttempts: ProblemAttempt[],
  problems: Problem[] = PROBLEMS,
): Problem | null {
  const solvedIds = getSolvedProblemIds(problemAttempts);

  return problems.find((problem) => !solvedIds.has(problem.id)) ?? problems[0] ?? null;
}
