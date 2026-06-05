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

vi.mock('framer-motion', async () => {
  const { forwardRef } = await vi.importActual<typeof import('react')>('react');

  const stripMotionProps = (props: MockMotionProps) => {
    const domProps = { ...props };
    delete domProps.initial;
    delete domProps.animate;
    delete domProps.transition;

    return domProps;
  };

  const MotionDiv = forwardRef<HTMLDivElement, MockMotionProps>(({ children, ...props }, ref) => (
    <div ref={ref} {...stripMotionProps(props)}>{children}</div>
  ));
  MotionDiv.displayName = 'MockMotionDiv';

  return {
    motion: {
      div: MotionDiv,
      button: ({ children, ...props }: MockMotionProps) => (
        <button {...stripMotionProps(props)}>{children}</button>
      ),
    },
  };
});

function clickButtonText(text: string) {
  fireEvent.click(screen.getByRole('button', { name: text }));
}

describe('SkillTree', () => {
  beforeEach(() => {
    useConceptStore.getState().resetAll();
    useGameStore.getState().startNewGame(19);
    useGameStore.getState().showSkillTree();
  });

  afterEach(() => cleanup());

  it('surfaces the first unlocked concept as the next step', () => {
    render(<SkillTree />);

    const upNext = screen.getByTestId('skill-tree-up-next');

    expect(upNext.textContent).toContain('Up next');
    expect(upNext.textContent).toContain('Stones & Board');
    expect(upNext.textContent).toContain('The 19×19 grid, black and white stones, alternating play.');

    clickButtonText('Start lesson');

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('groups');
  });

  it('advances the next step to the first unseen unlocked concept', () => {
    useConceptStore.getState().setMasteryLevel('stones-and-board', 1);

    render(<SkillTree />);

    const upNext = screen.getByTestId('skill-tree-up-next');

    expect(upNext.textContent).toContain('Liberties');
    expect(upNext.textContent).toContain('Empty points adjacent to a stone or group.');

    clickButtonText('Start lesson');

    expect(useGameStore.getState().appPhase).toBe('lesson');
    expect(useGameStore.getState().currentLessonId).toBe('liberties');
  });

  it('offers lesson and problem practice from a concept detail', () => {
    useConceptStore.getState().setMasteryLevel('stones-and-board', 1);

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

  it('shows missing prerequisites instead of practice actions for locked concepts', () => {
    render(<SkillTree />);

    clickButtonText('Liberties');

    expect(screen.getByText('Locked for now')).toBeTruthy();
    expect(screen.getByText('Unlock first')).toBeTruthy();
    expect(screen.getByText('Build the prerequisite ideas before practicing this concept directly.')).toBeTruthy();
    expect(screen.getByText('View Stones & Board requirement')).toBeTruthy();
    expect(screen.queryByText('Practice this')).toBeNull();
    expect(screen.queryByText('Start lesson: Liberties: Breathing Room')).toBeNull();

    clickButtonText('View Stones & Board requirement');

    expect(screen.getByTestId('skill-tree-detail').textContent).toContain('Stones & Board');
  });

  it('scrolls selected concept details into view', () => {
    const scrollIntoView = vi.fn();
    let scheduledFrame: FrameRequestCallback | null = null;
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const originalRequestAnimationFrame = window.requestAnimationFrame;

    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        scheduledFrame = callback;
        return 1;
      },
    });

    try {
      render(<SkillTree />);

      clickButtonText('Liberties');
      scheduledFrame?.(0);

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    } finally {
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      });
      Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        value: originalRequestAnimationFrame,
      });
    }
  });

  it('routes concepts without a direct lesson to matching problems', () => {
    useConceptStore.getState().setMasteryLevel('scoring', 1);
    useConceptStore.getState().setMasteryLevel('atari', 1);

    render(<SkillTree />);

    clickButtonText('Sente & Gote');

    expect(screen.queryByText(/Start lesson:/)).toBeNull();

    clickButtonText('Practice endgame problems');

    expect(useGameStore.getState().appPhase).toBe('problems');
    expect(useGameStore.getState().preferredProblemFilter).toBe('endgame');
  });
});
