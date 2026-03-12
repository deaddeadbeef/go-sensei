"use client";

import { useEffect } from 'react';
import { useGameStore } from '@/stores/game-store';
import { pointToSvg, stoneRadius } from '@/utils/coordinates';
import { CAPTURE_FLASH, CAPTURE_DISSOLVE } from '@/utils/animation';
import { motion, AnimatePresence } from 'framer-motion';

export function CaptureAnimation() {
  const pendingCaptures = useGameStore((s) => s.pendingCaptures);
  const boardSize = useGameStore((s) => s.game.board.size);
  const completeCaptureAnimation = useGameStore(
    (s) => s.completeCaptureAnimation,
  );

  // Auto-complete captures after animation duration
  useEffect(() => {
    if (pendingCaptures.length === 0) return;
    const timer = setTimeout(
      () => {
        completeCaptureAnimation(pendingCaptures.map((c) => c.point));
      },
      (CAPTURE_FLASH + CAPTURE_DISSOLVE) * 1000 + 100,
    );
    return () => clearTimeout(timer);
  }, [pendingCaptures, completeCaptureAnimation]);

  if (pendingCaptures.length === 0) return null;

  const r = stoneRadius(boardSize);

  return (
    <AnimatePresence>
      {pendingCaptures.map((cap) => {
        const { cx, cy } = pointToSvg(cap.point, boardSize);
        const gradientId =
          cap.color === 'black'
            ? 'black-stone-gradient'
            : 'white-stone-gradient';

        return (
          <motion.circle
            key={`capture-${cap.point.x}-${cap.point.y}`}
            cx={cx}
            cy={cy}
            r={r}
            fill={`url(#${gradientId})`}
            filter="url(#stone-shadow)"
            initial={{ scale: 1, opacity: 1 }}
            animate={{
              scale: [1, 1.05, 0.3],
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: CAPTURE_FLASH + CAPTURE_DISSOLVE,
              times: [0, 0.3, 1],
              ease: 'easeOut',
            }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
        );
      })}
    </AnimatePresence>
  );
}
