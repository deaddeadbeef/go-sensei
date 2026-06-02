import { describe, expect, it } from 'vitest';
import { getSenseiActionRoute } from '@/lib/coaching/sensei-actions';

describe('getSenseiActionRoute', () => {
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

  it('rejects malformed pressure comparison replay actions', () => {
    expect(getSenseiActionRoute('guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3')).toBeNull();
    expect(getSenseiActionRoute('guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,3')).toBeNull();
  });

  it('rejects malformed pressure defense replay actions', () => {
    expect(getSenseiActionRoute('guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,1')).toBeNull();
    expect(getSenseiActionRoute('guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,3:2,3')).toBeNull();
  });
});
