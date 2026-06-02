// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BeginnerObjectiveCard } from '@/components/game/BeginnerObjectiveCard';
import { useGameStore } from '@/stores/game-store';

describe('BeginnerObjectiveCard', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
  });

  afterEach(() => cleanup());

  it('names the marked opening points for coordinate learners', () => {
    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('Start with a corner')).toBeTruthy();
    expect(screen.getByText('Try C7, G7, C3, or G3.')).toBeTruthy();
  });

  it('plays a named target from the objective card', () => {
    render(<BeginnerObjectiveCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Play C7 target for Start with a corner' }));

    const state = useGameStore.getState();
    const lastMove = state.game.moveHistory.at(-1);
    expect(lastMove).toMatchObject({
      type: 'place',
      color: 'black',
      point: { x: 2, y: 2 },
    });
    expect(state.lastPlayerMove).toEqual({ x: 2, y: 2 });
    expect(state.game.currentPlayer).toBe('white');
  });

  it('explains why a hovered opening target is useful before it is played', () => {
    render(<BeginnerObjectiveCard />);

    const target = screen.getByRole('button', { name: 'Play C7 target for Start with a corner' });
    expect(screen.queryByText('Why C7')).toBeNull();

    fireEvent.mouseEnter(target);

    expect(screen.getByText('Why C7')).toBeTruthy();
    expect(screen.getByText('C7 leans on the top and left edges, so Black needs fewer stones to sketch territory there.')).toBeTruthy();
    expect(useGameStore.getState().overlays.targetHints).toEqual([{
      id: 'target-hint-target-2,2',
      point: { x: 2, y: 2 },
      variant: 'positive',
      label: 'C7: suggested corner target.',
    }]);

    fireEvent.mouseLeave(target);

    expect(screen.queryByText('Why C7')).toBeNull();
    expect(useGameStore.getState().overlays.targetHints).toEqual([]);
  });

  it('names extension targets after the learner claims a corner', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('Make your stones work together')).toBeTruthy();
    expect(screen.getByText('Try E7 or C5.')).toBeTruthy();
  });

  it('explains the anchor and gap for a focused extension target', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    const target = screen.getByRole('button', { name: 'Play E7 target for Make your stones work together' });
    fireEvent.focus(target);

    expect(screen.getByText('Why E7')).toBeTruthy();
    expect(screen.getByText('E7 is a one-space jump from C7; D7 stays open so the two stones can work together without clumping.')).toBeTruthy();
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'target-hint-target-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: suggested one-space jump.',
      },
      {
        id: 'target-hint-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'neutral',
        label: 'C7: anchor stone for the jump.',
      },
      {
        id: 'target-hint-gap-3,2',
        point: { x: 3, y: 2 },
        variant: 'warning',
        label: 'D7: open gap that keeps the jump flexible.',
      },
    ]);

    fireEvent.blur(target);

    expect(screen.queryByText('Why E7')).toBeNull();
    expect(useGameStore.getState().overlays.targetHints).toEqual([]);
  });

  it('shows progress when the learner completes the previous objective', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('Good: C7 hit the marked corner goal. Next, make that stone work with another one.')).toBeTruthy();
    expect(screen.getByText('Make your stones work together')).toBeTruthy();
  });

  it('pins a compact recap near the board after the first guided move', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('What changed')).toBeTruthy();
    expect(screen.getByText('Corner anchor')).toBeTruthy();
    expect(screen.getByText('C7 is a useful anchor because the edge helps it surround space. Your next job is to make it work with another stone.')).toBeTruthy();
  });

  it('updates the board-side recap after the learner makes the extension shape', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('What changed')).toBeTruthy();
    expect(screen.getByText('One-space jump shape')).toBeTruthy();
    expect(screen.getByText('E7 is a one-space jump from C7. The empty point at D7 leaves room to grow while the two stones still work together.')).toBeTruthy();
  });

  it('keeps a compact read-next prompt for the open gap after a one-space jump', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('Read next')).toBeTruthy();
    expect(screen.getByText('Watch D7')).toBeTruthy();
    expect(screen.getByText('If White plays D7, the jump between C7 and E7 is under pressure. First read whether Black should connect or defend that gap before extending again.')).toBeTruthy();
  });

  it('shows the pressure variation for a completed one-space jump without playing a move', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));

    expect(screen.getByText('Pressure variation')).toBeTruthy();
    expect(screen.getByText('Imagine White plays D7. Compare three plans: connect by attacking the cutting stone at D8 or D6, defend a Black side that is short on liberties, or keep extending if both stones still have room.')).toBeTruthy();
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'neutral',
        label: 'C7: one side of the jump; check whether this side becomes short.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'neutral',
        label: 'E7: one side of the jump; check whether this side becomes short.',
      },
      {
        id: 'read-pressure-gap-3,2',
        point: { x: 3, y: 2 },
        variant: 'warning',
        label: 'D7: imagine White tests the open gap here.',
      },
      {
        id: 'read-pressure-reply-3,1',
        point: { x: 3, y: 1 },
        variant: 'positive',
        label: 'D8: first reply to read against the cutting stone.',
      },
      {
        id: 'read-pressure-reply-3,3',
        point: { x: 3, y: 3 },
        variant: 'positive',
        label: 'D6: first reply to read against the cutting stone.',
      },
    ]);
  });

  it('lets the learner choose a first reply in the pressure variation', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));

    expect(screen.getByText('Branch choice')).toBeTruthy();
    expect(screen.getByText('D8 is a good first read: it attacks the imagined White stone at D7 and asks whether that cutting stone can live. After that, recount C7 and E7 before extending again.')).toBeTruthy();
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'neutral',
        label: 'C7: one side of the jump; check whether this side becomes short.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'neutral',
        label: 'E7: one side of the jump; check whether this side becomes short.',
      },
      {
        id: 'read-pressure-gap-3,2',
        point: { x: 3, y: 2 },
        variant: 'warning',
        label: 'D7: imagined White pressure point.',
      },
      {
        id: 'read-pressure-reply-3,1',
        point: { x: 3, y: 1 },
        variant: 'positive',
        label: 'D8: selected first reply; attack the imagined cutting stone.',
      },
      {
        id: 'read-pressure-reply-3,3',
        point: { x: 3, y: 3 },
        variant: 'neutral',
        label: 'D6: alternate reply to compare in the branch.',
      },
    ]);
  });

  it('recounts both Black sides after the selected pressure reply', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));

    expect(screen.getByText('Second read')).toBeTruthy();
    expect(screen.getByText('After D8, recount the two Black sides: C7 has 3 liberties at C8, C6, and B7. E7 has 3 liberties at E8, E6, and F7. Neither side is short yet, so keep building while staying ready to answer D7.')).toBeTruthy();
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: 3 liberties after D8: C8, C6, and B7.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: 3 liberties after D8: E8, E6, and F7.',
      },
      {
        id: 'read-pressure-gap-3,2',
        point: { x: 3, y: 2 },
        variant: 'warning',
        label: 'D7: imagined White pressure point to keep watching.',
      },
      {
        id: 'read-pressure-reply-3,1',
        point: { x: 3, y: 1 },
        variant: 'positive',
        label: 'D8: selected reply used for this recount.',
      },
      {
        id: 'read-pressure-reply-3,3',
        point: { x: 3, y: 3 },
        variant: 'neutral',
        label: 'D6: alternate reply to compare later.',
      },
    ]);
  });

  it('keeps the last missed objective visible without blocking the next try', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 4, y: 4 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    expect(screen.getByText('Progress check: E5 was not one of the marked corner points. Try C7, G7, C3, or G3.')).toBeTruthy();
    expect(screen.getByText('Start with a corner')).toBeTruthy();
  });
});
