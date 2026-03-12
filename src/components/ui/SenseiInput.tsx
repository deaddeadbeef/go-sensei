"use client";
import { useState, useCallback } from 'react';
import { useGameStore } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';

interface SenseiInputProps {
  onSendMessage: (text: string) => void;
}

export function SenseiInput({ onSendMessage }: SenseiInputProps) {
  const [text, setText] = useState('');
  const isAiThinking = useGameStore((s) => s.isAiThinking);

  const handleSend = useCallback(() => {
    if (!text.trim() || isAiThinking) return;
    onSendMessage(text.trim());
    setText('');
  }, [text, isAiThinking, onSendMessage]);

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
        placeholder={isAiThinking ? 'Sensei is thinking...' : 'Ask Sensei anything...'}
        disabled={isAiThinking}
        className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40 disabled:opacity-40"
        style={{ color: COLORS.ui.textPrimary }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || isAiThinking}
        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
      >
        Send
      </button>
    </div>
  );
}
