"use client";

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useGameStore } from '@/stores/game-store';
import {
  formatMoveMessage,
  formatFirstMoveMessage,
  formatHesitationMessage,
} from '@/lib/ai/format-board';
import { useCallback, useEffect, useMemo, useRef } from 'react';

export function useGoMaster() {
  const setAiThinking = useGameStore((s) => s.setAiThinking);
  const applyHighlights = useGameStore((s) => s.applyHighlights);
  const applyLibertyOverlay = useGameStore((s) => s.applyLibertyOverlay);
  const applySuggestions = useGameStore((s) => s.applySuggestions);
  const applyAiMove = useGameStore((s) => s.applyAiMove);
  const showBubble = useGameStore((s) => s.showBubble);
  const dismissBubble = useGameStore((s) => s.dismissBubble);
  const clearOverlays = useGameStore((s) => s.clearOverlays);
  const addPendingCaptures = useGameStore((s) => s.addPendingCaptures);

  // Stable refs so callbacks don't cause re-init of the chat
  const storeRef = useRef({
    applyHighlights,
    applyLibertyOverlay,
    applySuggestions,
    applyAiMove,
    showBubble,
    addPendingCaptures,
    setAiThinking,
  });
  useEffect(() => {
    storeRef.current = {
      applyHighlights,
      applyLibertyOverlay,
      applySuggestions,
      applyAiMove,
      showBubble,
      addPendingCaptures,
      setAiThinking,
    };
  });

  // Transport with dynamic body that reads game state at send time
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        headers: () => ({
          ...(typeof window !== 'undefined' && localStorage.getItem('go-sensei-api-key')
            ? { 'x-api-key': localStorage.getItem('go-sensei-api-key')! }
            : {}),
        }),
        body: () => ({
          gameState: {
            moveHistory: useGameStore.getState().game.moveHistory.map((m) => {
              if (m.type === 'place')
                return { type: 'place', x: m.point.x, y: m.point.y, color: m.color };
              if (m.type === 'pass') return { type: 'pass', color: m.color };
              return { type: 'resign', color: m.color };
            }),
            boardSize: useGameStore.getState().game.board.size,
            komi: useGameStore.getState().game.komi,
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage: chatSendMessage, status } = useChat({
    transport,
    onToolCall({ toolCall }) {
      const toolName = toolCall.toolName;
      const args = (toolCall.input ?? {}) as Record<string, unknown>;
      const s = storeRef.current;

      if (toolName === 'make_move') {
        if (args && typeof args.x === 'number' && typeof args.y === 'number') {
          s.applyAiMove({ x: args.x, y: args.y });
        }
      }

      if (toolName === 'highlight_positions' && args?.positions) {
        const positions = (args.positions as { x: number; y: number }[]).map((p, i) => ({
          id: `hl-${Date.now()}-${i}`,
          point: { x: p.x, y: p.y },
          variant: ((args.style as string) || 'neutral') as
            | 'positive'
            | 'warning'
            | 'danger'
            | 'neutral',
          label: args.label as string | undefined,
        }));
        s.applyHighlights(positions);
      }

      if (toolName === 'show_liberty_count' && args) {
        s.applyLibertyOverlay({
          id: `lib-${Date.now()}`,
          point: { x: args.x as number, y: args.y as number },
          count: (args.count as number) || 0,
          libertyPoints: (args.liberties as { x: number; y: number }[]) || [],
        });
      }

      if (toolName === 'suggest_moves' && args?.suggestions) {
        const suggestions = (
          args.suggestions as { x: number; y: number; reason?: string; label?: string }[]
        ).map((sg, i) => ({
          id: `sug-${Date.now()}-${i}`,
          point: { x: sg.x, y: sg.y },
          rank: i + 1,
          reason: sg.reason || '',
          label: sg.label || String(i + 1),
        }));
        s.applySuggestions(suggestions);
      }

      if (toolName === 'pass_turn') {
        useGameStore.getState().pass();
      }

      if (toolName === 'resign_game') {
        s.showBubble({
          text: (args?.message as string) || 'You win! Great game!',
          variant: 'celebrate',
          anchorPoint: null,
        });
      }
    },
    onFinish() {
      storeRef.current.setAiThinking(false);
    },
    onError(error: Error) {
      storeRef.current.setAiThinking(false);
      storeRef.current.showBubble({
        text: 'Hmm, I had trouble thinking. Make sure your API key is set in .env.local and try again.',
        variant: 'warning',
        anchorPoint: null,
      });
      console.error('AI error:', error);
    },
  });

  const isThinking = status === 'submitted' || status === 'streaming';

  // Show AI text responses in the bubble
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'assistant') {
      // Extract text content from parts
      const textParts = lastMessage.parts.filter(
        (p): p is { type: 'text'; text: string } => p.type === 'text',
      );
      const content = textParts.map((p) => p.text).join('');
      if (content) {
        showBubble({
          text: content,
          variant: 'neutral',
          anchorPoint: null,
          streamingComplete: !isThinking,
        });
      }
    }
  }, [messages, isThinking, showBubble]);

  // Sync thinking state
  useEffect(() => {
    setAiThinking(isThinking);
  }, [isThinking, setAiThinking]);

  const sendPlayerMove = useCallback(
    (wasCapture: boolean, capturedCount: number) => {
      const currentGame = useGameStore.getState().game;
      clearOverlays();
      dismissBubble();
      setAiThinking(true);

      const isFirstMove = currentGame.moveHistory.length === 1;
      const content = isFirstMove
        ? formatFirstMoveMessage(currentGame)
        : formatMoveMessage(currentGame, wasCapture, capturedCount);

      chatSendMessage({ text: content });
    },
    [chatSendMessage, clearOverlays, dismissBubble, setAiThinking],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const currentGame = useGameStore.getState().game;
      clearOverlays();
      setAiThinking(true);
      const content = formatMoveMessage(currentGame, false, 0, text);
      chatSendMessage({ text: content });
    },
    [chatSendMessage, clearOverlays, setAiThinking],
  );

  const requestHint = useCallback(() => {
    const currentGame = useGameStore.getState().game;
    setAiThinking(true);
    chatSendMessage({ text: formatHesitationMessage(currentGame) });
  }, [chatSendMessage, setAiThinking]);

  return { sendPlayerMove, sendMessage, requestHint, messages, isLoading: isThinking };
}
