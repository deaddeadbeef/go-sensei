"use client";
import { useGameStore } from '@/stores/game-store';
import { useTypewriter } from '@/hooks/useTypewriter';
import { useGoMaster } from '@/hooks/useGoMaster';
import { COLORS } from '@/utils/colors';
import { motion, AnimatePresence } from 'framer-motion';
import { BUBBLE_SLIDE_IN, BUBBLE_AUTO_DISMISS } from '@/utils/animation';
import { useCallback, useEffect } from 'react';
import type { ProblemCategory } from '@/lib/problems/types';

const variantStyles: Record<string, { borderColor: string; icon: string }> = {
  neutral: { borderColor: COLORS.ui.accent, icon: '🎓' },
  celebrate: { borderColor: COLORS.overlay.positive, icon: '🎉' },
  warning: { borderColor: COLORS.overlay.warning, icon: '⚠️' },
  teaching: { borderColor: COLORS.overlay.suggestion, icon: '💡' },
  thinking: { borderColor: COLORS.ui.textSecondary, icon: '🤔' },
};

const practiceActionToCategory: Record<string, ProblemCategory> = {
  'practice:capture': 'capture',
  'practice:life-and-death': 'life-and-death',
  'practice:reading': 'reading',
};

const lessonActionToId: Record<string, string> = {
  'lesson:liberties': 'liberties',
  'lesson:territory': 'territory',
  'lesson:ko': 'ko',
};

export function SenseiBubble() {
  const bubble = useGameStore((s) => s.bubble);
  const dismissBubble = useGameStore((s) => s.dismissBubble);
  const showProblems = useGameStore((s) => s.showProblems);
  const startLesson = useGameStore((s) => s.startLesson);
  const { requestHint } = useGoMaster();
  const { displayedText, isComplete } = useTypewriter(bubble.text);

  useEffect(() => {
    if (!bubble.visible || !isComplete || bubble.actions.length > 0) return;
    const timer = setTimeout(dismissBubble, BUBBLE_AUTO_DISMISS);
    return () => clearTimeout(timer);
  }, [bubble.visible, isComplete, bubble.actions.length, dismissBubble]);

  const style = variantStyles[bubble.variant] || variantStyles.neutral;
  const handleAction = useCallback((actionId: string) => {
    dismissBubble();
    if (actionId === 'hint') {
      requestHint();
      return;
    }

    const problemCategory = practiceActionToCategory[actionId];
    if (problemCategory) {
      showProblems(problemCategory);
      return;
    }

    const lessonId = lessonActionToId[actionId];
    if (lessonId) {
      startLesson(lessonId);
    }
  }, [dismissBubble, requestHint, showProblems, startLesson]);

  return (
    <AnimatePresence>
      {bubble.visible && bubble.text && (
        <motion.div
          key="sensei-bubble"
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 max-w-sm pointer-events-auto"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: BUBBLE_SLIDE_IN, ease: 'easeOut' }}
        >
          <div
            className="rounded-xl px-4 py-3 shadow-lg backdrop-blur-sm"
            style={{
              backgroundColor: COLORS.ui.bgCard + 'ee',
              borderLeft: `3px solid ${style.borderColor}`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{style.icon}</span>
              <span className="text-xs font-semibold" style={{ color: COLORS.ui.accent }}>
                Go Sensei
              </span>
              <button
                onClick={dismissBubble}
                className="ml-auto text-xs opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: COLORS.ui.textSecondary }}
              >
                ✕
              </button>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
              {displayedText}
              {!isComplete && (
                <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse"
                  style={{ backgroundColor: COLORS.ui.accent }} />
              )}
            </p>
            {bubble.actions.length > 0 && isComplete && (
              <div className="flex gap-2 mt-2">
                {bubble.actions.map((action) => (
                  <button
                    key={action.id}
                    className="text-xs px-3 py-1 rounded-lg font-medium transition-colors hover:brightness-110"
                    style={{
                      backgroundColor: COLORS.ui.accent,
                      color: COLORS.ui.bgPrimary,
                    }}
                    onClick={() => handleAction(action.id)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
