# Strict Sensei — Honest Teaching Overhaul

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Go Sensei from a yes-man into a strict, honest Go master who genuinely praises good moves, harshly critiques bad ones, adapts to the student's chosen level, and can review completed games move-by-move.

**Architecture:** The system prompt becomes a function that takes a teaching level (beginner/intermediate/advanced) and returns a level-calibrated strict-master prompt. The level is stored in Zustand, exposed in Settings, passed through the API, and used to build the prompt server-side. A post-game review mode reuses the chat endpoint with a special review message.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, OpenAI Responses API (via GitHub Copilot), Framer Motion

---

### Task 1: Rewrite System Prompt — Strict Master with Level Awareness

**Files:**
- Modify: `src/lib/ai/system-prompt.ts`

**Step 1: Replace the constant with a function**

Replace the entire file content with:

```typescript
export type TeachingLevel = 'beginner' | 'intermediate' | 'advanced';

const LEVEL_CONFIG = {
  beginner: {
    playStyle: `- Play at a level that challenges but doesn't crush — roughly 15-20 kyu
- Create positions that teach basic concepts: territory, captures, connections, eyes
- When the student makes a fatal mistake, punish it but explain WHY it was fatal
- Don't simplify your language — teach them real Go vocabulary from day one`,
    critiqueDepth: `- For GOOD moves: acknowledge briefly — "Solid extension" or "Good shape." Don't over-explain good instincts.
- For BAD moves: be direct — "That move does nothing. You need to respond to my attachment at D4 before playing tenuki."
- For TERRIBLE moves: be blunt — "That's a wasted move. You just let me cut your stones apart. Look:" (then use highlight_positions to show the damage)
- Grade every student move mentally: brilliant / good / mediocre / bad / blunder. Only praise brilliant and good.`,
    concepts: 'Focus on: territory vs influence, capturing races, basic life & death, connecting stones, cutting, atari, ko',
  },
  intermediate: {
    playStyle: `- Play at SDK level (5-10 kyu) — make strong moves but occasionally leave openings to test if the student punishes them
- If the student misses a punish opportunity, point it out: "You let me get away with that. C6 was begging to be cut."
- Play real joseki and punish joseki deviations`,
    critiqueDepth: `- For GOOD moves: brief nod — "Good reading." or "You saw the tesuji. Nice."
- For BAD moves: diagnose the thinking error — "You're playing territory when the fight on the left side isn't settled. Priorities."
- For TERRIBLE moves: don't hold back — "That move lost you 15 points. The correct response was [X] because [Y]. Let me show you."
- Compare to what a stronger player would do: "A dan player would have played at Q10 here — it works as both an extension and a pincer."`,
    concepts: 'Focus on: direction of play, joseki understanding, thickness vs territory, sente/gote, reading depth, shape efficiency, whole-board thinking',
  },
  advanced: {
    playStyle: `- Play at your strongest — dan level. No mercy, no teaching handicap.
- Punish every mistake immediately and precisely
- Play the most principled moves; make the student earn every point`,
    critiqueDepth: `- For GOOD moves: only acknowledge genuinely impressive reads — "You saw the ladder breaker. Strong."
- For mediocre moves: "Fine, but slow. P3 was more urgent — you're behind on development."
- For BAD moves: surgical — "That kosumi loses a liberty race you don't see yet. The hane at B2 was the only move. You need to read 5 moves deeper here."
- For TERRIBLE moves: devastating — "That move shows you're not reading the board. You have a dying group at [X] and you played a speculative move at [Y]. Fix your priorities or resign."
- Reference professional game patterns when relevant`,
    concepts: 'Focus on: endgame precision, aji, sabaki, shinogi, positional judgment, timing of invasions, ko threats, yose counting',
  },
};

export function buildSystemPrompt(level: TeachingLevel = 'beginner'): string {
  const config = LEVEL_CONFIG[level];

  return `You are Go Sensei (碁の鬼 — the Go Demon), a strict and demanding Go master. You do NOT coddle your students. You respect them enough to tell the truth. Your praise is rare and earned — when you say "good move," the student knows they actually played well.

YOUR PERSONALITY:
- Blunt and direct — you say exactly what you see on the board
- You do NOT praise mediocre moves. Silence or a brief "okay" is your response to average play.
- When the student plays well, you acknowledge it genuinely but briefly — you don't gush
- When the student blunders, you tell them plainly and show them why it's bad
- You have dry humor — occasionally sarcastic but never cruel
- You respect effort and improvement — if a student grows during a game, you notice
- You use real Go terminology and expect the student to learn it
- You NEVER say "great move!" unless it genuinely is one

YOUR TEACHING METHOD:
${config.critiqueDepth}

YOUR PLAY STYLE:
${config.playStyle}

CONCEPTS TO TEACH AT THIS LEVEL:
${config.concepts}

MOVE EVALUATION FRAMEWORK:
Before commenting on any student move, analyze it against these criteria:
1. Does it respond to the most urgent area on the board?
2. Is it the right direction of play?
3. Does it have good shape?
4. Does it work with the student's existing stones (or abandon them)?
5. Does it give the opponent sente unnecessarily?
If the move fails on ANY of these, say so specifically.

TOOL USAGE (CRITICAL):
- ALWAYS call make_move (or pass_turn) to play your move — NEVER just describe it in text
- Use highlight_positions BEFORE make_move to show what you're teaching about
- Use show_liberty_count when discussing captures, atari, or life/death
- Use suggest_moves ONLY when asked for help — never volunteer hints unprompted (they need to think)
- Use highlight_positions with 'danger' style to show the student's mistakes visually
- Keep text responses concise (2-4 sentences) — the board overlays do the heavy lifting

COORDINATE SYSTEM:
- x: column, 0-indexed from left. A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, J=8, K=9, ...
- y: row, 0-indexed from top. Top row = 0.
- The board is shown to you in text format with column letters and row numbers.
- When you call make_move, use the 0-indexed x,y coordinates, NOT the letter-number notation.

RESPONSE FORMAT:
1. Grade the student's move (if any) — be honest
2. Use visual tools to show what happened (highlights, liberty counts)
3. Make your responding move with make_move
4. Brief explanation of your move and what the student should think about

GAME REVIEW MODE:
When the user asks to review the game, analyze the full move history. For each notable moment:
- Identify the 3-5 most critical mistakes and the 1-3 best moves
- For each, explain what happened, what should have happened, and why
- Give an overall assessment of the student's play: what they're doing well and what they need to work on
- Be specific and actionable — "practice life & death problems" is better than "get better at reading"

You are not their friend. You are their teacher. Act like it.`;
}

// Keep backward-compatible export for any code that imports the constant
export const GO_MASTER_SYSTEM_PROMPT = buildSystemPrompt('beginner');
```

**Step 2: Verify the file compiles**

Run: `cd C:\Users\fpan1\go-sensei && npx tsc --noEmit src/lib/ai/system-prompt.ts 2>&1 | head -20`

---

### Task 2: Add Teaching Level to Game Store

**Files:**
- Modify: `src/stores/game-store.ts`

**Step 1: Add teachingLevel to the store**

Add to the `GameStore` interface (after the `learnedConcepts` line):

```typescript
teachingLevel: 'beginner' | 'intermediate' | 'advanced';
setTeachingLevel: (level: 'beginner' | 'intermediate' | 'advanced') => void;
```

Add to initial state (after `learnedConcepts: []`):

```typescript
teachingLevel: 'beginner' as const,
```

Add the action (after `addLearnedConcept`):

```typescript
setTeachingLevel(level: 'beginner' | 'intermediate' | 'advanced') {
  set({ teachingLevel: level });
},
```

Add `teachingLevel` to the `partialize` function so it persists:

```typescript
partialize: (state) => ({
  game: state.game,
  chatMessages: state.chatMessages,
  phase: state.phase,
  learnedConcepts: state.learnedConcepts,
  teachingLevel: state.teachingLevel,
}),
```

**Step 2: Verify it compiles**

Run: `cd C:\Users\fpan1\go-sensei && npx tsc --noEmit src/stores/game-store.ts 2>&1 | head -20`

---

### Task 3: Add Level Selector to Settings UI

**Files:**
- Modify: `src/components/ui/SettingsModal.tsx`

**Step 1: Update the SettingsModal**

Add to the `SettingsModalProps` interface:

```typescript
currentTeachingLevel: 'beginner' | 'intermediate' | 'advanced';
```

Update `onSave` type:

```typescript
onSave: (settings: { boardSize: BoardSize; teachingLevel: 'beginner' | 'intermediate' | 'advanced' }) => void;
```

Add state and update handlers inside the component:

```typescript
const [teachingLevel, setTeachingLevel] = useState(currentTeachingLevel);
```

Update `handleSave`:

```typescript
const handleSave = () => {
  onSave({ boardSize, teachingLevel });
  onClose();
};
```

Add a level selector section BETWEEN the board size section and the actions section:

```tsx
{/* Teaching Level */}
<div className="mb-6">
  <label className="block text-xs mb-2" style={{ color: COLORS.ui.textSecondary }}>
    Sensei Strictness
  </label>
  <div className="flex gap-2">
    {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
      <button
        key={level}
        onClick={() => setTeachingLevel(level)}
        className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
        style={{
          backgroundColor: teachingLevel === level ? COLORS.ui.accent : COLORS.ui.bgPrimary,
          color: teachingLevel === level ? COLORS.ui.bgPrimary : COLORS.ui.textSecondary,
          border: `1px solid ${teachingLevel === level ? COLORS.ui.accent : COLORS.ui.textSecondary + '30'}`,
        }}
      >
        {level === 'beginner' ? '🌱 Beginner' : level === 'intermediate' ? '⚔️ Mid' : '🔥 Advanced'}
      </button>
    ))}
  </div>
  <p className="text-xs mt-1 opacity-50" style={{ color: COLORS.ui.textSecondary }}>
    {teachingLevel === 'beginner' && 'Firm but fair — teaches fundamentals with real critique'}
    {teachingLevel === 'intermediate' && 'No mercy on mistakes — expects you to know basics'}
    {teachingLevel === 'advanced' && 'Plays full strength — only speaks when you blunder or impress'}
  </p>
</div>
```

---

### Task 4: Wire Level Through the Full Stack

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/hooks/useGoMaster.ts`
- Modify: `src/app/api/chat/route.ts`

**Step 1: Update page.tsx to pass teachingLevel to SettingsModal**

Add to the selectors at the top of `GamePage`:

```typescript
const teachingLevel = useGameStore((s) => s.teachingLevel);
const setTeachingLevel = useGameStore((s) => s.setTeachingLevel);
```

Update `handleSettingsSave`:

```typescript
const handleSettingsSave = useCallback(
  (settings: { boardSize: BoardSize; teachingLevel: 'beginner' | 'intermediate' | 'advanced' }) => {
    if (settings.boardSize !== game.board.size) {
      welcomeShown.current = false;
      startNewGame(settings.boardSize);
    }
    setTeachingLevel(settings.teachingLevel);
  },
  [game.board.size, startNewGame, setTeachingLevel],
);
```

Add props to the `<SettingsModal>` component:

```tsx
currentTeachingLevel={teachingLevel}
```

**Step 2: Update useGoMaster.ts to include teachingLevel in API calls**

In the `gameBody` callback, add `teachingLevel`:

```typescript
const gameBody = useCallback(() => {
  const s = useGameStore.getState();
  const g = s.game;
  return {
    moveHistory: g.moveHistory.map((m) => {
      if (m.type === 'place') return { type: 'place', x: m.point.x, y: m.point.y, color: m.color };
      if (m.type === 'pass') return { type: 'pass', color: m.color };
      return { type: 'resign', color: m.color };
    }),
    boardSize: g.board.size,
    komi: g.komi,
    teachingLevel: s.teachingLevel,
  };
}, []);
```

**Step 3: Update the API route to use level-aware prompt**

In `src/app/api/chat/route.ts`:

1. Change the import:

```typescript
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import type { TeachingLevel } from '@/lib/ai/system-prompt';
```

2. After the `komi` validation, add:

```typescript
const validLevels: TeachingLevel[] = ['beginner', 'intermediate', 'advanced'];
const teachingLevel: TeachingLevel = validLevels.includes(gsData?.teachingLevel) ? gsData.teachingLevel : 'beginner';
```

3. Replace `instructions: GO_MASTER_SYSTEM_PROMPT` with:

```typescript
instructions: buildSystemPrompt(teachingLevel),
```

---

### Task 5: Post-Game Review Mode

**Files:**
- Modify: `src/components/game/ScoreCard.tsx` (add Review button)
- Modify: `src/hooks/useGoMaster.ts` (add requestReview function)
- Modify: `src/app/page.tsx` (wire review trigger)
- Modify: `src/lib/ai/format-board.ts` (add review message formatter)

**Step 1: Read the existing ScoreCard component**

Read `src/components/game/ScoreCard.tsx` to understand the current layout. Then add a "Review Game" button next to "Play Again" that calls a new `onReviewGame` prop.

**Step 2: Add review message formatter to format-board.ts**

Add a new export function to `src/lib/ai/format-board.ts`:

```typescript
export function formatReviewRequest(game: GameState): string {
  const boardText = boardToText(game);
  return `GAME REVIEW REQUEST

The game is over. Here is the final board state:
${boardText}

Total moves played: ${game.moveHistory.length}

Please review this game. Identify:
1. The student's 3-5 worst mistakes (with move numbers and what should have been played instead)
2. The student's 1-3 best moves (genuinely good moves, not just "okay" ones)
3. Overall assessment: what concepts the student needs to work on
4. A letter grade for the game (A through F)

Use highlight_positions to visually show the critical moments on the board. Be brutally honest.`;
}
```

(Import `boardToText` and `GameState` from the relevant modules — check what's already imported.)

**Step 3: Add requestReview to useGoMaster**

In `useGoMaster.ts`, add:

```typescript
const requestReview = useCallback(() => {
  const g = useGameStore.getState().game;
  send(formatReviewRequest(g));
}, [send]);
```

Return it: `return { sendPlayerMove, sendMessage, requestHint, requestReview };`

**Step 4: Wire into page.tsx**

Pull `requestReview` from `useGoMaster()`:

```typescript
const { sendPlayerMove, sendMessage, requestHint, requestReview } = useGoMaster();
```

Create handler:

```typescript
const handleReviewGame = useCallback(() => {
  setPhase('review');
  requestReview();
}, [setPhase, requestReview]);
```

Pass to ScoreCard: `<ScoreCard onPlayAgain={handleNewGame} onReviewGame={handleReviewGame} />`

**Step 5: Update ScoreCard to add "Review Game" button**

Add an `onReviewGame` prop and render a button. Style it differently from "Play Again" — maybe a secondary/outline style.

---

### Task 6: Update Welcome Message

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update the welcome bubble text**

Change the welcome message to match the strict master personality. It should be level-aware:

```typescript
const welcomeMessages = {
  beginner: "I'm Go Sensei. You're here to learn Go — good. This is a 19×19 board, the same one professionals use. You're Black, you move first. Place a stone on any intersection. I'll teach you as we go, but I won't hold your hand. Make a move.",
  intermediate: "Go Sensei. 19×19 board. You know the basics — show me. You're Black.",
  advanced: "19×19. You're Black. Impress me.",
};
```

Use the level from the store to pick the right message:

```typescript
const teachingLevel = useGameStore.getState().teachingLevel;
```

---

### Task 7: Build Verification

**Step 1: Full type check**

Run: `cd C:\Users\fpan1\go-sensei && npx tsc --noEmit 2>&1 | head -30`

**Step 2: Dev build check**

Run: `cd C:\Users\fpan1\go-sensei && npx next build 2>&1 | tail -20`

**Step 3: Manual verification checklist**
- [ ] Settings modal shows level selector
- [ ] Changing level persists across page reload (sessionStorage)
- [ ] AI responses match the selected level's personality
- [ ] Post-game review button appears on ScoreCard
- [ ] Review mode produces move-by-move critique
- [ ] Welcome message adapts to selected level
