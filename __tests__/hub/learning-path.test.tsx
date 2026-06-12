// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LearningPath } from '@/components/hub/LearningPath';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';
import { useReviewStore } from '@/stores/review-store';

function makeReviewDue(problemId: string) {
  useReviewStore.getState().recordReview(problemId, 5);
  useReviewStore.setState((state) => ({
    cards: {
      ...state.cards,
      [problemId]: {
        ...state.cards[problemId],
        nextReviewDate: Date.now() - 1000,
      },
    },
  }));
}

describe('LearningPath', () => {
  beforeEach(() => {
    useProgressStore.getState().resetAll();
    useConceptStore.getState().resetAll();
    useReviewStore.getState().resetAll();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().showLearningPath();
  });

  afterEach(() => cleanup());

  it('renders learner-facing concept names instead of raw concept ids', () => {
    render(<LearningPath />);

    expect(screen.getAllByText('Corner Openings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Territory').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Liberties').length).toBeGreaterThan(0);
    expect(screen.getByText('Start guided 9x9')).toBeTruthy();
    expect(screen.getByText('Place the first stone near a corner instead of the center.')).toBeTruthy();
    expect(screen.getByText('Finish line:')).toBeTruthy();
    expect(screen.getByText('The guided 9x9 is started and the first corner objective is visible on the board.')).toBeTruthy();
    expect(screen.queryByText('corner-opening')).toBeNull();
  });

  it('starts the first guided board from the guided game path card', () => {
    render(<LearningPath />);

    fireEvent.click(screen.getByRole('button', { name: /Guided game: Play the first 9x9 with a goal\./ }));

    expect(useProgressStore.getState().hasStartedIntroGame).toBe(true);
    expect(useGameStore.getState().appPhase).toBe('game');
    expect(useGameStore.getState().teachingLevel).toBe('guided');
    expect(useGameStore.getState().game.board.size).toBe(9);
    expect(useConceptStore.getState().getMastery('stones-and-board').level).toBe(1);
    expect(useConceptStore.getState().getUnlockedConcepts()).toContain('groups');
  });

  it('names the recommended lesson in the primary path action', () => {
    useProgressStore.getState().markIntroGameStarted();

    render(<LearningPath />);

    expect(screen.getByRole('button', { name: 'Start lesson: What is a Group?' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start lesson: What is a Group?' }));

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('groups');
  });

  it('shows reliable progress totals in the path summary', () => {
    useProgressStore.setState({
      completedLessons: ['groups', 'stale-lesson-id'],
      problemAttempts: [
        { problemId: 'capture-001', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
        { problemId: 'missing-problem-id', solved: true, attempts: 1, moveSequence: [], timestamp: 1 },
        { problemId: 'capture-002', solved: false, attempts: 3, moveSequence: [], timestamp: 1 },
      ],
    });

    render(<LearningPath />);

    expect(screen.getByText('Lessons completed')).toBeTruthy();
    expect(screen.getByText('1/10')).toBeTruthy();
    expect(screen.getByText('Problems solved')).toBeTruthy();
    expect(screen.getByText('1/20')).toBeTruthy();
    expect(screen.getByText('Reviews due')).toBeTruthy();
    expect(screen.getByText('0 today')).toBeTruthy();
  });

  it('restores guided 9x9 from the guided game card when progress has a stale normal game', () => {
    useGameStore.getState().startGuidedIntroGame();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().setTeachingLevel('beginner');
    useGameStore.getState().showLearningPath();

    render(<LearningPath />);

    fireEvent.click(screen.getByRole('button', { name: /Guided game: Keep playing with one clear goal\./ }));

    expect(useProgressStore.getState().hasStartedIntroGame).toBe(true);
    expect(useGameStore.getState().appPhase).toBe('game');
    expect(useGameStore.getState().teachingLevel).toBe('guided');
    expect(useGameStore.getState().game.board.size).toBe(9);
    expect(useGameStore.getState().bubble.text).toContain('Your first job is: Start with a corner.');
  });

  it('opens the full problem picker from the problems path card', () => {
    render(<LearningPath />);

    fireEvent.click(screen.getByRole('button', { name: /Problems: Read one shape, then check it\./ }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBeNull();
  });

  it('makes the review path card truthful when no cards are due', () => {
    render(<LearningPath />);

    expect(screen.getByRole('button', { name: 'Review: No reviews due; follow the path first.' })).toBeTruthy();
  });

  it('offers review seeding after the path reaches problem practice', () => {
    useProgressStore.setState({
      hasStartedIntroGame: true,
      completedLessons: ['capture'],
    });

    render(<LearningPath />);

    expect(screen.getByRole('button', { name: "Review: No reviews due; seed tomorrow's queue." })).toBeTruthy();
  });

  it('shows the due review count in the review path card', () => {
    makeReviewDue('capture-001');
    makeReviewDue('life-001');

    render(<LearningPath />);

    expect(screen.getByText('Up now: 2 due: Corner Capture, Make Two Eyes.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review: 2 due: Corner Capture, Make Two Eyes.' })).toBeTruthy();
  });

  it('keeps long due review previews concise', () => {
    makeReviewDue('capture-001');
    makeReviewDue('capture-002');
    makeReviewDue('capture-003');
    makeReviewDue('capture-004');

    render(<LearningPath />);

    expect(screen.getByText('Up now: 4 due: Corner Capture, Edge Squeeze, Loose Ladder, +1 more.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review: 4 due: Corner Capture, Edge Squeeze, Loose Ladder, +1 more.' })).toBeTruthy();
  });

  it('starts the exact missed problem from a repair recommendation', () => {
    useProgressStore.setState({
      hasStartedIntroGame: true,
      problemAttempts: [
        { problemId: 'life-001', solved: false, attempts: 3, moveSequence: [], timestamp: 10 },
      ],
    });

    render(<LearningPath />);

    expect(screen.getByRole('heading', { name: 'Repair Life and Death' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Replay Make Two Eyes' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Replay Make Two Eyes' }));

    expect(useGameStore.getState().appPhase).toBe('problem');
    expect(useGameStore.getState().currentProblemId).toBe('life-001');
    expect(useGameStore.getState().preferredProblemFilter).toBe('life-and-death');
    expect(useGameStore.getState().problemInteraction.problem?.title).toBe('Make Two Eyes');
  });
});
