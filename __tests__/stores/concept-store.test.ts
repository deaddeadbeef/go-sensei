import { act } from '@testing-library/react';
import { useConceptStore } from '@/stores/concept-store';

beforeEach(() => {
  act(() => useConceptStore.getState().resetAll());
});

describe('concept store', () => {
  it('getMastery returns default for unseen concept', () => {
    const m = useConceptStore.getState().getMastery('liberties');
    expect(m.level).toBe(0);
    expect(m.encounterCount).toBe(0);
  });

  it('recordEncounter promotes to introduced (level 1) on first encounter', () => {
    act(() => useConceptStore.getState().recordEncounter('liberties'));
    const m = useConceptStore.getState().getMastery('liberties');
    expect(m.level).toBe(1);
    expect(m.encounterCount).toBe(1);
  });

  it('recordEncounter promotes to practiced (level 2) after 3 encounters', () => {
    act(() => {
      for (let i = 0; i < 3; i++) useConceptStore.getState().recordEncounter('capture');
    });
    const m = useConceptStore.getState().getMastery('capture');
    expect(m.level).toBe(2);
    expect(m.encounterCount).toBe(3);
  });

  it('recordEncounter promotes to mastered (level 3) after 7 encounters', () => {
    act(() => {
      for (let i = 0; i < 7; i++) useConceptStore.getState().recordEncounter('groups');
    });
    const m = useConceptStore.getState().getMastery('groups');
    expect(m.level).toBe(3);
    expect(m.encounterCount).toBe(7);
  });

  it('setMasteryLevel directly sets the level', () => {
    act(() => useConceptStore.getState().setMasteryLevel('ko', 3));
    const m = useConceptStore.getState().getMastery('ko');
    expect(m.level).toBe(3);
  });

  it('getUnlockedConcepts includes root concepts (no prerequisites)', () => {
    const unlocked = useConceptStore.getState().getUnlockedConcepts();
    expect(unlocked).toContain('stones-and-board');
  });

  it('getUnlockedConcepts unlocks children when prerequisites met', () => {
    // 'liberties' requires 'stones-and-board' at level >= 1
    act(() => useConceptStore.getState().recordEncounter('stones-and-board'));
    const unlocked = useConceptStore.getState().getUnlockedConcepts();
    expect(unlocked).toContain('liberties');
  });

  it('getUnlockedConcepts does NOT unlock when prerequisites unmet', () => {
    // 'eyes' requires 'groups' AND 'capture' — neither introduced
    const unlocked = useConceptStore.getState().getUnlockedConcepts();
    expect(unlocked).not.toContain('eyes');
  });

  it('getNextToLearn returns unlocked but unseen concepts', () => {
    const next = useConceptStore.getState().getNextToLearn();
    expect(next).toContain('stones-and-board');
    // After encountering it, it should no longer be "next to learn"
    act(() => useConceptStore.getState().recordEncounter('stones-and-board'));
    const next2 = useConceptStore.getState().getNextToLearn();
    expect(next2).not.toContain('stones-and-board');
  });

  it('getStats returns correct counts', () => {
    act(() => {
      useConceptStore.getState().setMasteryLevel('stones-and-board', 1);
      useConceptStore.getState().setMasteryLevel('liberties', 2);
      useConceptStore.getState().setMasteryLevel('capture', 3);
    });
    const stats = useConceptStore.getState().getStats();
    expect(stats.introduced).toBe(1);
    expect(stats.practiced).toBe(1);
    expect(stats.mastered).toBe(1);
    expect(stats.total).toBeGreaterThanOrEqual(25);
  });

  it('resetAll clears all mastery data', () => {
    act(() => useConceptStore.getState().recordEncounter('ko'));
    act(() => useConceptStore.getState().resetAll());
    const m = useConceptStore.getState().getMastery('ko');
    expect(m.level).toBe(0);
  });
});
