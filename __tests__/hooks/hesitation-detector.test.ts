import { canOfferHesitationHint } from '@/hooks/useHesitationDetector';
import type { HesitationHintGateInput } from '@/hooks/useHesitationDetector';

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
});
