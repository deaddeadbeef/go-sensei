# Clean Teaching UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move annotation legends from board overlay to sidebar, enforce one visual tool per AI response.

**Architecture:** Replace OverlayLegend (absolute-positioned on board) with a TeachingPanel in the right sidebar. Update system prompt from "≥2 tools" to "exactly 1 tool per response" to prevent visual clutter.

**Tech Stack:** React 19, Zustand, Framer Motion, Next.js 15, TypeScript

---

### Task 1: Create TeachingPanel sidebar component

**Files:**
- Create: `src/components/sidebar/TeachingPanel.tsx`

**Step 1: Create TeachingPanel component**

New component that reads overlay store (highlights, arrows, groups) and renders labeled annotations as styled cards in the sidebar. Collapses when no overlays active.

Key details:
- Import `useGameStore` from `@/stores/game-store`
- Read `overlays.highlights`, `overlays.arrows`, `overlays.groups`
- Filter to items with labels (same logic as OverlayLegend lines 24-26)
- Return null if no labeled items
- Render as a scrollable div with dark bg matching sidebar theme
- Three sections: Highlights (colored coord badges), Arrows (numbered sequence), Groups (colored dots)
- Use same color constants as OverlayLegend: positive=#4ade80, warning=#f59e0b, danger=#ef4444, neutral=#818cf8, arrows=#fbbf24, groups black=#3b82f6 white=#f97316
- GO_COLS = 'ABCDEFGHJKLMNOPQRST' for coordinate display
- Animate entry with framer-motion (same as OverlayLegend)
- Style: fits naturally in the sidebar, no absolute positioning, max-height with overflow-y-auto
- Add a small header like "📋 Board Analysis" when content is present

**Step 2: Commit**
```bash
git add src/components/sidebar/TeachingPanel.tsx
git commit -m "feat: add TeachingPanel sidebar component for overlay annotations"
```

---

### Task 2: Wire TeachingPanel into sidebar, remove OverlayLegend

**Files:**
- Modify: `src/app/page.tsx` (lines 141-143 area)
- Modify: `src/components/board/BoardContainer.tsx` (lines 4-5, 40)
- Delete: `src/components/board/overlays/OverlayLegend.tsx`

**Step 1: Add TeachingPanel to sidebar in page.tsx**

In `src/app/page.tsx`, add TeachingPanel between RulesPanel and SenseiChatLog sections. Import it at the top.

Insert after the RulesPanel section (after line ~143) and before the chat section (line ~146):
```tsx
<TeachingPanel />
```

**Step 2: Remove OverlayLegend from BoardContainer.tsx**

In `src/components/board/BoardContainer.tsx`:
- Remove import of OverlayLegend (line 5)
- Remove `<OverlayLegend />` from render (line 40)

**Step 3: Delete OverlayLegend.tsx**

Delete `src/components/board/overlays/OverlayLegend.tsx`

**Step 4: Commit**
```bash
git add -A
git commit -m "feat: move overlay legend from board to sidebar TeachingPanel"
```

---

### Task 3: Update system prompt — one visual tool per response

**Files:**
- Modify: `src/lib/ai/system-prompt.ts` (lines 75-84)

**Step 1: Update SHOW DON'T TELL rules**

In `src/lib/ai/system-prompt.ts`, replace the current rules (lines 75-84 area) that say "Use AT LEAST 2 visual tools per response" with:

```
## MANDATORY: SHOW, DON'T JUST TELL
HARD RULES:
1. NEVER reference a board position in text without highlighting it first
2. Use exactly ONE visual tool per response — pick the one that best teaches the current concept
3. Do NOT stack multiple visual tools (no highlights + arrows + groups together)
4. The sidebar Teaching Panel shows your annotations — keep board text SHORT (2-3 sentences max)
5. When discussing territory/influence, use show_influence
6. When explaining a sequence/variation, use show_sequence
7. When discussing group strength, use show_groups
8. For everything else, use highlight_positions
```

**Step 2: Commit**
```bash
git add src/lib/ai/system-prompt.ts
git commit -m "feat: enforce one visual tool per AI response for clarity"
```

---

### Task 4: Push and create PR

**Step 1: Push and create PR**
```bash
git push -u origin feat/clean-teaching-ux
gh pr create --title "feat: clean teaching UX — sidebar legends + one tool per response" --body "Moves overlay annotations from board to sidebar TeachingPanel. Enforces one visual tool per AI response to prevent cluttered board. Deletes OverlayLegend component." --base main
```
