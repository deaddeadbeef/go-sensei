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
      answerRevealed: false,
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
    expect(useGameStore.getState().lessonInteraction.answerRevealed).toBe(false);
  });

  it('reveals the answer after three wrong attempts', () => {
    act(() => {
      useGameStore.getState().setLessonPrompt({
        prompt: 'Click here',
        expectedMove: { x: 4, y: 4 },
        wrongMoveHint: 'Nope',
        branchOnFail: null,
        acceptRadius: 0,
      });
    });

    act(() => {
      useGameStore.getState().checkLessonAnswer({ x: 0, y: 0 });
      useGameStore.getState().checkLessonAnswer({ x: 1, y: 0 });
      useGameStore.getState().checkLessonAnswer({ x: 2, y: 0 });
    });

    const state = useGameStore.getState().lessonInteraction;
    expect(state.attempts).toBe(3);
    expect(state.answerRevealed).toBe(true);
    expect(state.awaitingClick).toBe(true);
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
    expect(s.lessonInteraction.answerRevealed).toBe(false);
  });

  it('completeLesson records progress and returns to the learning path', () => {
    act(() => {
      useGameStore.getState().startLesson('groups');
      useGameStore.setState({ currentStep: 4 });
      useGameStore.getState().completeLesson();
    });

    const state = useGameStore.getState();
    expect(state.appPhase).toBe('path');
    expect(state.currentLessonId).toBeNull();
    expect(state.currentStep).toBe(0);
    expect(state.completedLessons).toContain('groups');
  });
});
