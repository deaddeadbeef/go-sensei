'use client';

import { motion } from 'framer-motion';
import type { BoardSize } from '@/lib/go-engine/types';
import type { ProblemSolutionStep } from '@/lib/problems/solution-review';
import { formatProblemPoint } from '@/lib/problems/solution-review';
import { pointToSvg } from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';

interface ProblemSolutionOverlayProps {
  steps: ProblemSolutionStep[];
  boardSize: BoardSize;
  stoneRadius: number;
}

interface ProblemSolutionPanelProps {
  steps: ProblemSolutionStep[];
  boardSize: BoardSize;
}

function stepColor(step: ProblemSolutionStep): string {
  return step.role === 'student' ? COLORS.overlay.positive : COLORS.overlay.suggestion;
}

export function ProblemSolutionOverlay({ steps, boardSize, stoneRadius }: ProblemSolutionOverlayProps) {
  if (steps.length === 0) return null;

  return (
    <g pointerEvents="none">
      {steps.map((step) => {
        const { cx, cy } = pointToSvg(step.move, boardSize);
        const color = stepColor(step);
        const badgeX = cx + stoneRadius * 0.46;
        const badgeY = cy - stoneRadius * 0.46;

        return (
          <motion.g
            key={`${step.order}-${step.move.x}-${step.move.y}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: step.order * 0.06 }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={stoneRadius * 0.76}
              fill="transparent"
              stroke={color}
              strokeWidth={3}
              strokeDasharray={step.role === 'opponent' ? '5 4' : undefined}
            />
            <circle
              cx={badgeX}
              cy={badgeY}
              r={stoneRadius * 0.34}
              fill={color}
              stroke={COLORS.ui.bgPrimary}
              strokeWidth={2}
            />
            <text
              x={badgeX}
              y={badgeY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.max(9, stoneRadius * 0.42)}
              fontWeight={700}
              fill={COLORS.ui.bgPrimary}
            >
              {step.order}
            </text>
          </motion.g>
        );
      })}
    </g>
  );
}

export function ProblemSolutionPanel({ steps, boardSize }: ProblemSolutionPanelProps) {
  if (steps.length === 0) return null;

  return (
    <motion.div
      className="mb-3 rounded-xl p-4"
      style={{ backgroundColor: COLORS.ui.bgCard, border: `1px solid ${COLORS.ui.accent}30` }}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="mb-3">
        <p className="text-sm font-semibold" style={{ color: COLORS.ui.textPrimary }}>
          Solution line
        </p>
        <p className="mt-1 text-xs" style={{ color: COLORS.ui.textSecondary }}>
          Numbered points on the board show the main answer sequence.
        </p>
      </div>
      <ol className="space-y-2">
        {steps.map((step) => {
          const color = stepColor(step);
          return (
            <li key={`${step.order}-${step.move.x}-${step.move.y}`} className="flex gap-3">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: color, color: COLORS.ui.bgPrimary }}
              >
                {step.order}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: COLORS.ui.textPrimary }}>
                  {step.role === 'student' ? 'Your move' : 'Expected reply'} at {formatProblemPoint(step.move, boardSize)}
                </p>
                {step.label && (
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
                    {step.label}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
}
