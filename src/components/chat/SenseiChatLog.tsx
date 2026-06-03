"use client";
import { useRef, useEffect } from 'react';
import { useGameStore } from '@/stores/game-store';
import type { OverlayHighlight } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';
import { useSenseiAction } from '@/hooks/useSenseiAction';
import { motion, AnimatePresence } from 'framer-motion';
import type { SenseiAction } from '@/lib/coaching/sensei-actions';

const variantIcons: Record<string, string> = {
  neutral: '🎓',
  celebrate: '🎉',
  warning: '⚠️',
  teaching: '💡',
  thinking: '🤔',
  user: '💬',
  system: '⚠️',
};

export function SenseiChatLog() {
  const chatMessages = useGameStore((s) => s.chatMessages);
  const applyTargetHints = useGameStore((s) => s.applyTargetHints);
  const handleAction = useSenseiAction();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activePreviewRef = useRef<{ actionId: string; previousHints: OverlayHighlight[] } | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  const showActionPreview = (action: SenseiAction) => {
    if (!action.previewHighlights?.length) return;

    if (!activePreviewRef.current) {
      activePreviewRef.current = {
        actionId: action.id,
        previousHints: useGameStore.getState().overlays.targetHints,
      };
    } else if (activePreviewRef.current.actionId !== action.id) {
      activePreviewRef.current = {
        actionId: action.id,
        previousHints: activePreviewRef.current.previousHints,
      };
    }

    applyTargetHints(action.previewHighlights);
  };

  const clearActionPreview = (action: SenseiAction) => {
    if (!action.previewHighlights?.length) return;
    if (activePreviewRef.current?.actionId !== action.id) return;

    applyTargetHints(activePreviewRef.current.previousHints);
    activePreviewRef.current = null;
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto space-y-2 pr-1"
      style={{ scrollbarWidth: 'thin' }}
    >
      <AnimatePresence initial={false}>
        {chatMessages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg px-3 py-2"
            style={{
              backgroundColor: COLORS.ui.bgPrimary,
              borderLeft: `2px solid ${
                msg.variant === 'user' ? COLORS.ui.textSecondary
                : msg.variant === 'warning' || msg.variant === 'system' ? COLORS.overlay.warning
                : msg.variant === 'celebrate' ? COLORS.overlay.positive
                : msg.variant === 'teaching' ? COLORS.overlay.suggestion
                : COLORS.ui.accent
              }`,
              opacity: msg.variant === 'user' ? 0.85 : 1,
            }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs">{variantIcons[msg.variant] || '🎓'}</span>
              <span className="text-xs font-medium" style={{ color: msg.variant === 'user' ? COLORS.ui.textSecondary : COLORS.ui.accent }}>
                {msg.variant === 'user' ? 'You' : msg.variant === 'system' ? 'System' : 'Go Sensei'}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
              {msg.text}
            </p>
            {msg.variant !== 'user' && msg.actions && msg.actions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {msg.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleAction(action.id)}
                    onPointerEnter={() => showActionPreview(action)}
                    onMouseEnter={() => showActionPreview(action)}
                    onMouseLeave={() => clearActionPreview(action)}
                    onFocus={() => showActionPreview(action)}
                    onBlur={() => clearActionPreview(action)}
                    className="rounded border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-white/10"
                    style={{
                      borderColor: COLORS.ui.accent,
                      color: COLORS.ui.accent,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      {chatMessages.length === 0 && (
        <p className="text-xs text-center py-4 opacity-40" style={{ color: COLORS.ui.textSecondary }}>
          Place a stone to start learning!
        </p>
      )}
    </div>
  );
}
