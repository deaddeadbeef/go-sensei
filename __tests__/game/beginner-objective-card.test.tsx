// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SenseiChatLog } from '@/components/chat/SenseiChatLog';
import { BeginnerObjectiveCard } from '@/components/game/BeginnerObjectiveCard';
import { useGameStore } from '@/stores/game-store';

describe('BeginnerObjectiveCard', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().startGuidedIntroGame();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('names the marked opening points for coordinate learners', () => {
    render(
      <>
        <BeginnerObjectiveCard />
        <SenseiChatLog />
      </>,
    );

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
    vi.useFakeTimers();
    render(<BeginnerObjectiveCard />);

    const target = screen.getByRole('button', { name: 'Play C7 target for Start with a corner' });
    expect(screen.queryByText('Why C7')).toBeNull();

    fireEvent.mouseEnter(target);
    expect(screen.queryByText('Why C7')).toBeNull();
    act(() => vi.runOnlyPendingTimers());

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
    vi.useRealTimers();
  });

  it('still plays a target on the first click while hover help is pending', () => {
    vi.useFakeTimers();
    render(<BeginnerObjectiveCard />);

    const target = screen.getByRole('button', { name: 'Play C7 target for Start with a corner' });

    fireEvent.mouseEnter(target);
    expect(screen.queryByText('Why C7')).toBeNull();
    fireEvent.click(target);
    act(() => vi.runOnlyPendingTimers());

    const state = useGameStore.getState();
    const lastMove = state.game.moveHistory.at(-1);
    expect(lastMove).toMatchObject({
      type: 'place',
      color: 'black',
      point: { x: 2, y: 2 },
    });
    expect(screen.queryByText('Why C7')).toBeNull();
    vi.useRealTimers();
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
    vi.useFakeTimers();
    act(() => {
      useGameStore.getState().placeStone({ x: 2, y: 2 });
      useGameStore.getState().pass();
    });

    render(<BeginnerObjectiveCard />);

    const target = screen.getByRole('button', { name: 'Play E7 target for Make your stones work together' });
    fireEvent.focus(target);
    expect(screen.queryByText('Why E7')).toBeNull();
    act(() => vi.runOnlyPendingTimers());

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
    const restoredRecountCue = 'Showing the saved D8 recount from chat. Continue from here, or choose another branch to return to live reading.';
    const restoredVsLiveCue = 'Saved branch: D8. Live branch: D6. Live next: Recount C7 and E7 after D6.';
    const returnToLiveReadNote = 'Returned to live read: back on the D6 branch. The saved D8 recount stays in chat if you want to reopen it.';

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D6 as the first reply to D7' }));

    expect(screen.queryByText(d8RecountText)).toBeNull();
    expect(useGameStore.getState().chatMessages.at(-2)?.actions).toEqual([
      expect.objectContaining({
        id: 'guided:read-pressure:recount:read-pressure-2,2-4,2-3,2:3,1',
        label: 'Show saved D8 recount',
        previewHighlights: expect.arrayContaining([
          {
            id: 'read-pressure-reply-3,1',
            point: { x: 3, y: 1 },
            variant: 'positive',
            label: 'D8: selected reply used for this recount.',
          },
        ]),
      }),
    ]);

    const transcriptRecountAction = screen.getByRole('button', { name: 'Show saved D8 recount' });
    fireEvent.focus(transcriptRecountAction);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-reply-3,1',
        point: { x: 3, y: 1 },
        variant: 'positive',
        label: 'D8: selected reply used for this recount.',
      },
    ]));
    fireEvent.blur(transcriptRecountAction);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-reply-3,3',
        point: { x: 3, y: 3 },
        variant: 'positive',
        label: 'D6: selected first reply; attack the imagined cutting stone.',
      },
    ]));

    fireEvent.click(transcriptRecountAction);

    expect(screen.getByText(d8RecountText)).toBeTruthy();
    expect(screen.getByText('Restored read')).toBeTruthy();
    expect(screen.getByText(restoredRecountCue)).toBeTruthy();
    expect(screen.getByText(restoredVsLiveCue)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Return to live read' }));
    expect(screen.queryByText('Restored read')).toBeNull();
    expect(screen.queryByText(restoredRecountCue)).toBeNull();
    expect(screen.queryByText(restoredVsLiveCue)).toBeNull();
    expect(screen.getByText('D6 is a good first read: it attacks the imagined White stone at D7 and asks whether that cutting stone can live. After that, recount C7 and E7 before extending again.')).toBeTruthy();
    expect(screen.getByText(returnToLiveReadNote)).toBeTruthy();
    expect(useGameStore.getState().chatMessages.at(-1)).toMatchObject({
      text: returnToLiveReadNote,
      variant: 'teaching',
    });
    expect(useGameStore.getState().chatMessages.at(-1)?.actions).toEqual([
      expect.objectContaining({
        id: 'guided:read-pressure:recount:read-pressure-2,2-4,2-3,2:3,1',
        label: 'Reopen saved D8 recount',
        previewHighlights: expect.arrayContaining([
          {
            id: 'read-pressure-reply-3,1',
            point: { x: 3, y: 1 },
            variant: 'positive',
            label: 'D8: selected reply used for this recount.',
          },
        ]),
      }),
    ]);
    expect(useGameStore.getState().guidedReadReplayRequest).toBeNull();

    const returnNoteReopenAction = screen.getByRole('button', { name: 'Reopen saved D8 recount' });
    fireEvent.focus(returnNoteReopenAction);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-reply-3,1',
        point: { x: 3, y: 1 },
        variant: 'positive',
        label: 'D8: selected reply used for this recount.',
      },
    ]));
    fireEvent.blur(returnNoteReopenAction);
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
        variant: 'neutral',
        label: 'D8: alternate reply to compare in the branch.',
      },
      {
        id: 'read-pressure-reply-3,3',
        point: { x: 3, y: 3 },
        variant: 'positive',
        label: 'D6: selected first reply; attack the imagined cutting stone.',
      },
    ]);

    fireEvent.click(returnNoteReopenAction);
    expect(screen.getByText('Restored read')).toBeTruthy();
    expect(screen.getByText(restoredRecountCue)).toBeTruthy();
    expect(screen.getByText(restoredVsLiveCue)).toBeTruthy();
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

    fireEvent.click(screen.getByRole('button', { name: 'Choose D6 as the first reply to D7' }));
    expect(screen.queryByText('Restored read')).toBeNull();
    expect(screen.queryByText(restoredRecountCue)).toBeNull();
  });

  it('compares the alternate pressure reply directly after a recount', () => {
    vi.useFakeTimers();
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
    expect(screen.getByText('What you proved')).toBeTruthy();
    expect(screen.getByText('You proved D8 and D6 both leave C7 and E7 safe, so D7 does not need an immediate defense.')).toBeTruthy();
    expect(screen.getByText('The read is stable, so turn it into a real move: play G7 for Make your stones work together.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play G7 in the real game after the stable pressure read' })).toBeTruthy();
    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(useGameStore.getState().chatMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: `Comparison read: ${d6RecountText} ${comparisonSummary}`,
        variant: 'teaching',
        actions: [
          expect.objectContaining({
            id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1',
            label: 'Show saved D6 comparison',
            previewHighlights: expect.arrayContaining([
              {
                id: 'read-pressure-reply-3,3',
                point: { x: 3, y: 3 },
                variant: 'positive',
                label: 'D6: selected reply used for this recount.',
              },
            ]),
          }),
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

    fireEvent.click(screen.getByRole('button', { name: 'Play G7 in the real game after the stable pressure read' }));
    act(() => {
      useGameStore.getState().pass();
    });

    expect(screen.getByText('Read applied')).toBeTruthy();
    expect(screen.getByText('G7 applies the D7 read in the real game: You proved D8 and D6 both leave C7 and E7 safe, so D7 does not need an immediate defense. Black can keep extending instead of answering a cut that has not happened.')).toBeTruthy();
    expect(screen.getByText('Carry forward the proof: You proved D8 and D6 both leave C7 and E7 safe, so D7 does not need an immediate defense. Now test F7 the same way before the next extension.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Repeat D8 first-reply pattern at F8 for F7' }));

    expect(screen.getByText('Pressure variation')).toBeTruthy();
    expect(screen.getByText('F8 is a good first read: it attacks the imagined White stone at F7 and asks whether that cutting stone can live. After that, recount E7 and G7 before extending again.')).toBeTruthy();
    expect(screen.getByText('Recount E7 and G7')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Recount E7 and G7 after F8' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recount E7 and G7 after F8' }));

    expect(screen.getByText('You repeated D8 as F8. Now compare F6 so the F7 read gets its own proof before the next extension.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compare F6 against F8' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Compare F6 against F8' }));

    const repeatProofRecap = 'This matches the D7 proof: the repeated pattern stayed stable again. You proved F8 and F6 both leave E7 and G7 safe, so F7 does not need an immediate defense.';
    expect(screen.getByText(repeatProofRecap)).toBeTruthy();
    expect(useGameStore.getState().chatMessages.at(-1)?.text).toContain(repeatProofRecap);

    const twoGapProof = 'Two-gap proof: You proved D8 and D6 both leave C7 and E7 safe, so D7 does not need an immediate defense. You proved F8 and F6 both leave E7 and G7 safe, so F7 does not need an immediate defense. Black can keep extending instead of answering either cut immediately.';
    expect(screen.getByText(twoGapProof)).toBeTruthy();
    expect(screen.getByText('Both reads are stable, so turn them into a real move: play G5 for Make your stones work together.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Play G5 in the real game after the stable pressure read' }));
    act(() => {
      useGameStore.getState().pass();
    });

    expect(screen.getByText(`G5 applies the repeated stable reads in the real game: ${twoGapProof}`)).toBeTruthy();
    expect(screen.getByText('Read applied').closest('details')).toBeNull();
    expect(screen.getByText('Carry forward the chain: D7 and F7 were both tested and stayed stable. Now read G6 from scratch before the next extension.')).toBeTruthy();
    expect(screen.queryByText(`Carry forward the proof: ${twoGapProof} Now test G6 the same way before the next extension.`)).toBeNull();
    expect(screen.getByText('The repeat shortcut stops here: repeating F8 would land on G7, which is already one of your stones. Use Show pressure to read G6 from scratch.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Repeat F8 first-reply pattern at G7 for G6' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for G6' }));

    const collapsedAppliedRead = screen.getByText('Read applied').closest('details');
    expect(collapsedAppliedRead).toBeTruthy();
    expect(collapsedAppliedRead?.hasAttribute('open')).toBe(false);
    expect(collapsedAppliedRead?.textContent).toContain(`G5 applies the repeated stable reads in the real game: ${twoGapProof}`);
    expect(screen.getByText('Start with H6: it attacks G6 from the open side of the G7-G5 jump. Recount both stones, then compare F6.')).toBeTruthy();
    expect(screen.getByText('Start with H6')).toBeTruthy();
    expect(screen.queryByText('Recommended: H6')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start with H6 as the open-side first reply to G6' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose F6 as the first reply to G6' })).toBeTruthy();
    const firstChoiceRow = screen.getByTestId('read-pressure-first-choice-row');
    expect(firstChoiceRow.className).toContain('sticky');
    expect(firstChoiceRow.className).toContain('top-0');

    fireEvent.click(screen.getByRole('button', { name: 'Start with H6 as the open-side first reply to G6' }));

    expect(firstChoiceRow.className).not.toContain('sticky');
    const recountActionRow = screen.getByTestId('read-pressure-recount-action-row');
    expect(recountActionRow.className).toContain('sticky');
    expect(recountActionRow.className).toContain('top-0');
    expect(recountActionRow.contains(screen.getByRole('button', { name: 'Recount G7 and G5 after H6' }))).toBe(true);
    expect(useGameStore.getState().chatMessages.at(-1)?.text).toBe('Branch choice: H6 was recommended because it starts from the open side of the G7-G5 jump before you compare F6. H6 is a good first read: it attacks the imagined White stone at G6 and asks whether that cutting stone can live. After that, recount G7 and G5 before extending again.');

    fireEvent.click(screen.getByRole('button', { name: 'Recount G7 and G5 after H6' }));

    const completedFirstRead = screen.getByTestId('read-pressure-completed-first-read');
    expect(completedFirstRead.textContent).toContain('First read saved: H6');
    expect(completedFirstRead.hasAttribute('open')).toBe(false);
    expect(completedFirstRead.querySelector('[hidden]')?.textContent).toContain('Branch choice');
    expect(screen.getByRole('button', { name: 'Choose F6 as the first reply to G6' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compare F6 against H6' })).toBeTruthy();
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-reply-7,3',
        point: { x: 7, y: 3 },
        variant: 'positive',
        label: 'H6: selected reply used for this recount.',
      },
      {
        id: 'read-pressure-reply-5,3',
        point: { x: 5, y: 3 },
        variant: 'neutral',
        label: 'F6: alternate reply to compare later.',
      },
    ]));

    fireEvent.focus(screen.getByText('First read saved: H6'));

    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-reply-7,3',
        point: { x: 7, y: 3 },
        variant: 'positive',
        label: 'H6: saved first read and baseline for the next comparison.',
      },
      {
        id: 'read-pressure-reply-5,3',
        point: { x: 5, y: 3 },
        variant: 'warning',
        label: 'F6: next comparison branch to test against H6.',
      },
    ]));

    fireEvent.blur(screen.getByText('First read saved: H6'));

    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-reply-5,3',
        point: { x: 5, y: 3 },
        variant: 'neutral',
        label: 'F6: alternate reply to compare later.',
      },
    ]));

    const compareF6Action = screen.getByRole('button', { name: 'Compare F6 against H6' });
    fireEvent.focus(compareF6Action);

    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-anchor-6,2',
        point: { x: 6, y: 2 },
        variant: 'positive',
        label: 'G7: 3 liberties after F6: G8, F7, and H7.',
      },
      {
        id: 'read-pressure-stone-6,4',
        point: { x: 6, y: 4 },
        variant: 'positive',
        label: 'G5: 3 liberties after F6: G4, F5, and H5.',
      },
      {
        id: 'read-pressure-gap-6,3',
        point: { x: 6, y: 3 },
        variant: 'warning',
        label: 'G6: imagined White pressure point to keep watching.',
      },
      {
        id: 'read-pressure-reply-5,3',
        point: { x: 5, y: 3 },
        variant: 'positive',
        label: 'F6: selected reply used for this recount.',
      },
      {
        id: 'read-pressure-reply-7,3',
        point: { x: 7, y: 3 },
        variant: 'neutral',
        label: 'H6: alternate reply to compare later.',
      },
    ]));

    fireEvent.blur(compareF6Action);

    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-reply-7,3',
        point: { x: 7, y: 3 },
        variant: 'positive',
        label: 'H6: selected reply used for this recount.',
      },
      {
        id: 'read-pressure-reply-5,3',
        point: { x: 5, y: 3 },
        variant: 'neutral',
        label: 'F6: alternate reply to compare later.',
      },
    ]));

    fireEvent.click(screen.getByText('First read saved: H6'));

    expect(completedFirstRead.hasAttribute('open')).toBe(true);
    expect(completedFirstRead.querySelector('[hidden]')).toBeNull();
    expect(completedFirstRead.textContent).toContain('Branch choice');

    fireEvent.click(compareF6Action);

    const g6ChainProof = 'D7 and F7 were already tested and stayed stable. You proved H6 and F6 both leave G7 and G5 safe, so G6 does not need an immediate defense.';
    expect(screen.getByText('Comparison summary')).toBeTruthy();
    expect(screen.getByText('Why this is safe')).toBeTruthy();
    expect(screen.getByText(g6ChainProof)).toBeTruthy();
    expect(screen.queryByText('This matches the F7 proof: the repeated pattern stayed stable again. You proved H6 and F6 both leave G7 and G5 safe, so G6 does not need an immediate defense.')).toBeNull();
    expect(screen.queryByText((text) => text.includes('Two-gap proof: Two-gap proof'))).toBeNull();
    expect(useGameStore.getState().chatMessages.at(-1)?.text).not.toContain('This matches the F7 proof');

    const g6HandoffAction = screen.getByRole('button', { name: 'Play G3 in the real game after the stable pressure read' });
    fireEvent.focus(g6HandoffAction);

    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-handoff-6,6',
        point: { x: 6, y: 6 },
        variant: 'positive',
        label: 'G3: real move to play after the stable pressure read.',
      },
    ]));

    fireEvent.blur(g6HandoffAction);

    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-reply-5,3',
        point: { x: 5, y: 3 },
        variant: 'positive',
        label: 'F6: selected reply used for this recount.',
      },
    ]));

    fireEvent.click(g6HandoffAction);
    act(() => {
      useGameStore.getState().pass();
    });

    const compactThreeGapProof = 'Chain proof: D7, F7, and G6 were tested and stayed stable; Black can keep extending.';
    expect(screen.getByText(`G3 applies the stable read chain in the real game: ${compactThreeGapProof}`)).toBeTruthy();
    expect(screen.getByText('Carry forward the chain: D7, F7, and G6 were all tested and stayed stable. Stopping rule: read G4 once from scratch, then choose the next direction from the new board instead of extending by habit.')).toBeTruthy();
    expect(screen.getByText('The repeat shortcut stops here: D7, F7, and G6 are already a long enough chain. Use Show pressure so G4 gets a fresh H4/F4 comparison before the next direction.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show pressure variation for G4' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Repeat H6 first-reply pattern at H4 for G4' })).toBeNull();
    expect(screen.queryByText('Carry forward the proof: You proved H6 and F6 both leave G7 and G5 safe, so G6 does not need an immediate defense. Now test G4 the same way before the next extension.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for G4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start with H4 as the open-side first reply to G4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount G5 and G3 after H4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare F4 against H4' }));

    const g4ChainProof = 'D7, F7, and G6 were already tested and stayed stable. You proved H4 and F4 both leave G5 and G3 safe, so G4 does not need an immediate defense.';
    const compactFourGapProof = 'Chain proof: D7, F7, G6, and G4 were tested and stayed stable; Black can keep extending.';
    expect(screen.getByText(g4ChainProof)).toBeTruthy();
    expect(screen.getByText(compactFourGapProof)).toBeTruthy();
    expect(screen.getByText('The G4 read is stable, so change direction now: play E3 for Make your stones work together.')).toBeTruthy();
    expect(screen.getByText('Recommended by the read: E3. Other one-space jumps: E5 or C5.')).toBeTruthy();
    expect(screen.queryByText('Try E3, E5, or C5.')).toBeNull();
    expect(screen.queryByText('This matches the G6 proof: the repeated pattern stayed stable again. You proved H4 and F4 both leave G5 and G3 safe, so G4 does not need an immediate defense.')).toBeNull();
    expect(screen.queryByText((text) => text.includes('Two-gap proof: Chain proof'))).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Play E3 target for Make your stones work together' }));
    act(() => {
      useGameStore.getState().pass();
    });

    expect(screen.getByText(`E3 applies the stable read chain in the real game: ${compactFourGapProof}`)).toBeTruthy();
    expect(screen.getByText('The old chain already forced a direction change at E3. Start this side fresh: read F3 once, then choose from the new board instead of extending by habit.')).toBeTruthy();
    expect(screen.queryByText('Carry forward the chain: D7, F7, G6, and G4 were all tested and stayed stable. Stopping rule: read F3 once from scratch, then choose the next direction from the new board instead of extending by habit.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for F3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start with F2 as the open-side first reply to F3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount G3 and E3 after F2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare F4 against F2' }));

    const f3LocalProof = 'You proved F2 and F4 both leave G3 and E3 safe, so F3 does not need an immediate defense.';
    expect(screen.getByText(f3LocalProof)).toBeTruthy();
    expect(screen.getByText('The read is stable, so turn it into a real move: play C3 for Make your stones work together.')).toBeTruthy();
    expect(screen.queryByText('Chain proof: D7, F7, G6, G4, and F3 were tested and stayed stable; Black can keep extending.')).toBeNull();
    expect(screen.queryByText(`D7, F7, G6, and G4 were already tested and stayed stable. ${f3LocalProof}`)).toBeNull();
    expect(screen.queryByText('The F3 read is stable, so change direction now: play C3 for Make your stones work together.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Play C3 target for Make your stones work together' }));
    act(() => {
      useGameStore.getState().pass();
    });

    expect(screen.getByText(`C3 applies the F3 read in the real game: ${f3LocalProof} Black can keep extending instead of answering a cut that has not happened.`)).toBeTruthy();
    expect(screen.getByText('Local shape settled')).toBeTruthy();
    expect(screen.getByText('C3 landed after the F3 read, so this lower-edge shape is connected enough for now. Look upward next: C5 or E5 grow the same stones from a new direction.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show pressure variation for D3' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Repeat F2 first-reply pattern at D2 for D3' })).toBeNull();
    expect(screen.getByText('Recommended next direction: C5. Other upward jump: E5.')).toBeTruthy();
    expect(screen.queryByText('Try C5 or E5.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Play C5 target for Make your stones work together' }));
    act(() => {
      useGameStore.getState().pass();
    });

    expect(screen.getByText('Bridge back to the corner')).toBeTruthy();
    expect(screen.getByText('C5 links C3 back toward the earlier C7 corner: C6 and C4 stay open, so the corner stone and the lower-side stone now support the same line before you extend again.')).toBeTruthy();
    expect(screen.getByText('Watch C4')).toBeTruthy();
    expect(screen.getByText('If White plays C4, the jump between C3 and C5 is under pressure. C5 also reaches back toward C7 through C6, so this read tests whether the C7-C5-C3 line stays stable before Black extends again. First read whether Black should connect or defend that gap.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for C4' }));

    expect(screen.getByText('Imagine White plays C4. Keep the C7-C5-C3 line in mind while you compare three plans: connect by attacking the cutting stone at B4 or D4, defend a Black side that is short on liberties, or keep extending if both stones still have room.')).toBeTruthy();
    expect(screen.getByText('Start with B4: it attacks C4 from outside the C7-C5-C3 line. Recount C3 and C5 while remembering C7 still supports through C6, then compare D4 from the inside.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Choose B4 as the first reply to C4' }));

    expect(screen.getByText('B4 attacks C4 from outside the C7-C5-C3 line. D4 is the inside comparison toward the center, so recount C3 and C5 before deciding whether the bridge needs a defense.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Recount C3 and C5 after B4' }));

    expect(screen.getByText('After B4, recount the C7-C5-C3 line: C3 has 3 liberties at C2, B3, and D3. C5 has 3 liberties at C6, B5, and D5. C7 still supports through C6, so this read is checking whether C3 or C5 becomes short before extending again. Neither side is short yet, so keep building while staying ready to answer C4.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Compare D4 against B4' }));

    expect(screen.getByText('B4 and D4 leave the C7-C5-C3 bridge equally stable: C3 has 3 liberties and C5 has 3 liberties either way. B4 attacks C4 from outside the line; D4 tests the inside toward the center. C7 still supports through C6, so C4 does not need an immediate defense.')).toBeTruthy();
    const c4BridgeProof = 'You proved B4 outside and D4 inside both leave the C7-C5-C3 line stable, so C4 does not need an immediate defense.';
    expect(screen.getByText(c4BridgeProof)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Play E5 in the real game after the stable pressure read' }));
    act(() => {
      useGameStore.getState().pass();
    });

    expect(screen.getByText(`E5 applies the C4 read in the real game: ${c4BridgeProof} Black can keep extending instead of answering a cut that has not happened.`)).toBeTruthy();
    expect(screen.getByText(`Carry forward the bridge: E5 now links the older G5 stone to the proven C7-C5-C3 bridge through C5 and D5. Read F5 with that whole connection in mind, not as a fresh isolated G5-E5 gap.`)).toBeTruthy();
    expect(screen.queryByText(`Carry forward the proof: ${c4BridgeProof} Now test F5 the same way before the next extension.`)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for F5' }));

    expect(screen.getByText('Imagine White plays F5. Keep the C5-E5-G5 line in mind while you compare replies from above and below: connect by attacking the cutting stone at F6 or F4, defend a Black side that is short on liberties, or keep extending if both stones still have room.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Choose F6 as the first reply to F5' }));

    expect(screen.getByText('F6 attacks F5 from above the C5-E5-G5 line. F4 is the below comparison, so recount G5 and E5 before deciding whether the bridge needs a defense.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Recount G5 and E5 after F6' }));

    expect(screen.getByText('After F6, recount the C5-E5-G5 line: G5 has 3 liberties at G6, G4, and H5. E5 has 3 liberties at E6, E4, and D5. C5 still supports through D5, so this read is checking whether G5 or E5 becomes short before extending again. Neither side is short yet, so keep building while staying ready to answer F5.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Compare F4 against F6' }));

    expect(screen.getByText('F6 and F4 leave the C5-E5-G5 bridge equally stable: G5 has 3 liberties and E5 has 3 liberties either way. F6 attacks F5 from above the line; F4 tests below the line. C5 still supports through D5, so F5 does not need an immediate defense.')).toBeTruthy();
    expect(screen.getByText('You proved F6 above and F4 below both leave the C5-E5-G5 line stable, so F5 does not need an immediate defense.')).toBeTruthy();
    expect(screen.getByText('Weak-group handoff')).toBeTruthy();
    expect(screen.getByText('The F5 proof is the weak-group check: G5 and E5 both keep 3 liberties, so no urgent defense is marked. Keep D5 as the bridge liberty back to C5 before choosing the next real move.')).toBeTruthy();
    const bridgeLibertyButton = screen.getByRole('button', { name: 'Show D5 bridge liberty back to C5' });
    fireEvent.focus(bridgeLibertyButton);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-weak-bridge-liberty-3,4',
        point: { x: 3, y: 4 },
        variant: 'positive',
        label: 'D5: bridge liberty linking E5 back to C5 after the stable F5 proof.',
      },
    ]));
    expect(screen.getByText('Concrete next move: D5 settles the C5-E5 bridge before you look elsewhere. The F5 proof says this is a quiet connection, not an emergency defense.')).toBeTruthy();
    const quietBridgeMove = screen.getByRole('button', { name: 'Play D5 as the quiet bridge move after the safe F5 proof' });
    fireEvent.focus(quietBridgeMove);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-handoff-3,4',
        point: { x: 3, y: 4 },
        variant: 'positive',
        label: 'D5: real move to play after the stable pressure read.',
      },
    ]));

    fireEvent.click(quietBridgeMove);
    expect(useGameStore.getState().game.moveHistory.at(-1)).toMatchObject({
      type: 'place',
      color: 'black',
      point: { x: 3, y: 4 },
    });
    act(() => {
      useGameStore.getState().pass();
    });
    expect(screen.getByText('D5 settles the bridge after the F5 proof: You proved F6 above and F4 below both leave the C5-E5-G5 line stable, so F5 does not need an immediate defense. Black chose the quiet connection before looking for the next area.')).toBeTruthy();
    expect(screen.getByText('Local shape settled')).toBeTruthy();
    expect(screen.getByText('D5 connected C5 and E5. No marked Black group is short on liberties here, so this side is quiet now. Choose a new area instead of rereading the same bridge.')).toBeTruthy();
    expect(screen.getByText('Choose a new area')).toBeTruthy();
    expect(screen.getByText('Your nearby groups are safe for now. Pick a fresh area instead of rereading the settled shape.')).toBeTruthy();
    expect(screen.getByText('Try H8 or H2.')).toBeTruthy();
    const h8Target = screen.getByRole('button', { name: 'Play H8 target for Choose a new area' });
    const h2Target = screen.getByRole('button', { name: 'Play H2 target for Choose a new area' });
    expect(h8Target).toBeTruthy();
    expect(h2Target).toBeTruthy();
    fireEvent.focus(h8Target);
    expect(screen.queryByText('Why H8')).toBeNull();
    act(() => vi.runOnlyPendingTimers());
    expect(screen.getByText('Why H8')).toBeTruthy();
    expect(screen.getByText('H8 opens the upper-right direction after the nearby shape settled. It is far enough away to start a new plan without crowding your stones.')).toBeTruthy();
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'target-hint-target-7,1',
        point: { x: 7, y: 1 },
        variant: 'positive',
        label: 'H8: fresh upper-right direction after the nearby shape settled.',
      },
    ]));
    fireEvent.blur(h8Target);
    fireEvent.focus(h2Target);
    act(() => vi.runOnlyPendingTimers());
    expect(screen.getByText('Why H2')).toBeTruthy();
    expect(screen.getByText('H2 opens the lower-right direction after the nearby shape settled. It is far enough away to start a new plan without crowding your stones.')).toBeTruthy();
    expect(screen.queryByText('Before playing, ask which stones have little room to escape.')).toBeNull();
    expect(screen.queryByText('Progress check: D5 stayed near the settled shape. Look for a fresh direction before rereading the same local area.')).toBeNull();
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
        expect.objectContaining({
          id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1',
          label: 'Show saved D6 comparison',
          previewHighlights: expect.arrayContaining([
            {
              id: 'read-pressure-short-liberty-2,3',
              point: { x: 2, y: 3 },
              variant: 'warning',
              label: 'C6: defend this C7 liberty before extending.',
            },
          ]),
        }),
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
    const restoredComparisonCue = 'Showing the saved D6 comparison against D8 from chat. Continue from here, or choose another branch to return to live reading.';
    const restoredComparisonLiveCue = 'Saved branch: D6. Live branch: D8. Live next: Recount C7 and E7 after D8.';

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));

    expect(useGameStore.getState().chatMessages.at(-1)?.actions).toEqual([
      expect.objectContaining({
        id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1',
        label: 'Show saved D6 comparison',
        previewHighlights: expect.arrayContaining([
          {
            id: 'read-pressure-short-liberty-2,3',
            point: { x: 2, y: 3 },
            variant: 'warning',
            label: 'C6: defend this C7 liberty before extending.',
          },
        ]),
      }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));

    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-short-liberty-2,3');

    const comparisonActions = screen.getAllByRole('button', { name: 'Show saved D6 comparison' });
    const transcriptComparisonAction = comparisonActions[comparisonActions.length - 1];
    fireEvent.focus(transcriptComparisonAction);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-short-liberty-2,3',
        point: { x: 2, y: 3 },
        variant: 'warning',
        label: 'C6: defend this C7 liberty before extending.',
      },
    ]));
    fireEvent.blur(transcriptComparisonAction);
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-short-liberty-2,3');

    fireEvent.click(transcriptComparisonAction);

    expect(screen.getByText(d6RecountText)).toBeTruthy();
    expect(screen.getByText('Comparison summary')).toBeTruthy();
    expect(screen.getByText('D8: C7 2 liberties, E7 3 liberties.')).toBeTruthy();
    expect(screen.getByText('D6: C7 2 liberties, E7 3 liberties.')).toBeTruthy();
    expect(screen.getByText(comparisonSummary)).toBeTruthy();
    expect(screen.getByText(recommendation)).toBeTruthy();
    expect(screen.getByText('Restored read')).toBeTruthy();
    expect(screen.getByText(restoredComparisonCue)).toBeTruthy();
    expect(screen.getByText(restoredComparisonLiveCue)).toBeTruthy();
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
        expect.objectContaining({
          id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1:pin:reply-3,1',
          label: 'Show step',
          previewHighlights: expect.arrayContaining([
            {
              id: 'read-pressure-reply-3,1',
              point: { x: 3, y: 1 },
              variant: 'positive',
              label: 'D8: selected first reply; attack the imagined cutting stone.',
            },
          ]),
        }),
      ],
    });

    fireEvent.click(originalReplyStep);
    expect(originalReplyStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Saved read next question')).toBeNull();
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).toContain('read-pressure-reply-3,3');

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    const transcriptStepAction = focusActions[focusActions.length - 1];
    fireEvent.focus(transcriptStepAction);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-reply-3,1',
        point: { x: 3, y: 1 },
        variant: 'positive',
        label: 'D8: selected first reply; attack the imagined cutting stone.',
      },
    ]));
    fireEvent.blur(transcriptStepAction);
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).toContain('read-pressure-reply-3,3');
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-reply-3,1',
        point: { x: 3, y: 1 },
        variant: 'neutral',
        label: 'D8: alternate reply to compare later.',
      },
    ]));

    fireEvent.click(transcriptStepAction);

    const restoredOriginalReplyStep = screen.getByRole('button', { name: 'Show board highlights for step 2: Black D8 attacks D7 from above.' });
    expect(restoredOriginalReplyStep.getAttribute('aria-pressed')).toBe('true');
    expect(restoredOriginalReplyStep.textContent).toContain('Saved branch');
    const restoredRecountStep = screen.getByRole('button', { name: 'Show board highlights for step 3: Recount: C7 3 liberties; E7 3 liberties.' });
    expect(restoredRecountStep.textContent).toContain('Saved branch');
    const restoredComparisonStep = screen.getByRole('button', { name: 'Show board highlights for step 4: Compare D6: C7 3 liberties; E7 3 liberties.' });
    expect(restoredComparisonStep.textContent).toContain('Live branch');
    fireEvent.click(restoredRecountStep);
    expect(useGameStore.getState().chatMessages.at(-1)?.text).toBe('Read sequence focus: Saved branch. Step 3: Recount: C7 3 liberties; E7 3 liberties. Pin this D8 count as the baseline before the live D6 comparison; it shows what stayed safe or became short.');
    expect(useGameStore.getState().chatMessages.at(-1)?.actions).toEqual([
      expect.objectContaining({
        id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1:pin:recount-3,1',
        label: 'Show saved step 3: D8 recount',
      }),
    ]);
    fireEvent.click(restoredComparisonStep);
    expect(useGameStore.getState().chatMessages.at(-1)?.text).toBe('Read sequence focus: Live branch. Step 4: Compare D6: C7 3 liberties; E7 3 liberties. This is the live comparison against D8; use it to see whether the reply direction or liberty count changed.');
    expect(useGameStore.getState().chatMessages.at(-1)?.actions).toEqual([
      expect.objectContaining({
        id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1:pin:compare-3,3',
        label: 'Show live step 4: D6 comparison',
      }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Show board highlights for step 2: Black D8 attacks D7 from above.' }));
    expect(screen.getByText('Saved read next question')).toBeTruthy();
    expect(screen.getByText('Before returning to D6, ask: did D8 change the attack direction while keeping both sides safe?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 from here' }));

    expect(restoredOriginalReplyStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Saved read next question')).toBeNull();
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

  it('summarizes the last restored sequence step when returning to the live read', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Show board highlights for step 2: Black D8 attacks D7 from above.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show step' }));

    const restoredRecountStep = screen.getByRole('button', { name: 'Show board highlights for step 3: Recount: C7 3 liberties; E7 3 liberties.' });
    fireEvent.click(restoredRecountStep);
    fireEvent.click(screen.getByRole('button', { name: 'Return to live read' }));

    const returnToLiveReadNote = 'Returned to live read: back on the D6 branch. Last inspected sequence step: Saved branch step 3, Recount: C7 3 liberties; E7 3 liberties. The saved D6 comparison stays in chat if you want to reopen it.';
    expect(useGameStore.getState().chatMessages.at(-1)?.text).toBe(returnToLiveReadNote);
    expect(screen.getByText(returnToLiveReadNote)).toBeTruthy();
    expect(useGameStore.getState().chatMessages.at(-1)).toMatchObject({
      text: returnToLiveReadNote,
      variant: 'teaching',
    });
    expect(useGameStore.getState().chatMessages.at(-1)?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1:pin:recount-3,1',
        label: 'Reopen saved D6 comparison',
      }),
    ]));
    const liveHandoffStep = screen.getByRole('button', { name: 'Show board highlights for step 5: Real-game handoff: play G7 after the stable read.' });
    expect(liveHandoffStep.getAttribute('aria-pressed')).toBe('true');
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-handoff-6,2',
        point: { x: 6, y: 2 },
        variant: 'positive',
        label: 'G7: real move to play after the stable pressure read.',
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
        expect.objectContaining({
          id: 'guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3',
          label: 'Show saved C6 defense',
          previewHighlights: expect.arrayContaining([
            {
              id: 'read-pressure-selected-defense-2,3',
              point: { x: 2, y: 3 },
              variant: 'positive',
              label: 'C6: simulated defense; C7 now has 5 liberties.',
            },
          ]),
        }),
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
        expect.objectContaining({
          id: 'guided:read-pressure:follow-up-defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3:4,1',
          label: 'Show saved E8 follow-up defense',
          previewHighlights: expect.arrayContaining([
            {
              id: 'read-pressure-follow-up-defense-4,1',
              point: { x: 4, y: 1 },
              variant: 'positive',
              label: 'E8: follow-up defense; E7 now has 5 liberties.',
            },
          ]),
        }),
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

    const followUpActions = screen.getAllByRole('button', { name: 'Show saved E8 follow-up defense' });
    const transcriptFollowUpAction = followUpActions[followUpActions.length - 1];
    fireEvent.focus(transcriptFollowUpAction);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-follow-up-defense-4,1',
        point: { x: 4, y: 1 },
        variant: 'positive',
        label: 'E8: follow-up defense; E7 now has 5 liberties.',
      },
    ]));
    fireEvent.blur(transcriptFollowUpAction);
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-follow-up-defense-4,1');

    fireEvent.click(transcriptFollowUpAction);

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
        expect.objectContaining({
          id: 'guided:read-pressure:follow-up-defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3:4,3:pin:handoff-6,2',
          label: 'Show step',
          previewHighlights: [
            {
              id: 'read-pressure-handoff-6,2',
              point: { x: 6, y: 2 },
              variant: 'positive',
              label: 'G7: real move to play after the stable pressure read.',
            },
          ],
        }),
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

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    const transcriptHandoffAction = focusActions[focusActions.length - 1];
    fireEvent.focus(transcriptHandoffAction);
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-handoff-6,2',
        point: { x: 6, y: 2 },
        variant: 'positive',
        label: 'G7: real move to play after the stable pressure read.',
      },
    ]);
    fireEvent.blur(transcriptHandoffAction);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
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
    expect(screen.getByText('What you proved')).toBeTruthy();
    expect(screen.getByText('You proved E6 connects C7 and E7 into one Black group with 8 liberties, so the cut is answered.')).toBeTruthy();
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
    expect(screen.getByText('G7 applies the D7 read in the real game: You proved E6 connects C7 and E7 into one Black group with 8 liberties, so the cut is answered. Black can keep extending instead of answering a cut that has not happened.')).toBeTruthy();
    expect(screen.getByText('Carry forward the proof: You proved E6 connects C7 and E7 into one Black group with 8 liberties, so the cut is answered. Now test F7 the same way before the next extension.')).toBeTruthy();
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
    expect(screen.queryByText('Saved read next question')).toBeNull();

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    fireEvent.click(focusActions[focusActions.length - 1]);

    const restoredHandoffStep = screen.getByRole('button', { name: 'Show board highlights for step 7: Real-game handoff: play G7 after the stable read.' });
    expect(restoredHandoffStep.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Saved read next question')).toBeTruthy();
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
    expect(screen.queryByText('Saved read next question')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play G7 from here' })).toBeNull();

    act(() => {
      useGameStore.getState().pass();
    });

    expect(screen.getByText('Read applied')).toBeTruthy();
    expect(screen.getByText('G7 applies the D7 read in the real game: You proved E6 connects C7 and E7 into one Black group with 8 liberties, so the cut is answered. Black can keep extending instead of answering a cut that has not happened.')).toBeTruthy();
  });

  it('names the live handoff move when reopening a saved comparison after a stable read', () => {
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

    const restoredComparisonCue = 'Showing the saved D6 comparison against D8 from chat. Continue from here, or choose another branch to return to live reading.';
    const restoredLiveHandoffCue = 'Saved branch: D6. Live branch: D8. Live next: Play G7 in the real game.';

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D8 against D6' }));

    expect(screen.getByText('Real-game handoff')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play G7 in the real game after the stable pressure read' })).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Show saved D8 comparison' })).toBeTruthy();
    const savedD6ComparisonAction = screen.getByRole('button', { name: 'Show saved D6 comparison' });
    fireEvent.click(savedD6ComparisonAction);

    expect(screen.getByText('Restored read')).toBeTruthy();
    expect(screen.getAllByText('Live branch').length).toBeGreaterThan(0);
    expect(screen.getByText(restoredComparisonCue)).toBeTruthy();
    expect(screen.getByText(restoredLiveHandoffCue)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Return to live read' }));

    const returnToLiveReadNote = 'Returned to live read: back on the D8 branch. The saved D6 comparison stays in chat if you want to reopen it.';
    expect(screen.queryByText('Restored read')).toBeNull();
    expect(screen.getByText(returnToLiveReadNote)).toBeTruthy();
    expect(useGameStore.getState().chatMessages.at(-1)).toMatchObject({
      text: returnToLiveReadNote,
      variant: 'teaching',
      actions: [
        expect.objectContaining({
          id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1',
          label: 'Reopen saved D6 comparison',
        }),
        expect.objectContaining({
          id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,1:3,3:pin:handoff-6,2',
          label: 'Show live handoff',
          previewHighlights: [
            {
              id: 'read-pressure-handoff-6,2',
              point: { x: 6, y: 2 },
              variant: 'positive',
              label: 'G7: real move to play after the stable pressure read.',
            },
          ],
        }),
      ],
    });

    const liveHandoffAction = screen.getByRole('button', { name: 'Show live handoff' });
    fireEvent.focus(liveHandoffAction);
    expect(useGameStore.getState().overlays.targetHints).toEqual([
      {
        id: 'read-pressure-handoff-6,2',
        point: { x: 6, y: 2 },
        variant: 'positive',
        label: 'G7: real move to play after the stable pressure read.',
      },
    ]);
    fireEvent.click(liveHandoffAction);

    expect(screen.getByText('Saved read next question')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play G7 from here' })).toBeTruthy();
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
    expect(useGameStore.getState().chatMessages.at(-1)?.text).toBe('Read sequence focus: Step 5: Defend C7 at C6; C7 has 5 liberties. This shows how C6 changes the short side before the next read; compare it with the warning markers from the branch. Next choices: E8 levels E7 with C7 at 5 liberties. E6 connects C7 and E7 into one group with 8 liberties. F7 levels E7 with C7 at 5 liberties. Recommended: E6 connects C7 and E7 into one group with 8 liberties.');
    expect(useGameStore.getState().chatMessages.at(-1)?.actions).toEqual([
      expect.objectContaining({
        id: 'guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3:pin:defense-2,3',
        label: 'Show step',
        previewHighlights: expect.arrayContaining([
          {
            id: 'read-pressure-selected-defense-2,3',
            point: { x: 2, y: 3 },
            variant: 'positive',
            label: 'C6: simulated defense; C7 now has 5 liberties.',
          },
        ]),
      }),
      expect.objectContaining({
        id: 'guided:read-pressure:follow-up-defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3:4,3:pin:follow-up-4,3',
        label: 'Recommended: E6',
        previewHighlights: expect.arrayContaining([
          {
            id: 'read-pressure-follow-up-defense-4,3',
            point: { x: 4, y: 3 },
            variant: 'positive',
            label: 'E6: follow-up defense; C7 and E7 connect with 8 liberties.',
          },
        ]),
      }),
    ]);

    fireEvent.click(defenseSequenceStep);
    expect(defenseSequenceStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Saved read next question')).toBeNull();

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    fireEvent.click(focusActions[focusActions.length - 1]);

    const restoredDefenseStep = screen.getByRole('button', { name: 'Show board highlights for step 5: Defend C7 at C6; C7 has 5 liberties.' });
    expect(restoredDefenseStep.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Saved read next question')).toBeTruthy();
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
    expect(screen.queryByText('Saved read next question')).toBeNull();
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
    expect(useGameStore.getState().chatMessages.at(-1)?.text).toBe('Read sequence focus: Step 4: Compare D6: C7 2 liberties; E7 3 liberties. This is the live comparison against D8; use it to see whether the reply direction or liberty count changed. Next choices: C6 grows C7 to 5 liberties; E7 becomes the next read. B7 grows C7 to 4 liberties; E7 becomes the next read. Recommended: C6 grows C7 to 5 liberties; E7 becomes the next read.');
    expect(useGameStore.getState().chatMessages.at(-1)?.actions).toEqual([
      expect.objectContaining({
        id: 'guided:read-pressure:comparison:read-pressure-2,2-4,2-3,2:3,3:3,1:pin:compare-3,3',
        label: 'Show step',
        previewHighlights: expect.arrayContaining([
          {
            id: 'read-pressure-short-liberty-2,3',
            point: { x: 2, y: 3 },
            variant: 'warning',
            label: 'C6: defend this C7 liberty before extending.',
          },
        ]),
      }),
      expect.objectContaining({
        id: 'guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3:pin:defense-2,3',
        label: 'Recommended: C6',
        previewHighlights: expect.arrayContaining([
          {
            id: 'read-pressure-selected-defense-2,3',
            point: { x: 2, y: 3 },
            variant: 'positive',
            label: 'C6: simulated defense; C7 now has 5 liberties.',
          },
        ]),
      }),
    ]);

    fireEvent.click(comparisonSequenceStep);
    expect(comparisonSequenceStep.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('Saved read next question')).toBeNull();

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    fireEvent.click(focusActions[focusActions.length - 1]);

    const restoredComparisonStep = screen.getByRole('button', { name: 'Show board highlights for step 4: Compare D6: C7 2 liberties; E7 3 liberties.' });
    expect(restoredComparisonStep.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Saved read next question')).toBeTruthy();
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
    expect(screen.queryByText('Saved read next question')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try C6 defense from here' })).toBeNull();
  });

  it('tries the safest defense directly from a comparison focus transcript action', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Show board highlights for step 4: Compare D6: C7 2 liberties; E7 3 liberties.' }));

    const recommendedDefense = screen.getByRole('button', { name: 'Recommended: C6' });
    fireEvent.focus(recommendedDefense);
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
    fireEvent.blur(recommendedDefense);
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).toContain('read-pressure-short-liberty-2,3');
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-selected-defense-2,3');

    fireEvent.click(recommendedDefense);

    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(screen.getByText('Defense read')).toBeTruthy();
    expect(screen.getByText('After C6, C7 grows from 2 to 5 liberties at B7, C5, B6, D5, and E6. E7 has 3 liberties at E8, E6, and F7. C7 is no longer the short side, so the defense did its job; now recount the whole position before extending again.')).toBeTruthy();
    expect(screen.getByText('After C6, which side is now shorter, and should the read continue there?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try E6 follow-up defense from here' })).toBeTruthy();
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
  });

  it('tries the safest follow-up directly from a defense focus transcript action', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Show board highlights for step 5: Defend C7 at C6; C7 has 5 liberties.' }));

    const recommendedFollowUp = screen.getByRole('button', { name: 'Recommended: E6' });
    fireEvent.focus(recommendedFollowUp);
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
    fireEvent.blur(recommendedFollowUp);
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).toContain('read-pressure-selected-defense-2,3');
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-follow-up-defense-4,3');

    fireEvent.click(recommendedFollowUp);

    expect(useGameStore.getState().game.moveHistory).toHaveLength(4);
    expect(screen.getByText('Follow-up defense')).toBeTruthy();
    expect(screen.getByText('After E6, C7 and E7 connect into one Black group with 8 liberties at E8, F7, E5, F6, D5, C5, B6, and B7. Both sides are one group now, so the local read is stable; return to the real game and choose an extension.')).toBeTruthy();
    expect(screen.getByText('Does E6 connect the stones strongly enough to leave the local fight?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play G7 from here' })).toBeTruthy();
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
    expect(screen.queryByText('Saved read next question')).toBeNull();

    const focusActions = screen.getAllByRole('button', { name: 'Show step' });
    fireEvent.click(focusActions[focusActions.length - 1]);

    const restoredFollowUpStep = screen.getByRole('button', { name: 'Show board highlights for step 6: Follow-up E6 connects C7 and E7 into one group.' });
    expect(restoredFollowUpStep.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Saved read next question')).toBeTruthy();
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
    expect(screen.queryByText('Saved read next question')).toBeNull();
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
    const restoredDefenseCue = 'Showing the saved C6 defense from chat. Continue from here, or choose another branch to return to live reading.';
    const restoredDefenseLiveCue = 'Saved branch: D6. Live branch: D8. Live next: Recount C7 and E7 after D8.';

    fireEvent.click(screen.getByRole('button', { name: 'Show pressure variation for D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recount C7 and E7 after D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Compare D6 against D8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try C6 defense for C7' }));

    expect(useGameStore.getState().chatMessages.at(-1)?.actions).toEqual([
      expect.objectContaining({
        id: 'guided:read-pressure:defense:read-pressure-2,2-4,2-3,2:3,3:3,1:2,3',
        label: 'Show saved C6 defense',
        previewHighlights: expect.arrayContaining([
          {
            id: 'read-pressure-selected-defense-2,3',
            point: { x: 2, y: 3 },
            variant: 'positive',
            label: 'C6: simulated defense; C7 now has 5 liberties.',
          },
        ]),
      }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Choose D8 as the first reply to D7' }));

    expect(screen.queryByText(defenseText)).toBeNull();
    expect(screen.queryByText(defenseOutcomeText)).toBeNull();
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-selected-defense-2,3');

    const defenseActions = screen.getAllByRole('button', { name: 'Show saved C6 defense' });
    const transcriptDefenseAction = defenseActions[defenseActions.length - 1];
    fireEvent.focus(transcriptDefenseAction);
    expect(useGameStore.getState().overlays.targetHints).toEqual(expect.arrayContaining([
      {
        id: 'read-pressure-selected-defense-2,3',
        point: { x: 2, y: 3 },
        variant: 'positive',
        label: 'C6: simulated defense; C7 now has 5 liberties.',
      },
    ]));
    fireEvent.blur(transcriptDefenseAction);
    expect(useGameStore.getState().overlays.targetHints.map((hint) => hint.id)).not.toContain('read-pressure-selected-defense-2,3');

    fireEvent.click(transcriptDefenseAction);

    expect(screen.getByText('Restored read')).toBeTruthy();
    expect(screen.getByText(restoredDefenseCue)).toBeTruthy();
    expect(screen.getByText(restoredDefenseLiveCue)).toBeTruthy();
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
