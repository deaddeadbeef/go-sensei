"use client";

import { useGameStore } from '@/stores/game-store';
import { useConceptStore } from '@/stores/concept-store';
import { useReviewStore } from '@/stores/review-store';
import { useProgressStore } from '@/stores/progress-store';
import { CONCEPTS } from '@/lib/concepts/concept-data';
import { getLearningRecommendation } from '@/lib/learning-path/recommendations';
import { formatObjectiveTargetText, getBeginnerObjective } from '@/lib/coaching/beginner-objectives';
import { getLocalGuidedFallback } from '@/lib/coaching/local-guided-fallback';
import { coordToPoint } from '@/lib/go-engine';
import {
  formatMoveMessage,
  formatFirstMoveMessage,
  formatHesitationMessage,
  formatReviewRequest,
  formatFreeTextMessage,
  formatPassMessage,
} from '@/lib/ai/format-board';
import { useCallback, useRef } from 'react';
import type { ConceptMastery } from '@/lib/concepts/types';
import type { BeginnerObjective } from '@/lib/coaching/beginner-objectives';
import type { ProblemAttempt } from '@/lib/problems/types';
import type { BoardSize, GameState } from '@/lib/go-engine/types';
import type { TeachingLevel } from '@/lib/ai/system-prompt';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolResult {
  toolName: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

interface ChatResponse {
  text?: string;
  toolResults?: ToolResult[];
}

interface PointPayload {
  x: number;
  y: number;
  label?: string;
}

interface SuggestionPayload extends PointPayload {
  reason?: string;
}

interface ArrowPayload {
  from: PointPayload;
  to: PointPayload;
  label?: string;
  order: number;
}

interface GroupPayload {
  id: string;
  stones: PointPayload[];
  color: 'black' | 'white';
  liberties: number;
  label?: string;
}

interface ConceptPayload {
  conceptId: string;
}

interface InfluencePayload {
  point: { x: number; y: number };
  value: number;
}

function isPointPayload(value: unknown): value is PointPayload {
  return typeof value === 'object' && value !== null
    && typeof (value as PointPayload).x === 'number'
    && typeof (value as PointPayload).y === 'number';
}

function isOverlayVariant(value: unknown): value is 'positive' | 'warning' | 'danger' | 'neutral' {
  return value === 'positive' || value === 'warning' || value === 'danger' || value === 'neutral';
}

function pointFromToolArgs(args: Record<string, unknown>, boardSize: BoardSize): PointPayload | null {
  if (isPointPayload(args)) {
    return { x: args.x, y: args.y };
  }

  if (typeof args.position === 'string') {
    const point = coordToPoint(args.position, boardSize);
    return point ? { x: point.x, y: point.y } : null;
  }

  return null;
}

function buildGuidedContext(
  mastery: Record<string, ConceptMastery>,
  completedLessons: string[],
  problemAttempts: ProblemAttempt[],
  dueReviewCount: number,
  hasStartedIntroGame: boolean,
  beginnerObjective: BeginnerObjective | null,
  boardSize: BoardSize,
): string {
  const mastered: string[] = [];
  const practiced: string[] = [];
  const introduced: string[] = [];
  const unseen: string[] = [];
  const recommendation = getLearningRecommendation({
    completedLessons,
    problemAttempts,
    dueReviewCount,
    hasStartedIntroGame,
    mastery: Object.values(mastery),
  });

  for (const concept of CONCEPTS) {
    const m = mastery[concept.id];
    if (!m || m.level === 0) unseen.push(concept.name);
    else if (m.level === 1) introduced.push(concept.name);
    else if (m.level === 2) practiced.push(concept.name);
    else if (m.level >= 3) mastered.push(concept.name);
  }

  const lines: string[] = [];
  if (mastered.length) lines.push(`Mastered: ${mastered.join(', ')}`);
  if (practiced.length) lines.push(`Practicing: ${practiced.join(', ')}`);
  if (introduced.length) lines.push(`Introduced: ${introduced.join(', ')}`);
  if (unseen.length) lines.push(`Not yet seen: ${unseen.join(', ')}`);
  lines.push(`Current recommended focus: ${recommendation.title}`);
  if (recommendation.focusConcepts.length) {
    lines.push(`Focus concepts: ${recommendation.focusConcepts.join(', ')}`);
  }
  if (recommendation.kind === 'guided_intro') {
    lines.push('Current mode: first guided 9x9 beginner game.');
  }
  if (beginnerObjective) {
    const targetText = formatObjectiveTargetText(beginnerObjective, boardSize);
    lines.push(`Current visible objective: ${beginnerObjective.title}`);
    lines.push(`Student instruction: ${beginnerObjective.instruction}`);
    if (targetText) lines.push(`Suggested board points: ${targetText}`);
    lines.push(`Plain-language reason: ${beginnerObjective.why}`);
  }
  lines.push(`Focus on teaching concepts the student hasn't mastered yet.`);

  return lines.join('\n');
}

function getBeginnerObjectiveForAiContext(
  game: GameState,
  teachingLevel: TeachingLevel,
): BeginnerObjective | null {
  const visibleObjective = getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: game.moveHistory.length,
    currentPlayer: game.currentPlayer,
    teachingLevel,
  });

  if (visibleObjective) return visibleObjective;

  const lastMove = game.moveHistory[game.moveHistory.length - 1];
  if (!lastMove || lastMove.color !== 'black') return null;

  return getBeginnerObjective({
    boardSize: game.board.size,
    board: game.board,
    moveHistory: game.moveHistory,
    moveCount: Math.max(game.moveHistory.length - 1, 0),
    currentPlayer: 'black',
    teachingLevel,
  });
}

export function useGoMaster() {
  const showBubble = useGameStore((s) => s.showBubble);
  const dismissBubble = useGameStore((s) => s.dismissBubble);
  const setAiThinking = useGameStore((s) => s.setAiThinking);
  const applyHighlights = useGameStore((s) => s.applyHighlights);
  const applyLibertyOverlay = useGameStore((s) => s.applyLibertyOverlay);
  const applySuggestions = useGameStore((s) => s.applySuggestions);
  const applyArrows = useGameStore((s) => s.applyArrows);
  const applyInfluence = useGameStore((s) => s.applyInfluence);
  const applyGroups = useGameStore((s) => s.applyGroups);
  const applyAiMove = useGameStore((s) => s.applyAiMove);
  const clearOverlays = useGameStore((s) => s.clearOverlays);
  const addChatMessage = useGameStore((s) => s.addChatMessage);
  const recordEncounter = useConceptStore((s) => s.recordEncounter);
  const conceptMastery = useConceptStore((s) => s.mastery);

  const historyRef = useRef<ChatMsg[]>([]);

  const headers = useCallback(() => {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('go-sensei-github-token') : null;
    return { 'Content-Type': 'application/json', ...(t ? { 'x-github-token': t } : {}) };
  }, []);

  const passSenseiIfNeeded = useCallback((message: string) => {
    const state = useGameStore.getState();

    if (state.phase !== 'playing' || state.game.currentPlayer === 'black') {
      return false;
    }

    state.pass();
    useGameStore.getState().addChatMessage(message, 'system');
    return true;
  }, []);

  const applyLocalFallback = useCallback(
    (reason: 'auth-expired' | 'auth-unavailable' | 'network-error' | 'server-error') => {
      const state = useGameStore.getState();
      const fallback = getLocalGuidedFallback(state.game, state.teachingLevel, reason);

      if (!fallback) return false;

      for (const conceptId of fallback.conceptIds) {
        recordEncounter(conceptId);
      }

      if (fallback.shouldPassSensei && state.game.currentPlayer !== 'black') {
        passSenseiIfNeeded('Sensei used local guidance and passed for White.');
      }

      showBubble({
        text: fallback.text,
        variant: 'warning',
        anchorPoint: null,
        streamingComplete: true,
      });

      return true;
    },
    [passSenseiIfNeeded, recordEncounter, showBubble],
  );

  const gameBody = useCallback(() => {
    const s = useGameStore.getState();
    const g = s.game;
    const progress = useProgressStore.getState();
    const dueReviewCount = useReviewStore.getState().getDueCount();
    const beginnerObjective = getBeginnerObjectiveForAiContext(g, s.teachingLevel);
    const guidedContext = s.teachingLevel === 'guided' || beginnerObjective
      ? buildGuidedContext(
        conceptMastery,
        progress.completedLessons,
        progress.problemAttempts,
        dueReviewCount,
        progress.hasStartedIntroGame,
        beginnerObjective,
        g.board.size,
      )
      : undefined;

    return {
      moveHistory: g.moveHistory.map((m) => {
        if (m.type === 'place') return { type: 'place', x: m.point.x, y: m.point.y, color: m.color };
        if (m.type === 'pass') return { type: 'pass', color: m.color };
        return { type: 'resign', color: m.color };
      }),
      boardSize: g.board.size,
      komi: g.komi,
      teachingLevel: s.teachingLevel,
      guidedContext,
    };
  }, [conceptMastery]);

  const applyTools = useCallback((results: ToolResult[]) => {
    for (const { toolName, args, result } of results) {
      if (toolName === 'make_move' && result.success === true && typeof args.position === 'string') {
        const pt = coordToPoint(args.position, useGameStore.getState().game.board.size);
        if (pt) applyAiMove(pt);
      }

      if (toolName === 'highlight_positions' && Array.isArray(result.positions))
        applyHighlights(
          result.positions.filter(isPointPayload).map((p, i) => ({
            id: `hl-${Date.now()}-${i}`,
            point: { x: p.x, y: p.y },
            variant: isOverlayVariant(result.style) ? result.style : 'neutral',
            label: p.label,
          })),
        );

      if (toolName === 'show_liberty_count' && result.success === true) {
        const point = pointFromToolArgs(args, useGameStore.getState().game.board.size);
        if (point) {
          applyLibertyOverlay({
            id: `lib-${Date.now()}`,
            point,
            count: typeof result.count === 'number' ? result.count : 0,
            libertyPoints: Array.isArray(result.liberties) ? result.liberties.filter(isPointPayload) : [],
          });
        }
      }

      if (toolName === 'suggest_moves' && Array.isArray(result.suggestions))
        applySuggestions(
          result.suggestions.filter(isPointPayload).map((s: SuggestionPayload, i: number) => ({
            id: `sug-${Date.now()}-${i}`,
            point: { x: s.x, y: s.y },
            rank: i + 1,
            reason: s.reason || '',
            label: s.label || String(i + 1),
          })),
        );

      if (toolName === 'show_sequence' && Array.isArray(result.moves))
        applyArrows(
          (result.moves as ArrowPayload[]).filter((m) => isPointPayload(m.from) && isPointPayload(m.to)).map((m) => ({
            id: `arr-${Date.now()}-${m.order}`,
            from: { x: m.from.x, y: m.from.y },
            to: { x: m.to.x, y: m.to.y },
            label: m.label,
            order: m.order,
          })),
        );

      if (toolName === 'show_influence' && Array.isArray(result.influence))
        applyInfluence(result.influence as InfluencePayload[]);

      if (toolName === 'show_groups' && Array.isArray(result.groups))
        applyGroups(
          (result.groups as GroupPayload[]).map((g) => ({
            id: g.id,
            stones: g.stones.map((s) => ({ x: s.x, y: s.y })),
            color: g.color,
            liberties: g.liberties,
            label: g.label,
          })),
        );

      if (toolName === 'evaluate_concepts' && Array.isArray(result.concepts)) {
        for (const c of result.concepts as ConceptPayload[]) {
          recordEncounter(c.conceptId);
        }
      }

      // A6: pass_turn — server already applies the pass in the agentic loop.
      // Don't apply client-side to avoid double-pass.
    }
  }, [applyAiMove, applyHighlights, applyLibertyOverlay, applySuggestions, applyArrows, applyInfluence, applyGroups, recordEncounter]);

  const send = useCallback(
    async (message: string) => {
      clearOverlays();
      dismissBubble();
      setAiThinking(true);
      try {
        let r: Response;
        const reqBody = JSON.stringify({
          message,
          gameState: gameBody(),
          chatHistory: historyRef.current.slice(-20),
        });
        try {
          r = await fetch('/api/chat', { method: 'POST', headers: headers(), body: reqBody });
        } catch (networkErr) {
          // Retry once on network failure
          console.log('[GoSensei] Network error, retrying...', networkErr);
          await new Promise(resolve => setTimeout(resolve, 1500));
          r = await fetch('/api/chat', { method: 'POST', headers: headers(), body: reqBody });
        }

        if (!r.ok) {
          const errData = await r.json().catch(() => ({})) as Record<string, unknown>;

          if (r.status === 401 || errData.code === 'AUTH_EXPIRED') {
            // Clear expired token and notify user
            const authReason = errData.code === 'AUTH_EXPIRED' ? 'auth-expired' : 'auth-unavailable';
            if (authReason === 'auth-expired') {
              sessionStorage.removeItem('go-sensei-github-token');
            }
            if (!applyLocalFallback(authReason)) {
              const returnedTurn = passSenseiIfNeeded('Sensei needs login and passed for White to keep the board playable.');
              const authText = authReason === 'auth-expired'
                ? 'Your session has expired. Please open Settings and re-login with GitHub.'
                : 'Please open Settings and login with GitHub to use cloud Sensei.';
              showBubble({
                text: returnedTurn
                  ? `${authText} I passed for White so the board is not stuck.`
                  : authText,
                variant: 'warning',
                anchorPoint: null,
              });
              addChatMessage('⚠️ Cloud Sensei needs GitHub auth. Open Settings (⚙).', 'system');
            }
            setAiThinking(false);
            return;
          }

          throw new Error(typeof errData.error === 'string' ? errData.error : `HTTP ${r.status}`);
        }
        const d = await r.json() as ChatResponse;
        if (d.toolResults?.length) applyTools(d.toolResults);
        if (d.text) showBubble({ text: d.text, variant: 'neutral', anchorPoint: null, streamingComplete: true });

        // Check if AI failed to place a stone when it should have
        const aiMoved = d.toolResults?.some((r) => r.toolName === 'make_move' && r.result.success === true);
        if (!aiMoved && useGameStore.getState().game.currentPlayer !== 'black') {
          // AI didn't move — force pass to return turn to player
          const { pass, addChatMessage: addMsg } = useGameStore.getState();
          pass();
          addMsg('Sensei skipped their move.', 'system');
        }

        historyRef.current.push({ role: 'user', content: message });
        if (d.text) historyRef.current.push({ role: 'assistant', content: d.text });
        if (historyRef.current.length > 20) historyRef.current = historyRef.current.slice(-20);
      } catch (err) {
        if (applyLocalFallback(err instanceof TypeError ? 'network-error' : 'server-error')) {
          console.warn('AI fallback used:', err);
          return;
        }

        const returnedTurn = passSenseiIfNeeded('Sensei could not answer and passed for White to keep the board playable.');
        showBubble({
          text: `Hmm, I had trouble thinking. ${(err as Error).message}${returnedTurn ? ' I passed for White so the board is not stuck.' : ''}`,
          variant: 'warning',
          anchorPoint: null,
        });
        console.error('AI error:', err);
      } finally {
        setAiThinking(false);
      }
    },
    [clearOverlays, dismissBubble, setAiThinking, headers, gameBody, applyTools, showBubble, addChatMessage, applyLocalFallback, passSenseiIfNeeded],
  );

  const sendPlayerMove = useCallback(
    (wasCapture: boolean, capturedCount: number) => {
      const g = useGameStore.getState().game;
      const lastMove = g.moveHistory[g.moveHistory.length - 1];
      if (lastMove?.type === 'pass') {
        send(formatPassMessage(g));
        return;
      }
      send(g.moveHistory.length === 1 ? formatFirstMoveMessage(g) : formatMoveMessage(g, wasCapture, capturedCount));
    },
    [send],
  );

  const sendMessage = useCallback(
    (text: string) => {
      addChatMessage(text, 'user');
      const game = useGameStore.getState().game;
      send(formatFreeTextMessage(game, text));
    },
    [send, addChatMessage],
  );

  const requestHint = useCallback(() => {
    send(formatHesitationMessage(useGameStore.getState().game));
  }, [send]);

  const requestReview = useCallback(() => {
    const g = useGameStore.getState().game;
    send(formatReviewRequest(g));
  }, [send]);

  return { sendPlayerMove, sendMessage, requestHint, requestReview };
}
