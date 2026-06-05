// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LearningPath } from '@/components/hub/LearningPath';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import { useProgressStore } from '@/stores/progress-store';

describe('LearningPath', () => {
  beforeEach(() => {
    useProgressStore.getState().resetAll();
    useConceptStore.getState().resetAll();
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
});
