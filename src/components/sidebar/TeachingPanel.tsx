'use client';

import { CONCEPTS } from '@/lib/concepts/concept-data';
import { getSuggestionMarkerLabel } from '@/components/board/overlays/SuggestionOverlay';
import {
  getBeginnerObjective,
  getBeginnerObjectiveSuggestionReason,
  getFreshAreaFollowUpContext,
} from '@/lib/coaching/beginner-objectives';
import { getMoveInsight } from '@/lib/coaching/move-insight';
import { useConceptStore } from '@/stores/concept-store';
import { useGameStore } from '@/stores/game-store';
import type { Point } from '@/lib/go-engine';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo } from 'react';

const variantColors: Record<string, string> = {
  positive: '#4ade80',
  warning: '#f59e0b',
  danger: '#ef4444',
  neutral: '#818cf8',
};
const ARROW_COLOR = '#fbbf24';
const GROUP_COLORS: Record<string, string> = { black: '#3b82f6', white: '#f97316' };
const GO_COLS = 'ABCDEFGHJKLMNOPQRST';
const CONCEPT_NAME_BY_ID = new Map(CONCEPTS.map((concept) => [concept.id, concept.name]));
const RECORDED_INSIGHT_KEYS = new Set<string>();

function coordLabel(x: number, y: number, boardSize: number): string {
  return `${GO_COLS[x]}${boardSize - y}`;
}

export function TeachingPanel() {
  const highlights = useGameStore((s) => s.overlays.highlights);
  const arrows = useGameStore((s) => s.overlays.arrows);
  const groups = useGameStore((s) => s.overlays.groups);
  const suggestions = useGameStore((s) => s.overlays.suggestions);
  const game = useGameStore((s) => s.game);
  const teachingLevel = useGameStore((s) => s.teachingLevel);
  const appPhase = useGameStore((s) => s.appPhase);
  const boardSize = useGameStore((s) => s.game.board.size);
  const phase = useGameStore((s) => s.phase);
  const currentPlayer = useGameStore((s) => s.game.currentPlayer);
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const lastInteractionTime = useGameStore((s) => s.lastInteractionTime);
  const placeStone = useGameStore((s) => s.placeStone);
  const recordInteraction = useGameStore((s) => s.recordInteraction);
  const recordEvidence = useConceptStore((s) => s.recordEvidence);
  const insight = getMoveInsight(game, teachingLevel);
  const insightConceptIds = insight ? [...new Set(insight.conceptIds)] : [];
  const insightConceptKey = insightConceptIds.join('|');
  const insightRecordKey = insight
    ? `${lastInteractionTime}:${game.moveHistory.length}:${game.currentPlayer}:${insight.title}:${insightConceptKey}`
    : null;
  const conceptNames = insightConceptIds
    .map((id) => CONCEPT_NAME_BY_ID.get(id) ?? id)
    .slice(0, 3);

  const labeledHighlights = highlights.filter((h) => h.label);
  const labeledArrows = arrows.filter((a) => a.label);
  const labeledGroups = groups.filter((g) => g.label);
  const labeledSuggestions = suggestions.filter((s) => s.reason);
  const objectiveSuggestions = useMemo(() => {
    if (labeledSuggestions.length > 0) return [];
    if (appPhase !== 'game' || phase !== 'playing' || currentPlayer !== 'black') return [];

    const objective = getBeginnerObjective({
      boardSize: game.board.size,
      board: game.board,
      moveHistory: game.moveHistory,
      moveCount: game.moveHistory.length,
      currentPlayer: game.currentPlayer,
      teachingLevel,
    });

    if (!objective || objective.targetPoints.length === 0) return [];

    const followUpContext = getFreshAreaFollowUpContext(game, teachingLevel, objective);

    return objective.targetPoints.slice(0, 4).map((point, index) => ({
      id: `objective-analysis-move-${point.x},${point.y}`,
      point,
      rank: index + 1,
      reason: getBeginnerObjectiveSuggestionReason(objective, point, game.board.size, followUpContext),
    }));
  }, [appPhase, currentPlayer, game, labeledSuggestions.length, phase, teachingLevel]);
  const analysisSuggestions = labeledSuggestions.length > 0 ? labeledSuggestions : objectiveSuggestions;

  const hasBoardAnalysis = labeledHighlights.length + labeledArrows.length + labeledGroups.length + analysisSuggestions.length > 0;
  const hasContent = insight !== null || hasBoardAnalysis;
  const canPlaySuggestion = phase === 'playing' && currentPlayer === 'black' && !isAiThinking;

  const handleSuggestionClick = useCallback((point: Point) => {
    if (!canPlaySuggestion) return;

    recordInteraction();
    placeStone(point);
  }, [canPlaySuggestion, placeStone, recordInteraction]);

  useEffect(() => {
    if (!insightRecordKey || !insightConceptKey) return;
    if (RECORDED_INSIGHT_KEYS.has(insightRecordKey)) return;

    RECORDED_INSIGHT_KEYS.add(insightRecordKey);
    for (const conceptId of insightConceptKey.split('|')) {
      recordEvidence(conceptId, 'guided_insight');
    }
  }, [insightConceptKey, insightRecordKey, recordEvidence]);

  return (
    <AnimatePresence>
      {hasContent && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="border-y border-white/10 overflow-hidden"
        >
          <div className="px-3 py-2 max-h-48 overflow-y-auto thin-scrollbar">
            {insight && (
              <div className="mb-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-white/40">
                  Move Insight
                </div>
                <div className="mt-1 text-sm font-semibold text-white/90">{insight.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-white/70">{insight.observation}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-200">{insight.nextStep}</p>
                {conceptNames.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {conceptNames.map((name) => (
                      <span key={name} className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-200">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {hasBoardAnalysis && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
                  Board Analysis
                </div>
                <div className="space-y-1">
                  {analysisSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="flex w-full items-start gap-1.5 rounded-sm text-left transition hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent"
                      disabled={!canPlaySuggestion}
                      aria-label={`Play candidate ${getSuggestionMarkerLabel(s.rank)} at ${coordLabel(s.point.x, s.point.y, boardSize)}: ${s.reason}`}
                      onClick={() => handleSuggestionClick(s.point)}
                    >
                      <span
                        className="shrink-0 rounded px-1 py-0.5 text-[10px] font-mono font-bold leading-none"
                        style={{ backgroundColor: `${variantColors.neutral}33`, color: variantColors.neutral }}
                      >
                        {getSuggestionMarkerLabel(s.rank)} {coordLabel(s.point.x, s.point.y, boardSize)}
                      </span>
                      <span className="text-xs text-white/70 leading-tight">{s.reason}</span>
                    </button>
                  ))}
                  {labeledHighlights.map((h) => (
                    <div key={h.id} className="flex items-start gap-1.5">
                      <span
                        className="shrink-0 rounded px-1 py-0.5 text-[10px] font-mono font-bold leading-none"
                        style={{
                          backgroundColor: `${variantColors[h.variant] ?? variantColors.neutral}33`,
                          color: variantColors[h.variant] ?? variantColors.neutral,
                        }}
                      >
                        {coordLabel(h.point.x, h.point.y, boardSize)}
                      </span>
                      <span className="text-xs text-white/70 leading-tight">{h.label}</span>
                    </div>
                  ))}
                  {labeledArrows.map((a) => (
                    <div key={a.id} className="flex items-start gap-1.5">
                      <span
                        className="shrink-0 rounded px-1 py-0.5 text-[10px] font-mono font-bold leading-none"
                        style={{ backgroundColor: `${ARROW_COLOR}33`, color: ARROW_COLOR }}
                      >
                        {a.order}→
                      </span>
                      <span className="text-xs text-white/70 leading-tight">{a.label}</span>
                    </div>
                  ))}
                  {labeledGroups.map((g) => (
                    <div key={g.id} className="flex items-start gap-1.5">
                      <span
                        className="shrink-0 text-[10px] leading-none"
                        style={{ color: GROUP_COLORS[g.color] ?? '#818cf8' }}
                      >
                        ●
                      </span>
                      <span className="text-xs text-white/70 leading-tight">{g.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
