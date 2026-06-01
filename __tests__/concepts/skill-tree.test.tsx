// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SkillTree } from '@/components/concepts/SkillTree';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';

describe('SkillTree', () => {
  beforeEach(() => {
    useConceptStore.getState().resetAll();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().showSkillTree();
  });

  afterEach(() => cleanup());

  it('offers lesson and problem practice from a concept detail', () => {
    render(<SkillTree />);

    fireEvent.click(screen.getByRole('button', { name: 'Liberties' }));

    expect(screen.getByText('Practice this')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start lesson: Liberties: Breathing Room' }));

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('liberties');

    useGameStore.getState().showSkillTree();
    fireEvent.click(screen.getByRole('button', { name: 'Practice capture problems' }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
  });

  it('routes concepts without a direct lesson to matching problems', () => {
    render(<SkillTree />);

    fireEvent.click(screen.getByRole('button', { name: 'Sente & Gote' }));

    expect(screen.queryByText(/Start lesson:/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Practice endgame problems' }));

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('endgame');
  });
});
