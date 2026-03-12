"use client";
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

export function RulesPanel() {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: COLORS.ui.bgCard }}>
      <h3 className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: COLORS.ui.accent }}>
        Rules of Go
      </h3>
      <ul className="space-y-1.5">
        {RULES.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: COLORS.ui.textSecondary }}>
            <span className="shrink-0 text-xs">{r.icon}</span>
            <span>{r.rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
