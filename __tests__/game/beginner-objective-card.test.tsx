// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SenseiChatLog } from '@/components/chat/SenseiChatLog';
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

  it('keeps pressure branch decisions in the chat transcript', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));

    const branchText = 'Branch choice: D8 is a good first read: it attacks the imagined White stone at D7 and asks whether that cutting stone can live. After that, recount C7 and E7 before extending again.';
    expect(useGameStore.getState().chatMessages.at(-1)).toMatchObject({
      text: branchText,
      variant: 'teaching',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));

    const recountText = 'Second read: After D8, recount the two Black sides: C7 has 3 liberties at C8, C6, and B7. E7 has 3 liberties at E8, E6, and F7. Neither side is short yet, so keep building while staying ready to answer D7.';
    expect(useGameStore.getState().chatMessages.at(-1)).toMatchObject({
      text: recountText,
      variant: 'teaching',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));

    expect(useGameStore.getState().chatMessages.filter((message) => message.text === recountText)).toHaveLength(1);
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
  });

  it('reopens a pressure recount from its chat transcript action', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(
      <>
        <BeginnerObjectiveCard />
        <SenseiChatLog />
      </>,
    );

    const d8RecountText = 'After D8, recount the two Black sides: C7 has 3 liberties at C8, C6, and B7. E7 has 3 liberties at E8, E6, and F7. Neither side is short yet, so keep building while staying ready to answer D7.';

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D6 as the first reply to D7' }));

    expect(screen.queryByText(d8RecountText)).toBeNull();
    expect(useGameStore.getState().chatMessages.at(-2)?.actions).toEqual([
      { id: 'guided:read-pressure:recount:read-pressure-2,2-4,2-3,2:3,1', label: 'Show recount' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Show recount' }));

    expect(screen.getByText(d8RecountText)).toBeTruthy();
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

  it('compares the alternate pressure reply directly after a recount', () => {
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

    expect(screen.getByRole('button', { name: 'Compare D6 against D8' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));

    const d6RecountText = 'After D6, recount the two Black sides: C7 has 3 liberties at C8, C6, and B7. E7 has 3 liberties at E8, E6, and F7. Neither side is short yet, so keep building while staying ready to answer D7.';
    const comparisonSummary = 'D8 and D6 leave the same liberty counts: C7 has 3 liberties and E7 has 3 liberties either way. The difference is direction: D8 attacks D7 from above, while D6 attacks it from below.';
    expect(screen.getByText(d6RecountText)).toBeTruthy();
    expect(screen.getByText('Comparison summary')).toBeTruthy();
    expect(screen.getByText('D8: C7 3 liberties, E7 3 liberties.')).toBeTruthy();
    expect(screen.getByText('D6: C7 3 liberties, E7 3 liberties.')).toBeTruthy();
    expect(screen.getByText(comparisonSummary)).toBeTruthy();
    expect(screen.getByText('Read sequence')).toBeTruthy();
    expect(screen.getByText('1. White D7 tests the gap between C7 and E7.')).toBeTruthy();
    expect(screen.getByText('2. Black D8 attacks D7 from above.')).toBeTruthy();
    expect(screen.getByText('3. Recount: C7 3 liberties; E7 3 liberties.')).toBeTruthy();
    expect(screen.getByText('4. Compare D6: C7 3 liberties; E7 3 liberties.')).toBeTruthy();
    expect(screen.getByText('5. Real-game handoff: play G7 after the stable read.')).toBeTruthy();
    const originalReplyStep = screen.getByRole('button', { name: 'Show board highlights for step 2: Black D8 attacks D7 from above.' });
    fireEvent.mouseEnter(originalReplyStep);
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

    fireEvent.click(originalReplyStep);
    expect(originalReplyStep.getAttribute('aria-pressed')).toBe('true');
    fireEvent.mouseLeave(originalReplyStep);
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

    fireEvent.click(originalReplyStep);
    expect(originalReplyStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Real-game handoff')).toBeTruthy();
    expect(screen.getByText('The read is stable, so turn it into a real move: play G7 for Make your stones work together.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play G7 in the real game after the stable pressure read' })).toBeTruthy();
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(useGameStore.getState().chatMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: `Comparison read: ${d6RecountText} ${comparisonSummary}`,
        variant: 'teaching',
        actions: [
          { id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1', label: 'Show comparison' },
        ],
      }),
    ]));
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: 3 liberties after D6: C8, C6, and B7.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: 3 liberties after D6: E8, E6, and F7.',
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
        variant: 'neutral',
        label: 'D8: alternate reply to compare later.',
      },
      {
        id: 'read-pressure-reply-3,3',
        point: { x: 3, y: 3 },
        variant: 'positive',
        label: 'D6: selected reply used for this recount.',
      },
    ]);
  });

  it('recommends defending the short side after an asymmetric pressure comparison', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));

    const comparisonSummary = 'D8 and D6 leave the same liberty counts: C7 has 2 liberties and E7 has 3 liberties either way. The difference is direction: D8 attacks D7 from above, while D6 attacks it from below.';
    const recommendation = 'Recommendation: C7 is the short side with 2 liberties at C6 and B7. Defend C7 before extending again.';

    expect(screen.getByText('Comparison summary')).toBeTruthy();
    expect(screen.getByText('D8: C7 2 liberties, E7 3 liberties.')).toBeTruthy();
    expect(screen.getByText('D6: C7 2 liberties, E7 3 liberties.')).toBeTruthy();
    expect(screen.getByText(comparisonSummary)).toBeTruthy();
    expect(screen.getByText(recommendation)).toBeTruthy();
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(useGameStore.getState().chatMessages.at(-1)).toMatchObject({
      text: `Comparison read: After D6, recount the two Black sides: C7 has 2 liberties at C6 and B7. E7 has 3 liberties at E8, E6, and F7. C7 is the short side now, so defend it before extending again. ${comparisonSummary} ${recommendation}`,
      variant: 'teaching',
      actions: [
        { id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1', label: 'Show comparison' },
      ],
    });
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'warning',
        label: 'C7: short side with 2 liberties after D6: C6 and B7.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: 3 liberties after D6: E8, E6, and F7.',
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
        variant: 'neutral',
        label: 'D8: alternate reply to compare later.',
      },
      {
        id: 'read-pressure-reply-3,3',
        point: { x: 3, y: 3 },
        variant: 'positive',
        label: 'D6: selected reply used for this recount.',
      },
      {
        id: 'read-pressure-short-liberty-2,3',
        point: { x: 2, y: 3 },
        variant: 'warning',
        label: 'C6: defend this C7 liberty before extending.',
      },
      {
        id: 'read-pressure-short-liberty-1,2',
        point: { x: 1, y: 2 },
        variant: 'warning',
        label: 'B7: defend this C7 liberty before extending.',
      },
    ]);
  });

  it('reopens an asymmetric pressure comparison from chat with short-side liberty markers', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(
      <>
        <BeginnerObjectiveCard />
        <SenseiChatLog />
      </>,
    );

    const d6RecountText = 'After D6, recount the two Black sides: C7 has 2 liberties at C6 and B7. E7 has 3 liberties at E8, E6, and F7. C7 is the short side now, so defend it before extending again.';
    const comparisonSummary = 'D8 and D6 leave the same liberty counts: C7 has 2 liberties and E7 has 3 liberties either way. The difference is direction: D8 attacks D7 from above, while D6 attacks it from below.';
    const recommendation = 'Recommendation: C7 is the short side with 2 liberties at C6 and B7. Defend C7 before extending again.';

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));

    expect(useGameStore.getState().chatMessages.at(-1)?.actions).toEqual([
      { id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1', label: 'Show comparison' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));

    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-short-liberty-2,3');

    const comparisonActions = screen.getAllByRole('button', { name: 'Show comparison' });
    fireEvent.click(comparisonActions[comparisonActions.length - 1]);

    expect(screen.getByText(d6RecountText)).toBeTruthy();
    expect(screen.getByText('Comparison summary')).toBeTruthy();
    expect(screen.getByText('D8: C7 2 liberties, E7 3 liberties.')).toBeTruthy();
    expect(screen.getByText('D6: C7 2 liberties, E7 3 liberties.')).toBeTruthy();
    expect(screen.getByText(comparisonSummary)).toBeTruthy();
    expect(screen.getByText(recommendation)).toBeTruthy();
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'warning',
        label: 'C7: short side with 2 liberties after D6: C6 and B7.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: 3 liberties after D6: E8, E6, and F7.',
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
        variant: 'neutral',
        label: 'D8: alternate reply to compare later.',
      },
      {
        id: 'read-pressure-reply-3,3',
        point: { x: 3, y: 3 },
        variant: 'positive',
        label: 'D6: selected reply used for this recount.',
      },
      {
        id: 'read-pressure-short-liberty-2,3',
        point: { x: 2, y: 3 },
        variant: 'warning',
        label: 'C6: defend this C7 liberty before extending.',
      },
      {
        id: 'read-pressure-short-liberty-1,2',
        point: { x: 1, y: 2 },
        variant: 'warning',
        label: 'B7: defend this C7 liberty before extending.',
      },
    ]);
  });

  it('reopens a pressure comparison from chat with the pinned sequence step restored', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(
      <>
        <BeginnerObjectiveCard />
        <SenseiChatLog />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));

    const originalReplyStep = screen.getByRole('button', { name: 'Show board highlights for step 2: Black D8 attacks D7 from above.' });
    fireEvent.click(originalReplyStep);

    expect(useGameStore.getState().chatMessages.at(-1)).toMatchObject({
      text: 'Read sequence focus: Step 2: Black D8 attacks D7 from above. Compare this saved first answer with the live D6 branch; the direction changes before the liberty counts are checked.',
      variant: 'teaching',
      actions: [
        { id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1:pin:reply-3,1', label: 'Show step' },
      ],
    });

    fireEvent.click(originalReplyStep);
    expect(originalReplyStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Next question')).toBeNull();
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).toContain('read-pressure-reply-3,3');

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    fireEvent.click(focusActions[focusActions.length - 1]);

    const restoredOriginalReplyStep = screen.getByRole('button', { name: 'Show board highlights for step 2: Black D8 attacks D7 from above.' });
    expect(restoredOriginalReplyStep.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Next question')).toBeTruthy();
    expect(screen.getByText('Before returning to D6, ask: did D8 change the attack direction while keeping both sides safe?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 from here' }));

    expect(restoredOriginalReplyStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Next question')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Compare D6 from here' })).toBeNull();
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: 3 liberties after D6: C8, C6, and B7.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: 3 liberties after D6: E8, E6, and F7.',
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
        variant: 'neutral',
        label: 'D8: alternate reply to compare later.',
      },
      {
        id: 'read-pressure-reply-3,3',
        point: { x: 3, y: 3 },
        variant: 'positive',
        label: 'D6: selected reply used for this recount.',
      },
    ]);
  });

  it('lets the learner try a recommended short-side defense without changing the real game', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));

    expect(screen.getByRole('button', { name: 'Try C6 defense for C7' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try B7 defense for C7' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try C6 defense for C7' }));

    const defenseText = 'C6 directly defends C7, the short side in this pressure line. Keep C7 breathing first; then recount before extending again.';
    const defenseOutcomeText = 'After C6, C7 grows from 2 to 5 liberties at B7, C5, B6, D5, and E6. E7 has 3 liberties at E8, E6, and F7. C7 is no longer the short side, so the defense did its job; now recount the whole position before extending again.';
    expect(screen.getByText('Defense read')).toBeTruthy();
    expect(screen.getByText(defenseText)).toBeTruthy();
    expect(screen.getByText(defenseOutcomeText)).toBeTruthy();
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(useGameStore.getState().chatMessages.at(-1)).toMatchObject({
      text: `Defense read: ${defenseText} ${defenseOutcomeText}`,
      variant: 'teaching',
      actions: [
        { id: 'guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3', label: 'Show defense' },
      ],
    });
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: 5 liberties after C6 defense: B7, C5, B6, D5, and E6.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'warning',
        label: 'E7: short side with 3 liberties after C6 defense: E8, E6, and F7.',
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
        variant: 'neutral',
        label: 'D8: alternate reply to compare later.',
      },
      {
        id: 'read-pressure-reply-3,3',
        point: { x: 3, y: 3 },
        variant: 'positive',
        label: 'D6: selected reply before this defense.',
      },
      {
        id: 'read-pressure-selected-defense-2,3',
        point: { x: 2, y: 3 },
        variant: 'positive',
        label: 'C6: simulated defense; C7 now has 5 liberties.',
      },
      {
        id: 'read-pressure-defense-liberty-1,2',
        point: { x: 1, y: 2 },
        variant: 'positive',
        label: 'B7: C7 liberty after C6 defense.',
      },
      {
        id: 'read-pressure-defense-liberty-2,4',
        point: { x: 2, y: 4 },
        variant: 'positive',
        label: 'C5: C7 liberty after C6 defense.',
      },
      {
        id: 'read-pressure-defense-liberty-1,3',
        point: { x: 1, y: 3 },
        variant: 'positive',
        label: 'B6: C7 liberty after C6 defense.',
      },
      {
        id: 'read-pressure-defense-liberty-3,4',
        point: { x: 3, y: 4 },
        variant: 'positive',
        label: 'D5: C7 liberty after C6 defense.',
      },
      {
        id: 'read-pressure-defense-liberty-4,3',
        point: { x: 4, y: 3 },
        variant: 'positive',
        label: 'E6: C7 liberty after C6 defense.',
      },
    ]);
  });

  it('continues a pressure defense from the side that becomes shorter', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(
      <>
        <BeginnerObjectiveCard />
        <SenseiChatLog />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try C6 defense for C7' }));

    expect(screen.getByText('Continue from E7')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try E8 follow-up defense for E7' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try E6 follow-up defense for E7' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try F7 follow-up defense for E7' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try E8 follow-up defense for E7' }));

    const followUpText = 'E8 now defends E7, the side that became shorter after C6. Keep E7 breathing before you return to extensions.';
    const followUpOutcomeText = 'After E8, E7 grows from 3 to 5 liberties at E6, F7, E9, D8, and F8. C7 has 5 liberties at B7, C5, B6, D5, and E6. Both sides are level, so the local read is stable; return to the real game and choose an extension.';

    expect(screen.getByText('Follow-up defense')).toBeTruthy();
    expect(screen.getByText(followUpText)).toBeTruthy();
    expect(screen.getByText(followUpOutcomeText)).toBeTruthy();
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(useGameStore.getState().chatMessages.at(-1)).toMatchObject({
      text: `Follow-up defense: ${followUpText} ${followUpOutcomeText}`,
      variant: 'teaching',
      actions: [
        { id: 'guided:read-pressure:follow-up-defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3:4,1', label: 'Show follow-up' },
      ],
    });
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: 5 liberties after E8 follow-up: B7, C5, B6, D5, and E6.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: 5 liberties after E8 follow-up: E6, F7, E9, D8, and F8.',
      },
      {
        id: 'read-pressure-selected-defense-2,3',
        point: { x: 2, y: 3 },
        variant: 'positive',
        label: 'C6: first simulated defense; C7 has 5 liberties.',
      },
      {
        id: 'read-pressure-follow-up-defense-4,1',
        point: { x: 4, y: 1 },
        variant: 'positive',
        label: 'E8: follow-up defense; E7 now has 5 liberties.',
      },
      {
        id: 'read-pressure-follow-up-liberty-5,2',
        point: { x: 5, y: 2 },
        variant: 'positive',
        label: 'F7: E7 liberty after E8 follow-up.',
      },
    ]));
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-short-liberty-2,3');

    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    expect(screen.queryByText(followUpText)).toBeNull();
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-follow-up-defense-4,1');

    const followUpActions = screen.getAllByRole('button', { name: 'Show follow-up' });
    fireEvent.click(followUpActions[followUpActions.length - 1]);

    expect(screen.getByText('Follow-up defense')).toBeTruthy();
    expect(screen.getByText(followUpText)).toBeTruthy();
    expect(screen.getByText(followUpOutcomeText)).toBeTruthy();
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).toContain('read-pressure-follow-up-defense-4,1');
  });

  it('compares follow-up defenses and names connecting the two sides', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try C6 defense for C7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try E8 follow-up defense for E7' }));

    expect(screen.getByText('Follow-up comparison')).toBeTruthy();
    expect(screen.getByText('E8: E7 5 liberties, C7 5 liberties.')).toBeTruthy();
    expect(screen.getByText('E6: connects C7 and E7 into one group with 8 liberties.')).toBeTruthy();
    expect(screen.getByText('F7: E7 5 liberties, C7 5 liberties.')).toBeTruthy();
    expect(screen.getByText('Connection note: E6 joins C7 and E7 into one Black group; E8 and F7 keep the sides separate.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try E6 follow-up defense for E7' }));

    expect(screen.getByText('After E6, C7 and E7 connect into one Black group with 8 liberties at E8, F7, E5, F6, D5, C5, B6, and B7. Both sides are one group now, so the local read is stable; return to the real game and choose an extension.')).toBeTruthy();
    expect(screen.getByText('Read sequence')).toBeTruthy();
    expect(screen.getByText('5. Defend C7 at C6; C7 has 5 liberties.')).toBeTruthy();
    expect(screen.getByText('6. Follow-up E6 connects C7 and E7 into one group.')).toBeTruthy();
    expect(screen.getByText('7. Real-game handoff: play G7 after the stable read.')).toBeTruthy();
    const handoffSequenceStep = screen.getByRole('button', { name: 'Show board highlights for step 7: Real-game handoff: play G7 after the stable read.' });
    fireEvent.focus(handoffSequenceStep);
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-handoff-6,2',
        point: { x: 6, y: 2 },
        variant: 'positive',
        label: 'G7: real move to play after the stable pressure read.',
      },
    ]);

    fireEvent.click(handoffSequenceStep);
    expect(handoffSequenceStep.getAttribute('aria-pressed')).toBe('true');
    expect(useGameStore.getState().chatMessages.at(-1)).toMatchObject({
      text: 'Read sequence focus: Step 7: Real-game handoff: play G7 after the stable read. This is the real move unlocked by the completed read; play it after the simulated defenses show C7 and E7 are stable.',
      variant: 'teaching',
      actions: [
        { id: 'guided:read-pressure:follow-up-defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3:4,3:pin:handoff-6,2', label: 'Show step' },
      ],
    });
    fireEvent.blur(handoffSequenceStep);
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-handoff-6,2',
        point: { x: 6, y: 2 },
        variant: 'positive',
        label: 'G7: real move to play after the stable pressure read.',
      },
    ]);

    fireEvent.click(handoffSequenceStep);
    expect(handoffSequenceStep.getAttribute('aria-pressed')).toBe('false');
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: connected group has 8 liberties after E6 follow-up: E8, F7, E5, F6, D5, C5, B6, and B7.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'positive',
        label: 'E7: connected group has 8 liberties after E6 follow-up: E8, F7, E5, F6, D5, C5, B6, and B7.',
      },
      {
        id: 'read-pressure-follow-up-defense-4,3',
        point: { x: 4, y: 3 },
        variant: 'positive',
        label: 'E6: follow-up defense; C7 and E7 connect with 8 liberties.',
      },
    ]));
  });

  it('hands a stable follow-up defense back to a concrete real-game extension', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try C6 defense for C7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try E6 follow-up defense for E7' }));

    expect(screen.getByText('Real-game handoff')).toBeTruthy();
    expect(screen.getByText('The read is stable, so turn it into a real move: play G7 for Make your stones work together.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Play G7 in the real game after the stable pressure read' }));

    const state = useGameStore.getState();
    expect(state.game.moveHistory).toHaveLength(5);
    expect(state.game.moveHistory.at(-1)).toMatchObject({
      type: 'place',
      color: 'black',
      point: { x: 6, y: 2 },
    });
    expect(state.lastPlayerMove).toEqual({ x: 6, y: 2 });
    expect(state.game.currentPlayer).toBe('white');
    expect(screen.queryByText('Follow-up defense')).toBeNull();

    act(() => {
      useGameStore.getState().pass();
    });

    expect(screen.getByText('Read applied')).toBeTruthy();
    expect(screen.getByText('G7 applies the D7 read in the real game: C7 and E7 stayed safe in the variation, so Black can keep extending instead of answering a cut that has not happened.')).toBeTruthy();
    expect(screen.getByText('What changed')).toBeTruthy();
  });

  it('plays a restored handoff sequence step from chat', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(
      <>
        <BeginnerObjectiveCard />
        <SenseiChatLog />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try C6 defense for C7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try E6 follow-up defense for E7' }));

    const handoffSequenceStep = screen.getByRole('button', { name: 'Show board highlights for step 7: Real-game handoff: play G7 after the stable read.' });
    fireEvent.click(handoffSequenceStep);
    fireEvent.click(handoffSequenceStep);
    expect(handoffSequenceStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Next question')).toBeNull();

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    fireEvent.click(focusActions[focusActions.length - 1]);

    const restoredHandoffStep = screen.getByRole('button', { name: 'Show board highlights for step 7: Real-game handoff: play G7 after the stable read.' });
    expect(restoredHandoffStep.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Next question')).toBeTruthy();
    expect(screen.getByText('What real move can you play now that C7 and E7 survived the simulation?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play G7 from here' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Play G7 from here' }));

    const state = useGameStore.getState();
    expect(state.game.moveHistory).toHaveLength(5);
    expect(state.game.moveHistory.at(-1)).toMatchObject({
      type: 'place',
      color: 'black',
      point: { x: 6, y: 2 },
    });
    expect(state.lastPlayerMove).toEqual({ x: 6, y: 2 });
    expect(state.game.currentPlayer).toBe('white');
    expect(screen.queryByText('Next question')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play G7 from here' })).toBeNull();

    act(() => {
      useGameStore.getState().pass();
    });

    expect(screen.getByText('Read applied')).toBeTruthy();
    expect(screen.getByText('G7 applies the D7 read in the real game: C7 and E7 stayed safe in the variation, so Black can keep extending instead of answering a cut that has not happened.')).toBeTruthy();
  });

  it('continues a restored defense sequence step from chat', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(
      <>
        <BeginnerObjectiveCard />
        <SenseiChatLog />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try C6 defense for C7' }));

    const defenseSequenceStep = screen.getByRole('button', { name: 'Show board highlights for step 5: Defend C7 at C6; C7 has 5 liberties.' });
    fireEvent.click(defenseSequenceStep);
    fireEvent.click(defenseSequenceStep);
    expect(defenseSequenceStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Next question')).toBeNull();

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    fireEvent.click(focusActions[focusActions.length - 1]);

    const restoredDefenseStep = screen.getByRole('button', { name: 'Show board highlights for step 5: Defend C7 at C6; C7 has 5 liberties.' });
    expect(restoredDefenseStep.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Next question')).toBeTruthy();
    expect(screen.getByText('After C6, which side is now shorter, and should the read continue there?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try E8 follow-up defense from here' })).toBeTruthy();
    const e6FollowUpFromHere = screen.getByRole('button', { name: 'Try E6 follow-up defense from here' });
    expect(e6FollowUpFromHere).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try F7 follow-up defense from here' })).toBeTruthy();
    expect(screen.getByText('E8 levels E7 with C7 at 5 liberties.')).toBeTruthy();
    expect(screen.getByText('E6 connects C7 and E7 into one group with 8 liberties.')).toBeTruthy();
    expect(screen.getByText('F7 levels E7 with C7 at 5 liberties.')).toBeTruthy();

    fireEvent.focus(e6FollowUpFromHere);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-follow-up-defense-4,3',
        point: { x: 4, y: 3 },
        variant: 'positive',
        label: 'E6: follow-up defense; C7 and E7 connect with 8 liberties.',
      },
      {
        id: 'read-pressure-anchor-2,2',
        point: { x: 2, y: 2 },
        variant: 'positive',
        label: 'C7: connected group has 8 liberties after E6 follow-up: E8, F7, E5, F6, D5, C5, B6, and B7.',
      },
    ]));
    fireEvent.blur(e6FollowUpFromHere);
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).toContain('read-pressure-selected-defense-2,3');
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-follow-up-defense-4,3');

    fireEvent.click(e6FollowUpFromHere);

    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(screen.getByText('Follow-up defense')).toBeTruthy();
    expect(screen.getByText('After E6, C7 and E7 connect into one Black group with 8 liberties at E8, F7, E5, F6, D5, C5, B6, and B7. Both sides are one group now, so the local read is stable; return to the real game and choose an extension.')).toBeTruthy();
    expect(screen.queryByText('Next question')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try E6 follow-up defense from here' })).toBeNull();
  });

  it('tries a defense from a restored comparison sequence step from chat', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(
      <>
        <BeginnerObjectiveCard />
        <SenseiChatLog />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));

    const comparisonSequenceStep = screen.getByRole('button', { name: 'Show board highlights for step 4: Compare D6: C7 2 liberties; E7 3 liberties.' });
    fireEvent.click(comparisonSequenceStep);
    fireEvent.click(comparisonSequenceStep);
    expect(comparisonSequenceStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Next question')).toBeNull();

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    fireEvent.click(focusActions[focusActions.length - 1]);

    const restoredComparisonStep = screen.getByRole('button', { name: 'Show board highlights for step 4: Compare D6: C7 2 liberties; E7 3 liberties.' });
    expect(restoredComparisonStep.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Next question')).toBeTruthy();
    expect(screen.getByText('After D6, which side changed, and does that force a defense before extending?')).toBeTruthy();
    const c6DefenseFromHere = screen.getByRole('button', { name: 'Try C6 defense from here' });
    expect(c6DefenseFromHere).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try B7 defense from here' })).toBeTruthy();
    expect(screen.getByText('C6 grows C7 to 5 liberties; E7 becomes the next read.')).toBeTruthy();
    expect(screen.getByText('B7 grows C7 to 4 liberties; E7 becomes the next read.')).toBeTruthy();

    fireEvent.focus(c6DefenseFromHere);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-selected-defense-2,3',
        point: { x: 2, y: 3 },
        variant: 'positive',
        label: 'C6: simulated defense; C7 now has 5 liberties.',
      },
      {
        id: 'read-pressure-stone-4,2',
        point: { x: 4, y: 2 },
        variant: 'warning',
        label: 'E7: short side with 3 liberties after C6 defense: E8, E6, and F7.',
      },
    ]));
    fireEvent.blur(c6DefenseFromHere);
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).toContain('read-pressure-short-liberty-2,3');
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-selected-defense-2,3');

    fireEvent.click(c6DefenseFromHere);

    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(screen.getByText('Defense read')).toBeTruthy();
    expect(screen.getByText('C6 directly defends C7, the short side in this pressure line. Keep C7 breathing first; then recount before extending again.')).toBeTruthy();
    expect(screen.getByText('After C6, C7 grows from 2 to 5 liberties at B7, C5, B6, D5, and E6. E7 has 3 liberties at E8, E6, and F7. C7 is no longer the short side, so the defense did its job; now recount the whole position before extending again.')).toBeTruthy();
    expect(screen.queryByText('Next question')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try C6 defense from here' })).toBeNull();
  });

  it('hands off from a restored follow-up sequence step from chat', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(
      <>
        <BeginnerObjectiveCard />
        <SenseiChatLog />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try C6 defense for C7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try E6 follow-up defense for E7' }));

    const followUpSequenceStep = screen.getByRole('button', { name: 'Show board highlights for step 6: Follow-up E6 connects C7 and E7 into one group.' });
    fireEvent.click(followUpSequenceStep);
    fireEvent.click(followUpSequenceStep);
    expect(followUpSequenceStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Next question')).toBeNull();

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    fireEvent.click(focusActions[focusActions.length - 1]);

    const restoredFollowUpStep = screen.getByRole('button', { name: 'Show board highlights for step 6: Follow-up E6 connects C7 and E7 into one group.' });
    expect(restoredFollowUpStep.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Next question')).toBeTruthy();
    expect(screen.getByText('Does E6 connect the stones strongly enough to leave the local fight?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play G7 from here' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Play G7 from here' }));

    const state = useGameStore.getState();
    expect(state.game.moveHistory).toHaveLength(5);
    expect(state.game.moveHistory.at(-1)).toMatchObject({
      type: 'place',
      color: 'black',
      point: { x: 6, y: 2 },
    });
    expect(state.lastPlayerMove).toEqual({ x: 6, y: 2 });
    expect(state.game.currentPlayer).toBe('white');
    expect(screen.queryByText('Next question')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play G7 from here' })).toBeNull();
  });

  it('reopens a pressure defense from chat with the selected short-side marker', () => {
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().placeStone({ x: 2, y: 1 });
      useGameStore.getState().placeStone({ x: 4, y: 2 });
      useGameStore.getState().pass();
    });

    render(
      <>
        <BeginnerObjectiveCard />
        <SenseiChatLog />
      </>,
    );

    const defenseText = 'C6 directly defends C7, the short side in this pressure line. Keep C7 breathing first; then recount before extending again.';
    const defenseOutcomeText = 'After C6, C7 grows from 2 to 5 liberties at B7, C5, B6, D5, and E6. E7 has 3 liberties at E8, E6, and F7. C7 is no longer the short side, so the defense did its job; now recount the whole position before extending again.';

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try C6 defense for C7' }));

    expect(useGameStore.getState().chatMessages.at(-1)?.actions).toEqual([
      { id: 'guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3', label: 'Show defense' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));

    expect(screen.queryByText(defenseText)).toBeNull();
    expect(screen.queryByText(defenseOutcomeText)).toBeNull();
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-selected-defense-2,3');

    const defenseActions = screen.getAllByRole('button', { name: 'Show defense' });
    fireEvent.click(defenseActions[defenseActions.length - 1]);

    expect(screen.getByText('Defense read')).toBeTruthy();
    expect(screen.getByText(defenseText)).toBeTruthy();
    expect(screen.getByText(defenseOutcomeText)).toBeTruthy();
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-selected-defense-2,3',
        point: { x: 2, y: 3 },
        variant: 'positive',
        label: 'C6: simulated defense; C7 now has 5 liberties.',
      },
      {
        id: 'read-pressure-defense-liberty-1,2',
        point: { x: 1, y: 2 },
        variant: 'positive',
        label: 'B7: C7 liberty after C6 defense.',
      },
    ]));
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).toContain('read-pressure-defense-liberty-4,3');
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-short-liberty-2,3');
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-short-liberty-1,2');
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
