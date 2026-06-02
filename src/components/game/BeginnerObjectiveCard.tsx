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

function targetKey(point: Point): string {
  return `${point.x},${point.y}`;
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

function getOneSpaceJumpReadPrompt(game: GameState): { title: string; text: string } | null {
  const move = getLastBlackPlacement(game.moveHistory);
  if (!move) return null;

  const shape = getExtensionAnchor(game.board, move.point);
  if (!shape) return null;

  const stoneCoord = pointToCoord(move.point, game.board.size);
  const anchorCoord = pointToCoord(shape.anchor, game.board.size);
  const gapCoord = pointToCoord(shape.gap, game.board.size);

  return {
    title: `Watch ${gapCoord}`,
    text: `If White plays ${gapCoord}, the jump between ${anchorCoord} and ${stoneCoord} is under pressure. First read whether Black should connect or defend that gap before extending again.`,
  };
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

  const objective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: game.currentPlayer,
    teachingLevel,
  });

  const clearTargetHelp = useCallback(() => {
    setActiveTargetKey(null);
    applyTargetHints([]);
  }, [applyTargetHints]);

  useEffect(() => () => applyTargetHints([]), [applyTargetHints]);

  const showTargetHelp = useCallback((point: Point) => {
    if (!objective) return;

    setActiveTargetKey(targetKey(point));
    applyTargetHints(buildTargetHintHighlights(objective, point, game.board));
  }, [applyTargetHints, game.board, objective]);

  const handleTargetClick = useCallback((point: Point) => {
    if (!canPlayTarget) return;

    clearTargetHelp();
    recordInteraction();
    placeStone(point);
  }, [canPlayTarget, clearTargetHelp, placeStone, recordInteraction]);

  if (!objective) return null;

  const targetText = formatObjectiveTargetText(objective, game.board.size);
  const progress = getBeginnerObjectiveProgress(game, teachingLevel);
  const progressColor = progress?.status === 'met' ? COLORS.overlay.positive : COLORS.overlay.warning;
  const playableTargets = objective.targetPoints.slice(0, 4);
  const hasLearnerMove = game.moveHistory.some((move) => move.color === 'black');
  const insight = hasLearnerMove ? getMoveInsight(game, teachingLevel) : null;
  const readPrompt = progress?.status === 'met' && progress.objectiveId === 'extend-from-stone'
    ? getOneSpaceJumpReadPrompt(game)
    : null;
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
