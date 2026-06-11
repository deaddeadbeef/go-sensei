import { buildHesitationNudge, canOfferHesitationHint } from '@/hooks/useHesitationDetector';
import type { HesitationHintGateInput } from '@/hooks/useHesitationDetector';
import { createGame, passMove, playMove } from '@/lib/go-engine';

const baseInput: HesitationHintGateInput = {
  isAiThinking: false,
  phase: 'playing',
  appPhase: 'game',
  bubbleVisible: false,
  currentPlayer: 'black',
};

describe('hesitation detector', () => {
  it('offers hints only while the board is visible and black is thinking', () => {
    expect(canOfferHesitationHint(baseInput)).toBe(true);
  });

  it('does not interrupt learning path or practice surfaces', () => {
    expect(canOfferHesitationHint({ ...baseInput, appPhase: 'path' })).toBe(false);
    expect(canOfferHesitationHint({ ...baseInput, appPhase: 'lesson' })).toBe(false);
    expect(canOfferHesitationHint({ ...baseInput, appPhase: 'problem' })).toBe(false);
    expect(canOfferHesitationHint({ ...baseInput, appPhase: 'dashboard' })).toBe(false);
  });

  it('does not offer a player hint while Sensei is thinking or White is to play', () => {
    expect(canOfferHesitationHint({ ...baseInput, isAiThinking: true })).toBe(false);
    expect(canOfferHesitationHint({ ...baseInput, currentPlayer: 'white' })).toBe(false);
  });

  it('does not offer over another bubble or outside active play', () => {
    expect(canOfferHesitationHint({ ...baseInput, bubbleVisible: true })).toBe(false);
    expect(canOfferHesitationHint({ ...baseInput, phase: 'welcome' })).toBe(false);
    expect(canOfferHesitationHint({ ...baseInput, phase: 'finished' })).toBe(false);
  });

  it('nudges guided beginners with the current opening target', () => {
    const nudge = buildHesitationNudge(createGame(9), 'guided');

    expect(nudge.text).toContain('Your current job is Start with a corner');
    expect(nudge.text).toContain('Place your next stone near an empty corner. Try C7, G7, C3, or G3.');
    expect(nudge.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('updates the nudge after the learner claims a corner', () => {
    const firstMove = playMove(createGame(9), { x: 2, y: 2 });
    if (!firstMove.success) throw new Error('Opening move should be legal');

    const nudge = buildHesitationNudge(passMove(firstMove.newState), 'guided');

    expect(nudge.text).toContain('Your current job is Make your stones work together');
    expect(nudge.text).toContain('Play a one-space jump from one of your stones. Try E7 or C5.');
    expect(nudge.actions).toEqual([{ id: 'hint', label: 'Show targets' }]);
  });

  it('falls back to a general nudge outside beginner objectives', () => {
    const nudge = buildHesitationNudge(createGame(19), 'advanced');

    expect(nudge.text).toBe('Take your time. Want me to suggest a useful move?');
    expect(nudge.actions).toEqual([{ id: 'hint', label: 'Suggest a move' }]);
  });
});
