# Visual Teaching Tools Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Equip Go Sensei with three new visual teaching tools — move sequence arrows, influence heatmap, and group visualization — so beginners can SEE the concepts being taught.

**Architecture:** Add three new overlay types to the existing overlay system (store → tool → component). Each gets an AI tool in route.ts, a React SVG overlay component, and store state in game-store.ts. Arrows use SVG `<line>` with markers; influence uses colored `<rect>` cells; groups use hull outlines around connected stones. All clear with existing `clearOverlays()`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, Framer Motion, SVG overlays

---

### Task 1: Arrow overlay — Store + Component

**Files:**
- Modify: `src/stores/game-store.ts` — add `arrows` to overlays
- Create: `src/components/board/overlays/ArrowOverlay.tsx`
- Modify: `src/components/board/GoBoard.tsx` — render ArrowOverlay

**Step 1: Add arrow overlay types and state to store**

In `src/stores/game-store.ts`:

Add new interface after OverlaySuggestion (around line 45):
```ts
interface OverlayArrow {
  id: string;
  from: Point;
  to: Point;
  label?: string;
  order: number; // sequence number (1, 2, 3...)
}
```

Add `arrows: OverlayArrow[]` to the overlays shape (around line 107-111):
```ts
overlays: {
  highlights: OverlayHighlight[];
  liberties: OverlayLiberty[];
  suggestions: OverlaySuggestion[];
  arrows: OverlayArrow[];       // NEW
}
```

Add default empty array in defaultOverlays:
```ts
arrows: [],
```

Add action to GameStore interface:
```ts
applyArrows: (arrows: OverlayArrow[]) => void;
```

Implement action:
```ts
applyArrows: (arrows) => set((s) => ({ overlays: { ...s.overlays, arrows } })),
```

Update `clearOverlays` to include arrows:
```ts
set({ overlays: { highlights: [], liberties: [], suggestions: [], arrows: [] } });
```

**Step 2: Create ArrowOverlay component**

Create `src/components/board/overlays/ArrowOverlay.tsx`:
```tsx
'use client';

import { useGameStore } from '@/stores/game-store';
import { motion } from 'framer-motion';

interface Props {
  cellSize: number;
  padding: number;
}

export default function ArrowOverlay({ cellSize, padding }: Props) {
  const arrows = useGameStore((s) => s.overlays.arrows);
  if (arrows.length === 0) return null;

  const cx = (x: number) => padding + x * cellSize;
  const cy = (y: number) => padding + y * cellSize;

  return (
    <g className="arrow-overlay">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#fbbf24" />
        </marker>
      </defs>
      {arrows.map((a, i) => {
        const x1 = cx(a.from.x);
        const y1 = cy(a.from.y);
        const x2 = cx(a.to.x);
        const y2 = cy(a.to.y);
        // Shorten line so arrow doesn't overlap stone
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const shortenBy = cellSize * 0.35;
        const ratio = len > 0 ? (len - shortenBy) / len : 1;
        const ax2 = x1 + dx * ratio;
        const ay2 = y1 + dy * ratio;

        return (
          <motion.g
            key={a.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.15, duration: 0.3 }}
          >
            <line
              x1={x1}
              y1={y1}
              x2={ax2}
              y2={ay2}
              stroke="#f bbf24"
              strokeWidth={2.5}
              strokeLinecap="round"
              markerEnd="url(#arrowhead)"
              opacity={0.85}
            />
            {a.label && (
              <text
                x={(x1 + ax2) / 2}
                y={(y1 + ay2) / 2 - 8}
                textAnchor="middle"
                fill="#fef3c7"
                fontSize={10}
                fontWeight={600}
                style={{ pointerEvents: 'none' }}
              >
                {a.order}. {a.label}
              </text>
            )}
            {/* Sequence number circle at start of arrow */}
            <circle
              cx={x1}
              cy={y1}
              r={cellSize * 0.2}
              fill="#f59e0b"
              opacity={0.9}
            />
            <text
              x={x1}
              y={y1}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#000"
              fontSize={10}
              fontWeight={700}
              style={{ pointerEvents: 'none' }}
            >
              {a.order}
            </text>
          </motion.g>
        );
      })}
    </g>
  );
}
```

**Step 3: Add ArrowOverlay to GoBoard**

In `src/components/board/GoBoard.tsx`, import and render ArrowOverlay in the SVG after SuggestionOverlay (it should be on top since arrows are instructional):
```tsx
import ArrowOverlay from './overlays/ArrowOverlay';
// In the SVG, after SuggestionOverlay:
<ArrowOverlay cellSize={cellSize} padding={padding} />
```

**Step 4: Commit**
```bash
git add -A && git commit -m "feat: arrow overlay component and store state

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Arrow overlay — AI tool + applyTools

**Files:**
- Modify: `src/app/api/chat/route.ts` — add `show_sequence` tool definition + execution
- Modify: `src/hooks/useGoMaster.ts` — handle `show_sequence` in applyTools

**Step 1: Add show_sequence tool definition**

In `src/app/api/chat/route.ts`, add a new tool after `suggest_moves` (around line 103):
```ts
{
  type: 'function' as const,
  name: 'show_sequence',
  description: 'Show a sequence of moves as numbered arrows on the board to illustrate reading/variations. Use to teach concepts like: "if black plays here, white responds here, then black follows up here".',
  parameters: {
    type: 'object',
    properties: {
      moves: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Starting Go coordinate (e.g., "D4")' },
            to: { type: 'string', description: 'Ending Go coordinate (e.g., "E5")' },
            label: { type: 'string', description: 'Short explanation of this move (e.g., "Approach", "Block", "Extend")' },
          },
          required: ['from', 'to'],
        },
        description: 'Ordered sequence of moves as arrows',
      },
    },
    required: ['moves'],
  },
},
```

**Step 2: Add show_sequence execution in executeTool**

In the `executeTool` function, add a case before the default:
```ts
case 'show_sequence': {
  const moves = args.moves.map((m: any, i: number) => ({
    from: coordToPoint(m.from, boardSize),
    to: coordToPoint(m.to, boardSize),
    label: m.label,
    order: i + 1,
  }));
  return { result: { moves } };
}
```

**Step 3: Handle show_sequence in applyTools**

In `src/hooks/useGoMaster.ts`, in the `applyTools` function, add after the suggest_moves case:
```ts
if (toolName === 'show_sequence' && result.moves) {
  applyArrows(
    result.moves.map((m: any) => ({
      id: `arr-${Date.now()}-${m.order}`,
      from: { x: m.from.x, y: m.from.y },
      to: { x: m.to.x, y: m.to.y },
      label: m.label,
      order: m.order,
    })),
  );
}
```

Make sure `applyArrows` is destructured from `useGameStore` alongside the other overlay actions.

**Step 4: Commit**
```bash
git add -A && git commit -m "feat: show_sequence AI tool for arrow overlays

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Influence heatmap — Store + Computation + Component

**Files:**
- Modify: `src/stores/game-store.ts` — add `influence` to overlays
- Create: `src/lib/go-engine/influence.ts` — influence computation
- Create: `src/components/board/overlays/InfluenceOverlay.tsx`
- Modify: `src/components/board/GoBoard.tsx` — render InfluenceOverlay

**Step 1: Add influence overlay types and state to store**

In `src/stores/game-store.ts`:

Add new interface:
```ts
interface OverlayInfluence {
  point: Point;
  value: number; // -1.0 (full black) to +1.0 (full white), 0 = neutral
}
```

Add `influence: OverlayInfluence[]` to the overlays shape:
```ts
overlays: {
  highlights: OverlayHighlight[];
  liberties: OverlayLiberty[];
  suggestions: OverlaySuggestion[];
  arrows: OverlayArrow[];
  influence: OverlayInfluence[];  // NEW
}
```

Add default: `influence: []`

Add action:
```ts
applyInfluence: (influence: OverlayInfluence[]) => void;
```

Implement:
```ts
applyInfluence: (influence) => set((s) => ({ overlays: { ...s.overlays, influence } })),
```

Update `clearOverlays` to include influence:
```ts
set({ overlays: { highlights: [], liberties: [], suggestions: [], arrows: [], influence: [] } });
```

**Step 2: Create influence computation**

Create `src/lib/go-engine/influence.ts`:
```ts
import { Board, Point, StoneColor } from './types';

/**
 * Compute influence map using simple distance-based radiation.
 * Each stone radiates influence that decays with distance.
 * Returns array of {point, value} where value is -1 to +1.
 */
export function computeInfluence(board: Board): { point: Point; value: number }[] {
  const size = board.size;
  const grid: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const DECAY = 0.5; // influence halves each step
  const MAX_DIST = 6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = board.grid[y]?.[x];
      if (color === StoneColor.Empty) continue;
      const sign = color === StoneColor.Black ? -1 : 1;

      // Radiate influence using Manhattan distance
      for (let dy = -MAX_DIST; dy <= MAX_DIST; dy++) {
        for (let dx = -MAX_DIST; dx <= MAX_DIST; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist > MAX_DIST) continue;
          grid[ny][nx] += sign * Math.pow(DECAY, dist);
        }
      }
    }
  }

  // Normalize to -1..+1 and filter out near-zero cells
  const maxAbs = Math.max(...grid.flat().map(Math.abs), 0.001);
  const result: { point: Point; value: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const norm = grid[y][x] / maxAbs;
      if (Math.abs(norm) > 0.05) {
        result.push({ point: { x, y }, value: Math.max(-1, Math.min(1, norm)) });
      }
    }
  }
  return result;
}
```

Export from `src/lib/go-engine/index.ts`:
```ts
export { computeInfluence } from './influence';
```

**Step 3: Create InfluenceOverlay component**

Create `src/components/board/overlays/InfluenceOverlay.tsx`:
```tsx
'use client';

import { useGameStore } from '@/stores/game-store';
import { motion } from 'framer-motion';

interface Props {
  cellSize: number;
  padding: number;
}

export default function InfluenceOverlay({ cellSize, padding }: Props) {
  const influence = useGameStore((s) => s.overlays.influence);
  if (influence.length === 0) return null;

  return (
    <motion.g
      className="influence-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {influence.map((cell) => {
        const x = padding + cell.point.x * cellSize - cellSize / 2;
        const y = padding + cell.point.y * cellSize - cellSize / 2;
        const abs = Math.abs(cell.value);
        // Black influence = blue, White influence = red/orange
        const color = cell.value < 0 ? '59, 130, 246' : '249, 115, 22';
        return (
          <rect
            key={`inf-${cell.point.x}-${cell.point.y}`}
            x={x}
            y={y}
            width={cellSize}
            height={cellSize}
            fill={`rgba(${color}, ${abs * 0.35})`}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}
    </motion.g>
  );
}
```

**Step 4: Add InfluenceOverlay to GoBoard**

In `src/components/board/GoBoard.tsx`, import and render InfluenceOverlay BEFORE TerritoryOverlay (influence is a background layer):
```tsx
import InfluenceOverlay from './overlays/InfluenceOverlay';
// In the SVG, BEFORE TerritoryOverlay (so it's behind everything):
<InfluenceOverlay cellSize={cellSize} padding={padding} />
```

**Step 5: Commit**
```bash
git add -A && git commit -m "feat: influence heatmap overlay with distance-based computation

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Influence heatmap — AI tool + applyTools

**Files:**
- Modify: `src/app/api/chat/route.ts` — add `show_influence` tool + execution
- Modify: `src/hooks/useGoMaster.ts` — handle `show_influence` in applyTools

**Step 1: Add show_influence tool definition**

In `src/app/api/chat/route.ts`, add tool:
```ts
{
  type: 'function' as const,
  name: 'show_influence',
  description: 'Display an influence/moyo heatmap on the board showing which areas each player controls or influences. Blue = black influence, orange = white influence. Use to teach territory, influence, and moyo concepts.',
  parameters: {
    type: 'object',
    properties: {},
  },
},
```

No parameters — the server computes influence from the current board state.

**Step 2: Add show_influence execution**

In `executeTool`, add:
```ts
case 'show_influence': {
  const { computeInfluence } = await import('@/lib/go-engine/influence');
  const influence = computeInfluence(gameState.board);
  return { result: { influence } };
}
```

Note: Use dynamic import since this is a new module.

**Step 3: Handle show_influence in applyTools**

In `src/hooks/useGoMaster.ts`:
```ts
if (toolName === 'show_influence' && result.influence) {
  applyInfluence(result.influence);
}
```

Make sure `applyInfluence` is destructured from `useGameStore`.

**Step 4: Commit**
```bash
git add -A && git commit -m "feat: show_influence AI tool for heatmap overlay

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Group visualization — Store + Component

**Files:**
- Modify: `src/stores/game-store.ts` — add `groups` to overlays
- Create: `src/components/board/overlays/GroupOverlay.tsx`
- Modify: `src/components/board/GoBoard.tsx` — render GroupOverlay

**Step 1: Add group overlay types and state to store**

In `src/stores/game-store.ts`:

Add new interface:
```ts
interface OverlayGroup {
  id: string;
  stones: Point[];
  color: 'black' | 'white';
  liberties: number;
  label?: string;
}
```

Add `groups: OverlayGroup[]` to the overlays shape:
```ts
overlays: {
  highlights: OverlayHighlight[];
  liberties: OverlayLiberty[];
  suggestions: OverlaySuggestion[];
  arrows: OverlayArrow[];
  influence: OverlayInfluence[];
  groups: OverlayGroup[];       // NEW
}
```

Add default: `groups: []`

Add action:
```ts
applyGroups: (groups: OverlayGroup[]) => void;
```

Implement:
```ts
applyGroups: (groups) => set((s) => ({ overlays: { ...s.overlays, groups } })),
```

Update `clearOverlays` to include groups:
```ts
set({ overlays: { highlights: [], liberties: [], suggestions: [], arrows: [], influence: [], groups: [] } });
```

**Step 2: Create GroupOverlay component**

Create `src/components/board/overlays/GroupOverlay.tsx`:
```tsx
'use client';

import { useGameStore } from '@/stores/game-store';
import { motion } from 'framer-motion';

interface Props {
  cellSize: number;
  padding: number;
}

const groupColors: Record<string, { fill: string; stroke: string }> = {
  black: { fill: 'rgba(59, 130, 246, 0.15)', stroke: 'rgba(59, 130, 246, 0.6)' },
  white: { fill: 'rgba(249, 115, 22, 0.15)', stroke: 'rgba(249, 115, 22, 0.6)' },
};

export default function GroupOverlay({ cellSize, padding }: Props) {
  const groups = useGameStore((s) => s.overlays.groups);
  if (groups.length === 0) return null;

  const cx = (x: number) => padding + x * cellSize;
  const cy = (y: number) => padding + y * cellSize;
  const r = cellSize * 0.52; // slightly larger than stone

  return (
    <g className="group-overlay">
      {groups.map((g, gi) => {
        const colors = groupColors[g.color] || groupColors.black;
        const isWeak = g.liberties <= 2;
        return (
          <motion.g
            key={g.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: gi * 0.1, duration: 0.3 }}
          >
            {/* Rounded rect hull around each stone in the group */}
            {g.stones.map((s, si) => (
              <rect
                key={`${g.id}-${si}`}
                x={cx(s.x) - r}
                y={cy(s.y) - r}
                width={r * 2}
                height={r * 2}
                rx={r * 0.4}
                ry={r * 0.4}
                fill={colors.fill}
                stroke={isWeak ? '#ef4444' : colors.stroke}
                strokeWidth={isWeak ? 2 : 1.5}
                strokeDasharray={isWeak ? '4 2' : 'none'}
              />
            ))}
            {/* Liberty count badge */}
            {g.stones.length > 0 && (() => {
              // Place badge at the topmost-leftmost stone
              const anchor = g.stones.reduce((best, s) =>
                s.y < best.y || (s.y === best.y && s.x < best.x) ? s : best
              );
              return (
                <>
                  <circle
                    cx={cx(anchor.x) - r + 4}
                    cy={cy(anchor.y) - r + 4}
                    r={8}
                    fill={isWeak ? '#ef4444' : '#334155'}
                    stroke="#fff"
                    strokeWidth={0.5}
                  />
                  <text
                    x={cx(anchor.x) - r + 4}
                    y={cy(anchor.y) - r + 4}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fff"
                    fontSize={9}
                    fontWeight={700}
                    style={{ pointerEvents: 'none' }}
                  >
                    {g.liberties}
                  </text>
                </>
              );
            })()}
            {/* Group label */}
            {g.label && g.stones.length > 0 && (() => {
              // Center label on the group centroid
              const avgX = g.stones.reduce((sum, s) => sum + s.x, 0) / g.stones.length;
              const avgY = g.stones.reduce((sum, s) => sum + s.y, 0) / g.stones.length;
              return (
                <text
                  x={cx(avgX)}
                  y={cy(avgY) + r + 12}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize={10}
                  fontWeight={600}
                  style={{
                    pointerEvents: 'none',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                  }}
                >
                  {g.label}
                </text>
              );
            })()}
          </motion.g>
        );
      })}
    </g>
  );
}
```

Visual design:
- Each stone in a group gets a rounded highlight rect
- Blue tint for black groups, orange tint for white groups
- Weak groups (≤2 liberties): red dashed border
- Liberty count badge at top-left stone
- Optional label at group centroid

**Step 3: Add GroupOverlay to GoBoard**

In `src/components/board/GoBoard.tsx`, import and render GroupOverlay after StoneLayer but before HighlightOverlay:
```tsx
import GroupOverlay from './overlays/GroupOverlay';
// After StoneLayer, before HighlightOverlay:
<GroupOverlay cellSize={cellSize} padding={padding} />
```

**Step 4: Commit**
```bash
git add -A && git commit -m "feat: group visualization overlay with weakness indicators

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Group visualization — AI tool + applyTools

**Files:**
- Modify: `src/app/api/chat/route.ts` — add `show_groups` tool + execution
- Modify: `src/hooks/useGoMaster.ts` — handle `show_groups` in applyTools

**Step 1: Add show_groups tool definition**

In `src/app/api/chat/route.ts`, add tool:
```ts
{
  type: 'function' as const,
  name: 'show_groups',
  description: 'Highlight stone groups on the board showing their boundaries, connections, and liberty counts. Weak groups (≤2 liberties) are shown with red dashed borders. Use to teach about: group strength, cutting points, connections, life and death.',
  parameters: {
    type: 'object',
    properties: {
      positions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            position: { type: 'string', description: 'Go coordinate of a stone in the group to highlight (e.g., "D4")' },
            label: { type: 'string', description: 'Educational label for this group (e.g., "Strong wall", "Weak — needs help", "Connected to corner")' },
          },
          required: ['position'],
        },
        description: 'One stone from each group you want to visualize. The server auto-expands to the full group.',
      },
    },
    required: ['positions'],
  },
},
```

**Step 2: Add show_groups execution**

In `executeTool`, add (uses existing `getGroup` from go-engine):
```ts
case 'show_groups': {
  const { getGroup } = await import('@/lib/go-engine/groups');
  const groups = args.positions.map((p: any, i: number) => {
    const pt = coordToPoint(p.position, boardSize);
    const group = getGroup(gameState.board, pt);
    if (!group) return null;
    return {
      id: `grp-${i}`,
      stones: group.stones,
      color: group.color === 1 ? 'black' : 'white',
      liberties: group.liberties.length,
      label: p.label,
    };
  }).filter(Boolean);
  return { result: { groups } };
}
```

Note: Check how StoneColor enum maps — `StoneColor.Black` might be 1 or a string. Look at `src/lib/go-engine/types.ts` for the actual enum values and use accordingly. The `getGroup` function returns `{ color: StoneColor; stones: Point[]; liberties: Point[] }`.

**Step 3: Handle show_groups in applyTools**

In `src/hooks/useGoMaster.ts`:
```ts
if (toolName === 'show_groups' && result.groups) {
  applyGroups(
    result.groups.map((g: any) => ({
      id: g.id,
      stones: g.stones.map((s: any) => ({ x: s.x, y: s.y })),
      color: g.color,
      liberties: g.liberties,
      label: g.label,
    })),
  );
}
```

Make sure `applyGroups` is destructured from `useGameStore`.

**Step 4: Commit**
```bash
git add -A && git commit -m "feat: show_groups AI tool with auto-expansion from go-engine

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: System prompt — document all new tools

**Files:**
- Modify: `src/lib/ai/system-prompt.ts`

**Step 1: Add tool usage docs for all three new tools**

In the TOOLS USAGE section of the system prompt, add:

```
## MOVE SEQUENCE ARROWS (show_sequence)
Use to illustrate reading and variations — "if you play here, opponent responds here, then you follow up here."
- Each arrow has a from/to coordinate and an optional label
- Arrows are numbered automatically (1, 2, 3...)
- Use to teach: joseki patterns, reading ahead, tactical sequences, life/death solutions
- Keep sequences short (2-5 moves) — beginners can't follow long lines
- Example: show_sequence({moves: [{from: "D4", to: "C6", label: "Approach"}, {from: "C6", to: "E3", label: "Pincer response"}]})

## INFLUENCE HEATMAP (show_influence)
Use to visualize territorial influence and moyo (framework/potential territory).
- No parameters needed — computed from the current board state
- Blue = black influence, orange = white influence
- Use to teach: territory vs influence, moyo, balance of territory, when to invade
- Great for explaining opening strategy and middle game direction
- Pair with chat explanation: "See how black's influence extends along the left side..."

## GROUP VISUALIZATION (show_groups)
Use to highlight stone groups, their boundaries, and strength.
- Specify one stone per group — the server auto-expands to the full connected group
- Weak groups (≤2 liberties) shown with red dashed borders
- Each group shows a liberty count badge
- Use to teach: connections, cutting points, group strength, life and death, capturing races
- Always provide educational labels: "Strong wall", "Weak — only 2 liberties", "Cut here to separate"
- Example: show_groups({positions: [{position: "D4", label: "Strong corner group"}, {position: "K10", label: "Floating — needs eyes"}]})
```

**Step 2: Commit**
```bash
git add -A && git commit -m "docs: add system prompt instructions for visual teaching tools

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: Update OverlayLegend for new overlay types

**Files:**
- Modify: `src/components/board/overlays/OverlayLegend.tsx`

**Step 1: Extend annotation panel to show arrow and group labels**

The current OverlayLegend only shows highlight annotations. Update it to also show:
- Arrow sequence labels (with "→" prefix and order number)
- Group labels (with group color indicator)

Add sections for arrows and groups after the existing highlights section. Only show each section if there are labeled items.

For arrows:
```tsx
const arrows = useGameStore((s) => s.overlays.arrows);
const labeledArrows = arrows.filter((a) => a.label);
```

For groups:
```tsx
const groups = useGameStore((s) => s.overlays.groups);
const labeledGroups = groups.filter((g) => g.label);
```

Show arrows as: `1→ Approach` (amber colored, using arrow order)
Show groups as: `● Strong wall` (blue for black groups, orange for white)

If none of the three overlay types have labels, return null.

**Step 2: Commit**
```bash
git add -A && git commit -m "feat: extend annotation panel for arrows and groups

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: Build + verify

**Step 1: Run build**
```bash
cd C:\Users\fpan1\go-sensei && npm run build
```
Expected: Build succeeds with no TypeScript errors.

**Step 2: Push branch and create PR**
```bash
git push -u origin feat/visual-teaching-tools
gh pr create --title "feat: visual teaching tools — arrows, influence, groups" --body "Three new AI-driven visual teaching tools for Go Sensei:

## New Tools
- **show_sequence**: Numbered arrows on the board showing move sequences/variations
- **show_influence**: Heatmap overlay showing territorial influence (blue=black, orange=white)
- **show_groups**: Group boundary visualization with liberty counts and weakness indicators

## Changes
- 3 new overlay components (ArrowOverlay, InfluenceOverlay, GroupOverlay)
- 3 new AI tools in route.ts with server-side execution
- Influence computation engine (distance-based radiation)
- Extended store with arrows, influence, groups overlay state
- Updated system prompt with usage instructions for all new tools
- Extended annotation panel to show labels from all overlay types" --base main
```
