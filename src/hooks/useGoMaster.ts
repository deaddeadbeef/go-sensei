"use client";

import { useGameStore } from '@/stores/game-store';
import { coordToPoint } from '@/lib/go-engine';
import {
  formatMoveMessage,
  formatFirstMoveMessage,
  formatHesitationMessage,
  formatReviewRequest,
  formatFreeTextMessage,
} from '@/lib/ai/format-board';
import { useCallback, useRef } from 'react';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
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

  const historyRef = useRef<ChatMsg[]>([]);

  const headers = useCallback(() => {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('go-sensei-github-token') : null;
    return { 'Content-Type': 'application/json', ...(t ? { 'x-github-token': t } : {}) };
  }, []);

  const gameBody = useCallback(() => {
    const s = useGameStore.getState();
    const g = s.game;
    return {
      moveHistory: g.moveHistory.map((m) => {
        if (m.type === 'place') return { type: 'place', x: m.point.x, y: m.point.y, color: m.color };
        if (m.type === 'pass') return { type: 'pass', color: m.color };
        return { type: 'resign', color: m.color };
      }),
      boardSize: g.board.size,
      komi: g.komi,
      teachingLevel: s.teachingLevel,
    };
  }, []);

  const applyTools = useCallback((results: any[]) => {
    for (const { toolName, args, result } of results) {
      if (toolName === 'make_move' && result.success) {
        const pt = coordToPoint(args.position, useGameStore.getState().game.board.size);
        if (pt) applyAiMove(pt);
      }

      if (toolName === 'highlight_positions' && result.positions)
        applyHighlights(
          result.positions.map((p: any, i: number) => ({
            id: `hl-${Date.now()}-${i}`,
            point: { x: p.x, y: p.y },
            variant: result.style || 'neutral',
            label: p.label,
          })),
        );

      if (toolName === 'show_liberty_count' && result.success)
        applyLibertyOverlay({
          id: `lib-${Date.now()}`,
          point: { x: args.x, y: args.y },
          count: result.count,
          libertyPoints: result.liberties || [],
        });

      if (toolName === 'suggest_moves' && result.suggestions)
        applySuggestions(
          result.suggestions.map((s: any, i: number) => ({
            id: `sug-${Date.now()}-${i}`,
            point: { x: s.x, y: s.y },
            rank: i + 1,
            reason: s.reason || '',
            label: s.label || String(i + 1),
          })),
        );

      if (toolName === 'show_sequence' && result.moves)
        applyArrows(
          result.moves.map((m: any) => ({
            id: `arr-${Date.now()}-${m.order}`,
            from: { x: m.from.x, y: m.from.y },
            to: { x: m.to.x, y: m.to.y },
            label: m.label,
            order: m.order,
          })),
        );

      if (toolName === 'show_influence' && result.influence)
        applyInfluence(result.influence);

      if (toolName === 'show_groups' && result.groups)
        applyGroups(
          result.groups.map((g: any) => ({
            id: g.id,
            stones: g.stones.map((s: any) => ({ x: s.x, y: s.y })),
            color: g.color,
            liberties: g.liberties,
            label: g.label,
          })),
        );

      // A6: pass_turn — server already applies the pass in the agentic loop.
      // Don't apply client-side to avoid double-pass.
    }
  }, [applyAiMove, applyHighlights, applyLibertyOverlay, applySuggestions, applyArrows, applyInfluence, applyGroups]);

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
          const errData = await r.json().catch(() => ({} as any));

          if (r.status === 401 || errData.code === 'AUTH_EXPIRED') {
            // Clear expired token and notify user
            sessionStorage.removeItem('go-sensei-github-token');
            showBubble({ text: 'Your session has expired. Please open Settings and re-login with GitHub.', variant: 'warning', anchorPoint: null });
            addChatMessage('⚠️ Session expired. Please re-login via Settings (⚙).', 'system');
            setAiThinking(false);
            return;
          }

          throw new Error(errData.error || `HTTP ${r.status}`);
        }
        const d = await r.json();
        if (d.toolResults?.length) applyTools(d.toolResults);
        if (d.text) showBubble({ text: d.text, variant: 'neutral', anchorPoint: null, streamingComplete: true });

        historyRef.current.push({ role: 'user', content: message });
        if (d.text) historyRef.current.push({ role: 'assistant', content: d.text });
        if (historyRef.current.length > 20) historyRef.current = historyRef.current.slice(-20);
      } catch (err) {
        showBubble({
          text: `Hmm, I had trouble thinking. ${(err as Error).message}`,
          variant: 'warning',
          anchorPoint: null,
        });
        console.error('AI error:', err);
      } finally {
        setAiThinking(false);
      }
    },
    [clearOverlays, dismissBubble, setAiThinking, headers, gameBody, applyTools, showBubble],
  );

  const sendPlayerMove = useCallback(
    (wasCapture: boolean, capturedCount: number) => {
      const g = useGameStore.getState().game;
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
