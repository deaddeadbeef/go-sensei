import { LESSONS } from '@/lib/lessons/lesson-data';
import type { ProblemCategory } from '@/lib/problems/types';

export const LESSON_TO_CONCEPTS: Record<string, string[]> = {
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

export const LESSON_TO_PROBLEM_CATEGORY: Partial<Record<string, ProblemCategory>> = {
  capture: 'capture',
  eyes: 'life-and-death',
  ladder: 'reading',
  net: 'reading',
  snapback: 'tesuji',
  'territory-vs-influence': 'endgame',
};

export const PROBLEM_CATEGORY_TO_CONCEPTS: Record<ProblemCategory, string[]> = {
  capture: ['capture', 'atari', 'liberties'],
  'life-and-death': ['eyes', 'life-and-death'],
  tesuji: ['tesuji', 'snapback', 'throw-in'],
  reading: ['reading', 'ladder', 'net'],
  endgame: ['sente-gote', 'endgame-counting', 'territory'],
};

export function findLessonForConcept(conceptId: string) {
  return LESSONS.find((lesson) => LESSON_TO_CONCEPTS[lesson.id]?.includes(conceptId)) ?? null;
}

export function findProblemCategoryForConcept(conceptId: string): ProblemCategory | null {
  for (const [category, concepts] of Object.entries(PROBLEM_CATEGORY_TO_CONCEPTS)) {
    if (concepts.includes(conceptId)) {
      return category as ProblemCategory;
    }
  }

  return null;
}

export function problemCategoryTitle(category: ProblemCategory): string {
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
