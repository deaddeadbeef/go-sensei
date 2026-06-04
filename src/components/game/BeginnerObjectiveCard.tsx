'use client';

import {
  formatObjectiveTargetText,
  getBeginnerObjective,
  getBeginnerObjectiveProgress,
} from '@/lib/coaching/beginner-objectives';
import type { BeginnerObjective } from '@/lib/coaching/beginner-objectives';
import type { SenseiAction } from '@/lib/coaching/sensei-actions';
import { getMoveInsight } from '@/lib/coaching/move-insight';
import {
  getAdjacentPoints,
  getGroup,
  getStone,
  isOnBoard,
  playMove,
  pointToCoord,
} from '@/lib/go-engine';
import type { BoardState, GameState, Group, Move, Point } from '@/lib/go-engine';
import { useGameStore } from '@/stores/game-store';
import type { GuidedReadReplayRequest, OverlayHighlight } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const ONE_SPACE_JUMP_DELTAS: Point[] = [
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
  { x: 0, y: -2 },
];

const TARGET_HELP_DELAY_MS = 120;

interface OneSpaceJumpReadPrompt {
  key: string;
  title: string;
  text: string;
  variationText: string;
  anchor: Point;
  stone: Point;
  gap: Point;
  replyPoints: Point[];
  gapCoord: string;
}

interface PressureRecount {
  text: string;
  reply: Point;
  anchorLiberties: Point[];
  stoneLiberties: Point[];
}

interface PressureDefenseRecommendation {
  shortSide: Point;
  shortSideCoord: string;
  liberties: Point[];
  text: string;
}

interface PressureDefenseOutcome {
  text: string;
  defense: Point;
  defendedSide: Point;
  defendedSideCoord: string;
  defendedLiberties: Point[];
  otherSide: Point;
  otherSideCoord: string;
  otherLiberties: Point[];
  connectedSides: boolean;
}

interface PressureComparisonSummary {
  rows: string[];
  text: string;
  recommendationText: string | null;
  defenseRecommendation: PressureDefenseRecommendation | null;
}

interface PressureFollowUpComparisonSummary {
  rows: string[];
  text: string;
}

interface PressureHandoffRecap {
  point: Point;
  coord: string;
  text: string;
}

interface PressureExtensionHandoff {
  point: Point;
  coord: string;
  text: string;
  ariaLabel: string;
  recap: PressureHandoffRecap;
}

interface PressureReadSequenceRow {
  key: string;
  replayKey: string;
  text: string;
  focusText: string;
  nextQuestion: string;
  highlights: OverlayHighlight[];
}

interface PressureReadSequenceBranchContext {
  savedReplyKey: string;
  liveReplyKey: string;
}

interface PressureReadSequenceBranchBadge {
  label: 'Saved branch' | 'Live branch';
  tone: 'saved' | 'live';
}

interface ReplaySequenceDefenseChoice {
  point: Point;
  coord: string;
  hint: string | null;
  highlights: OverlayHighlight[] | null;
  outcome: PressureDefenseOutcome | null;
}

function targetKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function copyPoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

function getPressureReadSequenceReplayReplyKey(replayKey: string | null | undefined): string | null {
  if (!replayKey) return null;

  const branchReplayPrefixes = ['reply-', 'recount-', 'compare-'];

  return branchReplayPrefixes.reduce<string | null>((matchedKey, prefix) => {
    if (matchedKey !== null) return matchedKey;
    return replayKey.startsWith(prefix) ? replayKey.slice(prefix.length) : null;
  }, null);
}

function getPreferredLivePressureReadSequenceReplayKey(
  selectedReply: Point | null,
  selectedRecount: PressureRecount | null,
  comparedReply: Point | null,
  selectedDefense: Point | null,
  selectedFollowUpDefense: Point | null,
  handoff: PressureExtensionHandoff | null,
): string | null {
  if (handoff) return `handoff-${targetKey(handoff.point)}`;
  if (selectedFollowUpDefense) return `follow-up-${targetKey(selectedFollowUpDefense)}`;
  if (selectedDefense) return `defense-${targetKey(selectedDefense)}`;
  if (selectedRecount && comparedReply) return `compare-${targetKey(selectedRecount.reply)}`;
  if (selectedRecount) return `recount-${targetKey(selectedRecount.reply)}`;
  if (selectedReply) return `reply-${targetKey(selectedReply)}`;

  return 'gap';
}

function joinCoordinateList(coords: string[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return coords[0];
  if (coords.length === 2) return `${coords[0]} or ${coords[1]}`;

  return `${coords.slice(0, -1).join(', ')}, or ${coords[coords.length - 1]}`;
}

function joinAndCoordinateList(coords: string[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return coords[0];
  if (coords.length === 2) return `${coords[0]} and ${coords[1]}`;

  return `${coords.slice(0, -1).join(', ')}, and ${coords[coords.length - 1]}`;
}

function formatLibertyCount(count: number): string {
  return `${count} ${count === 1 ? 'liberty' : 'liberties'}`;
}

function getReplyDirection(reply: Point, gap: Point): string {
  if (reply.y < gap.y) return 'above';
  if (reply.y > gap.y) return 'below';
  if (reply.x < gap.x) return 'the left';
  if (reply.x > gap.x) return 'the right';

  return 'next to it';
}

function getCornerTargetExplanation(point: Point, board: BoardState): string {
  const coord = pointToCoord(point, board.size);
  const verticalEdge = point.y < board.size / 2 ? 'top' : 'bottom';
  const horizontalEdge = point.x < board.size / 2 ? 'left' : 'right';

  return `${coord} leans on the ${verticalEdge} and ${horizontalEdge} edges, so Black needs fewer stones to sketch territory there.`;
}

function getExtensionAnchor(board: BoardState, target: Point): { anchor: Point; gap: Point } | null {
  for (const delta of ONE_SPACE_JUMP_DELTAS) {
    const anchor = { x: target.x + delta.x, y: target.y + delta.y };
    const gap = { x: target.x + delta.x / 2, y: target.y + delta.y / 2 };

    if (!isOnBoard(board, anchor) || !isOnBoard(board, gap)) continue;
    if (getStone(board, anchor) !== 'black') continue;
    if (getStone(board, gap) !== null) continue;

    return { anchor, gap };
  }

  return null;
}

function getGapPressureReplyPoints(board: BoardState, anchor: Point, stone: Point, gap: Point): Point[] {
  const isHorizontalJump = Math.abs(stone.x - anchor.x) === 2;
  const candidates = isHorizontalJump
    ? [
        { x: gap.x, y: gap.y - 1 },
        { x: gap.x, y: gap.y + 1 },
      ]
    : [
        { x: gap.x - 1, y: gap.y },
        { x: gap.x + 1, y: gap.y },
      ];

  return candidates.filter((point) => isOnBoard(board, point) && getStone(board, point) === null);
}

function getExtensionTargetExplanation(point: Point, board: BoardState): string {
  const coord = pointToCoord(point, board.size);
  const anchor = getExtensionAnchor(board, point);
  if (!anchor) {
    return `${coord} keeps a one-point gap from another stone, so the stones can work together without clumping.`;
  }

  const anchorCoord = pointToCoord(anchor.anchor, board.size);
  const gapCoord = pointToCoord(anchor.gap, board.size);

  return `${coord} is a one-space jump from ${anchorCoord}; ${gapCoord} stays open so the two stones can work together without clumping.`;
}

function findWeakGroupTouchingLiberty(board: BoardState, point: Point): Group | null {
  const groups = getAdjacentPoints(board, point)
    .filter((adjacent) => getStone(board, adjacent) === 'black')
    .map((adjacent) => getGroup(board, adjacent))
    .filter((group): group is Group => group !== null)
    .sort((a, b) => a.liberties.length - b.liberties.length || a.stones.length - b.stones.length);

  return groups[0] ?? null;
}

function getWeakGroupTargetExplanation(point: Point, board: BoardState): string {
  const coord = pointToCoord(point, board.size);
  const group = findWeakGroupTouchingLiberty(board, point);
  if (!group) {
    return `${coord} gives a short-on-liberties group more breathing room.`;
  }

  const stoneText = group.stones.length === 1 ? 'stone' : `${group.stones.length}-stone group`;
  return `${coord} is a liberty for your ${stoneText}; playing there gives it one more breathing point before White can squeeze it.`;
}

function getTargetExplanation(objective: BeginnerObjective, point: Point, board: BoardState): string {
  switch (objective.id) {
    case 'claim-corner':
      return getCornerTargetExplanation(point, board);
    case 'extend-from-stone':
      return getExtensionTargetExplanation(point, board);
    case 'look-for-weak-groups':
      return getWeakGroupTargetExplanation(point, board);
  }
}

function getLastBlackPlacement(moveHistory: Move[]): Extract<Move, { type: 'place' }> | null {
  for (let index = moveHistory.length - 1; index >= 0; index -= 1) {
    const move = moveHistory[index];
    if (move.type === 'place' && move.color === 'black') return move;
  }

  return null;
}

function getOneSpaceJumpReadPrompt(game: GameState): OneSpaceJumpReadPrompt | null {
  const move = getLastBlackPlacement(game.moveHistory);
  if (!move) return null;

  const shape = getExtensionAnchor(game.board, move.point);
  if (!shape) return null;

  const stoneCoord = pointToCoord(move.point, game.board.size);
  const anchorCoord = pointToCoord(shape.anchor, game.board.size);
  const gapCoord = pointToCoord(shape.gap, game.board.size);
  const replyPoints = getGapPressureReplyPoints(game.board, shape.anchor, move.point, shape.gap);
  const replyText = joinCoordinateList(replyPoints.map((point) => pointToCoord(point, game.board.size)));

  return {
    key: `read-pressure-${targetKey(shape.anchor)}-${targetKey(move.point)}-${targetKey(shape.gap)}`,
    title: `Watch ${gapCoord}`,
    text: `If White plays ${gapCoord}, the jump between ${anchorCoord} and ${stoneCoord} is under pressure. First read whether Black should connect or defend that gap before extending again.`,
    variationText: `Imagine White plays ${gapCoord}. Compare three plans: connect by attacking the cutting stone${replyText ? ` at ${replyText}` : ''}, defend a Black side that is short on liberties, or keep extending if both stones still have room.`,
    anchor: copyPoint(shape.anchor),
    stone: copyPoint(move.point),
    gap: copyPoint(shape.gap),
    replyPoints: replyPoints.map(copyPoint),
    gapCoord,
  };
}

function buildOneSpaceJumpPressureHighlights(
  prompt: OneSpaceJumpReadPrompt,
  board: BoardState,
  selectedReply: Point | null = null,
): OverlayHighlight[] {
  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);
  const gapCoord = pointToCoord(prompt.gap, board.size);
  const selectedReplyKey = selectedReply ? targetKey(selectedReply) : null;

  return [
    {
      id: `read-pressure-anchor-${targetKey(prompt.anchor)}`,
      point: copyPoint(prompt.anchor),
      variant: 'neutral',
      label: `${anchorCoord}: one side of the jump; check whether this side becomes short.`,
    },
    {
      id: `read-pressure-stone-${targetKey(prompt.stone)}`,
      point: copyPoint(prompt.stone),
      variant: 'neutral',
      label: `${stoneCoord}: one side of the jump; check whether this side becomes short.`,
    },
    {
      id: `read-pressure-gap-${targetKey(prompt.gap)}`,
      point: copyPoint(prompt.gap),
      variant: 'warning',
      label: selectedReply
        ? `${gapCoord}: imagined White pressure point.`
        : `${gapCoord}: imagine White tests the open gap here.`,
    },
    ...prompt.replyPoints.map((point) => {
      const coord = pointToCoord(point, board.size);
      const isSelected = selectedReplyKey === targetKey(point);

      return {
        id: `read-pressure-reply-${targetKey(point)}`,
        point: copyPoint(point),
        variant: selectedReply ? (isSelected ? 'positive' as const : 'neutral' as const) : 'positive' as const,
        label: selectedReply
          ? isSelected
            ? `${coord}: selected first reply; attack the imagined cutting stone.`
            : `${coord}: alternate reply to compare in the branch.`
          : `${coord}: first reply to read against the cutting stone.`,
      };
    }),
  ];
}

function getPressureChoiceFeedback(prompt: OneSpaceJumpReadPrompt, reply: Point, board: BoardState): string {
  const replyCoord = pointToCoord(reply, board.size);
  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);

  return `${replyCoord} is a good first read: it attacks the imagined White stone at ${prompt.gapCoord} and asks whether that cutting stone can live. After that, recount ${anchorCoord} and ${stoneCoord} before extending again.`;
}

function getPressureReadNextActionText(
  board: BoardState,
  prompt: OneSpaceJumpReadPrompt,
  selectedReply: Point | null,
  selectedRecount: PressureRecount | null,
  comparedReply: Point | null,
  defenseRecommendation: PressureDefenseRecommendation | null,
  selectedDefense: Point | null,
  followUpRecommendation: PressureDefenseRecommendation | null,
  selectedFollowUpDefense: Point | null,
  extensionHandoff: PressureExtensionHandoff | null,
): string | null {
  if (!selectedReply) return null;

  const replyCoord = pointToCoord(selectedReply, board.size);

  if (!selectedRecount) {
    return `Recount ${pointToCoord(prompt.anchor, board.size)} and ${pointToCoord(prompt.stone, board.size)} after ${replyCoord}.`;
  }

  if (!comparedReply) {
    const nextReply = prompt.replyPoints.find((point) => targetKey(point) !== targetKey(selectedReply));
    return nextReply ? `Compare ${pointToCoord(nextReply, board.size)} against ${replyCoord}.` : null;
  }

  if (defenseRecommendation && !selectedDefense) {
    return `Try a defense for ${defenseRecommendation.shortSideCoord}.`;
  }

  if (followUpRecommendation && !selectedFollowUpDefense) {
    return `Try a follow-up defense for ${followUpRecommendation.shortSideCoord}.`;
  }

  if (extensionHandoff) {
    return `Play ${extensionHandoff.coord} in the real game.`;
  }

  return null;
}

function getRestoredPressureReadCue(
  request: GuidedReadReplayRequest,
  board: BoardState,
  selectedReply: Point | null,
  comparedReply: Point | null,
  selectedDefense: Point | null,
  selectedFollowUpDefense: Point | null,
): string | null {
  if (!selectedReply) return null;

  const replyCoord = pointToCoord(selectedReply, board.size);
  const suffix = 'Continue from here, or choose another branch to return to live reading.';

  if (request.mode === 'branch') {
    return `Showing the saved ${replyCoord} first-read branch from chat. ${suffix}`;
  }

  if (request.mode === 'recount') {
    return `Showing the saved ${replyCoord} recount from chat. ${suffix}`;
  }

  if (request.mode === 'comparison' && comparedReply) {
    return `Showing the saved ${replyCoord} comparison against ${pointToCoord(comparedReply, board.size)} from chat. ${suffix}`;
  }

  if (request.mode === 'defense' && selectedDefense) {
    return `Showing the saved ${pointToCoord(selectedDefense, board.size)} defense from chat. ${suffix}`;
  }

  if (request.mode === 'follow-up-defense' && selectedFollowUpDefense) {
    return `Showing the saved ${pointToCoord(selectedFollowUpDefense, board.size)} follow-up defense from chat. ${suffix}`;
  }

  return `Showing a saved read from chat. ${suffix}`;
}

function getRestoredPressureReadLiveCue(
  board: BoardState,
  liveReply: Point | null,
  restoredReply: Point | null,
  liveNextAction: string | null,
): string | null {
  if (!liveReply || !restoredReply) return null;
  if (targetKey(liveReply) === targetKey(restoredReply)) return null;

  const branchCue = `Saved branch: ${pointToCoord(restoredReply, board.size)}. Live branch: ${pointToCoord(liveReply, board.size)}.`;
  return liveNextAction ? `${branchCue} Live next: ${liveNextAction}` : branchCue;
}

function getSavedPressureReadLabel(request: GuidedReadReplayRequest): string {
  if (request.mode === 'branch') return 'first-read branch';
  if (request.mode === 'recount') return 'recount';
  if (request.mode === 'comparison') return 'comparison';
  if (request.mode === 'defense') return 'defense';
  if (request.mode === 'follow-up-defense') return 'follow-up defense';

  return 'read';
}

function getReturnToLivePressureReadActionLabel(
  request: GuidedReadReplayRequest,
  board: BoardState,
  selectedReply: Point | null,
  selectedDefense: Point | null,
  selectedFollowUpDefense: Point | null,
): string {
  if (request.mode === 'defense' && selectedDefense) {
    return `Reopen saved ${pointToCoord(selectedDefense, board.size)} defense`;
  }

  if (request.mode === 'follow-up-defense' && selectedFollowUpDefense) {
    return `Reopen saved ${pointToCoord(selectedFollowUpDefense, board.size)} follow-up defense`;
  }

  if (selectedReply) {
    const label = request.mode === 'branch' ? 'branch' : getSavedPressureReadLabel(request);

    return `Reopen saved ${pointToCoord(selectedReply, board.size)} ${label}`;
  }

  return 'Reopen saved read';
}

function getReturnToLivePressureReadMessage(
  request: GuidedReadReplayRequest,
  board: BoardState,
  liveReply: Point | null,
  restoredReply: Point | null,
  inspectedSequenceStepSummary: string | null,
): string {
  const liveBranchText = liveReply
    ? `back on the ${pointToCoord(liveReply, board.size)} branch`
    : 'back on the live branch';
  const savedReadText = restoredReply
    ? `The saved ${pointToCoord(restoredReply, board.size)} ${getSavedPressureReadLabel(request)} stays in chat if you want to reopen it.`
    : 'The saved read stays in chat if you want to reopen it.';
  const inspectedStepText = inspectedSequenceStepSummary ? `${inspectedSequenceStepSummary} ` : '';

  return `Returned to live read: ${liveBranchText}. ${inspectedStepText}${savedReadText}`;
}

interface PressureReplayActionOptions {
  board?: BoardState;
  pinnedSequenceStepKey?: string;
}

function getPressureReplayActionLabel(
  mode: 'branch' | 'recount',
  reply: Point,
  board?: BoardState,
): string {
  if (!board) return mode === 'recount' ? 'Show recount' : 'Show branch';

  const replyCoord = pointToCoord(reply, board.size);
  return mode === 'recount' ? `Show saved ${replyCoord} recount` : `Show saved ${replyCoord} branch`;
}

function getPressureComparisonReplayActionLabel(reply: Point, board?: BoardState): string {
  return board ? `Show saved ${pointToCoord(reply, board.size)} comparison` : 'Show comparison';
}

function getPressureDefenseReplayActionLabel(defensePoint: Point, board?: BoardState): string {
  return board ? `Show saved ${pointToCoord(defensePoint, board.size)} defense` : 'Show defense';
}

function getPressureFollowUpReplayActionLabel(followUpDefensePoint: Point, board?: BoardState): string {
  return board ? `Show saved ${pointToCoord(followUpDefensePoint, board.size)} follow-up defense` : 'Show follow-up';
}

function getPressureReplayAction(
  mode: 'branch' | 'recount',
  prompt: OneSpaceJumpReadPrompt,
  reply: Point,
  options: PressureReplayActionOptions = {},
): SenseiAction {
  const { board, pinnedSequenceStepKey } = options;

  return {
    id: getPinnedPressureReplayActionId(
      `guided:read-pressure:${mode}:${prompt.key}:${targetKey(reply)}`,
      pinnedSequenceStepKey,
    ),
    label: pinnedSequenceStepKey ? 'Show step' : getPressureReplayActionLabel(mode, reply, board),
  };
}

function withPreviewHighlights(action: SenseiAction, previewHighlights: OverlayHighlight[]): SenseiAction {
  return previewHighlights.length > 0 ? { ...action, previewHighlights } : action;
}

function getPressureComparisonReplayAction(
  prompt: OneSpaceJumpReadPrompt,
  reply: Point,
  comparedReply: Point,
  options: PressureReplayActionOptions = {},
): SenseiAction {
  const { board, pinnedSequenceStepKey } = options;

  return {
    id: getPinnedPressureReplayActionId(
      `guided:read-pressure:comparison:${prompt.key}:${targetKey(reply)}:${targetKey(comparedReply)}`,
      pinnedSequenceStepKey,
    ),
    label: pinnedSequenceStepKey ? 'Show step' : getPressureComparisonReplayActionLabel(reply, board),
  };
}

function getPressureDefenseReplayAction(
  prompt: OneSpaceJumpReadPrompt,
  reply: Point,
  comparedReply: Point,
  defensePoint: Point,
  options: PressureReplayActionOptions = {},
): SenseiAction {
  const { board, pinnedSequenceStepKey } = options;

  return {
    id: getPinnedPressureReplayActionId(
      `guided:read-pressure:defense:${prompt.key}:${targetKey(reply)}:${targetKey(comparedReply)}:${targetKey(defensePoint)}`,
      pinnedSequenceStepKey,
    ),
    label: pinnedSequenceStepKey ? 'Show step' : getPressureDefenseReplayActionLabel(defensePoint, board),
  };
}

function getPressureFollowUpDefenseReplayAction(
  prompt: OneSpaceJumpReadPrompt,
  reply: Point,
  comparedReply: Point,
  defensePoint: Point,
  followUpDefensePoint: Point,
  options: PressureReplayActionOptions = {},
): SenseiAction {
  const { board, pinnedSequenceStepKey } = options;

  return {
    id: getPinnedPressureReplayActionId(
      `guided:read-pressure:follow-up-defense:${prompt.key}:${targetKey(reply)}:${targetKey(comparedReply)}:${targetKey(defensePoint)}:${targetKey(followUpDefensePoint)}`,
      pinnedSequenceStepKey,
    ),
    label: pinnedSequenceStepKey ? 'Show step' : getPressureFollowUpReplayActionLabel(followUpDefensePoint, board),
  };
}

function getReturnToLivePressureReadAction(
  request: GuidedReadReplayRequest,
  board: BoardState,
  prompt: OneSpaceJumpReadPrompt | null,
  selectedReply: Point | null,
  comparedReply: Point | null,
  selectedDefense: Point | null,
  selectedFollowUpDefense: Point | null,
  previewHighlights: OverlayHighlight[],
  pinnedSequenceStepKey?: string,
): SenseiAction | null {
  if (!prompt || !selectedReply) return null;

  let action: SenseiAction | null = null;

  if (request.mode === 'branch' || request.mode === 'recount') {
    action = getPressureReplayAction(request.mode, prompt, selectedReply, { pinnedSequenceStepKey });
  } else if (request.mode === 'comparison' && comparedReply) {
    action = getPressureComparisonReplayAction(prompt, selectedReply, comparedReply, { pinnedSequenceStepKey });
  } else if (request.mode === 'defense' && comparedReply && selectedDefense) {
    action = getPressureDefenseReplayAction(prompt, selectedReply, comparedReply, selectedDefense, { pinnedSequenceStepKey });
  } else if (request.mode === 'follow-up-defense' && comparedReply && selectedDefense && selectedFollowUpDefense) {
    action = getPressureFollowUpDefenseReplayAction(
      prompt,
      selectedReply,
      comparedReply,
      selectedDefense,
      selectedFollowUpDefense,
      { pinnedSequenceStepKey },
    );
  }

  return action
    ? withPreviewHighlights(
      {
        ...action,
        label: getReturnToLivePressureReadActionLabel(
          request,
          board,
          selectedReply,
          selectedDefense,
          selectedFollowUpDefense,
        ),
      },
      previewHighlights,
    )
    : null;
}

function getReturnToLivePressureHandoffAction(
  prompt: OneSpaceJumpReadPrompt | null,
  liveReply: Point | null,
  comparedReply: Point | null,
  selectedDefense: Point | null,
  selectedFollowUpDefense: Point | null,
  handoff: PressureExtensionHandoff | null,
): SenseiAction | null {
  if (!prompt || !liveReply || !comparedReply || !handoff) return null;

  const pinnedHandoffStepKey = `handoff-${targetKey(handoff.point)}`;
  let action: SenseiAction | null = null;

  if (selectedDefense && selectedFollowUpDefense) {
    action = getPressureFollowUpDefenseReplayAction(
      prompt,
      liveReply,
      comparedReply,
      selectedDefense,
      selectedFollowUpDefense,
      { pinnedSequenceStepKey: pinnedHandoffStepKey },
    );
  } else if (selectedDefense) {
    action = getPressureDefenseReplayAction(
      prompt,
      liveReply,
      comparedReply,
      selectedDefense,
      { pinnedSequenceStepKey: pinnedHandoffStepKey },
    );
  } else {
    action = getPressureComparisonReplayAction(
      prompt,
      liveReply,
      comparedReply,
      { pinnedSequenceStepKey: pinnedHandoffStepKey },
    );
  }

  return withPreviewHighlights({ ...action, label: 'Show live handoff' }, buildPressureHandoffHighlights(handoff));
}

function getPinnedPressureReplayActionId(actionId: string, pinnedSequenceStepKey?: string): string {
  return pinnedSequenceStepKey ? `${actionId}:pin:${pinnedSequenceStepKey}` : actionId;
}

function getPressureSequenceFocusReplayAction(
  prompt: OneSpaceJumpReadPrompt | null,
  selectedReply: Point | null,
  selectedRecount: PressureRecount | null,
  comparedReply: Point | null,
  selectedDefenseOutcome: PressureDefenseOutcome | null,
  selectedFollowUpDefenseOutcome: PressureDefenseOutcome | null,
  pinnedSequenceStepKey: string,
): SenseiAction | null {
  if (!prompt || !selectedReply) return null;

  if (selectedFollowUpDefenseOutcome && selectedDefenseOutcome && comparedReply) {
    return getPressureFollowUpDefenseReplayAction(
      prompt,
      selectedReply,
      comparedReply,
      selectedDefenseOutcome.defense,
      selectedFollowUpDefenseOutcome.defense,
      { pinnedSequenceStepKey },
    );
  }

  if (selectedDefenseOutcome && comparedReply) {
    return getPressureDefenseReplayAction(
      prompt,
      selectedReply,
      comparedReply,
      selectedDefenseOutcome.defense,
      { pinnedSequenceStepKey },
    );
  }

  if (comparedReply) {
    return getPressureComparisonReplayAction(prompt, selectedReply, comparedReply, { pinnedSequenceStepKey });
  }

  if (selectedRecount) {
    return getPressureReplayAction('recount', prompt, selectedReply, { pinnedSequenceStepKey });
  }

  return getPressureReplayAction('branch', prompt, selectedReply, { pinnedSequenceStepKey });
}

function getPressureRecountFollowUp(
  prompt: OneSpaceJumpReadPrompt,
  anchorCoord: string,
  stoneCoord: string,
  anchorLibertyCount: number,
  stoneLibertyCount: number,
): string {
  if (anchorLibertyCount < stoneLibertyCount) {
    return `${anchorCoord} is the short side now, so defend it before extending again.`;
  }

  if (stoneLibertyCount < anchorLibertyCount) {
    return `${stoneCoord} is the short side now, so defend it before extending again.`;
  }

  if (anchorLibertyCount <= 2) {
    return `Both Black sides are short now, so finish answering ${prompt.gapCoord} before extending again.`;
  }

  return `Neither side is short yet, so keep building while staying ready to answer ${prompt.gapCoord}.`;
}

function getPressureRecount(game: GameState, prompt: OneSpaceJumpReadPrompt, reply: Point): PressureRecount | null {
  const whitePressure = playMove({
    ...game,
    currentPlayer: 'white',
    phase: 'playing',
    positionHistory: new Set(game.positionHistory),
  }, prompt.gap);
  if (!whitePressure.success) return null;

  const blackReply = playMove(whitePressure.newState, reply);
  if (!blackReply.success) return null;

  const anchorGroup = getGroup(blackReply.newState.board, prompt.anchor);
  const stoneGroup = getGroup(blackReply.newState.board, prompt.stone);
  if (!anchorGroup || !stoneGroup) return null;

  const boardSize = game.board.size;
  const replyCoord = pointToCoord(reply, boardSize);
  const anchorCoord = pointToCoord(prompt.anchor, boardSize);
  const stoneCoord = pointToCoord(prompt.stone, boardSize);
  const anchorLibertyText = joinAndCoordinateList(anchorGroup.liberties.map((point) => pointToCoord(point, boardSize)));
  const stoneLibertyText = joinAndCoordinateList(stoneGroup.liberties.map((point) => pointToCoord(point, boardSize)));
  const followUpText = getPressureRecountFollowUp(
    prompt,
    anchorCoord,
    stoneCoord,
    anchorGroup.liberties.length,
    stoneGroup.liberties.length,
  );

  return {
    text: `After ${replyCoord}, recount the two Black sides: ${anchorCoord} has ${formatLibertyCount(anchorGroup.liberties.length)} at ${anchorLibertyText}. ${stoneCoord} has ${formatLibertyCount(stoneGroup.liberties.length)} at ${stoneLibertyText}. ${followUpText}`,
    reply: copyPoint(reply),
    anchorLiberties: anchorGroup.liberties.map(copyPoint),
    stoneLiberties: stoneGroup.liberties.map(copyPoint),
  };
}

function formatPressureComparisonRow(
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  board: BoardState,
): string {
  const replyCoord = pointToCoord(recount.reply, board.size);
  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);

  return `${replyCoord}: ${anchorCoord} ${formatLibertyCount(recount.anchorLiberties.length)}, ${stoneCoord} ${formatLibertyCount(recount.stoneLiberties.length)}.`;
}

function formatLibertyChange(coord: string, beforeCount: number, afterCount: number): string {
  if (beforeCount === afterCount) {
    return `${coord} stays at ${formatLibertyCount(afterCount)}`;
  }

  const direction = afterCount > beforeCount ? 'gains' : 'loses';
  return `${coord} ${direction} ${formatLibertyCount(Math.abs(afterCount - beforeCount))}`;
}

function getPressureDefenseRecommendation(
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  board: BoardState,
): PressureDefenseRecommendation | null {
  const sides = [
    {
      point: prompt.anchor,
      coord: pointToCoord(prompt.anchor, board.size),
      liberties: recount.anchorLiberties,
    },
    {
      point: prompt.stone,
      coord: pointToCoord(prompt.stone, board.size),
      liberties: recount.stoneLiberties,
    },
  ].sort((a, b) => a.liberties.length - b.liberties.length);

  const [shortSide, roomySide] = sides;
  if (!shortSide || !roomySide || shortSide.liberties.length >= roomySide.liberties.length) return null;

  const libertyText = joinAndCoordinateList(shortSide.liberties.map((point) => pointToCoord(point, board.size)));
  return {
    shortSide: copyPoint(shortSide.point),
    shortSideCoord: shortSide.coord,
    liberties: shortSide.liberties.map(copyPoint),
    text: `Recommendation: ${shortSide.coord} is the short side with ${formatLibertyCount(shortSide.liberties.length)} at ${libertyText}. Defend ${shortSide.coord} before extending again.`,
  };
}

function getPressureDefenseReadText(
  defense: PressureDefenseRecommendation,
  point: Point,
  board: BoardState,
): string {
  const coord = pointToCoord(point, board.size);

  return `${coord} directly defends ${defense.shortSideCoord}, the short side in this pressure line. Keep ${defense.shortSideCoord} breathing first; then recount before extending again.`;
}

function getPressureDefenseSimulationState(
  game: GameState,
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  defensePoint: Point,
): GameState | null {
  const whitePressure = playMove({
    ...game,
    currentPlayer: 'white',
    phase: 'playing',
    positionHistory: new Set(game.positionHistory),
  }, prompt.gap);
  if (!whitePressure.success) return null;

  const blackReply = playMove(whitePressure.newState, recount.reply);
  if (!blackReply.success) return null;

  const blackDefense = playMove({
    ...blackReply.newState,
    currentPlayer: 'black',
    positionHistory: new Set(blackReply.newState.positionHistory),
  }, defensePoint);
  if (!blackDefense.success) return null;

  return blackDefense.newState;
}

function getPressureDefenseOutcome(
  game: GameState,
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  defense: PressureDefenseRecommendation,
  point: Point,
): PressureDefenseOutcome | null {
  if (!defense.liberties.some((liberty) => targetKey(liberty) === targetKey(point))) return null;

  const blackDefense = getPressureDefenseSimulationState(game, prompt, recount, point);
  if (!blackDefense) return null;

  const anchorGroup = getGroup(blackDefense.board, prompt.anchor);
  const stoneGroup = getGroup(blackDefense.board, prompt.stone);
  if (!anchorGroup || !stoneGroup) return null;

  const boardSize = game.board.size;
  const coord = pointToCoord(point, boardSize);
  const anchorCoord = pointToCoord(prompt.anchor, boardSize);
  const stoneCoord = pointToCoord(prompt.stone, boardSize);
  const defendedIsAnchor = targetKey(defense.shortSide) === targetKey(prompt.anchor);
  const defendedCoord = defense.shortSideCoord;
  const otherCoord = defendedIsAnchor ? stoneCoord : anchorCoord;
  const defendedBeforeCount = defendedIsAnchor ? recount.anchorLiberties.length : recount.stoneLiberties.length;
  const defendedAfterLiberties = defendedIsAnchor ? anchorGroup.liberties : stoneGroup.liberties;
  const otherAfterLiberties = defendedIsAnchor ? stoneGroup.liberties : anchorGroup.liberties;
  const connectedSides = anchorGroup.stones.some((stone) => targetKey(stone) === targetKey(prompt.stone));
  const defendedLibertyText = joinAndCoordinateList(defendedAfterLiberties.map((liberty) => pointToCoord(liberty, boardSize)));
  const otherLibertyText = joinAndCoordinateList(otherAfterLiberties.map((liberty) => pointToCoord(liberty, boardSize)));
  const defendedChangeText = defendedAfterLiberties.length > defendedBeforeCount
    ? `${defendedCoord} grows from ${defendedBeforeCount} to ${formatLibertyCount(defendedAfterLiberties.length)} at ${defendedLibertyText}.`
    : `${defendedCoord} has ${formatLibertyCount(defendedAfterLiberties.length)} at ${defendedLibertyText}.`;
  const followUpText = defendedAfterLiberties.length > otherAfterLiberties.length
    ? `${defendedCoord} is no longer the short side, so the defense did its job; now recount the whole position before extending again.`
    : defendedAfterLiberties.length === otherAfterLiberties.length
      ? `${defendedCoord} is level with ${otherCoord}, so the defense did its job; now recount the whole position before extending again.`
      : `${defendedCoord} is still the short side, so read one more defense before extending again.`;

  return {
    text: `After ${coord}, ${defendedChangeText} ${otherCoord} has ${formatLibertyCount(otherAfterLiberties.length)} at ${otherLibertyText}. ${followUpText}`,
    defense: copyPoint(point),
    defendedSide: copyPoint(defense.shortSide),
    defendedSideCoord: defense.shortSideCoord,
    defendedLiberties: defendedAfterLiberties.map(copyPoint),
    otherSide: copyPoint(defendedIsAnchor ? prompt.stone : prompt.anchor),
    otherSideCoord: otherCoord,
    otherLiberties: otherAfterLiberties.map(copyPoint),
    connectedSides,
  };
}

function getPressureDefenseContinuationRecommendation(
  outcome: PressureDefenseOutcome,
  board: BoardState,
): PressureDefenseRecommendation | null {
  if (outcome.defendedLiberties.length === outcome.otherLiberties.length) return null;

  const shortSideIsOther = outcome.otherLiberties.length < outcome.defendedLiberties.length;
  const shortSide = shortSideIsOther ? outcome.otherSide : outcome.defendedSide;
  const shortSideCoord = shortSideIsOther ? outcome.otherSideCoord : outcome.defendedSideCoord;
  const liberties = shortSideIsOther ? outcome.otherLiberties : outcome.defendedLiberties;
  const libertyText = joinAndCoordinateList(liberties.map((point) => pointToCoord(point, board.size)));
  const shortText = shortSideIsOther ? 'now the short side' : 'still the short side';

  return {
    shortSide: copyPoint(shortSide),
    shortSideCoord,
    liberties: liberties.map(copyPoint),
    text: `${shortSideCoord} is ${shortText} with ${formatLibertyCount(liberties.length)} at ${libertyText}. Try one more defense before extending.`,
  };
}

function getPressureDefenseContinuationReadText(
  defense: PressureDefenseRecommendation,
  point: Point,
  previousOutcome: PressureDefenseOutcome,
  board: BoardState,
): string {
  const coord = pointToCoord(point, board.size);
  const previousDefenseCoord = pointToCoord(previousOutcome.defense, board.size);
  const becameShorter = targetKey(defense.shortSide) === targetKey(previousOutcome.otherSide);
  const shortSideReason = becameShorter
    ? `the side that became shorter after ${previousDefenseCoord}`
    : `the side that is still short after ${previousDefenseCoord}`;

  return `${coord} now defends ${defense.shortSideCoord}, ${shortSideReason}. Keep ${defense.shortSideCoord} breathing before you return to extensions.`;
}

function getPressureDefenseContinuationOutcome(
  game: GameState,
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  previousOutcome: PressureDefenseOutcome,
  defense: PressureDefenseRecommendation,
  point: Point,
): PressureDefenseOutcome | null {
  if (!defense.liberties.some((liberty) => targetKey(liberty) === targetKey(point))) return null;

  const firstDefenseState = getPressureDefenseSimulationState(game, prompt, recount, previousOutcome.defense);
  if (!firstDefenseState) return null;

  const blackFollowUpDefense = playMove({
    ...firstDefenseState,
    currentPlayer: 'black',
    positionHistory: new Set(firstDefenseState.positionHistory),
  }, point);
  if (!blackFollowUpDefense.success) return null;

  const anchorGroup = getGroup(blackFollowUpDefense.newState.board, prompt.anchor);
  const stoneGroup = getGroup(blackFollowUpDefense.newState.board, prompt.stone);
  if (!anchorGroup || !stoneGroup) return null;

  const boardSize = game.board.size;
  const coord = pointToCoord(point, boardSize);
  const anchorCoord = pointToCoord(prompt.anchor, boardSize);
  const stoneCoord = pointToCoord(prompt.stone, boardSize);
  const defendedIsAnchor = targetKey(defense.shortSide) === targetKey(prompt.anchor);
  const defendedCoord = defense.shortSideCoord;
  const otherCoord = defendedIsAnchor ? stoneCoord : anchorCoord;
  const defendedBeforeCount = targetKey(defense.shortSide) === targetKey(previousOutcome.defendedSide)
    ? previousOutcome.defendedLiberties.length
    : previousOutcome.otherLiberties.length;
  const defendedAfterLiberties = defendedIsAnchor ? anchorGroup.liberties : stoneGroup.liberties;
  const otherAfterLiberties = defendedIsAnchor ? stoneGroup.liberties : anchorGroup.liberties;
  const connectedSides = anchorGroup.stones.some((stone) => targetKey(stone) === targetKey(prompt.stone));
  const defendedLibertyText = joinAndCoordinateList(defendedAfterLiberties.map((liberty) => pointToCoord(liberty, boardSize)));
  const otherLibertyText = joinAndCoordinateList(otherAfterLiberties.map((liberty) => pointToCoord(liberty, boardSize)));
  if (connectedSides) {
    return {
      text: `After ${coord}, ${anchorCoord} and ${stoneCoord} connect into one Black group with ${formatLibertyCount(defendedAfterLiberties.length)} at ${defendedLibertyText}. Both sides are one group now, so the local read is stable; return to the real game and choose an extension.`,
      defense: copyPoint(point),
      defendedSide: copyPoint(defense.shortSide),
      defendedSideCoord: defense.shortSideCoord,
      defendedLiberties: defendedAfterLiberties.map(copyPoint),
      otherSide: copyPoint(defendedIsAnchor ? prompt.stone : prompt.anchor),
      otherSideCoord: otherCoord,
      otherLiberties: otherAfterLiberties.map(copyPoint),
      connectedSides,
    };
  }

  const defendedChangeText = defendedAfterLiberties.length > defendedBeforeCount
    ? `${defendedCoord} grows from ${defendedBeforeCount} to ${formatLibertyCount(defendedAfterLiberties.length)} at ${defendedLibertyText}.`
    : `${defendedCoord} has ${formatLibertyCount(defendedAfterLiberties.length)} at ${defendedLibertyText}.`;
  const followUpText = defendedAfterLiberties.length > otherAfterLiberties.length
    ? `${otherCoord} is now the short side, so keep alternating defenses before extending again.`
    : defendedAfterLiberties.length === otherAfterLiberties.length
      ? 'Both sides are level, so the local read is stable; return to the real game and choose an extension.'
      : `${defendedCoord} is still the short side, so read one more defense before extending again.`;

  return {
    text: `After ${coord}, ${defendedChangeText} ${otherCoord} has ${formatLibertyCount(otherAfterLiberties.length)} at ${otherLibertyText}. ${followUpText}`,
    defense: copyPoint(point),
    defendedSide: copyPoint(defense.shortSide),
    defendedSideCoord: defense.shortSideCoord,
    defendedLiberties: defendedAfterLiberties.map(copyPoint),
    otherSide: copyPoint(defendedIsAnchor ? prompt.stone : prompt.anchor),
    otherSideCoord: otherCoord,
    otherLiberties: otherAfterLiberties.map(copyPoint),
    connectedSides,
  };
}

function getPressureDefenseChoiceHint(
  prompt: OneSpaceJumpReadPrompt,
  outcome: PressureDefenseOutcome,
  board: BoardState,
  coord: string,
): string {
  if (outcome.connectedSides) {
    const anchorCoord = pointToCoord(prompt.anchor, board.size);
    const stoneCoord = pointToCoord(prompt.stone, board.size);

    return `${coord} connects ${anchorCoord} and ${stoneCoord} into one group with ${formatLibertyCount(outcome.defendedLiberties.length)}.`;
  }

  if (outcome.defendedLiberties.length === outcome.otherLiberties.length) {
    return `${coord} levels ${outcome.defendedSideCoord} with ${outcome.otherSideCoord} at ${formatLibertyCount(outcome.defendedLiberties.length)}.`;
  }

  if (outcome.defendedLiberties.length > outcome.otherLiberties.length) {
    return `${coord} grows ${outcome.defendedSideCoord} to ${formatLibertyCount(outcome.defendedLiberties.length)}; ${outcome.otherSideCoord} becomes the next read.`;
  }

  return `${coord} grows ${outcome.defendedSideCoord} to ${formatLibertyCount(outcome.defendedLiberties.length)}, but it stays shorter than ${outcome.otherSideCoord}.`;
}

function getPressureDefenseChoices(
  game: GameState,
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  defense: PressureDefenseRecommendation,
): ReplaySequenceDefenseChoice[] {
  return defense.liberties.map((point): ReplaySequenceDefenseChoice => {
    const coord = pointToCoord(point, game.board.size);
    const outcome = getPressureDefenseOutcome(game, prompt, recount, defense, point);

    return {
      point,
      coord,
      hint: outcome ? getPressureDefenseChoiceHint(prompt, outcome, game.board, coord) : null,
      highlights: outcome
        ? buildOneSpaceJumpDefenseOutcomeHighlights(prompt, recount, game.board, outcome)
        : null,
      outcome,
    };
  });
}

function getPressureFollowUpDefenseChoices(
  game: GameState,
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  previousOutcome: PressureDefenseOutcome,
  defense: PressureDefenseRecommendation,
): ReplaySequenceDefenseChoice[] {
  return defense.liberties.map((point): ReplaySequenceDefenseChoice => {
    const coord = pointToCoord(point, game.board.size);
    const outcome = getPressureDefenseContinuationOutcome(
      game,
      prompt,
      recount,
      previousOutcome,
      defense,
      point,
    );

    return {
      point,
      coord,
      hint: outcome ? getPressureDefenseChoiceHint(prompt, outcome, game.board, coord) : null,
      highlights: outcome
        ? buildOneSpaceJumpFollowUpDefenseOutcomeHighlights(prompt, recount, game.board, previousOutcome, outcome)
        : null,
      outcome,
    };
  });
}

function getReplaySequenceChoiceSafetyScore(choice: ReplaySequenceDefenseChoice): number {
  if (!choice.outcome) return Number.NEGATIVE_INFINITY;

  const defendedLibertyCount = choice.outcome.defendedLiberties.length;
  const otherLibertyCount = choice.outcome.otherLiberties.length;
  const minimumLibertyCount = Math.min(defendedLibertyCount, otherLibertyCount);
  const totalLibertyCount = defendedLibertyCount + otherLibertyCount;

  return (choice.outcome.connectedSides ? 10000 : 0) + minimumLibertyCount * 100 + totalLibertyCount;
}

function getSafestReplaySequenceChoice(choices: ReplaySequenceDefenseChoice[]): ReplaySequenceDefenseChoice | null {
  return choices.reduce<ReplaySequenceDefenseChoice | null>((best, choice) => {
    if (!choice.outcome) return best;
    if (!best) return choice;

    return getReplaySequenceChoiceSafetyScore(choice) > getReplaySequenceChoiceSafetyScore(best)
      ? choice
      : best;
  }, null);
}

function formatReplaySequenceChoiceSummary(choices: ReplaySequenceDefenseChoice[]): string | null {
  const hints = choices
    .map((choice) => choice.hint)
    .filter((hint): hint is string => Boolean(hint));

  return hints.length > 0 ? `Next choices: ${hints.join(' ')}` : null;
}

function formatReplaySequenceRecommendedChoice(choice: ReplaySequenceDefenseChoice | null): string | null {
  return choice?.hint ? `Recommended: ${choice.hint}` : null;
}

function getPressureSequenceContinuationSummary(
  game: GameState,
  prompt: OneSpaceJumpReadPrompt | null,
  selectedRecount: PressureRecount | null,
  comparedReply: Point | null,
  defenseRecommendation: PressureDefenseRecommendation | null,
  selectedDefenseOutcome: PressureDefenseOutcome | null,
  continuationRecommendation: PressureDefenseRecommendation | null,
  row: PressureReadSequenceRow,
): string | null {
  if (!prompt || !selectedRecount || !comparedReply) return null;

  if (
    defenseRecommendation
    && row.replayKey === `compare-${targetKey(selectedRecount.reply)}`
  ) {
    const choices = getPressureDefenseChoices(
      game,
      prompt,
      selectedRecount,
      defenseRecommendation,
    );

    return [
      formatReplaySequenceChoiceSummary(choices),
      formatReplaySequenceRecommendedChoice(getSafestReplaySequenceChoice(choices)),
    ].filter((text): text is string => Boolean(text)).join(' ');
  }

  if (
    selectedDefenseOutcome
    && continuationRecommendation
    && row.replayKey === `defense-${targetKey(selectedDefenseOutcome.defense)}`
  ) {
    const choices = getPressureFollowUpDefenseChoices(
      game,
      prompt,
      selectedRecount,
      selectedDefenseOutcome,
      continuationRecommendation,
    );

    return [
      formatReplaySequenceChoiceSummary(choices),
      formatReplaySequenceRecommendedChoice(getSafestReplaySequenceChoice(choices)),
    ].filter((text): text is string => Boolean(text)).join(' ');
  }

  return null;
}

function getPressureDefenseContinuationChatAction(
  prompt: OneSpaceJumpReadPrompt,
  reply: Point,
  comparedReply: Point,
  choice: ReplaySequenceDefenseChoice,
): SenseiAction {
  return {
    ...getPressureDefenseReplayAction(
      prompt,
      reply,
      comparedReply,
      choice.point,
      { pinnedSequenceStepKey: `defense-${targetKey(choice.point)}` },
    ),
    label: `Recommended: ${choice.coord}`,
    ...(choice.highlights ? { previewHighlights: choice.highlights } : {}),
  };
}

function getPressureFollowUpDefenseContinuationChatAction(
  prompt: OneSpaceJumpReadPrompt,
  reply: Point,
  comparedReply: Point,
  firstDefensePoint: Point,
  choice: ReplaySequenceDefenseChoice,
): SenseiAction {
  return {
    ...getPressureFollowUpDefenseReplayAction(
      prompt,
      reply,
      comparedReply,
      firstDefensePoint,
      choice.point,
      { pinnedSequenceStepKey: `follow-up-${targetKey(choice.point)}` },
    ),
    label: `Recommended: ${choice.coord}`,
    ...(choice.highlights ? { previewHighlights: choice.highlights } : {}),
  };
}

function getPressureSequenceContinuationActions(
  game: GameState,
  prompt: OneSpaceJumpReadPrompt | null,
  selectedRecount: PressureRecount | null,
  comparedReply: Point | null,
  defenseRecommendation: PressureDefenseRecommendation | null,
  selectedDefenseOutcome: PressureDefenseOutcome | null,
  continuationRecommendation: PressureDefenseRecommendation | null,
  row: PressureReadSequenceRow,
): SenseiAction[] {
  if (!prompt || !selectedRecount || !comparedReply) return [];

  if (
    defenseRecommendation
    && row.replayKey === `compare-${targetKey(selectedRecount.reply)}`
  ) {
    const safestChoice = getSafestReplaySequenceChoice(getPressureDefenseChoices(
      game,
      prompt,
      selectedRecount,
      defenseRecommendation,
    ));

    return safestChoice
      ? [getPressureDefenseContinuationChatAction(prompt, selectedRecount.reply, comparedReply, safestChoice)]
      : [];
  }

  if (
    selectedDefenseOutcome
    && continuationRecommendation
    && row.replayKey === `defense-${targetKey(selectedDefenseOutcome.defense)}`
  ) {
    const safestChoice = getSafestReplaySequenceChoice(getPressureFollowUpDefenseChoices(
      game,
      prompt,
      selectedRecount,
      selectedDefenseOutcome,
      continuationRecommendation,
    ));

    return safestChoice
      ? [getPressureFollowUpDefenseContinuationChatAction(
        prompt,
        selectedRecount.reply,
        comparedReply,
        selectedDefenseOutcome.defense,
        safestChoice,
      )]
      : [];
  }

  return [];
}

function getPressureDefenseContinuationComparisonSummary(
  game: GameState,
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  previousOutcome: PressureDefenseOutcome,
  defense: PressureDefenseRecommendation,
): PressureFollowUpComparisonSummary | null {
  const anchorCoord = pointToCoord(prompt.anchor, game.board.size);
  const stoneCoord = pointToCoord(prompt.stone, game.board.size);
  const compared = defense.liberties.flatMap((point) => {
    const outcome = getPressureDefenseContinuationOutcome(game, prompt, recount, previousOutcome, defense, point);
    if (!outcome) return [];

    return [{ point, outcome }];
  });
  if (compared.length === 0) return null;

  const rows = compared.map(({ point, outcome }) => {
    const coord = pointToCoord(point, game.board.size);

    return outcome.connectedSides
      ? `${coord}: connects ${anchorCoord} and ${stoneCoord} into one group with ${formatLibertyCount(outcome.defendedLiberties.length)}.`
      : `${coord}: ${outcome.defendedSideCoord} ${formatLibertyCount(outcome.defendedLiberties.length)}, ${outcome.otherSideCoord} ${formatLibertyCount(outcome.otherLiberties.length)}.`;
  });
  const connectionCoords = compared
    .filter(({ outcome }) => outcome.connectedSides)
    .map(({ point }) => pointToCoord(point, game.board.size));
  const separateCoords = compared
    .filter(({ outcome }) => !outcome.connectedSides)
    .map(({ point }) => pointToCoord(point, game.board.size));
  const text = connectionCoords.length > 0 && separateCoords.length > 0
    ? `Connection note: ${joinAndCoordinateList(connectionCoords)} ${connectionCoords.length === 1 ? 'joins' : 'join'} ${anchorCoord} and ${stoneCoord} into one Black group; ${joinAndCoordinateList(separateCoords)} ${separateCoords.length === 1 ? 'keeps' : 'keep'} the sides separate.`
    : connectionCoords.length > 0
      ? `Connection note: ${joinAndCoordinateList(connectionCoords)} ${connectionCoords.length === 1 ? 'joins' : 'join'} ${anchorCoord} and ${stoneCoord} into one Black group.`
      : `Connection note: ${joinAndCoordinateList(separateCoords)} keep the sides separate, so choose the direction that leaves the next extension clearest.`;

  return { rows, text };
}

function isStablePressureDefenseOutcome(outcome: PressureDefenseOutcome): boolean {
  return outcome.connectedSides || outcome.defendedLiberties.length === outcome.otherLiberties.length;
}

function getStablePressureExtensionHandoff(
  objective: BeginnerObjective,
  targets: Point[],
  board: BoardState,
  prompt: OneSpaceJumpReadPrompt | null,
  isStable: boolean,
): PressureExtensionHandoff | null {
  if (!isStable || objective.id !== 'extend-from-stone' || !prompt) return null;

  const point = targets.find((target) => getStone(board, target) === null);
  if (!point) return null;

  const coord = pointToCoord(point, board.size);
  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);

  return {
    point: copyPoint(point),
    coord,
    text: `The read is stable, so turn it into a real move: play ${coord} for ${objective.title}.`,
    ariaLabel: `Play ${coord} in the real game after the stable pressure read`,
    recap: {
      point: copyPoint(point),
      coord,
      text: `${coord} applies the ${prompt.gapCoord} read in the real game: ${anchorCoord} and ${stoneCoord} stayed safe in the variation, so Black can keep extending instead of answering a cut that has not happened.`,
    },
  };
}

function buildPressureHandoffHighlights(handoff: PressureExtensionHandoff): OverlayHighlight[] {
  return [{
    id: `read-pressure-handoff-${targetKey(handoff.point)}`,
    point: copyPoint(handoff.point),
    variant: 'positive',
    label: `${handoff.coord}: real move to play after the stable pressure read.`,
  }];
}

function getPressureReadSequenceRowBranchBadge(
  row: PressureReadSequenceRow,
  context: PressureReadSequenceBranchContext | null,
): PressureReadSequenceBranchBadge | null {
  if (!context) return null;

  const branchReplyKey = getPressureReadSequenceReplayReplyKey(row.replayKey);

  if (branchReplyKey === context.savedReplyKey) return { label: 'Saved branch', tone: 'saved' };
  if (branchReplyKey === context.liveReplyKey) return { label: 'Live branch', tone: 'live' };

  if (
    row.replayKey.startsWith('defense-')
    || row.replayKey.startsWith('follow-up-')
    || row.replayKey.startsWith('handoff-')
  ) {
    return { label: 'Saved branch', tone: 'saved' };
  }

  return null;
}

function formatPressureReadSequenceFocusMessage(
  row: PressureReadSequenceRow,
  index: number,
  branchBadge: PressureReadSequenceBranchBadge | null,
): string {
  const branchContext = branchBadge ? `${branchBadge.label}. ` : '';

  return `Read sequence focus: ${branchContext}Step ${index + 1}: ${row.text} ${row.focusText}`;
}

function formatPressureReadSequenceReturnSummary(
  row: PressureReadSequenceRow,
  index: number,
  branchBadge: PressureReadSequenceBranchBadge | null,
): string {
  const stepLabel = branchBadge ? `${branchBadge.label} step ${index + 1}` : `step ${index + 1}`;
  const rowText = row.text.replace(/[.!?]$/, '');

  return `Last inspected sequence step: ${stepLabel}, ${rowText}.`;
}

function formatPressureSequenceLibertyStep(
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  board: BoardState,
): string {
  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);

  return `${anchorCoord} ${formatLibertyCount(recount.anchorLiberties.length)}; ${stoneCoord} ${formatLibertyCount(recount.stoneLiberties.length)}`;
}

function getPressureReadSequenceRows(
  board: BoardState,
  prompt: OneSpaceJumpReadPrompt | null,
  selectedReply: Point | null,
  selectedRecount: PressureRecount | null,
  comparedRecount: PressureRecount | null,
  selectedDefenseOutcome: PressureDefenseOutcome | null,
  selectedFollowUpDefenseOutcome: PressureDefenseOutcome | null,
  extensionHandoff: PressureExtensionHandoff | null,
): PressureReadSequenceRow[] {
  if (!prompt || (!selectedReply && !selectedRecount && !comparedRecount)) return [];

  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);
  const primaryRecount = comparedRecount ?? selectedRecount;
  const comparisonRecount = comparedRecount && selectedRecount ? selectedRecount : null;
  const firstReply = primaryRecount?.reply ?? selectedReply;
  const liveComparisonCoord = comparisonRecount ? pointToCoord(comparisonRecount.reply, board.size) : null;
  const firstReplyKeepsSidesSafe = primaryRecount
    ? primaryRecount.anchorLiberties.length === primaryRecount.stoneLiberties.length
      && primaryRecount.anchorLiberties.length >= 3
    : false;
  const rows: PressureReadSequenceRow[] = [{
    key: `${prompt.key}:pressure-gap`,
    replayKey: 'gap',
    text: `White ${prompt.gapCoord} tests the gap between ${anchorCoord} and ${stoneCoord}.`,
    focusText: `Use this as the reference point: every branch starts by imagining White ${prompt.gapCoord} before Black answers.`,
    nextQuestion: `If White really plays ${prompt.gapCoord}, which Black reply attacks the cutter without leaving a short side?`,
    highlights: buildOneSpaceJumpPressureHighlights(prompt, board),
  }];

  if (firstReply) {
    const firstReplyCoord = pointToCoord(firstReply, board.size);
    rows.push({
      key: `${prompt.key}:pressure-reply-${targetKey(firstReply)}`,
      replayKey: `reply-${targetKey(firstReply)}`,
      text: `Black ${firstReplyCoord} attacks ${prompt.gapCoord} from ${getReplyDirection(firstReply, prompt.gap)}.`,
      focusText: liveComparisonCoord
        ? `Compare this saved first answer with the live ${liveComparisonCoord} branch; the direction changes before the liberty counts are checked.`
        : `Save this first answer before recounting ${anchorCoord} and ${stoneCoord}; it sets the branch direction.`,
      nextQuestion: liveComparisonCoord
        ? firstReplyKeepsSidesSafe
          ? `Before returning to ${liveComparisonCoord}, ask: did ${firstReplyCoord} change the attack direction while keeping both sides safe?`
          : `Before returning to ${liveComparisonCoord}, ask: did ${firstReplyCoord} change the attack direction or reveal a short side?`
        : `Before recounting, ask which side of the jump ${firstReplyCoord} pressures first.`,
      highlights: buildOneSpaceJumpPressureHighlights(prompt, board, firstReply),
    });
  }

  if (primaryRecount) {
    const primaryCoord = pointToCoord(primaryRecount.reply, board.size);
    rows.push({
      key: `${prompt.key}:pressure-recount-${targetKey(primaryRecount.reply)}`,
      replayKey: `recount-${targetKey(primaryRecount.reply)}`,
      text: `Recount: ${formatPressureSequenceLibertyStep(prompt, primaryRecount, board)}.`,
      focusText: liveComparisonCoord
        ? `Pin this ${primaryCoord} count as the baseline before the live ${liveComparisonCoord} comparison; it shows what stayed safe or became short.`
        : `Pin this liberty count before choosing another reply; it tells you whether either side is already short.`,
      nextQuestion: liveComparisonCoord
        ? `Before checking ${liveComparisonCoord}, ask which liberty count is the baseline for comparison.`
        : `Which side is shorter after ${primaryCoord}, or are both sides ready for another reply?`,
      highlights: buildOneSpaceJumpRecountHighlights(prompt, primaryRecount, board),
    });
  }

  if (comparisonRecount) {
    const comparisonCoord = pointToCoord(comparisonRecount.reply, board.size);
    const primaryCoord = primaryRecount ? pointToCoord(primaryRecount.reply, board.size) : null;
    rows.push({
      key: `${prompt.key}:pressure-compare-${targetKey(comparisonRecount.reply)}`,
      replayKey: `compare-${targetKey(comparisonRecount.reply)}`,
      text: `Compare ${comparisonCoord}: ${formatPressureSequenceLibertyStep(prompt, comparisonRecount, board)}.`,
      focusText: primaryCoord
        ? `This is the live comparison against ${primaryCoord}; use it to see whether the reply direction or liberty count changed.`
        : `This is the alternate reply count; compare it against the first answer before extending.`,
      nextQuestion: `After ${comparisonCoord}, which side changed, and does that force a defense before extending?`,
      highlights: buildOneSpaceJumpRecountHighlights(prompt, comparisonRecount, board),
    });
  }

  if (selectedDefenseOutcome && selectedRecount) {
    const defenseCoord = pointToCoord(selectedDefenseOutcome.defense, board.size);
    rows.push({
      key: `${prompt.key}:pressure-defense-${targetKey(selectedDefenseOutcome.defense)}`,
      replayKey: `defense-${targetKey(selectedDefenseOutcome.defense)}`,
      text: `Defend ${selectedDefenseOutcome.defendedSideCoord} at ${defenseCoord}; ${selectedDefenseOutcome.defendedSideCoord} has ${formatLibertyCount(selectedDefenseOutcome.defendedLiberties.length)}.`,
      focusText: `This shows how ${defenseCoord} changes the short side before the next read; compare it with the warning markers from the branch.`,
      nextQuestion: `After ${defenseCoord}, which side is now shorter, and should the read continue there?`,
      highlights: buildOneSpaceJumpDefenseOutcomeHighlights(prompt, selectedRecount, board, selectedDefenseOutcome),
    });
  }

  if (selectedFollowUpDefenseOutcome && selectedDefenseOutcome && selectedRecount) {
    const followUpCoord = pointToCoord(selectedFollowUpDefenseOutcome.defense, board.size);

    rows.push({
      key: `${prompt.key}:pressure-follow-up-${targetKey(selectedFollowUpDefenseOutcome.defense)}`,
      replayKey: `follow-up-${targetKey(selectedFollowUpDefenseOutcome.defense)}`,
      text: selectedFollowUpDefenseOutcome.connectedSides
        ? `Follow-up ${followUpCoord} connects ${anchorCoord} and ${stoneCoord} into one group.`
        : `Follow-up ${followUpCoord}: ${selectedFollowUpDefenseOutcome.defendedSideCoord} has ${formatLibertyCount(selectedFollowUpDefenseOutcome.defendedLiberties.length)}; ${selectedFollowUpDefenseOutcome.otherSideCoord} has ${formatLibertyCount(selectedFollowUpDefenseOutcome.otherLiberties.length)}.`,
      focusText: selectedFollowUpDefenseOutcome.connectedSides
        ? `This shows the follow-up that connects ${anchorCoord} and ${stoneCoord}; compare it with defenses that only add liberties.`
        : `This shows the second defense after the other side became short; compare the new liberty counts before returning to the real board.`,
      nextQuestion: selectedFollowUpDefenseOutcome.connectedSides
        ? `Does ${followUpCoord} connect the stones strongly enough to leave the local fight?`
        : `After ${followUpCoord}, are both sides stable enough to return to the real board?`,
      highlights: buildOneSpaceJumpFollowUpDefenseOutcomeHighlights(
        prompt,
        selectedRecount,
        board,
        selectedDefenseOutcome,
        selectedFollowUpDefenseOutcome,
      ),
    });
  }

  if (extensionHandoff) {
    const stableSource = selectedDefenseOutcome || selectedFollowUpDefenseOutcome ? 'simulated defenses' : 'comparison branches';
    rows.push({
      key: `${prompt.key}:pressure-handoff-${targetKey(extensionHandoff.point)}`,
      replayKey: `handoff-${targetKey(extensionHandoff.point)}`,
      text: `Real-game handoff: play ${extensionHandoff.coord} after the stable read.`,
      focusText: `This is the real move unlocked by the completed read; play it after the ${stableSource} show ${anchorCoord} and ${stoneCoord} are stable.`,
      nextQuestion: `What real move can you play now that ${anchorCoord} and ${stoneCoord} survived the simulation?`,
      highlights: buildPressureHandoffHighlights(extensionHandoff),
    });
  }

  return rows;
}

function getActivePressureReadHighlights(
  board: BoardState,
  prompt: OneSpaceJumpReadPrompt | null,
  selectedReply: Point | null,
  selectedRecount: PressureRecount | null,
  selectedDefenseOutcome: PressureDefenseOutcome | null,
  selectedFollowUpDefenseOutcome: PressureDefenseOutcome | null,
): OverlayHighlight[] {
  if (!prompt) return [];

  if (selectedFollowUpDefenseOutcome && selectedDefenseOutcome && selectedRecount) {
    return buildOneSpaceJumpFollowUpDefenseOutcomeHighlights(
      prompt,
      selectedRecount,
      board,
      selectedDefenseOutcome,
      selectedFollowUpDefenseOutcome,
    );
  }

  if (selectedDefenseOutcome && selectedRecount) {
    return buildOneSpaceJumpDefenseOutcomeHighlights(prompt, selectedRecount, board, selectedDefenseOutcome);
  }

  if (selectedRecount) {
    return buildOneSpaceJumpRecountHighlights(prompt, selectedRecount, board);
  }

  if (selectedReply) {
    return buildOneSpaceJumpPressureHighlights(prompt, board, selectedReply);
  }

  return buildOneSpaceJumpPressureHighlights(prompt, board);
}

function getReplayPressureDefensePoint(
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  board: BoardState,
  defensePointKey: string,
): Point | null {
  const defense = getPressureDefenseRecommendation(prompt, recount, board);

  return defense?.liberties.find((point) => targetKey(point) === defensePointKey) ?? null;
}

function getPressureComparisonSummary(
  prompt: OneSpaceJumpReadPrompt,
  firstRecount: PressureRecount,
  secondRecount: PressureRecount,
  board: BoardState,
): PressureComparisonSummary {
  const firstCoord = pointToCoord(firstRecount.reply, board.size);
  const secondCoord = pointToCoord(secondRecount.reply, board.size);
  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);
  const directionText = `${firstCoord} attacks ${prompt.gapCoord} from ${getReplyDirection(firstRecount.reply, prompt.gap)}, while ${secondCoord} attacks it from ${getReplyDirection(secondRecount.reply, prompt.gap)}.`;
  const hasSameCounts = firstRecount.anchorLiberties.length === secondRecount.anchorLiberties.length
    && firstRecount.stoneLiberties.length === secondRecount.stoneLiberties.length;
  const defenseRecommendation = getPressureDefenseRecommendation(prompt, secondRecount, board);

  return {
    rows: [
      formatPressureComparisonRow(prompt, firstRecount, board),
      formatPressureComparisonRow(prompt, secondRecount, board),
    ],
    text: hasSameCounts
      ? `${firstCoord} and ${secondCoord} leave the same liberty counts: ${anchorCoord} has ${formatLibertyCount(secondRecount.anchorLiberties.length)} and ${stoneCoord} has ${formatLibertyCount(secondRecount.stoneLiberties.length)} either way. The difference is direction: ${directionText}`
      : `Compared with ${firstCoord}, ${secondCoord} changes the count: ${formatLibertyChange(anchorCoord, firstRecount.anchorLiberties.length, secondRecount.anchorLiberties.length)} and ${formatLibertyChange(stoneCoord, firstRecount.stoneLiberties.length, secondRecount.stoneLiberties.length)}. The direction also changes: ${directionText}`,
    recommendationText: defenseRecommendation?.text ?? null,
    defenseRecommendation,
  };
}

function buildOneSpaceJumpRecountHighlights(
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  board: BoardState,
  selectedDefense: Point | null = null,
): OverlayHighlight[] {
  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);
  const gapCoord = pointToCoord(prompt.gap, board.size);
  const replyCoord = pointToCoord(recount.reply, board.size);
  const selectedReplyKey = targetKey(recount.reply);
  const anchorLibertyText = joinAndCoordinateList(recount.anchorLiberties.map((point) => pointToCoord(point, board.size)));
  const stoneLibertyText = joinAndCoordinateList(recount.stoneLiberties.map((point) => pointToCoord(point, board.size)));
  const selectedDefenseKey = selectedDefense ? targetKey(selectedDefense) : null;
  const anchorIsShort = recount.anchorLiberties.length < recount.stoneLiberties.length;
  const stoneIsShort = recount.stoneLiberties.length < recount.anchorLiberties.length;
  const shortSide = anchorIsShort
    ? { coord: anchorCoord, liberties: recount.anchorLiberties }
    : stoneIsShort
      ? { coord: stoneCoord, liberties: recount.stoneLiberties }
      : null;

  return [
    {
      id: `read-pressure-anchor-${targetKey(prompt.anchor)}`,
      point: copyPoint(prompt.anchor),
      variant: anchorIsShort ? 'warning' : 'positive',
      label: anchorIsShort
        ? `${anchorCoord}: short side with ${formatLibertyCount(recount.anchorLiberties.length)} after ${replyCoord}: ${anchorLibertyText}.`
        : `${anchorCoord}: ${formatLibertyCount(recount.anchorLiberties.length)} after ${replyCoord}: ${anchorLibertyText}.`,
    },
    {
      id: `read-pressure-stone-${targetKey(prompt.stone)}`,
      point: copyPoint(prompt.stone),
      variant: stoneIsShort ? 'warning' : 'positive',
      label: stoneIsShort
        ? `${stoneCoord}: short side with ${formatLibertyCount(recount.stoneLiberties.length)} after ${replyCoord}: ${stoneLibertyText}.`
        : `${stoneCoord}: ${formatLibertyCount(recount.stoneLiberties.length)} after ${replyCoord}: ${stoneLibertyText}.`,
    },
    {
      id: `read-pressure-gap-${targetKey(prompt.gap)}`,
      point: copyPoint(prompt.gap),
      variant: 'warning',
      label: `${gapCoord}: imagined White pressure point to keep watching.`,
    },
    ...prompt.replyPoints.map((point) => {
      const coord = pointToCoord(point, board.size);
      const isSelected = targetKey(point) === selectedReplyKey;

      return {
        id: `read-pressure-reply-${targetKey(point)}`,
        point: copyPoint(point),
        variant: isSelected ? 'positive' as const : 'neutral' as const,
        label: isSelected
          ? `${coord}: selected reply used for this recount.`
          : `${coord}: alternate reply to compare later.`,
      };
    }),
    ...(shortSide
      ? shortSide.liberties.map((point) => {
        const coord = pointToCoord(point, board.size);
        const isSelectedDefense = selectedDefenseKey === targetKey(point);

        return {
          id: isSelectedDefense
            ? `read-pressure-selected-defense-${targetKey(point)}`
            : `read-pressure-short-liberty-${targetKey(point)}`,
          point: copyPoint(point),
          variant: isSelectedDefense ? 'positive' as const : 'warning' as const,
          label: isSelectedDefense
            ? `${coord}: selected defense for ${shortSide.coord}; keep the short side breathing before extending.`
            : `${coord}: defend this ${shortSide.coord} liberty before extending.`,
        };
      })
      : []),
  ];
}

function buildOneSpaceJumpDefenseOutcomeHighlights(
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  board: BoardState,
  outcome: PressureDefenseOutcome,
): OverlayHighlight[] {
  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);
  const gapCoord = pointToCoord(prompt.gap, board.size);
  const defenseCoord = pointToCoord(outcome.defense, board.size);
  const selectedReplyKey = targetKey(recount.reply);
  const defendedIsAnchor = targetKey(outcome.defendedSide) === targetKey(prompt.anchor);
  const anchorLiberties = defendedIsAnchor ? outcome.defendedLiberties : outcome.otherLiberties;
  const stoneLiberties = defendedIsAnchor ? outcome.otherLiberties : outcome.defendedLiberties;
  const anchorLibertyText = joinAndCoordinateList(anchorLiberties.map((point) => pointToCoord(point, board.size)));
  const stoneLibertyText = joinAndCoordinateList(stoneLiberties.map((point) => pointToCoord(point, board.size)));
  const anchorIsShort = anchorLiberties.length < stoneLiberties.length;
  const stoneIsShort = stoneLiberties.length < anchorLiberties.length;
  const defendedStillShort = outcome.defendedLiberties.length < outcome.otherLiberties.length;
  const defenseLibertyVariant = defendedStillShort ? 'warning' as const : 'positive' as const;

  return [
    {
      id: `read-pressure-anchor-${targetKey(prompt.anchor)}`,
      point: copyPoint(prompt.anchor),
      variant: anchorIsShort ? 'warning' as const : 'positive' as const,
      label: anchorIsShort
        ? `${anchorCoord}: short side with ${formatLibertyCount(anchorLiberties.length)} after ${defenseCoord} defense: ${anchorLibertyText}.`
        : `${anchorCoord}: ${formatLibertyCount(anchorLiberties.length)} after ${defenseCoord} defense: ${anchorLibertyText}.`,
    },
    {
      id: `read-pressure-stone-${targetKey(prompt.stone)}`,
      point: copyPoint(prompt.stone),
      variant: stoneIsShort ? 'warning' as const : 'positive' as const,
      label: stoneIsShort
        ? `${stoneCoord}: short side with ${formatLibertyCount(stoneLiberties.length)} after ${defenseCoord} defense: ${stoneLibertyText}.`
        : `${stoneCoord}: ${formatLibertyCount(stoneLiberties.length)} after ${defenseCoord} defense: ${stoneLibertyText}.`,
    },
    {
      id: `read-pressure-gap-${targetKey(prompt.gap)}`,
      point: copyPoint(prompt.gap),
      variant: 'warning',
      label: `${gapCoord}: imagined White pressure point to keep watching.`,
    },
    ...prompt.replyPoints.map((point) => {
      const coord = pointToCoord(point, board.size);
      const isSelected = targetKey(point) === selectedReplyKey;

      return {
        id: `read-pressure-reply-${targetKey(point)}`,
        point: copyPoint(point),
        variant: isSelected ? 'positive' as const : 'neutral' as const,
        label: isSelected
          ? `${coord}: selected reply before this defense.`
          : `${coord}: alternate reply to compare later.`,
      };
    }),
    {
      id: `read-pressure-selected-defense-${targetKey(outcome.defense)}`,
      point: copyPoint(outcome.defense),
      variant: 'positive',
      label: `${defenseCoord}: simulated defense; ${outcome.defendedSideCoord} now has ${formatLibertyCount(outcome.defendedLiberties.length)}.`,
    },
    ...outcome.defendedLiberties.map((point) => {
      const coord = pointToCoord(point, board.size);

      return {
        id: `read-pressure-defense-liberty-${targetKey(point)}`,
        point: copyPoint(point),
        variant: defenseLibertyVariant,
        label: defendedStillShort
          ? `${coord}: ${outcome.defendedSideCoord} still needs this liberty after ${defenseCoord}.`
          : `${coord}: ${outcome.defendedSideCoord} liberty after ${defenseCoord} defense.`,
      };
    }),
  ];
}

function buildOneSpaceJumpFollowUpDefenseOutcomeHighlights(
  prompt: OneSpaceJumpReadPrompt,
  recount: PressureRecount,
  board: BoardState,
  previousOutcome: PressureDefenseOutcome,
  outcome: PressureDefenseOutcome,
): OverlayHighlight[] {
  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);
  const gapCoord = pointToCoord(prompt.gap, board.size);
  const firstDefenseCoord = pointToCoord(previousOutcome.defense, board.size);
  const followUpCoord = pointToCoord(outcome.defense, board.size);
  const selectedReplyKey = targetKey(recount.reply);
  const defendedIsAnchor = targetKey(outcome.defendedSide) === targetKey(prompt.anchor);
  const anchorLiberties = defendedIsAnchor ? outcome.defendedLiberties : outcome.otherLiberties;
  const stoneLiberties = defendedIsAnchor ? outcome.otherLiberties : outcome.defendedLiberties;
  const anchorLibertyText = joinAndCoordinateList(anchorLiberties.map((point) => pointToCoord(point, board.size)));
  const stoneLibertyText = joinAndCoordinateList(stoneLiberties.map((point) => pointToCoord(point, board.size)));
  const connectedLibertyText = joinAndCoordinateList(outcome.defendedLiberties.map((point) => pointToCoord(point, board.size)));
  const anchorIsShort = anchorLiberties.length < stoneLiberties.length;
  const stoneIsShort = stoneLiberties.length < anchorLiberties.length;
  const defendedStillShort = outcome.defendedLiberties.length < outcome.otherLiberties.length;
  const followUpLibertyVariant = defendedStillShort ? 'warning' as const : 'positive' as const;

  return [
    {
      id: `read-pressure-anchor-${targetKey(prompt.anchor)}`,
      point: copyPoint(prompt.anchor),
      variant: anchorIsShort ? 'warning' as const : 'positive' as const,
      label: outcome.connectedSides
        ? `${anchorCoord}: connected group has ${formatLibertyCount(outcome.defendedLiberties.length)} after ${followUpCoord} follow-up: ${connectedLibertyText}.`
        : anchorIsShort
          ? `${anchorCoord}: short side with ${formatLibertyCount(anchorLiberties.length)} after ${followUpCoord} follow-up: ${anchorLibertyText}.`
          : `${anchorCoord}: ${formatLibertyCount(anchorLiberties.length)} after ${followUpCoord} follow-up: ${anchorLibertyText}.`,
    },
    {
      id: `read-pressure-stone-${targetKey(prompt.stone)}`,
      point: copyPoint(prompt.stone),
      variant: stoneIsShort ? 'warning' as const : 'positive' as const,
      label: outcome.connectedSides
        ? `${stoneCoord}: connected group has ${formatLibertyCount(outcome.defendedLiberties.length)} after ${followUpCoord} follow-up: ${connectedLibertyText}.`
        : stoneIsShort
          ? `${stoneCoord}: short side with ${formatLibertyCount(stoneLiberties.length)} after ${followUpCoord} follow-up: ${stoneLibertyText}.`
          : `${stoneCoord}: ${formatLibertyCount(stoneLiberties.length)} after ${followUpCoord} follow-up: ${stoneLibertyText}.`,
    },
    {
      id: `read-pressure-gap-${targetKey(prompt.gap)}`,
      point: copyPoint(prompt.gap),
      variant: 'warning',
      label: `${gapCoord}: imagined White pressure point to keep watching.`,
    },
    ...prompt.replyPoints.map((point) => {
      const coord = pointToCoord(point, board.size);
      const isSelected = targetKey(point) === selectedReplyKey;

      return {
        id: `read-pressure-reply-${targetKey(point)}`,
        point: copyPoint(point),
        variant: isSelected ? 'positive' as const : 'neutral' as const,
        label: isSelected
          ? `${coord}: selected reply before these defenses.`
          : `${coord}: alternate reply to compare later.`,
      };
    }),
    {
      id: `read-pressure-selected-defense-${targetKey(previousOutcome.defense)}`,
      point: copyPoint(previousOutcome.defense),
      variant: 'positive',
      label: `${firstDefenseCoord}: first simulated defense; ${previousOutcome.defendedSideCoord} has ${formatLibertyCount(previousOutcome.defendedLiberties.length)}.`,
    },
    {
      id: `read-pressure-follow-up-defense-${targetKey(outcome.defense)}`,
      point: copyPoint(outcome.defense),
      variant: 'positive',
      label: outcome.connectedSides
        ? `${followUpCoord}: follow-up defense; ${anchorCoord} and ${stoneCoord} connect with ${formatLibertyCount(outcome.defendedLiberties.length)}.`
        : `${followUpCoord}: follow-up defense; ${outcome.defendedSideCoord} now has ${formatLibertyCount(outcome.defendedLiberties.length)}.`,
    },
    ...outcome.defendedLiberties.map((point) => {
      const coord = pointToCoord(point, board.size);

      return {
        id: `read-pressure-follow-up-liberty-${targetKey(point)}`,
        point: copyPoint(point),
        variant: followUpLibertyVariant,
        label: defendedStillShort
          ? `${coord}: ${outcome.defendedSideCoord} still needs this liberty after ${followUpCoord}.`
          : `${coord}: ${outcome.defendedSideCoord} liberty after ${followUpCoord} follow-up.`,
      };
    }),
  ];
}

function buildTargetHintHighlights(objective: BeginnerObjective, point: Point, board: BoardState): OverlayHighlight[] {
  const coord = pointToCoord(point, board.size);

  switch (objective.id) {
    case 'claim-corner':
      return [{
        id: `target-hint-target-${targetKey(point)}`,
        point: { ...point },
        variant: 'positive',
        label: `${coord}: suggested corner target.`,
      }];
    case 'extend-from-stone': {
      const anchor = getExtensionAnchor(board, point);
      const hints: OverlayHighlight[] = [{
        id: `target-hint-target-${targetKey(point)}`,
        point: { ...point },
        variant: 'positive',
        label: `${coord}: suggested one-space jump.`,
      }];

      if (anchor) {
        const anchorCoord = pointToCoord(anchor.anchor, board.size);
        const gapCoord = pointToCoord(anchor.gap, board.size);

        hints.push(
          {
            id: `target-hint-anchor-${targetKey(anchor.anchor)}`,
            point: { ...anchor.anchor },
            variant: 'neutral',
            label: `${anchorCoord}: anchor stone for the jump.`,
          },
          {
            id: `target-hint-gap-${targetKey(anchor.gap)}`,
            point: { ...anchor.gap },
            variant: 'warning',
            label: `${gapCoord}: open gap that keeps the jump flexible.`,
          },
        );
      }

      return hints;
    }
    case 'look-for-weak-groups': {
      const group = findWeakGroupTouchingLiberty(board, point);
      const hints: OverlayHighlight[] = [{
        id: `target-hint-target-${targetKey(point)}`,
        point: { ...point },
        variant: 'positive',
        label: `${coord}: liberty to help this group breathe.`,
      }];

      if (group) {
        hints.push(...group.stones.map((stone) => ({
          id: `target-hint-group-${targetKey(stone)}`,
          point: { ...stone },
          variant: 'warning' as const,
          label: `${pointToCoord(stone, board.size)}: stone helped by ${coord}.`,
        })));
      }

      return hints;
    }
  }
}

interface StablePressureExtensionHandoffProps {
  handoff: PressureExtensionHandoff;
  canPlayTarget: boolean;
  onPlay: (handoff: PressureExtensionHandoff) => void;
}

function StablePressureExtensionHandoff({
  handoff,
  canPlayTarget,
  onPlay,
}: StablePressureExtensionHandoffProps) {
  return (
    <div className="mt-2">
      <div className="text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
        Real-game handoff
      </div>
      <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
        {handoff.text}
      </p>
      <button
        type="button"
        className="mt-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-bold transition hover:bg-white/[0.07] disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent"
        style={{
          borderColor: COLORS.ui.accent,
          color: COLORS.ui.textPrimary,
          backgroundColor: `${COLORS.ui.accent}1f`,
        }}
        disabled={!canPlayTarget}
        aria-label={handoff.ariaLabel}
        onClick={() => onPlay(handoff)}
      >
        {handoff.coord}
      </button>
    </div>
  );
}

interface ReplaySequenceContinuationButtonProps {
  children: ReactNode;
  ariaLabel: string;
  onClick: () => void;
  tone?: 'accent' | 'warning';
  mono?: boolean;
  disabled?: boolean;
  className?: string;
  hint?: string | null;
  hintId?: string;
  onPreview?: () => void;
  onPreviewEnd?: () => void;
}

function ReplaySequenceContinuationButton({
  children,
  ariaLabel,
  onClick,
  tone = 'accent',
  mono = false,
  disabled = false,
  className,
  hint,
  hintId,
  onPreview,
  onPreviewEnd,
}: ReplaySequenceContinuationButtonProps) {
  const toneColor = tone === 'warning' ? COLORS.overlay.warning : COLORS.ui.accent;

  return (
    <button
      type="button"
      className={[
        className,
        'rounded border px-2 py-0.5 text-[11px] transition hover:bg-white/[0.07]',
        hint ? 'inline-flex max-w-[14rem] flex-col items-start text-left leading-tight' : null,
        mono ? 'font-mono font-bold' : 'font-semibold',
        disabled ? 'disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent' : null,
      ].filter(Boolean).join(' ')}
      style={{
        borderColor: toneColor,
        color: COLORS.ui.textPrimary,
        backgroundColor: `${toneColor}1f`,
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={hint && hintId ? hintId : undefined}
      onPointerEnter={onPreview}
      onPointerMove={onPreview}
      onMouseEnter={onPreview}
      onMouseLeave={onPreviewEnd}
      onFocus={onPreview}
      onBlur={onPreviewEnd}
      onClick={onClick}
    >
      <span>{children}</span>
      {hint && (
        <span
          id={hintId}
          className="mt-0.5 whitespace-normal font-sans text-[10px] font-medium leading-snug"
          style={{ color: COLORS.ui.textSecondary }}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

interface ReplaySequenceContinuationRowProps {
  label: string;
  children: ReactNode;
}

function ReplaySequenceContinuationRow({
  label,
  children,
}: ReplaySequenceContinuationRowProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold" style={{ color: COLORS.ui.textSecondary }}>
        {label}
      </span>
      {children}
    </div>
  );
}

export function BeginnerObjectiveCard() {
  const game = useGameStore((s) => s.game);
  const teachingLevel = useGameStore((s) => s.teachingLevel);
  const phase = useGameStore((s) => s.phase);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const placeStone = useGameStore((s) => s.placeStone);
  const lastPlayerMove = useGameStore((s) => s.lastPlayerMove);
  const recordInteraction = useGameStore((s) => s.recordInteraction);
  const addChatMessage = useGameStore((s) => s.addChatMessage);
  const applyTargetHints = useGameStore((s) => s.applyTargetHints);
  const guidedReadReplayRequest = useGameStore((s) => s.guidedReadReplayRequest);
  const clearGuidedReadReplay = useGameStore((s) => s.clearGuidedReadReplay);
  const canPlayTarget = phase === 'playing' && game.currentPlayer === 'black' && !isAiThinking;
  const [activeTargetKey, setActiveTargetKey] = useState<string | null>(null);
  const [activeReadPromptKey, setActiveReadPromptKey] = useState<string | null>(null);
  const [selectedReadReplyKey, setSelectedReadReplyKey] = useState<string | null>(null);
  const [recountReadReplyKey, setRecountReadReplyKey] = useState<string | null>(null);
  const [comparisonReadReplyKey, setComparisonReadReplyKey] = useState<string | null>(null);
  const [defenseReadPointKey, setDefenseReadPointKey] = useState<string | null>(null);
  const [followUpDefenseReadPointKey, setFollowUpDefenseReadPointKey] = useState<string | null>(null);
  const [pinnedPressureSequenceRowKey, setPinnedPressureSequenceRowKey] = useState<string | null>(null);
  const [pressureSequencePinOverride, setPressureSequencePinOverride] = useState<{ replayRequestId: number; rowKey: string | null } | null>(null);
  const [pressureHandoffRecap, setPressureHandoffRecap] = useState<PressureHandoffRecap | null>(null);
  const processedReplayRequestId = useRef<number | null>(null);
  const targetHelpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTargetHelpKey = useRef<string | null>(null);

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: game.currentPlayer,
    teachingLevel,
  });
  const progress = getBeginnerObjectiveProgress(game, teachingLevel);
  const readPrompt = progress?.status === 'met' && progress.objectiveId === 'extend-from-stone'
    ? getOneSpaceJumpReadPrompt(game)
    : null;

  const cancelTargetHelpTimer = useCallback(() => {
    if (targetHelpTimer.current !== null) {
      clearTimeout(targetHelpTimer.current);
      targetHelpTimer.current = null;
    }

    pendingTargetHelpKey.current = null;
  }, []);

  const clearTargetHelp = useCallback(() => {
    cancelTargetHelpTimer();
    setActiveTargetKey(null);
    applyTargetHints([]);
  }, [applyTargetHints, cancelTargetHelpTimer]);

  useEffect(() => () => applyTargetHints([]), [applyTargetHints]);
  useEffect(() => () => cancelTargetHelpTimer(), [cancelTargetHelpTimer]);

  useEffect(() => {
    if (activeReadPromptKey === null || activeReadPromptKey === readPrompt?.key) return;

    applyTargetHints([]);
  }, [activeReadPromptKey, applyTargetHints, readPrompt?.key]);

  const showTargetHelp = useCallback((point: Point) => {
    if (!objective) return;

    clearGuidedReadReplay();
    setActiveTargetKey(targetKey(point));
    setActiveReadPromptKey(null);
    setSelectedReadReplyKey(null);
    setRecountReadReplyKey(null);
    setComparisonReadReplyKey(null);
    setDefenseReadPointKey(null);
    setFollowUpDefenseReadPointKey(null);
    setPinnedPressureSequenceRowKey(null);
    setPressureSequencePinOverride(null);
    applyTargetHints(buildTargetHintHighlights(objective, point, game.board));
  }, [applyTargetHints, clearGuidedReadReplay, game.board, objective]);

  const scheduleTargetHelp = useCallback((point: Point) => {
    if (!objective) return;

    const nextTargetKey = targetKey(point);
    if (activeTargetKey === nextTargetKey || pendingTargetHelpKey.current === nextTargetKey) return;

    cancelTargetHelpTimer();
    pendingTargetHelpKey.current = nextTargetKey;
    targetHelpTimer.current = setTimeout(() => {
      targetHelpTimer.current = null;
      pendingTargetHelpKey.current = null;
      showTargetHelp(point);
    }, TARGET_HELP_DELAY_MS);
  }, [activeTargetKey, cancelTargetHelpTimer, objective, showTargetHelp]);

  const showReadPressure = useCallback((prompt: OneSpaceJumpReadPrompt) => {
    recordInteraction();
    clearGuidedReadReplay();
    setActiveTargetKey(null);
    setActiveReadPromptKey(prompt.key);
    setSelectedReadReplyKey(null);
    setRecountReadReplyKey(null);
    setComparisonReadReplyKey(null);
    setDefenseReadPointKey(null);
    setFollowUpDefenseReadPointKey(null);
    setPinnedPressureSequenceRowKey(null);
    setPressureSequencePinOverride(null);
    applyTargetHints(buildOneSpaceJumpPressureHighlights(prompt, game.board));
  }, [applyTargetHints, clearGuidedReadReplay, game.board, recordInteraction]);

  const chooseReadPressureReply = useCallback((prompt: OneSpaceJumpReadPrompt, reply: Point) => {
    const feedback = getPressureChoiceFeedback(prompt, reply, game.board);

    recordInteraction();
    clearGuidedReadReplay();
    setActiveTargetKey(null);
    setActiveReadPromptKey(prompt.key);
    setSelectedReadReplyKey(targetKey(reply));
    setRecountReadReplyKey(null);
    setComparisonReadReplyKey(null);
    setDefenseReadPointKey(null);
    setFollowUpDefenseReadPointKey(null);
    setPinnedPressureSequenceRowKey(null);
    setPressureSequencePinOverride(null);
    const previewHighlights = buildOneSpaceJumpPressureHighlights(prompt, game.board, reply);
    applyTargetHints(previewHighlights);
    addChatMessage(
      `Branch choice: ${feedback}`,
      'teaching',
      [withPreviewHighlights(getPressureReplayAction('branch', prompt, reply, { board: game.board }), previewHighlights)],
    );
  }, [addChatMessage, applyTargetHints, clearGuidedReadReplay, game.board, recordInteraction]);

  const recountReadPressureReply = useCallback((prompt: OneSpaceJumpReadPrompt, reply: Point) => {
    const recount = getPressureRecount(game, prompt, reply);
    if (!recount) return;

    recordInteraction();
    clearGuidedReadReplay();
    setActiveTargetKey(null);
    setActiveReadPromptKey(prompt.key);
    setSelectedReadReplyKey(targetKey(reply));
    setRecountReadReplyKey(targetKey(reply));
    setComparisonReadReplyKey(null);
    setDefenseReadPointKey(null);
    setFollowUpDefenseReadPointKey(null);
    setPinnedPressureSequenceRowKey(null);
    setPressureSequencePinOverride(null);
    const previewHighlights = buildOneSpaceJumpRecountHighlights(prompt, recount, game.board);
    applyTargetHints(previewHighlights);
    addChatMessage(
      `Second read: ${recount.text}`,
      'teaching',
      [withPreviewHighlights(getPressureReplayAction('recount', prompt, reply, { board: game.board }), previewHighlights)],
    );
  }, [addChatMessage, applyTargetHints, clearGuidedReadReplay, game, recordInteraction]);

  const compareReadPressureReply = useCallback((prompt: OneSpaceJumpReadPrompt, comparedReply: Point, reply: Point) => {
    const comparedRecount = getPressureRecount(game, prompt, comparedReply);
    const recount = getPressureRecount(game, prompt, reply);
    if (!recount) return;

    const comparisonSummary = comparedRecount
      ? getPressureComparisonSummary(prompt, comparedRecount, recount, game.board)
      : null;

    recordInteraction();
    clearGuidedReadReplay();
    setActiveTargetKey(null);
    setActiveReadPromptKey(prompt.key);
    setSelectedReadReplyKey(targetKey(reply));
    setRecountReadReplyKey(targetKey(reply));
    setComparisonReadReplyKey(targetKey(comparedReply));
    setDefenseReadPointKey(null);
    setFollowUpDefenseReadPointKey(null);
    setPinnedPressureSequenceRowKey(null);
    setPressureSequencePinOverride(null);
    const previewHighlights = buildOneSpaceJumpRecountHighlights(prompt, recount, game.board);
    applyTargetHints(previewHighlights);
    const comparisonText = [
      recount.text,
      comparisonSummary?.text,
      comparisonSummary?.recommendationText,
    ].filter((text): text is string => Boolean(text)).join(' ');

    addChatMessage(
      `Comparison read: ${comparisonText}`,
      'teaching',
      [withPreviewHighlights(getPressureComparisonReplayAction(prompt, reply, comparedReply, { board: game.board }), previewHighlights)],
    );
  }, [addChatMessage, applyTargetHints, clearGuidedReadReplay, game, recordInteraction]);

  const tryReadPressureDefense = useCallback((
    prompt: OneSpaceJumpReadPrompt,
    recount: PressureRecount,
    comparedReply: Point,
    defense: PressureDefenseRecommendation,
    point: Point,
  ) => {
    const defenseText = getPressureDefenseReadText(defense, point, game.board);
    const defenseOutcome = getPressureDefenseOutcome(game, prompt, recount, defense, point);
    const defenseMessage = [defenseText, defenseOutcome?.text]
      .filter((text): text is string => Boolean(text))
      .join(' ');

    recordInteraction();
    clearGuidedReadReplay();
    setActiveTargetKey(null);
    setActiveReadPromptKey(prompt.key);
    setSelectedReadReplyKey(targetKey(recount.reply));
    setRecountReadReplyKey(targetKey(recount.reply));
    setComparisonReadReplyKey(targetKey(comparedReply));
    setDefenseReadPointKey(targetKey(point));
    setFollowUpDefenseReadPointKey(null);
    setPinnedPressureSequenceRowKey(null);
    setPressureSequencePinOverride(null);
    const previewHighlights = defenseOutcome
      ? buildOneSpaceJumpDefenseOutcomeHighlights(prompt, recount, game.board, defenseOutcome)
      : buildOneSpaceJumpRecountHighlights(prompt, recount, game.board, point);
    applyTargetHints(previewHighlights);
    addChatMessage(
      `Defense read: ${defenseMessage}`,
      'teaching',
      [withPreviewHighlights(
        getPressureDefenseReplayAction(prompt, recount.reply, comparedReply, point, { board: game.board }),
        previewHighlights,
      )],
    );
  }, [addChatMessage, applyTargetHints, clearGuidedReadReplay, game, recordInteraction]);

  const tryReadPressureFollowUpDefense = useCallback((
    prompt: OneSpaceJumpReadPrompt,
    recount: PressureRecount,
    comparedReply: Point,
    firstDefense: PressureDefenseRecommendation,
    firstDefensePoint: Point,
    followUpDefense: PressureDefenseRecommendation,
    point: Point,
  ) => {
    const firstDefenseOutcome = getPressureDefenseOutcome(game, prompt, recount, firstDefense, firstDefensePoint);
    if (!firstDefenseOutcome) return;

    const followUpText = getPressureDefenseContinuationReadText(followUpDefense, point, firstDefenseOutcome, game.board);
    const followUpOutcome = getPressureDefenseContinuationOutcome(
      game,
      prompt,
      recount,
      firstDefenseOutcome,
      followUpDefense,
      point,
    );
    const followUpMessage = [followUpText, followUpOutcome?.text]
      .filter((text): text is string => Boolean(text))
      .join(' ');

    recordInteraction();
    clearGuidedReadReplay();
    setActiveTargetKey(null);
    setActiveReadPromptKey(prompt.key);
    setSelectedReadReplyKey(targetKey(recount.reply));
    setRecountReadReplyKey(targetKey(recount.reply));
    setComparisonReadReplyKey(targetKey(comparedReply));
    setDefenseReadPointKey(targetKey(firstDefensePoint));
    setFollowUpDefenseReadPointKey(targetKey(point));
    setPinnedPressureSequenceRowKey(null);
    setPressureSequencePinOverride(null);
    const previewHighlights = followUpOutcome
      ? buildOneSpaceJumpFollowUpDefenseOutcomeHighlights(prompt, recount, game.board, firstDefenseOutcome, followUpOutcome)
      : buildOneSpaceJumpDefenseOutcomeHighlights(prompt, recount, game.board, firstDefenseOutcome);
    applyTargetHints(previewHighlights);
    addChatMessage(
      `Follow-up defense: ${followUpMessage}`,
      'teaching',
      [withPreviewHighlights(
        getPressureFollowUpDefenseReplayAction(
          prompt,
          recount.reply,
          comparedReply,
          firstDefensePoint,
          point,
          { board: game.board },
        ),
        previewHighlights,
      )],
    );
  }, [addChatMessage, applyTargetHints, clearGuidedReadReplay, game, recordInteraction]);

  const playObjectiveTarget = useCallback((point: Point): boolean => {
    if (!canPlayTarget) return false;

    setActiveReadPromptKey(null);
    setSelectedReadReplyKey(null);
    setRecountReadReplyKey(null);
    setComparisonReadReplyKey(null);
    setDefenseReadPointKey(null);
    setFollowUpDefenseReadPointKey(null);
    setPinnedPressureSequenceRowKey(null);
    setPressureSequencePinOverride(null);
    clearGuidedReadReplay();
    clearTargetHelp();
    recordInteraction();
    const result = placeStone(point);

    return result.success;
  }, [canPlayTarget, clearGuidedReadReplay, clearTargetHelp, placeStone, recordInteraction]);

  const handleTargetClick = useCallback((point: Point) => {
    setPressureHandoffRecap(null);
    playObjectiveTarget(point);
  }, [playObjectiveTarget]);

  const handlePressureHandoffClick = useCallback((handoff: PressureExtensionHandoff) => {
    const played = playObjectiveTarget(handoff.point);
    if (!played) return;

    setPressureHandoffRecap(handoff.recap);
  }, [playObjectiveTarget]);

  const replayedReadReplyKey = guidedReadReplayRequest?.type === 'read-pressure'
    && readPrompt
    && guidedReadReplayRequest.promptKey === readPrompt.key
    && readPrompt.replyPoints.some((point) => targetKey(point) === guidedReadReplayRequest.replyKey)
    ? guidedReadReplayRequest.replyKey
    : null;
  const replayedRecountReadReplyKey = replayedReadReplyKey
    && (
      guidedReadReplayRequest?.mode === 'recount'
      || guidedReadReplayRequest?.mode === 'comparison'
      || guidedReadReplayRequest?.mode === 'defense'
      || guidedReadReplayRequest?.mode === 'follow-up-defense'
    )
    ? replayedReadReplyKey
    : null;
  const replayedComparisonReadReplyKey = replayedReadReplyKey
    && (
      guidedReadReplayRequest?.mode === 'comparison'
      || guidedReadReplayRequest?.mode === 'defense'
      || guidedReadReplayRequest?.mode === 'follow-up-defense'
    )
    && guidedReadReplayRequest.comparedReplyKey
    && readPrompt?.replyPoints.some((point) => (
      targetKey(point) === guidedReadReplayRequest.comparedReplyKey
      && targetKey(point) !== replayedReadReplyKey
    ))
    ? guidedReadReplayRequest.comparedReplyKey
    : null;
  const effectiveActiveReadPromptKey = replayedReadReplyKey && readPrompt ? readPrompt.key : activeReadPromptKey;
  const effectiveSelectedReadReplyKey = replayedReadReplyKey ?? selectedReadReplyKey;
  const effectiveRecountReadReplyKey = replayedRecountReadReplyKey ?? recountReadReplyKey;
  const effectiveComparisonReadReplyKey = replayedComparisonReadReplyKey
    ?? (replayedReadReplyKey ? null : comparisonReadReplyKey);

  useEffect(() => {
    if (!replayedReadReplyKey || !guidedReadReplayRequest || !readPrompt) return;
    if (processedReplayRequestId.current === guidedReadReplayRequest.id) return;

    const reply = readPrompt.replyPoints.find((point) => targetKey(point) === guidedReadReplayRequest.replyKey);
    if (!reply) return;

    processedReplayRequestId.current = guidedReadReplayRequest.id;
    recordInteraction();

    let replayHighlights = buildOneSpaceJumpPressureHighlights(readPrompt, game.board, reply);
    let replayedSelectedRecount: PressureRecount | null = null;
    let replayedComparedRecount: PressureRecount | null = null;
    let replayedDefenseOutcome: PressureDefenseOutcome | null = null;
    let replayedFollowUpDefenseOutcome: PressureDefenseOutcome | null = null;
    let replayedContinuationDefense: PressureDefenseRecommendation | null = null;

    if (
      guidedReadReplayRequest.mode === 'recount'
      || guidedReadReplayRequest.mode === 'comparison'
      || guidedReadReplayRequest.mode === 'defense'
      || guidedReadReplayRequest.mode === 'follow-up-defense'
    ) {
      const recount = getPressureRecount(game, readPrompt, reply);
      if (recount) {
        replayedSelectedRecount = recount;
        const comparedReply = replayedComparisonReadReplyKey
          ? readPrompt.replyPoints.find((point) => targetKey(point) === replayedComparisonReadReplyKey) ?? null
          : null;
        replayedComparedRecount = comparedReply
          ? getPressureRecount(game, readPrompt, comparedReply)
          : null;
        const selectedDefense = (guidedReadReplayRequest.mode === 'defense' || guidedReadReplayRequest.mode === 'follow-up-defense')
          && replayedComparisonReadReplyKey
          && guidedReadReplayRequest.defensePointKey
          ? getReplayPressureDefensePoint(
            readPrompt,
            recount,
            game.board,
            guidedReadReplayRequest.defensePointKey,
          )
          : null;
        const replayedDefense = selectedDefense
          ? getPressureDefenseRecommendation(readPrompt, recount, game.board)
          : null;
        replayedDefenseOutcome = selectedDefense && replayedDefense
          ? getPressureDefenseOutcome(game, readPrompt, recount, replayedDefense, selectedDefense)
          : null;
        replayedContinuationDefense = replayedDefenseOutcome
          ? getPressureDefenseContinuationRecommendation(replayedDefenseOutcome, game.board)
          : null;
        const selectedFollowUpDefense = guidedReadReplayRequest.mode === 'follow-up-defense'
          && replayedContinuationDefense
          && guidedReadReplayRequest.followUpDefensePointKey
          ? replayedContinuationDefense.liberties.find((point) => (
            targetKey(point) === guidedReadReplayRequest.followUpDefensePointKey
          )) ?? null
          : null;
        replayedFollowUpDefenseOutcome = replayedDefenseOutcome && replayedContinuationDefense && selectedFollowUpDefense
          ? getPressureDefenseContinuationOutcome(
            game,
            readPrompt,
            recount,
            replayedDefenseOutcome,
            replayedContinuationDefense,
            selectedFollowUpDefense,
          )
          : null;

        if (replayedDefenseOutcome && replayedFollowUpDefenseOutcome) {
          replayHighlights = buildOneSpaceJumpFollowUpDefenseOutcomeHighlights(
            readPrompt,
            recount,
            game.board,
            replayedDefenseOutcome,
            replayedFollowUpDefenseOutcome,
          );
        } else {
          replayHighlights = replayedDefenseOutcome
            ? buildOneSpaceJumpDefenseOutcomeHighlights(readPrompt, recount, game.board, replayedDefenseOutcome)
            : buildOneSpaceJumpRecountHighlights(readPrompt, recount, game.board, selectedDefense);
        }
      }
    }

    const replayedComparisonSummary = replayedComparedRecount && replayedSelectedRecount
      ? getPressureComparisonSummary(readPrompt, replayedComparedRecount, replayedSelectedRecount, game.board)
      : null;
    const replayTargets = objective?.targetPoints.slice(0, 4) ?? [];
    const replayedComparisonHandoff = objective
      ? getStablePressureExtensionHandoff(
        objective,
        replayTargets,
        game.board,
        readPrompt,
        Boolean(replayedComparisonSummary && !replayedComparisonSummary.defenseRecommendation),
      )
      : null;
    const replayedDefenseHandoff = objective
      ? getStablePressureExtensionHandoff(
        objective,
        replayTargets,
        game.board,
        readPrompt,
        Boolean(
          replayedDefenseOutcome
          && !replayedContinuationDefense
          && isStablePressureDefenseOutcome(replayedDefenseOutcome),
        ),
      )
      : null;
    const replayedFollowUpHandoff = objective
      ? getStablePressureExtensionHandoff(
        objective,
        replayTargets,
        game.board,
        readPrompt,
        Boolean(
          replayedFollowUpDefenseOutcome
          && isStablePressureDefenseOutcome(replayedFollowUpDefenseOutcome),
        ),
      )
      : null;
    const replayedSequenceRows = getPressureReadSequenceRows(
      game.board,
      readPrompt,
      reply,
      replayedSelectedRecount,
      replayedComparedRecount,
      replayedDefenseOutcome,
      replayedFollowUpDefenseOutcome,
      replayedFollowUpHandoff ?? replayedDefenseHandoff ?? replayedComparisonHandoff,
    );
    const pinnedReplayRow = guidedReadReplayRequest.pinnedSequenceStepKey
      ? replayedSequenceRows.find((row) => row.replayKey === guidedReadReplayRequest.pinnedSequenceStepKey) ?? null
      : null;

    applyTargetHints(pinnedReplayRow?.highlights ?? replayHighlights);
  }, [
    applyTargetHints,
    game,
    guidedReadReplayRequest,
    objective,
    readPrompt,
    recordInteraction,
    replayedComparisonReadReplyKey,
    replayedReadReplyKey,
  ]);

  if (!objective) return null;

  const targetText = formatObjectiveTargetText(objective, game.board.size);
  const progressColor = progress?.status === 'met' ? COLORS.overlay.positive : COLORS.overlay.warning;
  const playableTargets = objective.targetPoints.slice(0, 4);
  const hasLearnerMove = game.moveHistory.some((move) => move.color === 'black');
  const insight = hasLearnerMove ? getMoveInsight(game, teachingLevel) : null;
  const showReadPressureDetail = readPrompt !== null && effectiveActiveReadPromptKey === readPrompt.key;
  const selectedReadReply = showReadPressureDetail && effectiveSelectedReadReplyKey
    ? readPrompt.replyPoints.find((point) => targetKey(point) === effectiveSelectedReadReplyKey) ?? null
    : null;
  const selectedReadReplyFeedback = readPrompt && selectedReadReply
    ? getPressureChoiceFeedback(readPrompt, selectedReadReply, game.board)
    : null;
  const selectedReadRecount = readPrompt && selectedReadReply && effectiveRecountReadReplyKey === targetKey(selectedReadReply)
    ? getPressureRecount(game, readPrompt, selectedReadReply)
    : null;
  const compareReadReplyPoints = readPrompt && selectedReadRecount
    ? readPrompt.replyPoints.filter((point) => targetKey(point) !== targetKey(selectedReadRecount.reply))
    : [];
  const comparedReadReply = readPrompt && selectedReadRecount && effectiveComparisonReadReplyKey
    ? readPrompt.replyPoints.find((point) => (
      targetKey(point) === effectiveComparisonReadReplyKey
      && targetKey(point) !== targetKey(selectedReadRecount.reply)
    )) ?? null
    : null;
  const comparedReadRecount = readPrompt && comparedReadReply
    ? getPressureRecount(game, readPrompt, comparedReadReply)
    : null;
  const pressureComparisonSummary = readPrompt && comparedReadRecount && selectedReadRecount
    ? getPressureComparisonSummary(readPrompt, comparedReadRecount, selectedReadRecount, game.board)
    : null;
  const pressureDefenseRecommendation = pressureComparisonSummary?.defenseRecommendation ?? null;
  const replayedDefenseReadPointKey = replayedComparisonReadReplyKey
    && (guidedReadReplayRequest?.mode === 'defense' || guidedReadReplayRequest?.mode === 'follow-up-defense')
    && guidedReadReplayRequest.defensePointKey
    && pressureDefenseRecommendation?.liberties.some((point) => targetKey(point) === guidedReadReplayRequest.defensePointKey)
    ? guidedReadReplayRequest.defensePointKey
    : null;
  const effectiveDefenseReadPointKey = replayedDefenseReadPointKey ?? (replayedReadReplyKey ? null : defenseReadPointKey);
  const selectedDefenseReadPoint = pressureDefenseRecommendation && effectiveDefenseReadPointKey
    ? pressureDefenseRecommendation.liberties.find((point) => targetKey(point) === effectiveDefenseReadPointKey) ?? null
    : null;
  const selectedDefenseReadText = pressureDefenseRecommendation && selectedDefenseReadPoint
    ? getPressureDefenseReadText(pressureDefenseRecommendation, selectedDefenseReadPoint, game.board)
    : null;
  const selectedDefenseReadOutcome = readPrompt && selectedReadRecount && pressureDefenseRecommendation && selectedDefenseReadPoint
    ? getPressureDefenseOutcome(game, readPrompt, selectedReadRecount, pressureDefenseRecommendation, selectedDefenseReadPoint)
    : null;
  const pressureDefenseContinuationRecommendation = selectedDefenseReadOutcome
    ? getPressureDefenseContinuationRecommendation(selectedDefenseReadOutcome, game.board)
    : null;
  const replayedFollowUpDefenseReadPointKey = replayedComparisonReadReplyKey
    && guidedReadReplayRequest?.mode === 'follow-up-defense'
    && guidedReadReplayRequest.followUpDefensePointKey
    && pressureDefenseContinuationRecommendation?.liberties.some((point) => (
      targetKey(point) === guidedReadReplayRequest.followUpDefensePointKey
    ))
    ? guidedReadReplayRequest.followUpDefensePointKey
    : null;
  const effectiveFollowUpDefenseReadPointKey = replayedFollowUpDefenseReadPointKey
    ?? (replayedReadReplyKey ? null : followUpDefenseReadPointKey);
  const selectedFollowUpDefenseReadPoint = pressureDefenseContinuationRecommendation && effectiveFollowUpDefenseReadPointKey
    ? pressureDefenseContinuationRecommendation.liberties.find((point) => targetKey(point) === effectiveFollowUpDefenseReadPointKey) ?? null
    : null;
  const selectedFollowUpDefenseReadText = pressureDefenseContinuationRecommendation && selectedDefenseReadOutcome && selectedFollowUpDefenseReadPoint
    ? getPressureDefenseContinuationReadText(
      pressureDefenseContinuationRecommendation,
      selectedFollowUpDefenseReadPoint,
      selectedDefenseReadOutcome,
      game.board,
    )
    : null;
  const selectedFollowUpDefenseReadOutcome = readPrompt
    && selectedReadRecount
    && selectedDefenseReadOutcome
    && pressureDefenseContinuationRecommendation
    && selectedFollowUpDefenseReadPoint
    ? getPressureDefenseContinuationOutcome(
      game,
      readPrompt,
      selectedReadRecount,
      selectedDefenseReadOutcome,
      pressureDefenseContinuationRecommendation,
      selectedFollowUpDefenseReadPoint,
    )
    : null;
  const selectedFollowUpDefenseComparisonSummary = readPrompt
    && selectedReadRecount
    && selectedDefenseReadOutcome
    && pressureDefenseContinuationRecommendation
    && selectedFollowUpDefenseReadOutcome
    ? getPressureDefenseContinuationComparisonSummary(
      game,
      readPrompt,
      selectedReadRecount,
      selectedDefenseReadOutcome,
      pressureDefenseContinuationRecommendation,
    )
    : null;
  const livePressureReadState: {
    comparedReply: Point | null;
    handoff: PressureExtensionHandoff | null;
    highlights: OverlayHighlight[];
    nextAction: string | null;
    reply: Point | null;
    selectedDefense: Point | null;
    selectedFollowUpDefense: Point | null;
    sequenceRow: PressureReadSequenceRow | null;
  } = (() => {
    if (!readPrompt || activeReadPromptKey !== readPrompt.key) {
      return {
        comparedReply: null,
        handoff: null,
        highlights: [],
        nextAction: null,
        reply: null,
        selectedDefense: null,
        selectedFollowUpDefense: null,
        sequenceRow: null,
      };
    }

    const liveSelectedReply = selectedReadReplyKey
      ? readPrompt.replyPoints.find((point) => targetKey(point) === selectedReadReplyKey) ?? null
      : null;
    const liveSelectedRecount = liveSelectedReply && recountReadReplyKey === targetKey(liveSelectedReply)
      ? getPressureRecount(game, readPrompt, liveSelectedReply)
      : null;
    const liveComparedReply = liveSelectedRecount && comparisonReadReplyKey
      ? readPrompt.replyPoints.find((point) => (
        targetKey(point) === comparisonReadReplyKey
        && targetKey(point) !== targetKey(liveSelectedRecount.reply)
      )) ?? null
      : null;
    const liveComparedRecount = liveComparedReply
      ? getPressureRecount(game, readPrompt, liveComparedReply)
      : null;
    const liveComparisonSummary = liveSelectedRecount && liveComparedRecount
      ? getPressureComparisonSummary(readPrompt, liveComparedRecount, liveSelectedRecount, game.board)
      : null;
    const liveDefenseRecommendation = liveComparisonSummary?.defenseRecommendation ?? null;
    const liveSelectedDefensePoint = liveDefenseRecommendation && defenseReadPointKey
      ? liveDefenseRecommendation.liberties.find((point) => targetKey(point) === defenseReadPointKey) ?? null
      : null;
    const liveDefenseOutcome = liveSelectedRecount && liveDefenseRecommendation && liveSelectedDefensePoint
      ? getPressureDefenseOutcome(game, readPrompt, liveSelectedRecount, liveDefenseRecommendation, liveSelectedDefensePoint)
      : null;
    const liveFollowUpRecommendation = liveDefenseOutcome
      ? getPressureDefenseContinuationRecommendation(liveDefenseOutcome, game.board)
      : null;
    const liveSelectedFollowUpPoint = liveFollowUpRecommendation && followUpDefenseReadPointKey
      ? liveFollowUpRecommendation.liberties.find((point) => targetKey(point) === followUpDefenseReadPointKey) ?? null
      : null;
    const liveFollowUpOutcome = liveSelectedRecount && liveDefenseOutcome && liveFollowUpRecommendation && liveSelectedFollowUpPoint
      ? getPressureDefenseContinuationOutcome(
        game,
        readPrompt,
        liveSelectedRecount,
        liveDefenseOutcome,
        liveFollowUpRecommendation,
        liveSelectedFollowUpPoint,
      )
      : null;
    const liveComparisonHandoff = getStablePressureExtensionHandoff(
      objective,
      playableTargets,
      game.board,
      readPrompt,
      Boolean(liveComparisonSummary && !liveDefenseRecommendation),
    );
    const liveDefenseHandoff = getStablePressureExtensionHandoff(
      objective,
      playableTargets,
      game.board,
      readPrompt,
      Boolean(
        liveDefenseOutcome
        && !liveFollowUpRecommendation
        && isStablePressureDefenseOutcome(liveDefenseOutcome),
      ),
    );
    const liveFollowUpHandoff = getStablePressureExtensionHandoff(
      objective,
      playableTargets,
      game.board,
      readPrompt,
      Boolean(liveFollowUpOutcome && isStablePressureDefenseOutcome(liveFollowUpOutcome)),
    );
    const liveExtensionHandoff = liveFollowUpHandoff ?? liveDefenseHandoff ?? liveComparisonHandoff;
    const liveSequenceRows = getPressureReadSequenceRows(
      game.board,
      readPrompt,
      liveSelectedReply,
      liveSelectedRecount,
      liveComparedRecount,
      liveDefenseOutcome,
      liveFollowUpOutcome,
      liveExtensionHandoff,
    );
    const preferredLiveSequenceReplayKey = getPreferredLivePressureReadSequenceReplayKey(
      liveSelectedReply,
      liveSelectedRecount,
      liveComparedReply,
      liveSelectedDefensePoint,
      liveSelectedFollowUpPoint,
      liveExtensionHandoff,
    );
    const preferredLiveSequenceRow = preferredLiveSequenceReplayKey
      ? liveSequenceRows.find((row) => row.replayKey === preferredLiveSequenceReplayKey) ?? null
      : null;

    return {
      comparedReply: liveComparedReply,
      handoff: liveExtensionHandoff,
      highlights: getActivePressureReadHighlights(
        game.board,
        readPrompt,
        liveSelectedReply,
        liveSelectedRecount,
        liveDefenseOutcome,
        liveFollowUpOutcome,
      ),
      nextAction: getPressureReadNextActionText(
        game.board,
        readPrompt,
        liveSelectedReply,
        liveSelectedRecount,
        liveComparedReply,
        liveDefenseRecommendation,
        liveSelectedDefensePoint,
        liveFollowUpRecommendation,
        liveSelectedFollowUpPoint,
        liveExtensionHandoff,
      ),
      reply: liveSelectedReply,
      selectedDefense: liveSelectedDefensePoint,
      selectedFollowUpDefense: liveSelectedFollowUpPoint,
      sequenceRow: preferredLiveSequenceRow,
    };
  })();
  const livePressureReadHighlights = livePressureReadState.highlights;
  const livePressureReadSequenceRow = livePressureReadState.sequenceRow;
  const pressureComparisonExtensionHandoff = getStablePressureExtensionHandoff(
    objective,
    playableTargets,
    game.board,
    readPrompt,
    Boolean(pressureComparisonSummary && !pressureDefenseRecommendation),
  );
  const selectedDefenseExtensionHandoff = getStablePressureExtensionHandoff(
    objective,
    playableTargets,
    game.board,
    readPrompt,
    Boolean(
      selectedDefenseReadOutcome
      && !pressureDefenseContinuationRecommendation
      && isStablePressureDefenseOutcome(selectedDefenseReadOutcome),
    ),
  );
  const selectedFollowUpExtensionHandoff = getStablePressureExtensionHandoff(
    objective,
    playableTargets,
    game.board,
    readPrompt,
    Boolean(
      selectedFollowUpDefenseReadOutcome
      && isStablePressureDefenseOutcome(selectedFollowUpDefenseReadOutcome),
    ),
  );
  const activePressureExtensionHandoff = selectedFollowUpExtensionHandoff
    ?? selectedDefenseExtensionHandoff
    ?? pressureComparisonExtensionHandoff;
  const pressureReadSequenceRows = getPressureReadSequenceRows(
    game.board,
    readPrompt,
    selectedReadReply,
    selectedReadRecount,
    comparedReadRecount,
    selectedDefenseReadOutcome,
    selectedFollowUpDefenseReadOutcome,
    activePressureExtensionHandoff,
  );
  const activePressureReadHighlights = getActivePressureReadHighlights(
    game.board,
    readPrompt,
    selectedReadReply,
    selectedReadRecount,
    selectedDefenseReadOutcome,
    selectedFollowUpDefenseReadOutcome,
  );
  const activePressureReplayRequestId = replayedReadReplyKey && guidedReadReplayRequest?.type === 'read-pressure'
    ? guidedReadReplayRequest.id
    : null;
  const restoredPressureReadCue = activePressureReplayRequestId !== null && guidedReadReplayRequest?.type === 'read-pressure'
    ? getRestoredPressureReadCue(
      guidedReadReplayRequest,
      game.board,
      selectedReadReply,
      comparedReadReply,
      selectedDefenseReadPoint,
      selectedFollowUpDefenseReadPoint,
    )
    : null;
  const activePressureReplayPinOverride = activePressureReplayRequestId !== null
    && pressureSequencePinOverride?.replayRequestId === activePressureReplayRequestId
    ? pressureSequencePinOverride
    : null;
  const replayedPressureSequenceRow = activePressureReplayRequestId !== null && guidedReadReplayRequest?.pinnedSequenceStepKey
    ? pressureReadSequenceRows.find((row) => row.replayKey === guidedReadReplayRequest.pinnedSequenceStepKey) ?? null
    : null;
  const effectivePinnedPressureSequenceRowKey = activePressureReplayRequestId !== null
    ? activePressureReplayPinOverride
      ? activePressureReplayPinOverride.rowKey
      : replayedPressureSequenceRow?.key ?? null
    : pinnedPressureSequenceRowKey;
  const pinnedPressureSequenceRow = pressureReadSequenceRows.find((row) => row.key === effectivePinnedPressureSequenceRowKey) ?? null;
  const replayedPressureSequenceNextQuestion = activePressureReplayRequestId !== null
    ? pinnedPressureSequenceRow?.nextQuestion ?? null
    : null;
  const replayedPressureSequenceCompareFromHere = activePressureReplayRequestId !== null
    && pinnedPressureSequenceRow
    && readPrompt
    && selectedReadReply
    && selectedReadRecount
    && comparedReadReply
    && (
      pinnedPressureSequenceRow.replayKey === `reply-${targetKey(comparedReadReply)}`
      || pinnedPressureSequenceRow.replayKey === `recount-${targetKey(comparedReadReply)}`
    )
    ? {
      baselineReply: comparedReadReply,
      comparisonCoord: pointToCoord(selectedReadReply, game.board.size),
      comparisonReply: selectedReadReply,
      prompt: readPrompt,
    }
    : null;
  const replayedPressureSequenceDefensesFromHere = activePressureReplayRequestId !== null
    && pinnedPressureSequenceRow
    && readPrompt
    && selectedReadRecount
    && comparedReadReply
    && pressureDefenseRecommendation
    && pinnedPressureSequenceRow.replayKey === `compare-${targetKey(selectedReadRecount.reply)}`
    ? {
      comparedReply: comparedReadReply,
      choices: getPressureDefenseChoices(game, readPrompt, selectedReadRecount, pressureDefenseRecommendation),
      defense: pressureDefenseRecommendation,
      prompt: readPrompt,
      recount: selectedReadRecount,
    }
    : null;
  const replayedPressureSequenceFollowUpDefensesFromHere = activePressureReplayRequestId !== null
    && pinnedPressureSequenceRow
    && readPrompt
    && selectedReadRecount
    && comparedReadReply
    && pressureDefenseRecommendation
    && selectedDefenseReadPoint
    && selectedDefenseReadOutcome
    && pressureDefenseContinuationRecommendation
    && pinnedPressureSequenceRow.replayKey === `defense-${targetKey(selectedDefenseReadPoint)}`
    ? {
      comparedReply: comparedReadReply,
      choices: getPressureFollowUpDefenseChoices(
        game,
        readPrompt,
        selectedReadRecount,
        selectedDefenseReadOutcome,
        pressureDefenseContinuationRecommendation,
      ),
      firstDefense: pressureDefenseRecommendation,
      firstDefensePoint: selectedDefenseReadPoint,
      followUpDefense: pressureDefenseContinuationRecommendation,
      prompt: readPrompt,
      recount: selectedReadRecount,
    }
    : null;
  const replayedPressureSequenceHandoffFromHere = activePressureReplayRequestId !== null
    && pinnedPressureSequenceRow
    ? (
      activePressureExtensionHandoff
        && pinnedPressureSequenceRow.replayKey === `handoff-${targetKey(activePressureExtensionHandoff.point)}`
        ? activePressureExtensionHandoff
        : selectedFollowUpExtensionHandoff
          && selectedFollowUpDefenseReadOutcome
          && pinnedPressureSequenceRow.replayKey === `follow-up-${targetKey(selectedFollowUpDefenseReadOutcome.defense)}`
          ? selectedFollowUpExtensionHandoff
          : selectedDefenseExtensionHandoff
            && selectedDefenseReadOutcome
            && pinnedPressureSequenceRow.replayKey === `defense-${targetKey(selectedDefenseReadOutcome.defense)}`
            ? selectedDefenseExtensionHandoff
            : null
    )
    : null;
  const readPromptAnchorCoord = readPrompt ? pointToCoord(readPrompt.anchor, game.board.size) : null;
  const readPromptStoneCoord = readPrompt ? pointToCoord(readPrompt.stone, game.board.size) : null;
  const selectedReadReplyCoord = selectedReadReply ? pointToCoord(selectedReadReply, game.board.size) : null;
  const livePressureReadReply = livePressureReadState.reply;
  const pressureReadSequenceSavedReplyKey = activePressureReplayRequestId !== null
    ? getPressureReadSequenceReplayReplyKey(guidedReadReplayRequest?.pinnedSequenceStepKey) ?? replayedReadReplyKey
    : null;
  const selectedReadReplyKeyForSequence = selectedReadReply ? targetKey(selectedReadReply) : null;
  const comparedReadReplyKeyForSequence = comparedReadReply ? targetKey(comparedReadReply) : null;
  const livePressureReadReplyKey = livePressureReadReply ? targetKey(livePressureReadReply) : null;
  const pressureReadSequenceLiveReplyKey = pressureReadSequenceSavedReplyKey
    ? (
      comparedReadReplyKeyForSequence && comparedReadReplyKeyForSequence !== pressureReadSequenceSavedReplyKey
        ? comparedReadReplyKeyForSequence
        : selectedReadReplyKeyForSequence && selectedReadReplyKeyForSequence !== pressureReadSequenceSavedReplyKey
          ? selectedReadReplyKeyForSequence
          : livePressureReadReplyKey && livePressureReadReplyKey !== pressureReadSequenceSavedReplyKey
            ? livePressureReadReplyKey
            : null
    )
    : null;
  const pressureReadSequenceBranchContext = activePressureReplayRequestId !== null
    && pressureReadSequenceSavedReplyKey
    && pressureReadSequenceLiveReplyKey
    ? {
      savedReplyKey: pressureReadSequenceSavedReplyKey,
      liveReplyKey: pressureReadSequenceLiveReplyKey,
    }
    : null;
  const pinnedPressureSequenceRowIndex = pinnedPressureSequenceRow
    ? pressureReadSequenceRows.findIndex((row) => row.key === pinnedPressureSequenceRow.key)
    : -1;
  const returnToLivePressureSequenceSummary = pinnedPressureSequenceRow && pinnedPressureSequenceRowIndex >= 0
    ? formatPressureReadSequenceReturnSummary(
      pinnedPressureSequenceRow,
      pinnedPressureSequenceRowIndex,
      getPressureReadSequenceRowBranchBadge(pinnedPressureSequenceRow, pressureReadSequenceBranchContext),
    )
    : null;
  const restoredPressureReadLiveCue = activePressureReplayRequestId !== null
    ? getRestoredPressureReadLiveCue(game.board, livePressureReadReply, selectedReadReply, livePressureReadState.nextAction)
    : null;
  const activeTarget = activeTargetKey
    ? playableTargets.find((point) => targetKey(point) === activeTargetKey) ?? null
    : null;
  const activePressureHandoffRecap = pressureHandoffRecap
    && lastPlayerMove
    && targetKey(pressureHandoffRecap.point) === targetKey(lastPlayerMove)
    ? pressureHandoffRecap
    : null;
  const activeTargetCoord = activeTarget ? pointToCoord(activeTarget, game.board.size) : null;
  const activeTargetExplanation = activeTarget ? getTargetExplanation(objective, activeTarget, game.board) : null;
  const targetHelpId = 'beginner-objective-target-help';
  const showPressureReadSequenceRow = (row: PressureReadSequenceRow) => {
    setActiveTargetKey(null);
    applyTargetHints(row.highlights);
  };
  const showPressureReadSequenceContinuation = (highlights: OverlayHighlight[] | null) => {
    if (!highlights) return;

    setActiveTargetKey(null);
    applyTargetHints(highlights);
  };
  const restorePressureReadHighlights = () => {
    applyTargetHints(pinnedPressureSequenceRow?.highlights ?? activePressureReadHighlights);
  };
  const returnToLivePressureRead = () => {
    if (activePressureReplayRequestId === null) return;

    const returnNote = guidedReadReplayRequest?.type === 'read-pressure'
      ? getReturnToLivePressureReadMessage(
        guidedReadReplayRequest,
        game.board,
        livePressureReadReply,
        selectedReadReply,
        returnToLivePressureSequenceSummary,
      )
      : null;
    const returnAction = guidedReadReplayRequest?.type === 'read-pressure'
      ? getReturnToLivePressureReadAction(
        guidedReadReplayRequest,
        game.board,
        readPrompt,
        selectedReadReply,
        comparedReadReply,
        selectedDefenseReadPoint,
        selectedFollowUpDefenseReadPoint,
        pinnedPressureSequenceRow?.highlights ?? activePressureReadHighlights,
        pinnedPressureSequenceRow?.replayKey,
      )
      : null;
    const liveHandoffAction = guidedReadReplayRequest?.type === 'read-pressure'
      ? getReturnToLivePressureHandoffAction(
        readPrompt,
        livePressureReadState.reply,
        livePressureReadState.comparedReply,
        livePressureReadState.selectedDefense,
        livePressureReadState.selectedFollowUpDefense,
        livePressureReadState.handoff,
      )
      : null;
    const returnActions = [returnAction, liveHandoffAction]
      .filter((action): action is SenseiAction => Boolean(action));
    const liveReturnHighlights = livePressureReadSequenceRow?.highlights ?? livePressureReadHighlights;

    recordInteraction();
    setActiveTargetKey(null);
    setPressureSequencePinOverride(null);
    setPinnedPressureSequenceRowKey(livePressureReadSequenceRow?.key ?? null);
    clearGuidedReadReplay(activePressureReplayRequestId);
    applyTargetHints(liveReturnHighlights);
    if (returnNote) {
      addChatMessage(returnNote, 'teaching', returnActions.length > 0 ? returnActions : undefined);
    }
  };
  const togglePressureReadSequenceRow = (row: PressureReadSequenceRow, index: number) => {
    if (pinnedPressureSequenceRow?.key === row.key) {
      if (activePressureReplayRequestId !== null) {
        setPressureSequencePinOverride({ replayRequestId: activePressureReplayRequestId, rowKey: null });
      } else {
        setPinnedPressureSequenceRowKey(null);
      }
      applyTargetHints(activePressureReadHighlights);
      return;
    }

    setActiveTargetKey(null);
    if (activePressureReplayRequestId !== null) {
      setPressureSequencePinOverride({ replayRequestId: activePressureReplayRequestId, rowKey: row.key });
    } else {
      setPinnedPressureSequenceRowKey(row.key);
    }
    applyTargetHints(row.highlights);

    const replayAction = getPressureSequenceFocusReplayAction(
      readPrompt,
      selectedReadReply,
      selectedReadRecount,
      comparedReadReply,
      selectedDefenseReadOutcome,
      selectedFollowUpDefenseReadOutcome,
      row.replayKey,
    );

    if (replayAction) {
      const continuationSummary = getPressureSequenceContinuationSummary(
        game,
        readPrompt,
        selectedReadRecount,
        comparedReadReply,
        pressureDefenseRecommendation,
        selectedDefenseReadOutcome,
        pressureDefenseContinuationRecommendation,
        row,
      );
      const continuationActions = getPressureSequenceContinuationActions(
        game,
        readPrompt,
        selectedReadRecount,
        comparedReadReply,
        pressureDefenseRecommendation,
        selectedDefenseReadOutcome,
        pressureDefenseContinuationRecommendation,
        row,
      );

      addChatMessage(
        [
          formatPressureReadSequenceFocusMessage(
            row,
            index,
            getPressureReadSequenceRowBranchBadge(row, pressureReadSequenceBranchContext),
          ),
          continuationSummary,
        ].filter((text): text is string => Boolean(text)).join(' '),
        'teaching',
        [{ ...replayAction, previewHighlights: row.highlights }, ...continuationActions],
      );
    }
  };

  return (
    <div
      className="mx-auto mb-3 w-full max-w-2xl rounded-lg border px-4 py-3 text-sm"
      style={{ backgroundColor: COLORS.ui.bgCard, borderColor: 'rgba(255,255,255,0.08)' }}
    >
      {activePressureHandoffRecap && (
        <div className="mb-2 border-b border-white/10 pb-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.ui.textSecondary }}>
            Read applied
          </div>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
            {activePressureHandoffRecap.text}
          </p>
        </div>
      )}
      {insight && (
        <div className="mb-2 border-b border-white/10 pb-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.ui.textSecondary }}>
            What changed
          </div>
          <div className="mt-1 text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
            {insight.title}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
            {insight.observation}
          </p>
        </div>
      )}
      {readPrompt && (
        <div className="mb-2 border-b border-white/10 pb-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.ui.textSecondary }}>
            Read next
          </div>
          <div className="mt-1 text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
            {readPrompt.title}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
            {readPrompt.text}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border px-2 py-0.5 text-[11px] font-semibold transition hover:bg-white/[0.07]"
              style={{
                borderColor: COLORS.ui.accent,
                color: COLORS.ui.textPrimary,
                backgroundColor: showReadPressureDetail ? `${COLORS.overlay.warning}26` : `${COLORS.ui.accent}1f`,
              }}
              aria-label={`Show pressure variation for ${readPrompt.gapCoord}`}
              onClick={() => showReadPressure(readPrompt)}
            >
              Show pressure
            </button>
          </div>
          {showReadPressureDetail && (
            <div className="mt-2 rounded border px-2 py-1.5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
                Pressure variation
              </div>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                {readPrompt.variationText}
              </p>
              {restoredPressureReadCue && (
                <div className="mt-2 border-l-2 pl-2" style={{ borderColor: COLORS.ui.accent }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.ui.accent }}>
                      Restored read
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.ui.textSecondary }}>
                      Live branch
                    </div>
                    <button
                      type="button"
                      className="rounded border px-2 py-0.5 text-[11px] font-semibold transition hover:bg-white/[0.07]"
                      style={{
                        borderColor: COLORS.ui.accent,
                        color: COLORS.ui.textPrimary,
                        backgroundColor: `${COLORS.ui.accent}1f`,
                      }}
                      onClick={returnToLivePressureRead}
                    >
                      Return to live read
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                    {restoredPressureReadCue}
                  </p>
                  {restoredPressureReadLiveCue && (
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                      {restoredPressureReadLiveCue}
                    </p>
                  )}
                </div>
              )}
              {readPrompt.replyPoints.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold" style={{ color: COLORS.ui.textSecondary }}>
                    Choose a first read:
                  </span>
                  {readPrompt.replyPoints.map((point) => {
                    const coord = pointToCoord(point, game.board.size);
                    const isSelected = effectiveSelectedReadReplyKey === targetKey(point);

                    return (
                      <button
                        key={`read-pressure-choice-${targetKey(point)}`}
                        type="button"
                        className="rounded border px-2 py-0.5 font-mono text-[11px] font-bold transition hover:bg-white/[0.07]"
                        style={{
                          borderColor: isSelected ? COLORS.overlay.positive : COLORS.ui.accent,
                          color: COLORS.ui.textPrimary,
                          backgroundColor: isSelected ? `${COLORS.overlay.positive}24` : `${COLORS.ui.accent}1f`,
                        }}
                        aria-label={`Choose ${coord} as the first reply to ${readPrompt.gapCoord}`}
                        onClick={() => chooseReadPressureReply(readPrompt, point)}
                      >
                        {coord}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedReadReplyFeedback && (
                <div className="mt-2">
                  <div className="text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
                    Branch choice
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                    {selectedReadReplyFeedback}
                  </p>
                  {selectedReadReply && selectedReadReplyCoord && readPromptAnchorCoord && readPromptStoneCoord && (
                    <button
                      type="button"
                      className="mt-2 rounded border px-2 py-0.5 text-[11px] font-semibold transition hover:bg-white/[0.07]"
                      style={{
                        borderColor: selectedReadRecount ? COLORS.overlay.positive : COLORS.ui.accent,
                        color: COLORS.ui.textPrimary,
                        backgroundColor: selectedReadRecount ? `${COLORS.overlay.positive}24` : `${COLORS.ui.accent}1f`,
                      }}
                      aria-label={`Recount ${readPromptAnchorCoord} and ${readPromptStoneCoord} after ${selectedReadReplyCoord}`}
                      onClick={() => recountReadPressureReply(readPrompt, selectedReadReply)}
                    >
                      Recount sides
                    </button>
                  )}
                  {selectedReadRecount && (
                    <div className="mt-2">
                      <div className="text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
                        Second read
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                        {selectedReadRecount.text}
                      </p>
                      {compareReadReplyPoints.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {compareReadReplyPoints.map((point) => {
                            const coord = pointToCoord(point, game.board.size);
                            const currentCoord = pointToCoord(selectedReadRecount.reply, game.board.size);

                            return (
                              <button
                                key={`read-pressure-compare-${targetKey(point)}`}
                                type="button"
                                className="rounded border px-2 py-0.5 text-[11px] font-semibold transition hover:bg-white/[0.07]"
                                style={{
                                  borderColor: COLORS.ui.accent,
                                  color: COLORS.ui.textPrimary,
                                  backgroundColor: `${COLORS.ui.accent}1f`,
                                }}
                                aria-label={`Compare ${coord} against ${currentCoord}`}
                                onClick={() => compareReadPressureReply(readPrompt, selectedReadRecount.reply, point)}
                              >
                                Compare {coord}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {pressureComparisonSummary && (
                        <div className="mt-2">
                          <div className="text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
                            Comparison summary
                          </div>
                          <div className="mt-1 grid gap-x-3 gap-y-0.5 text-[11px] leading-relaxed sm:grid-cols-2" style={{ color: COLORS.ui.textSecondary }}>
                            {pressureComparisonSummary.rows.map((row) => (
                              <div key={row}>{row}</div>
                            ))}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                            {pressureComparisonSummary.text}
                          </p>
                          {pressureComparisonExtensionHandoff && (
                            <StablePressureExtensionHandoff
                              handoff={pressureComparisonExtensionHandoff}
                              canPlayTarget={canPlayTarget}
                              onPlay={handlePressureHandoffClick}
                            />
                          )}
                          {pressureComparisonSummary.recommendationText && (
                            <>
                              <p className="mt-1 text-xs font-semibold leading-relaxed" style={{ color: COLORS.overlay.warning }}>
                                {pressureComparisonSummary.recommendationText}
                              </p>
                              {pressureDefenseRecommendation && comparedReadReply && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] font-semibold" style={{ color: COLORS.ui.textSecondary }}>
                                    Try a defense:
                                  </span>
                                  {pressureDefenseRecommendation.liberties.map((point) => {
                                    const coord = pointToCoord(point, game.board.size);
                                    const isSelected = effectiveDefenseReadPointKey === targetKey(point);

                                    return (
                                      <button
                                        key={`read-pressure-defense-${targetKey(point)}`}
                                        type="button"
                                        className="rounded border px-2 py-0.5 font-mono text-[11px] font-bold transition hover:bg-white/[0.07]"
                                        style={{
                                          borderColor: isSelected ? COLORS.overlay.positive : COLORS.overlay.warning,
                                          color: COLORS.ui.textPrimary,
                                          backgroundColor: isSelected ? `${COLORS.overlay.positive}24` : `${COLORS.overlay.warning}1f`,
                                        }}
                                        aria-label={`Try ${coord} defense for ${pressureDefenseRecommendation.shortSideCoord}`}
                                        onClick={() => tryReadPressureDefense(
                                          readPrompt,
                                          selectedReadRecount,
                                          comparedReadReply,
                                          pressureDefenseRecommendation,
                                          point,
                                        )}
                                      >
                                        {coord}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              {selectedDefenseReadText && (
                                <div className="mt-2">
                                  <div className="text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
                                    Defense read
                                  </div>
                                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                                    {selectedDefenseReadText}
                                  </p>
                                  {selectedDefenseReadOutcome && (
                                    <p className="mt-1 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                                      {selectedDefenseReadOutcome.text}
                                    </p>
                                  )}
                                  {selectedDefenseExtensionHandoff && (
                                    <StablePressureExtensionHandoff
                                      handoff={selectedDefenseExtensionHandoff}
                                      canPlayTarget={canPlayTarget}
                                      onPlay={handlePressureHandoffClick}
                                    />
                                  )}
                                  {pressureDefenseContinuationRecommendation
                                    && pressureDefenseRecommendation
                                    && selectedDefenseReadPoint
                                    && selectedDefenseReadOutcome
                                    && comparedReadReply
                                    && (
                                      <div className="mt-2">
                                        <div className="text-[11px] font-semibold" style={{ color: COLORS.ui.textSecondary }}>
                                          Continue from {pressureDefenseContinuationRecommendation.shortSideCoord}
                                        </div>
                                        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                                          {pressureDefenseContinuationRecommendation.text}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                          {pressureDefenseContinuationRecommendation.liberties.map((point) => {
                                            const coord = pointToCoord(point, game.board.size);
                                            const isSelected = effectiveFollowUpDefenseReadPointKey === targetKey(point);

                                            return (
                                              <button
                                                key={`read-pressure-follow-up-defense-${targetKey(point)}`}
                                                type="button"
                                                className="rounded border px-2 py-0.5 font-mono text-[11px] font-bold transition hover:bg-white/[0.07]"
                                                style={{
                                                  borderColor: isSelected ? COLORS.overlay.positive : COLORS.overlay.warning,
                                                  color: COLORS.ui.textPrimary,
                                                  backgroundColor: isSelected ? `${COLORS.overlay.positive}24` : `${COLORS.overlay.warning}1f`,
                                                }}
                                                aria-label={`Try ${coord} follow-up defense for ${pressureDefenseContinuationRecommendation.shortSideCoord}`}
                                                onClick={() => tryReadPressureFollowUpDefense(
                                                  readPrompt,
                                                  selectedReadRecount,
                                                  comparedReadReply,
                                                  pressureDefenseRecommendation,
                                                  selectedDefenseReadPoint,
                                                  pressureDefenseContinuationRecommendation,
                                                  point,
                                                )}
                                              >
                                                {coord}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  {selectedFollowUpDefenseReadText && (
                                    <div className="mt-2">
                                      <div className="text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
                                        Follow-up defense
                                      </div>
                                      <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                                        {selectedFollowUpDefenseReadText}
                                      </p>
                                      {selectedFollowUpDefenseReadOutcome && (
                                        <p className="mt-1 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                                          {selectedFollowUpDefenseReadOutcome.text}
                                        </p>
                                      )}
                                      {selectedFollowUpDefenseComparisonSummary && (
                                        <div className="mt-2">
                                          <div className="text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
                                            Follow-up comparison
                                          </div>
                                          <div className="mt-1 grid gap-x-3 gap-y-0.5 text-[11px] leading-relaxed sm:grid-cols-2" style={{ color: COLORS.ui.textSecondary }}>
                                            {selectedFollowUpDefenseComparisonSummary.rows.map((row) => (
                                              <div key={row}>{row}</div>
                                            ))}
                                          </div>
                                          <p className="mt-1 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                                            {selectedFollowUpDefenseComparisonSummary.text}
                                          </p>
                                        </div>
                                      )}
                                      {selectedFollowUpExtensionHandoff && (
                                        <StablePressureExtensionHandoff
                                          handoff={selectedFollowUpExtensionHandoff}
                                          canPlayTarget={canPlayTarget}
                                          onPlay={handlePressureHandoffClick}
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {pressureReadSequenceRows.length > 0 && (
                    <div className="mt-2 border-t border-white/10 pt-2">
                      <div className="text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
                        Read sequence
                      </div>
                      <div className="mt-1 space-y-0.5 text-[11px] leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                        {pressureReadSequenceRows.map((row, index) => {
                          const isPinned = pinnedPressureSequenceRow?.key === row.key;
                          const branchBadge = getPressureReadSequenceRowBranchBadge(row, pressureReadSequenceBranchContext);

                          return (
                            <button
                              key={row.key}
                              type="button"
                              className="block w-full rounded px-1 py-0.5 text-left transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                              style={{
                                color: isPinned ? COLORS.ui.textPrimary : COLORS.ui.textSecondary,
                                backgroundColor: isPinned ? `${COLORS.overlay.positive}1f` : 'transparent',
                                outlineColor: COLORS.ui.accent,
                              }}
                              aria-label={`Show board highlights for step ${index + 1}: ${row.text}`}
                              aria-pressed={isPinned}
                              onPointerEnter={() => showPressureReadSequenceRow(row)}
                              onPointerMove={() => showPressureReadSequenceRow(row)}
                              onMouseEnter={() => showPressureReadSequenceRow(row)}
                              onMouseLeave={restorePressureReadHighlights}
                              onFocus={() => showPressureReadSequenceRow(row)}
                              onBlur={restorePressureReadHighlights}
                              onClick={() => togglePressureReadSequenceRow(row, index)}
                            >
                              <span className="flex flex-wrap items-center gap-1.5">
                                {branchBadge && (
                                  <span
                                    className="rounded border px-1 py-px text-[9px] font-semibold uppercase tracking-wider"
                                    style={{
                                      borderColor: branchBadge.tone === 'saved' ? COLORS.ui.accent : COLORS.overlay.positive,
                                      color: branchBadge.tone === 'saved' ? COLORS.ui.accent : COLORS.overlay.positive,
                                      backgroundColor: branchBadge.tone === 'saved' ? `${COLORS.ui.accent}1a` : `${COLORS.overlay.positive}1a`,
                                    }}
                                  >
                                    {branchBadge.label}
                                  </span>
                                )}
                                <span>{index + 1}. {row.text}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {replayedPressureSequenceNextQuestion && (
                        <div className="mt-2 border-t border-white/10 pt-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLORS.ui.textSecondary }}>
                            Saved read next question
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
                            {replayedPressureSequenceNextQuestion}
                          </p>
                          {replayedPressureSequenceCompareFromHere && (
                            <ReplaySequenceContinuationButton
                              className="mt-2"
                              ariaLabel={`Compare ${replayedPressureSequenceCompareFromHere.comparisonCoord} from here`}
                              onClick={() => compareReadPressureReply(
                                replayedPressureSequenceCompareFromHere.prompt,
                                replayedPressureSequenceCompareFromHere.baselineReply,
                                replayedPressureSequenceCompareFromHere.comparisonReply,
                              )}
                            >
                              Compare {replayedPressureSequenceCompareFromHere.comparisonCoord} from here
                            </ReplaySequenceContinuationButton>
                          )}
                          {replayedPressureSequenceDefensesFromHere && (
                            <ReplaySequenceContinuationRow label="Defend from here:">
                              {replayedPressureSequenceDefensesFromHere.choices.map(({ point, coord, hint, highlights }) => (
                                <ReplaySequenceContinuationButton
                                  key={`read-pressure-replayed-defense-${targetKey(point)}`}
                                  tone="warning"
                                  mono
                                  hint={hint}
                                  hintId={`read-pressure-replayed-defense-hint-${targetKey(point)}`}
                                  ariaLabel={`Try ${coord} defense from here`}
                                  onPreview={() => showPressureReadSequenceContinuation(highlights)}
                                  onPreviewEnd={restorePressureReadHighlights}
                                  onClick={() => tryReadPressureDefense(
                                    replayedPressureSequenceDefensesFromHere.prompt,
                                    replayedPressureSequenceDefensesFromHere.recount,
                                    replayedPressureSequenceDefensesFromHere.comparedReply,
                                    replayedPressureSequenceDefensesFromHere.defense,
                                    point,
                                  )}
                                >
                                  Try {coord} from here
                                </ReplaySequenceContinuationButton>
                              ))}
                            </ReplaySequenceContinuationRow>
                          )}
                          {replayedPressureSequenceFollowUpDefensesFromHere && (
                            <ReplaySequenceContinuationRow label="Continue from here:">
                              {replayedPressureSequenceFollowUpDefensesFromHere.choices.map(({ point, coord, hint, highlights }) => (
                                <ReplaySequenceContinuationButton
                                  key={`read-pressure-replayed-follow-up-${targetKey(point)}`}
                                  mono
                                  hint={hint}
                                  hintId={`read-pressure-replayed-follow-up-hint-${targetKey(point)}`}
                                  ariaLabel={`Try ${coord} follow-up defense from here`}
                                  onPreview={() => showPressureReadSequenceContinuation(highlights)}
                                  onPreviewEnd={restorePressureReadHighlights}
                                  onClick={() => tryReadPressureFollowUpDefense(
                                    replayedPressureSequenceFollowUpDefensesFromHere.prompt,
                                    replayedPressureSequenceFollowUpDefensesFromHere.recount,
                                    replayedPressureSequenceFollowUpDefensesFromHere.comparedReply,
                                    replayedPressureSequenceFollowUpDefensesFromHere.firstDefense,
                                    replayedPressureSequenceFollowUpDefensesFromHere.firstDefensePoint,
                                    replayedPressureSequenceFollowUpDefensesFromHere.followUpDefense,
                                    point,
                                  )}
                                >
                                  Try {coord} from here
                                </ReplaySequenceContinuationButton>
                              ))}
                            </ReplaySequenceContinuationRow>
                          )}
                          {replayedPressureSequenceHandoffFromHere && (
                            <ReplaySequenceContinuationButton
                              className="mt-2"
                              mono
                              disabled={!canPlayTarget}
                              ariaLabel={`Play ${replayedPressureSequenceHandoffFromHere.coord} from here`}
                              onClick={() => handlePressureHandoffClick(replayedPressureSequenceHandoffFromHere)}
                            >
                              Play {replayedPressureSequenceHandoffFromHere.coord} from here
                            </ReplaySequenceContinuationButton>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>
        {objective.title}
      </div>
      <div className="mt-1" style={{ color: COLORS.ui.textSecondary }}>
        {objective.instruction}
      </div>
      {progress && (
        <div className="mt-1 text-xs font-medium" style={{ color: progressColor }}>
          {progress.text}
        </div>
      )}
      {targetText && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold" style={{ color: COLORS.ui.textPrimary }}>
          <span>{targetText}</span>
          {playableTargets.map((point) => {
            const coord = pointToCoord(point, game.board.size);

            return (
              <button
                key={`${objective.id}-${point.x}-${point.y}`}
                type="button"
                className="rounded border px-2 py-0.5 font-mono text-[11px] font-bold transition hover:bg-white/[0.07] disabled:cursor-default disabled:opacity-70 disabled:hover:bg-transparent"
                style={{
                  borderColor: COLORS.ui.accent,
                  color: COLORS.ui.textPrimary,
                  backgroundColor: `${COLORS.ui.accent}1f`,
                }}
                disabled={!canPlayTarget}
                aria-label={`Play ${coord} target for ${objective.title}`}
                aria-describedby={activeTargetKey === targetKey(point) ? targetHelpId : undefined}
                onPointerEnter={() => scheduleTargetHelp(point)}
                onPointerMove={() => scheduleTargetHelp(point)}
                onMouseEnter={() => scheduleTargetHelp(point)}
                onMouseLeave={clearTargetHelp}
                onFocus={() => scheduleTargetHelp(point)}
                onBlur={clearTargetHelp}
                onKeyDown={() => scheduleTargetHelp(point)}
                onClick={() => handleTargetClick(point)}
              >
                {coord}
              </button>
            );
          })}
        </div>
      )}
      {activeTargetCoord && activeTargetExplanation && (
        <div id={targetHelpId} className="mt-1.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
          <div className="font-semibold" style={{ color: COLORS.ui.textPrimary }}>
            Why {activeTargetCoord}
          </div>
          <p>{activeTargetExplanation}</p>
        </div>
      )}
      <div className="mt-1 text-xs" style={{ color: COLORS.ui.accent }}>
        {objective.why}
      </div>
    </div>
  );
}
