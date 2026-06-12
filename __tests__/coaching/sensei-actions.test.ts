import { describe, expect, it } from 'vitest';
import { getSenseiActionRoute } from '@/lib/coaching/sensei-actions';

describe('getSenseiActionRoute', () => {
  it('routes learning path actions', () => {
    expect(getSenseiActionRoute('path')).toEqual({
      type: 'learning_path',
    });
  });

  it('routes exact problem replay actions', () => {
    expect(getSenseiActionRoute('problem:life-001')).toEqual({
      type: 'problem',
      problemId: 'life-001',
    });
  });

  it('rejects unknown exact problem replay actions', () => {
    expect(getSenseiActionRoute('problem:not-real')).toBeNull();
  });

  it('routes pressure comparison replay actions with both reply keys', () => {
    expect(getSenseiActionRoute(
      'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1',
    )).toEqual({
      type: 'guided_read_pressure',
      mode: 'comparison',
      promptKey: 'read-pressure-2,2-4,2-3,2',
      replyKey: '3,3',
      comparedReplyKey: '3,1',
    });
  });

  it('routes pressure replay actions with a pinned sequence step', () => {
    expect(getSenseiActionRoute(
      'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1:pin:reply-3,1',
    )).toEqual({
      type: 'guided_read_pressure',
      mode: 'comparison',
      promptKey: 'read-pressure-2,2-4,2-3,2',
      replyKey: '3,3',
      comparedReplyKey: '3,1',
      pinnedSequenceStepKey: 'reply-3,1',
    });
  });

  it('routes pressure defense replay actions with compared and defense keys', () => {
    expect(getSenseiActionRoute(
      'guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3',
    )).toEqual({
      type: 'guided_read_pressure',
      mode: 'defense',
      promptKey: 'read-pressure-2,2-4,2-3,2',
      replyKey: '3,3',
      comparedReplyKey: '3,1',
      defensePointKey: '2,3',
    });
  });

  it('routes pressure follow-up defense replay actions with both defense keys', () => {
    expect(getSenseiActionRoute(
      'guided:read-pressure:follow-up-defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3:4,1',
    )).toEqual({
      type: 'guided_read_pressure',
      mode: 'follow-up-defense',
      promptKey: 'read-pressure-2,2-4,2-3,2',
      replyKey: '3,3',
      comparedReplyKey: '3,1',
      defensePointKey: '2,3',
      followUpDefensePointKey: '4,1',
    });
  });

  it('rejects malformed pressure comparison replay actions', () => {
    expect(getSenseiActionRoute('guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3')).toBeNull();
    expect(getSenseiActionRoute('guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,3')).toBeNull();
  });

  it('rejects malformed pressure defense replay actions', () => {
    expect(getSenseiActionRoute('guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,1')).toBeNull();
    expect(getSenseiActionRoute('guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,3:2,3')).toBeNull();
    expect(getSenseiActionRoute('guided:read-pressure:follow-up-defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3')).toBeNull();
    expect(getSenseiActionRoute('guided:read-pressure:follow-up-defense:read-pressure-2,2-4,2-3,2:3,3:3,3:2,3:4,1')).toBeNull();
  });

  it('rejects malformed pressure sequence pin suffixes', () => {
    expect(getSenseiActionRoute(
      'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1:pin',
    )).toBeNull();
    expect(getSenseiActionRoute(
      'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1:pin:unknown-3,1',
    )).toBeNull();
    expect(getSenseiActionRoute(
      'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1:pin:reply-3,1:extra',
    )).toBeNull();
  });
});
