"use client";
import { useState } from 'react';
import { useGameStore } from '@/stores/game-store';
import { COLORS } from '@/utils/colors';

const RULES = [
  { icon: '⚫', rule: 'Players alternate placing black and white stones' },
  { icon: '📍', rule: 'Stones go on intersections, not squares' },
  { icon: '🏰', rule: 'Surround empty areas to claim territory' },
  { icon: '⛓️', rule: 'Connected stones of the same color form groups' },
  { icon: '💨', rule: 'Open adjacent points are "liberties" (breathing room)' },
  { icon: '💀', rule: 'A group with zero liberties is captured and removed' },
  { icon: '🔄', rule: 'Ko rule: you can\'t immediately recreate the previous position' },
  { icon: '🏁', rule: 'Game ends when both players pass — most territory wins' },
];

function RulesPanelDetails({ defaultOpen }: { defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      data-testid="rules-panel"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="rounded-lg p-3"
      style={{ backgroundColor: COLORS.ui.bgCard }}
    >
      <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.ui.accent }}>
        <span className="flex items-center justify-between gap-2">
          <span>Rules of Go</span>
          <span className="text-[10px] font-medium normal-case tracking-normal" style={{ color: COLORS.ui.textSecondary }}>
            {isOpen ? 'Hide basics' : 'Show basics'}
          </span>
        </span>
      </summary>
      <ul className="mt-2 space-y-1.5">
        {RULES.map((r) => (
          <li key={r.rule} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
            <span className="shrink-0 text-xs">{r.icon}</span>
            <span>{r.rule}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function RulesPanel() {
  const hasStarted = useGameStore((s) => s.game.moveHistory.length > 0);

  return (
    <RulesPanelDetails
      key={hasStarted ? 'started' : 'fresh'}
      defaultOpen={!hasStarted}
    />
  );
}
