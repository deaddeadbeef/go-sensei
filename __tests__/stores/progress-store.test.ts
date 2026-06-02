import { act } from '@testing-library/react';
import { useProgressStore } from '@/stores/progress-store';
import { createGame } from '@/lib/go-engine';

describe('progress store', () => {
  it('deduplicates completed lessons', () => {
    act(() => {
      useProgressStore.getState().completeLesson('capture');
      useProgressStore.getState().completeLesson('capture');
    });

    expect(useProgressStore.getState().completedLessons).toEqual(['capture']);
  });

  it('tracks that the guided intro game has started', () => {
    act(() => useProgressStore.getState().markIntroGameStarted());

    expect(useProgressStore.getState().hasStartedIntroGame).toBe(true);
  });

  it('records problem attempts as long-term progress', () => {
    act(() => useProgressStore.getState().recordProblemAttempt({
      problemId: 'capture-001',
      solved: true,
      attempts: 1,
      moveSequence: [{ x: 0, y: 1 }],
      timestamp: 123,
    }));

    expect(useProgressStore.getState().problemAttempts).toEqual([
      {
        problemId: 'capture-001',
        solved: true,
        attempts: 1,
        moveSequence: [{ x: 0, y: 1 }],
        timestamp: 123,
      },
    ]);
  });

  it('stores a durable guided game snapshot with position history', () => {
    const game = createGame(9);

    act(() => useProgressStore.getState().saveGuidedGameSnapshot(game));

    expect(useProgressStore.getState().guidedGameSnapshot?.board.size).toBe(9);
    expect(useProgressStore.getState().guidedGameSnapshot?.positionHistory).toBeInstanceOf(Set);
    expect(localStorage.getItem('go-sensei-progress')).toContain('"__type":"Set"');

    act(() => useProgressStore.getState().resetAll());

    expect(useProgressStore.getState().guidedGameSnapshot).toBeNull();
  });
});
