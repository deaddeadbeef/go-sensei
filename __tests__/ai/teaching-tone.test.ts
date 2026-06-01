import { buildSystemPrompt, type TeachingLevel } from '@/lib/ai/system-prompt';
import { createGame } from '@/lib/go-engine';
import { formatHesitationMessage, formatReviewRequest } from '@/lib/ai/format-board';

const TEACHING_LEVELS: TeachingLevel[] = ['beginner', 'intermediate', 'advanced', 'guided'];
const PUNITIVE_PATTERNS = [
  /Go Demon/i,
  /\bcoddle\b/i,
  /\bpunish(?:es|ed|ing)?\b/i,
  /\bbrutal(?:ly)?\b/i,
  /\bdevastating\b/i,
  /No mercy/i,
  /Fix your priorities/i,
  /you're not reading the board/i,
];

describe('AI teaching tone', () => {
  it('keeps critique firm, specific, and constructive instead of punitive', () => {
    const systemPrompts = TEACHING_LEVELS.map((level) => buildSystemPrompt(level));
    const helperPrompts = [
      formatHesitationMessage(createGame(9)),
      formatReviewRequest(createGame(9)),
    ];

    for (const prompt of systemPrompts) {
      expect(prompt).toContain('honest');
      expect(prompt).toMatch(/specific|concrete|plain|concise/);
    }

    for (const prompt of [...systemPrompts, ...helperPrompts]) {
      for (const pattern of PUNITIVE_PATTERNS) {
        expect(prompt).not.toMatch(pattern);
      }
    }

    expect(buildSystemPrompt('beginner')).toContain('firm, honest, encouraging Go teacher');
    expect(formatReviewRequest(createGame(9))).toContain('Be honest, specific, and constructive.');
  });
});
