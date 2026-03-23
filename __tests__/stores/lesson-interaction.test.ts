import { useGameStore } from '@/stores/game-store';
import { act } from '@testing-library/react';

beforeEach(() => {
  act(() => {
    useGameStore.getState().startNewGame();
  });
});

describe('lesson interaction state', () => {
  it('has default interaction state', () => {
    const store = useGameStore.getState();
    expect(store.lessonInteraction).toEqual({
      awaitingClick: false,
      prompt: null,
      expectedMove: null,
      wrongMoveHint: null,
      branchOnFail: null,
      acceptRadius: 0,
      attempts: 0,
      feedback: null,
    });
  });

  it('setLessonPrompt activates click mode', () => {
    act(() => {
      useGameStore.getState().setLessonPrompt({
        prompt: 'Click the star point',
        expectedMove: { x: 4, y: 4 },
        wrongMoveHint: 'Not there',
        branchOnFail: 0,
        acceptRadius: 0,
      });
    });
    const s = useGameStore.getState();
    expect(s.lessonInteraction.awaitingClick).toBe(true);
    expect(s.lessonInteraction.prompt).toBe('Click the star point');
    expect(s.lessonInteraction.expectedMove).toEqual({ x: 4, y: 4 });
  });

  it('checkLessonAnswer returns correct for exact match', () => {
    act(() => {
      useGameStore.getState().setLessonPrompt({
        prompt: 'Click here',
        expectedMove: { x: 4, y: 4 },
        wrongMoveHint: 'Wrong',
        branchOnFail: null,
        acceptRadius: 0,
      });
    });
    let result: string = '';
    act(() => {
      result = useGameStore.getState().checkLessonAnswer({ x: 4, y: 4 });
    });
    expect(result).toBe('correct');
    expect(useGameStore.getState().lessonInteraction.feedback).toBe('correct');
    expect(useGameStore.getState().lessonInteraction.awaitingClick).toBe(false);
  });

  it('checkLessonAnswer returns wrong for mismatch', () => {
    act(() => {
      useGameStore.getState().setLessonPrompt({
        prompt: 'Click here',
        expectedMove: { x: 4, y: 4 },
        wrongMoveHint: 'Nope',
        branchOnFail: null,
        acceptRadius: 0,
      });
    });
    let result: string = '';
    act(() => {
      result = useGameStore.getState().checkLessonAnswer({ x: 0, y: 0 });
    });
    expect(result).toBe('wrong');
    expect(useGameStore.getState().lessonInteraction.attempts).toBe(1);
    expect(useGameStore.getState().lessonInteraction.feedback).toBe('wrong');
  });

  it('acceptRadius allows nearby clicks', () => {
    act(() => {
      useGameStore.getState().setLessonPrompt({
        prompt: 'Click near here',
        expectedMove: { x: 4, y: 4 },
        wrongMoveHint: 'Too far',
        branchOnFail: null,
        acceptRadius: 1,
      });
    });
    let result: string = '';
    act(() => {
      result = useGameStore.getState().checkLessonAnswer({ x: 5, y: 4 });
    });
    expect(result).toBe('correct');
  });

  it('acceptRadius rejects too-far clicks', () => {
    act(() => {
      useGameStore.getState().setLessonPrompt({
        prompt: 'Click near here',
        expectedMove: { x: 4, y: 4 },
        wrongMoveHint: 'Too far',
        branchOnFail: null,
        acceptRadius: 1,
      });
    });
    let result: string = '';
    act(() => {
      result = useGameStore.getState().checkLessonAnswer({ x: 6, y: 4 });
    });
    expect(result).toBe('wrong');
  });

  it('clearLessonPrompt resets interaction state', () => {
    act(() => {
      useGameStore.getState().setLessonPrompt({
        prompt: 'Click here',
        expectedMove: { x: 4, y: 4 },
        wrongMoveHint: 'Wrong',
        branchOnFail: null,
        acceptRadius: 0,
      });
      useGameStore.getState().clearLessonPrompt();
    });
    const s = useGameStore.getState();
    expect(s.lessonInteraction.awaitingClick).toBe(false);
    expect(s.lessonInteraction.prompt).toBeNull();
    expect(s.lessonInteraction.attempts).toBe(0);
  });
});
