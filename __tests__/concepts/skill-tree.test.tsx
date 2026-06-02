// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillTree } from '@/components/concepts/SkillTree';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';

type MockMotionProps = {
  children?: ReactNode;
  initial?: unknown;
  animate?: unknown;
  transition?: unknown;
  [key: string]: unknown;
};

vi.mock('framer-motion', () => ({
  motion: (() => {
    const stripMotionProps = (props: MockMotionProps) => {
      const domProps = { ...props };
      delete domProps.initial;
      delete domProps.animate;
      delete domProps.transition;

      return domProps;
    };

    return {
      div: ({ children, ...props }: MockMotionProps) => (
        <div {...stripMotionProps(props)}>{children}</div>
      ),
      button: ({ children, ...props }: MockMotionProps) => (
        <button {...stripMotionProps(props)}>{children}</button>
      ),
    };
  })(),
}));

function clickButtonText(text: string) {
  const button = screen.getByText(text).closest('button');
  if (!button) throw new Error(`Expected "${text}" to be inside a button.`);

  fireEvent.click(button);
}

describe('SkillTree', () => {
  beforeEach(() => {
    useConceptStore.getState().resetAll();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().showSkillTree();
  });

  afterEach(() => cleanup());

  it('offers lesson and problem practice from a concept detail', () => {
    render(<SkillTree />);

    clickButtonText('Liberties');

    expect(screen.getByText('Practice this')).toBeTruthy();

    clickButtonText('Start lesson: Liberties: Breathing Room');

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('liberties');

    useGameStore.getState().showSkillTree();
    clickButtonText('Practice capture problems');

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('capture');
  });

  it('routes concepts without a direct lesson to matching problems', () => {
    render(<SkillTree />);

    clickButtonText('Sente & Gote');

    expect(screen.queryByText(/Start lesson:/)).toBeNull();

    clickButtonText('Practice endgame problems');

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('endgame');
  });
});
