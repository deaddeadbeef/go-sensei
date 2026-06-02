'use client';

import {
  formatObjectiveTargetText,
  getBeginnerObjective,
  getBeginnerObjectiveProgress,
} from '@/lib/coaching/beginner-objectives';
import type { BeginnerObjective } from '@/lib/coaching/beginner-objectives';
import { getMoveInsight } from '@/lib/coaching/move-insight';
import {
  getAdjacentPoints,
  getGroup,
  getStone,
  isOnBoard,
  pointToCoord,
} from '@/lib/go-engine';
import type { BoardState, GameState, Group, Move, Point } from '@/lib/go-engine';
import { useGameStore } from '@/stores/game-store';
import type { OverlayHighlight } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';
import { useCallback, useEffect, useState } from 'react';

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

function buildOneSpaceJumpPressureHighlights(prompt: OneSpaceJumpReadPrompt, board: BoardState): OverlayHighlight[] {
  const anchorCoord = pointToCoord(prompt.anchor, board.size);
  const stoneCoord = pointToCoord(prompt.stone, board.size);
  const gapCoord = pointToCoord(prompt.gap, board.size);

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
      label: `${gapCoord}: imagine White tests the open gap here.`,
    },
    ...prompt.replyPoints.map((point) => {
      const coord = pointToCoord(point, board.size);

      return {
        id: `read-pressure-reply-${targetKey(point)}`,
        point: copyPoint(point),
        variant: 'positive' as const,
        label: `${coord}: first reply to read against the cutting stone.`,
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

export function BeginnerObjectiveCard() {
  const game = useGameStore((s) => s.game);
  const teachingLevel = useGameStore((s) => s.teachingLevel);
  const phase = useGameStore((s) => s.phase);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const placeStone = useGameStore((s) => s.placeStone);
  const recordInteraction = useGameStore((s) => s.recordInteraction);
  const applyTargetHints = useGameStore((s) => s.applyTargetHints);
  const canPlayTarget = phase === 'playing' && game.currentPlayer === 'black' && !isAiThinking;
  const [activeTargetKey, setActiveTargetKey] = useState<string | null>(null);
  const [activeReadPromptKey, setActiveReadPromptKey] = useState<string | null>(null);

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

    setActiveTargetKey(targetKey(point));
    setActiveReadPromptKey(null);
    applyTargetHints(buildTargetHintHighlights(objective, point, game.board));
  }, [applyTargetHints, game.board, objective]);

  const showReadPressure = useCallback((prompt: OneSpaceJumpReadPrompt) => {
    recordInteraction();
    setActiveTargetKey(null);
    setActiveReadPromptKey(prompt.key);
    applyTargetHints(buildOneSpaceJumpPressureHighlights(prompt, game.board));
  }, [applyTargetHints, game.board, recordInteraction]);

  const handleTargetClick = useCallback((point: Point) => {
    if (!canPlayTarget) return;

    setActiveReadPromptKey(null);
    clearTargetHelp();
    recordInteraction();
    placeStone(point);
  }, [canPlayTarget, clearTargetHelp, placeStone, recordInteraction]);

  if (!objective) return null;

  const targetText = formatObjectiveTargetText(objective, game.board.size);
  const progressColor = progress?.status === 'met' ? COLORS.overlay.positive : COLORS.overlay.warning;
  const playableTargets = objective.targetPoints.slice(0, 4);
  const hasLearnerMove = game.moveHistory.some((move) => move.color === 'black');
  const insight = hasLearnerMove ? getMoveInsight(game, teachingLevel) : null;
  const showReadPressureDetail = readPrompt !== null && activeReadPromptKey === readPrompt.key;
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
