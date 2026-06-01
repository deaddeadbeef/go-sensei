'use client';

import { motion } from 'framer-motion';
import type { ProblemCategory } from '@/lib/problems/types';
import { getProblemReadingPlan } from '@/lib/problems/reading-plan';
import { COLORS } from '@/utils/colors';

interface ProblemReadingPlanProps {
  category: ProblemCategory;
}

export function ProblemReadingPlan({ category }: ProblemReadingPlanProps) {
  const plan = getProblemReadingPlan(category);

  return (
    <motion.section
      className="mb-3 rounded-xl p-4"
      style={{ backgroundColor: COLORS.ui.bgCard, border: `1px solid ${COLORS.ui.accent}30` }}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Problem reading plan"
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.ui.textSecondary }}>
        Read before you click
      </p>
      <div className="mt-3 border-l-2 pl-3" style={{ borderColor: COLORS.ui.accent }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.ui.accent }}>
          {plan.focusLabel}
        </p>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: COLORS.ui.textPrimary }}>
          {plan.focus}
        </p>
      </div>
      <ol className="mt-3 space-y-2">
        {plan.steps.map((step, index) => (
          <li key={step} className="flex gap-2 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: `${COLORS.ui.accent}22`, color: COLORS.ui.accent }}
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
        {plan.reminder}
      </p>
    </motion.section>
  );
}
