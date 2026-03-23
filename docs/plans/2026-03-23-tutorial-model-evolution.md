# Tutorial Model Evolution - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Go Sensei from reactive-only teaching into a structured learning system with interactive lessons, tsumego puzzles, guided games, concept mastery tracking, and spaced repetition.

**Architecture:** Five features layered incrementally. Each phase adds a capability that the next builds on: interactive lessons → problem engine → guided games + concept tracker → spaced repetition. All state in Zustand + localStorage (no backend). AI integration via existing agentic tool loop + new evaluate_concepts tool.

**Tech Stack:** Next.js 16, React 19, Zustand (persist middleware), Vitest, TypeScript, GPT-5.4 via Copilot Responses API, Framer Motion

---

## Phase 1: Interactive Lessons 2.0

Wire up the prompt/expectedMove fields already in LessonStep type. Add click handling to LessonView. Add 5 new lessons with interactive steps.

### Task 1: Add interactive fields to LessonStep type

**Files:**
- Modify: `src/lib/lessons/types.ts`
- Test: `__tests__/lessons/types.test.ts` (create)

**Step 1: Write failing test** — Create `__tests__/lessons/types.test.ts` with a test that constructs a LessonStep using the new fields: `wrongMoveHint`, `branchOnFail`, `acceptRadius`.

**Step 2: Run test** — `npx vitest run __tests__/lessons/types.test.ts` — Expected: FAIL

**Step 3: Update the type** — Add to LessonStep interface in `src/lib/lessons/types.ts`:
- `wrongMoveHint?: string` — hint shown on wrong click
- `branchOnFail?: number` — step index to jump to on repeated failure
- `acceptRadius?: number` — how many intersections away still counts (0 = exact)

**Step 4: Run test** — Expected: PASS

**Step 5: Commit** — `feat(lessons): add interactive step fields to LessonStep type`

---

### Task 2: Add lesson interaction state to game store

**Files:**
- Modify: `src/stores/game-store.ts`
- Test: `__tests__/stores/lesson-interaction.test.ts` (create)

Add new `LessonInteraction` interface:
- `awaitingClick: boolean`
- `prompt: string | null`
- `expectedMove: Point | null`
- `wrongMoveHint: string | null`
- `branchOnFail: number | null`
- `acceptRadius: number` (default 0)
- `attempts: number`
- `feedback: 'correct' | 'wrong' | null`

Add to GameStore interface:
- `lessonInteraction: LessonInteraction`
- `setLessonPrompt(config): void`
- `checkLessonAnswer(point: Point): 'correct' | 'wrong'`
- `clearLessonPrompt(): void`

`checkLessonAnswer` logic: Manhattan distance `dx + dy <= acceptRadius`. If correct → set feedback='correct', awaitingClick=false. If wrong → increment attempts, set feedback='wrong'.

Tests: verify exact match, fuzzy match with acceptRadius, wrong answer increments attempts, clearLessonPrompt resets state.

---

### Task 3: Make LessonView interactive — click handling

**Files:**
- Modify: `src/components/lessons/LessonView.tsx`
- Modify: `src/components/lessons/LessonOverlay.tsx`

Key changes to LessonView.tsx:
1. Add `onClick` handler to SVG element that converts click coords to board point using inverse of `pointToSvg`
2. When step has `prompt`/`expectedMove`, call `setLessonPrompt` on step entry (useEffect on currentStep)
3. On correct click: green flash animation, auto-advance after 700ms
4. On wrong click: red flash, show wrongMoveHint, shake animation
5. After 3 wrong attempts with `branchOnFail` set: jump to that step index
6. Show prompt text in sidebar when `awaitingClick` is true
7. Disable Next button while awaitingClick (replace with "Click the board...")
8. Call `clearLessonPrompt()` when step changes

SVG click → board point conversion:
```
svgX = ((clientX - rect.left) / rect.width) * SVG_SIZE
svgY = ((clientY - rect.top) / rect.height) * SVG_SIZE
bx = Math.round((svgX - BOARD_PADDING) / cellSize(boardSize))
by = Math.round((svgY - BOARD_PADDING) / cellSize(boardSize))
```

Add `LessonFeedbackDot` to LessonOverlay.tsx:
- Green pulsing circle for correct (scale up + fade)
- Red shaking circle for wrong (horizontal shake + fade)
- Uses Framer Motion `motion.circle`

---

### Task 4: Add 5 new interactive lessons

**Files:**
- Modify: `src/lib/lessons/lesson-data.ts`
- Test: `__tests__/lessons/lesson-data.test.ts` (create)

New lessons (each with at least 1 interactive step):

1. **Ko** (id: 'ko') — 5 steps, 2 interactive. Ko position, can't recapture rule, interactive: click where black can't play, ko threat, interactive: recapture after threat.

2. **Ladder** (id: 'ladder') — 5 steps, 2 interactive. Stone in atari, zigzag chase, interactive: continue ladder, ladder breaker, interactive: play alternative.

3. **Net** (id: 'net') — 4 steps, 1 interactive. Net concept, loose surround, interactive: place the net move, show escape fails.

4. **Snapback** (id: 'snapback') — 4 steps, 1 interactive. Setup, sacrifice concept, interactive: play sacrifice stone, show recapture.

5. **Territory vs Influence** (id: 'territory-vs-influence') — 5 steps, 2 interactive. 3rd vs 4th line, trade-off, interactive: click for territory, moyo, interactive: click for influence.

Tests: ≥10 lessons, unique IDs, interactive steps have prompt+expectedMove, each new lesson has ≥1 interactive step.

---

## Phase 2: Tsumego Engine — Problem Sets

### Task 5: Define Problem types

**Files:**
- Create: `src/lib/problems/types.ts`
- Test: `__tests__/problems/types.test.ts`

Types: `ProblemCategory` ('capture'|'life-and-death'|'tesuji'|'reading'|'endgame'), `ProblemDifficulty` (1-5), `MoveNode` (branching tree), `Problem`, `ProblemAttempt`, `ProblemProgress`.

### Task 6: Build solution tree validator

**Files:**
- Create: `src/lib/problems/validator.ts`
- Test: `__tests__/problems/validator.test.ts`

Functions: `validateMove(tree, move)` → 'correct'|'opponent'|'wrong', `findResponse(node)` → first opponent response.

### Task 7: Create 20+ hand-crafted tsumego

**Files:**
- Create: `src/lib/problems/problem-data.ts`
- Create: `src/lib/problems/index.ts`
- Test: `__tests__/problems/problem-data.test.ts`

5 capture (diff 1-2), 5 life-and-death (diff 2-4), 4 tesuji (diff 3-4), 3 reading (diff 4-5), 3 endgame (diff 3-4). All 9×9 boards.

### Task 8: Add problem state to game store

**Files:**
- Modify: `src/stores/game-store.ts`
- Test: `__tests__/stores/problem-state.test.ts`

Extend appPhase with 'problems'|'problem'. Add: currentProblemId, problemMoveIndex, problemSolvedMoves, problemFeedback, problemProgress (persisted localStorage). Actions: showProblems, startProblem, submitProblemMove, resetProblem, returnFromProblems.

### Task 9: Build ProblemView and ProblemPicker

**Files:**
- Create: `src/components/problems/ProblemView.tsx`
- Create: `src/components/problems/ProblemPicker.tsx`

ProblemView: SVG board with click-to-play, opponent auto-responses, Reset/Hint buttons. ProblemPicker: grid with category filters, difficulty stars, progress badges.

### Task 10: Wire problems into app shell

**Files:** Modify `src/app/page.tsx`. Add rendering for appPhase 'problems'/'problem'. Add navigation.

---

## Phase 3: Guided Game + Concept Mastery

### Task 11: Define concept graph data model

**Files:**
- Create: `src/lib/concepts/types.ts`
- Create: `src/lib/concepts/concept-graph.ts`
- Test: `__tests__/concepts/concept-graph.test.ts`

~30 concepts in DAG across 4 categories (fundamentals, tactics, strategy, endgame). Helpers: `isUnlocked`, `getMastery`, `updateMastery`, `getNextToLearn`, `getWeakConcepts`.

### Task 12: Concept mastery store with localStorage

**Files:**
- Create: `src/stores/concept-store.ts`
- Test: `__tests__/stores/concept-store.test.ts`

Separate Zustand store with persist using localStorage (NOT sessionStorage).

### Task 13: Add evaluate_concepts AI tool

**Files:**
- Modify: `src/app/api/chat/route.ts` (tool #9)
- Modify: `src/hooks/useGoMaster.ts`
- Modify: `src/lib/ai/system-prompt.ts`

Tool: evaluate_concepts with evaluations array of {concept, demonstrated, evidence}. Client hook updates concept store.

### Task 14: Guided game mode

**Files:**
- Modify: `src/lib/ai/system-prompt.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/stores/game-store.ts`

Add `guidedMode: boolean`, `teachingObjectives: string[]`. Inject into system prompt when active.

### Task 15: Skill tree UI

**Files:**
- Create: `src/components/concepts/SkillTree.tsx`
- Create: `src/components/concepts/ConceptCard.tsx`

SVG DAG visualization. Nodes colored by mastery.

---

## Phase 4: Spaced Repetition

### Task 16: SM-2 scheduler

**Files:**
- Create: `src/lib/spaced-repetition/scheduler.ts`
- Test: `__tests__/spaced-repetition/scheduler.test.ts`

ReviewCard type, processReview (SM-2 algorithm), isDue, getDueCards.

### Task 17: Review state store

**Files:** Create `src/stores/review-store.ts`. Persisted localStorage. Actions: refreshDailyQueue, completeReview, getReviewCount.

### Task 18: Daily Review UI

**Files:** Create `src/components/review/DailyReview.tsx`. Badge on nav, 3-5 due problems, streak tracking.

### Task 19: Progress dashboard

**Files:** Create `src/components/dashboard/ProgressDashboard.tsx`. Overall mastery %, concept breakdown, games/problems counts, weakest areas.

### Task 20: Wire into app navigation

**Files:** Modify `src/app/page.tsx`, `src/components/ui/SenseiBar.tsx`. Nav items: Tutorials, Problems, Skill Tree, Daily Review (badge), Progress.

---

## Notes

- All tests use Vitest: `npx vitest run`
- Test helpers: `__tests__/go-engine/test-helpers.ts` — `p()`, `black()`, `white()`, `setupBoard()`
- Game store persists to sessionStorage. NEW persistence (concepts, problems, review) → **localStorage**
- Board rendering: `pointToSvg()`, `cellSize()`, `stoneRadius()` from `src/utils/coordinates.ts`
- Animation: Framer Motion (`motion.circle`, `AnimatePresence`)
- Colors: always use `COLORS.*` from `src/utils/colors.ts`
- AI tools: `src/app/api/chat/route.ts` TOOLS array
- Go engine: READ-ONLY — don't modify `src/lib/go-engine/`