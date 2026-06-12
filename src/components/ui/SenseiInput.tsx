"use client";
import { useState, useCallback } from 'react';
import { useGameStore } from '@/stores/game-store';
import { pointToCoord } from '@/lib/go-engine';
import type { BoardState, Move } from '@/lib/go-engine/types';
import { COLORS } from '@/utils/colors';

interface SenseiInputProps {
  onSendMessage: (text: string) => void;
}

const QUESTION_PROMPT_PREFIX = 'Ask: ';

function hasBoardStones(board: BoardState): boolean {
  return board.grid.some((row) => row.some((cell) => cell !== null));
}

function latestPlaceMove(moveHistory: Move[]): Extract<Move, { type: 'place' }> | null {
  for (let index = moveHistory.length - 1; index >= 0; index -= 1) {
    const move = moveHistory[index];
    if (move.type === 'place') return move;
  }

  return null;
}

function buildQuestionPrompt(board: BoardState, moveHistory: Move[]): string {
  if (moveHistory.length === 0) {
    return hasBoardStones(board)
      ? 'Ask: Which group needs help?'
      : 'Ask: Where should I start?';
  }

  const lastPlace = latestPlaceMove(moveHistory);
  if (lastPlace?.color === 'black') {
    return `Ask: What did ${pointToCoord(lastPlace.point, board.size)} change?`;
  }

  if (lastPlace?.color === 'white') {
    return 'Ask: What is White threatening?';
  }

  return 'Ask: What should I play now?';
}

function questionFromPrompt(prompt: string): string | null {
  return prompt.startsWith(QUESTION_PROMPT_PREFIX)
    ? prompt.slice(QUESTION_PROMPT_PREFIX.length)
    : null;
}

export function SenseiInput({ onSendMessage }: SenseiInputProps) {
  const [text, setText] = useState('');
  const isAiThinking = useGameStore((s) => s.isAiThinking);
  const board = useGameStore((s) => s.game.board);
  const moveHistory = useGameStore((s) => s.game.moveHistory);
  const placeholder = isAiThinking ? 'Sensei is thinking...' : buildQuestionPrompt(board, moveHistory);
  const suggestedQuestion = isAiThinking ? null : questionFromPrompt(placeholder);
  const trimmedText = text.trim();
  const hasTypedText = trimmedText.length > 0;
  const sendButtonLabel = hasTypedText || isAiThinking ? 'Send' : 'Ask';
  const sendButtonAriaLabel = hasTypedText || isAiThinking ? 'Send message' : 'Ask suggested question';

  const handleSend = useCallback(() => {
    if (isAiThinking) return;

    const typedText = text.trim();
    const message = typedText || suggestedQuestion;
    if (!message) return;

    onSendMessage(message);
    setText('');
  }, [text, suggestedQuestion, isAiThinking, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div
      className="flex items-center gap-2 px-4 h-14 shrink-0"
      style={{ backgroundColor: COLORS.ui.bgCard, borderTop: `1px solid ${COLORS.ui.bgPrimary}` }}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isAiThinking}
        className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40 disabled:opacity-40"
        style={{ color: COLORS.ui.textPrimary }}
      />
      <button
        onClick={handleSend}
        disabled={isAiThinking || (!hasTypedText && !suggestedQuestion)}
        aria-label={sendButtonAriaLabel}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
      >
        {sendButtonLabel}
      </button>
    </div>
  );
}
