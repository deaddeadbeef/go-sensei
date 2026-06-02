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
import type { OverlayHighlight } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';
import { useCallback, useEffect, useRef, useState } from 'react';

const ONE_SPACE_JUMP_DELTAS: Point[] = [
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
  { x: 0, y: -2 },
];

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

interface PressureComparisonSummary {
  rows: string[];
  text: string;
  recommendationText: string | null;
  defenseRecommendation: PressureDefenseRecommendation | null;
}

function targetKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function copyPoint(point: Point): Point {
  return { x: point.x, y: point.y };
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

function getPressureReplayAction(
  mode: 'branch' | 'recount',
  prompt: OneSpaceJumpReadPrompt,
  reply: Point,
): SenseiAction {
  return {
    id: `guided:read-pressure:${mode}:${prompt.key}:${targetKey(reply)}`,
    label: mode === 'recount' ? 'Show recount' : 'Show branch',
  };
}

function getPressureComparisonReplayAction(
  prompt: OneSpaceJumpReadPrompt,
  reply: Point,
  comparedReply: Point,
): SenseiAction {
  return {
    id: `guided:read-pressure:comparison:${prompt.key}:${targetKey(reply)}:${targetKey(comparedReply)}`,
    label: 'Show comparison',
  };
}

function getPressureDefenseReplayAction(
  prompt: OneSpaceJumpReadPrompt,
  reply: Point,
  comparedReply: Point,
  defensePoint: Point,
): SenseiAction {
  return {
    id: `guided:read-pressure:defense:${prompt.key}:${targetKey(reply)}:${targetKey(comparedReply)}:${targetKey(defensePoint)}`,
    label: 'Show defense',
  };
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

export function BeginnerObjectiveCard() {
  const game = useGameStore((s) => s.game);
  const teachingLevel = useGameStore((s) => s.teachingLevel);
  const phase = useGameStore((s) => s.phase);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const placeStone = useGameStore((s) => s.placeStone);
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
  const processedReplayRequestId = useRef<number | null>(null);

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

  const clearTargetHelp = useCallback(() => {
    setActiveTargetKey(null);
    applyTargetHints([]);
  }, [applyTargetHints]);

  useEffect(() => () => applyTargetHints([]), [applyTargetHints]);

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
    applyTargetHints(buildTargetHintHighlights(objective, point, game.board));
  }, [applyTargetHints, clearGuidedReadReplay, game.board, objective]);

  const showReadPressure = useCallback((prompt: OneSpaceJumpReadPrompt) => {
    recordInteraction();
    clearGuidedReadReplay();
    setActiveTargetKey(null);
    setActiveReadPromptKey(prompt.key);
    setSelectedReadReplyKey(null);
    setRecountReadReplyKey(null);
    setComparisonReadReplyKey(null);
    setDefenseReadPointKey(null);
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
    applyTargetHints(buildOneSpaceJumpPressureHighlights(prompt, game.board, reply));
    addChatMessage(`Branch choice: ${feedback}`, 'teaching', [getPressureReplayAction('branch', prompt, reply)]);
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
    applyTargetHints(buildOneSpaceJumpRecountHighlights(prompt, recount, game.board));
    addChatMessage(`Second read: ${recount.text}`, 'teaching', [getPressureReplayAction('recount', prompt, reply)]);
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
    applyTargetHints(buildOneSpaceJumpRecountHighlights(prompt, recount, game.board));
    const comparisonText = [
      recount.text,
      comparisonSummary?.text,
      comparisonSummary?.recommendationText,
    ].filter((text): text is string => Boolean(text)).join(' ');

    addChatMessage(
      `Comparison read: ${comparisonText}`,
      'teaching',
      [getPressureComparisonReplayAction(prompt, reply, comparedReply)],
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

    recordInteraction();
    clearGuidedReadReplay();
    setActiveTargetKey(null);
    setActiveReadPromptKey(prompt.key);
    setSelectedReadReplyKey(targetKey(recount.reply));
    setRecountReadReplyKey(targetKey(recount.reply));
    setComparisonReadReplyKey(targetKey(comparedReply));
    setDefenseReadPointKey(targetKey(point));
    applyTargetHints(buildOneSpaceJumpRecountHighlights(prompt, recount, game.board, point));
    addChatMessage(
      `Defense read: ${defenseText}`,
      'teaching',
      [getPressureDefenseReplayAction(prompt, recount.reply, comparedReply, point)],
    );
  }, [addChatMessage, applyTargetHints, clearGuidedReadReplay, game.board, recordInteraction]);

  const handleTargetClick = useCallback((point: Point) => {
    if (!canPlayTarget) return;

    setActiveReadPromptKey(null);
    setSelectedReadReplyKey(null);
    setRecountReadReplyKey(null);
    setComparisonReadReplyKey(null);
    setDefenseReadPointKey(null);
    clearGuidedReadReplay();
    clearTargetHelp();
    recordInteraction();
    placeStone(point);
  }, [canPlayTarget, clearGuidedReadReplay, clearTargetHelp, placeStone, recordInteraction]);

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
    )
    ? replayedReadReplyKey
    : null;
  const replayedComparisonReadReplyKey = replayedReadReplyKey
    && (guidedReadReplayRequest?.mode === 'comparison' || guidedReadReplayRequest?.mode === 'defense')
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

    if (
      guidedReadReplayRequest.mode === 'recount'
      || guidedReadReplayRequest.mode === 'comparison'
      || guidedReadReplayRequest.mode === 'defense'
    ) {
      const recount = getPressureRecount(game, readPrompt, reply);
      if (recount) {
        const selectedDefense = guidedReadReplayRequest.mode === 'defense'
          && replayedComparisonReadReplyKey
          && guidedReadReplayRequest.defensePointKey
          ? getReplayPressureDefensePoint(
            readPrompt,
            recount,
            game.board,
            guidedReadReplayRequest.defensePointKey,
          )
          : null;

        applyTargetHints(buildOneSpaceJumpRecountHighlights(readPrompt, recount, game.board, selectedDefense));
      } else {
        applyTargetHints(buildOneSpaceJumpPressureHighlights(readPrompt, game.board, reply));
      }
    } else {
      applyTargetHints(buildOneSpaceJumpPressureHighlights(readPrompt, game.board, reply));
    }
  }, [
    applyTargetHints,
    game,
    guidedReadReplayRequest,
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
    && guidedReadReplayRequest?.mode === 'defense'
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
  const readPromptAnchorCoord = readPrompt ? pointToCoord(readPrompt.anchor, game.board.size) : null;
  const readPromptStoneCoord = readPrompt ? pointToCoord(readPrompt.stone, game.board.size) : null;
  const selectedReadReplyCoord = selectedReadReply ? pointToCoord(selectedReadReply, game.board.size) : null;
  const activeTarget = activeTargetKey
    ? playableTargets.find((point) => targetKey(point) === activeTargetKey) ?? null
    : null;
  const activeTargetCoord = activeTarget ? pointToCoord(activeTarget, game.board.size) : null;
  const activeTargetExplanation = activeTarget ? getTargetExplanation(objective, activeTarget, game.board) : null;
  const targetHelpId = 'beginner-objective-target-help';

  return (
    <div
      className="mx-auto mb-3 w-full max-w-2xl rounded-lg border px-4 py-3 text-sm"
      style={{ backgroundColor: COLORS.ui.bgCard, borderColor: 'rgba(255,255,255,0.08)' }}
    >
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
                                </div>
                              )}
                            </>
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
                onPointerEnter={() => showTargetHelp(point)}
                onPointerMove={() => showTargetHelp(point)}
                onMouseEnter={() => showTargetHelp(point)}
                onMouseLeave={clearTargetHelp}
                onFocus={() => showTargetHelp(point)}
                onBlur={clearTargetHelp}
                onKeyDown={() => showTargetHelp(point)}
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
