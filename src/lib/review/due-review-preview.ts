import { PROBLEMS } from '@/lib/problems/problem-data';

const PROBLEM_BY_ID = new Map(PROBLEMS.map((problem) => [problem.id, problem]));
const DUE_REVIEW_PREVIEW_LIMIT = 3;

export function formatDueReviewPreview(problemIds: string[]): string | null {
  const dueProblems = problemIds
    .map((problemId) => PROBLEM_BY_ID.get(problemId))
    .filter((problem): problem is NonNullable<typeof problem> => problem !== undefined);

  if (dueProblems.length === 0) return null;

  const previewTitles = dueProblems
    .slice(0, DUE_REVIEW_PREVIEW_LIMIT)
    .map((problem) => problem.title);
  const hiddenCount = dueProblems.length - previewTitles.length;
  const hiddenText = hiddenCount > 0 ? `, +${hiddenCount} more` : '';

  return `${dueProblems.length} due: ${previewTitles.join(', ')}${hiddenText}.`;
}
