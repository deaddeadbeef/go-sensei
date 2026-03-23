# Go Sensei Teaching Model v2 — Design Document

**Date:** 2026-07-18
**Status:** PROPOSED
**Author:** Architect

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Vision](#2-vision)
3. [Codebase Constraints & Affordances](#3-codebase-constraints--affordances)
4. [Feature Proposals](#4-feature-proposals)
   - 4.1 [Interactive Lessons 2.0](#41-interactive-lessons-20)
   - 4.2 [Tsumego Engine](#42-tsumego-engine)
   - 4.3 [Concept Mastery & Curriculum Tree](#43-concept-mastery--curriculum-tree)
   - 4.4 [Challenge Scenarios](#44-challenge-scenarios)
   - 4.5 [Adaptive AI Teaching Loop](#45-adaptive-ai-teaching-loop)
5. [Phased Implementation Roadmap](#5-phased-implementation-roadmap)
6. [Data Model Changes (Consolidated)](#6-data-model-changes-consolidated)
7. [Risks & Trade-offs](#7-risks--trade-offs)
8. [Appendix: Concept Taxonomy](#8-appendix-concept-taxonomy)

---

## 1. Problem Statement

Go Sensei currently has two disconnected teaching modes:

1. **Passive lessons** — 5 static slide decks. The user clicks "Next" through stone diagrams. No interaction, no practice, no feedback. Retention is low because the user never applies what they read.

2. **Reactive free play** — The AI waits for blunders, then critiques. There's no structure: a beginner might play 50 games without ever encountering a life/death problem, or might keep making the same shape mistakes because nobody forces them to practice the pattern.

**The gap:** There is no bridge from "I read about captures" to "I can reliably capture in a game." The app teaches *about* Go but doesn't teach *Go*.

A 20-kyu player reaching 10-kyu needs to master ~15 core concepts and solve hundreds of tactical problems. The current app provides no structured path, no practice, no progress tracking, and no adaptation. The AI is a strong player who talks — but not yet a *teacher who guides*.

---

## 2. Vision

### The Learning Loop

```
  ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
  │  LEARN       │────▶│  PRACTICE     │────▶│  PLAY         │
  │  Interactive  │     │  Tsumego +    │     │  Free game    │
  │  Lessons      │     │  Challenges   │     │  with AI      │
  └──────┬────────┘     └──────┬────────┘     └──────┬────────┘
         │                     │                     │
         │                     ▼                     │
         │              ┌──────────────┐             │
         │              │  TRACK        │             │
         └─────────────▶│  Concept      │◀────────────┘
                        │  Mastery      │
                        └──────┬────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  ADAPT        │
                        │  AI adjusts   │
                        │  teaching     │
                        └──────────────┘
```

Each mode feeds into concept mastery tracking. The AI reads the mastery profile before every game and adapts:

- **After a lesson on "eyes"** → the AI plays moves that create life/death situations
- **After failing a tsumego** → the problem re-appears via spaced repetition
- **During a game** → the AI notices a weak-area move and activates the relevant visual tool

### Design Principle: No Custom Backend

Every feature must work with:
- **Client-side state** (Zustand + localStorage for durability)
- **GPT-5.4 via Copilot API** (Responses API with tool calling)
- **Static data** bundled in the app (lesson content, problem sets)
- **The existing Go engine** (move validation, scoring, group detection)

This means: no user accounts, no server-side progress DB, no custom API endpoints beyond the existing `/api/chat` proxy. Progress lives in the browser.

---

## 3. Codebase Constraints & Affordances

### What We Already Have (use these)

| Asset | Location | Usable For |
|-------|----------|------------|
| `LessonStep.prompt` field | `src/lib/lessons/types.ts` | Interactive challenges — **exists but unwired** |
| `LessonStep.expectedMove` field | `src/lib/lessons/types.ts` | Move validation — **exists but unwired** |
| `lesson.interactiveChallenge` in store | `src/stores/game-store.ts` | State for active challenges — **exists but unused** |
| `learnedConcepts: string[]` | Game store, persisted | Concept tracking — **exists, needs enrichment** |
| `completedLessons: string[]` | Game store, persisted | Lesson completion — **exists** |
| `isValidMove()` | `src/lib/go-engine/rules.ts` | Validate user answers in problems |
| `getGroup()`, `countLiberties()` | Go engine | Validate life/death outcomes |
| `computeInfluence()` | Go engine | Territory awareness |
| `calculateTerritory()` | Go engine | Scoring validation for challenges |
| Overlay system (6 types) | Store + components | Visual feedback on all features |
| Hesitation detector pattern | `useHesitationDetector.ts` | Template for proactive teaching |
| Board text serialization | `src/lib/ai/format-board.ts` | Send any position to AI for commentary |
| `InteractionLayer` click handling | Board component | Board clicks already work — just need to redirect during lessons/problems |

### Hard Constraints

| Constraint | Implication |
|------------|-------------|
| No backend DB | Progress stored in `localStorage` (survives sessions) — current `sessionStorage` for game state stays, but mastery data needs `localStorage` |
| Copilot API rate limits | Can't call AI for every problem hint — need client-side validation first, AI only for commentary |
| GPT-5.4 can't "see" the board | Must serialize board as text every call; AI can't verify visual positions itself |
| No SGF parser | Problem positions must be defined in our existing `LessonStone[]` format |
| 5 tool-call rounds max | Complex multi-step AI teaching sequences must fit in 5 rounds |
| Client-side only | Can't do leaderboards, can't share progress across devices |

### Key Insight: The Engine IS the Validator

For tsumego and challenges, we don't need the AI to validate moves. The Go engine can:
- Check if a group is captured after a sequence
- Check if a group has ≥2 eyes (alive)
- Count territory
- Detect ko

The AI's role shifts from **validator** to **commentator** — the engine checks correctness, the AI explains *why*.

---

## 4. Feature Proposals

### 4.1 Interactive Lessons 2.0

**Impact: ★★★★★ | Feasibility: ★★★★★ | Priority: P0**

#### What It Does

Transforms the existing 5 passive lessons into interactive experiences where the user must **click the correct move** at key steps. Wrong answers get immediate visual feedback and a hint. The AI provides contextual commentary when the user gets stuck.

#### Why It's Highest Priority

- The `prompt` and `expectedMove` fields **already exist** in `LessonStep` — they're typed, they're in the data model, they just need wiring
- The `interactiveChallenge` state **already exists** in the Zustand store
- The `InteractionLayer` component **already handles clicks** — it just needs a lesson-mode code path
- Estimated delta: ~200 lines of new code + lesson data updates

#### How It Works

**Step types become mixed:** A lesson alternates between *presentation steps* (current behavior — read text, see diagram) and *challenge steps* (new — "click the move that captures this group").

```
Step 1: [PRESENTATION] "A group with one liberty is in atari..."
Step 2: [PRESENTATION] "White can capture by playing here..."
Step 3: [CHALLENGE]    "Where should White play to capture the black group?"
         → User clicks a position
         → Engine validates: did it capture?
         → ✅ Correct: green highlight + "Exactly! Filling the last liberty captures."
         → ❌ Wrong: red highlight + hint text + "Try again. Look at which liberties remain."
Step 4: [PRESENTATION] "After capture, the stones are removed..."
```

**Challenge validation is engine-driven, not AI-driven:**

```typescript
// In LessonView, on board click during a challenge step:
function handleChallengeClick(point: Point) {
  const step = currentStep;
  if (!step.expectedMove) return;

  if (pointEquals(point, step.expectedMove)) {
    // Correct!
    setFeedback({ variant: 'correct', text: step.correctFeedback ?? 'Correct!' });
    // Auto-advance after 1.5s delay
    setTimeout(() => nextStep(), 1500);
  } else {
    setAttempts(a => a + 1);
    setFeedback({ variant: 'wrong', text: step.hintText ?? 'Not quite. Try again.' });
    
    if (attempts >= 2) {
      // Show the answer with highlight
      showAnswerHighlight(step.expectedMove);
    }
  }
}
```

**For more complex validation** (e.g., "capture this group" where multiple moves work):

```typescript
// Extended LessonStep type:
interface LessonStep {
  // ... existing fields ...
  prompt?: string;              // Challenge instruction
  expectedMove?: Point;         // Single correct answer
  acceptableMoves?: Point[];    // Multiple valid answers
  validator?: 'exact' | 'captures_group' | 'creates_eye' | 'increases_liberties';
  validatorTarget?: Point;      // Which group/point to check
  hintText?: string;            // Shown after wrong answer
  correctFeedback?: string;     // Shown on correct answer
  hintHighlights?: LessonHighlight[];  // Progressive hints
}
```

The `validator` field enables engine-based checking:

```typescript
function validateMove(step: LessonStep, point: Point, board: BoardState): boolean {
  switch (step.validator) {
    case 'exact':
      return pointEquals(point, step.expectedMove!);
    
    case 'captures_group': {
      // Play the move, check if target group is captured
      const result = playMove(gameState, point);
      if (!result.success) return false;
      const targetGroup = getGroup(result.newState.board, step.validatorTarget!);
      return targetGroup === null; // Group no longer exists = captured
    }
    
    case 'creates_eye': {
      const result = playMove(gameState, point);
      if (!result.success) return false;
      // Check if the point is now an eye (empty, surrounded by friendly stones)
      return isEye(result.newState.board, step.validatorTarget!, 'black');
    }
    
    case 'increases_liberties': {
      const before = countLiberties(board, step.validatorTarget!);
      const result = playMove(gameState, point);
      if (!result.success) return false;
      const after = countLiberties(result.newState.board, step.validatorTarget!);
      return after > before;
    }
  }
}
```

#### Data Model Changes

**Extend `LessonStep` in `src/lib/lessons/types.ts`:**

```typescript
export interface LessonStep {
  // Existing
  stones: LessonStone[];
  highlights: LessonHighlight[];
  text: string;
  boardSize?: number;
  
  // Interactive (wire up existing fields + add new ones)
  prompt?: string;                    // Challenge text shown to user
  expectedMove?: Point;               // Primary correct answer
  acceptableMoves?: Point[];          // Alternative correct answers
  validator?: StepValidator;          // Engine-based validation type
  validatorTarget?: Point;            // Group/point to validate against
  hintText?: string;                  // Hint after wrong attempts
  correctFeedback?: string;           // Success message
  hintHighlights?: LessonHighlight[]; // Progressive hint visuals
  playerColor?: StoneColor;           // Which color the user plays as (default: 'black')
}

export type StepValidator = 
  | 'exact'               // Must match expectedMove exactly
  | 'captures_group'      // Move must capture the group at validatorTarget
  | 'creates_eye'         // Move must create an eye at validatorTarget
  | 'increases_liberties' // Move must increase liberties of group at validatorTarget
  | 'any_of';             // Any of acceptableMoves
```

**Extend lesson store state:**

```typescript
// In game-store.ts lesson state:
lesson: {
  // ... existing fields ...
  challengeState: {
    active: boolean;
    attempts: number;
    feedback: { variant: 'correct' | 'wrong' | 'hint'; text: string } | null;
    solved: boolean;
    showingAnswer: boolean;
  } | null;
}
```

**Update lesson data** — add interactive steps to existing lessons. Example for the "capture" lesson:

```typescript
// Step 3 becomes interactive:
{
  stones: [
    { point: { x: 4, y: 4 }, color: 'black' },  // Black stone in atari
    { point: { x: 3, y: 4 }, color: 'white' },
    { point: { x: 5, y: 4 }, color: 'white' },
    { point: { x: 4, y: 3 }, color: 'white' },
    // Liberty at (4, 5)
  ],
  highlights: [
    { point: { x: 4, y: 4 }, color: 'red', label: 'Atari!' },
  ],
  text: 'This black stone has only one liberty left.',
  prompt: 'Where should White play to capture it?',
  expectedMove: { x: 4, y: 5 },
  validator: 'captures_group',
  validatorTarget: { x: 4, y: 4 },
  hintText: 'Look for the last empty point adjacent to the black stone.',
  correctFeedback: 'Captured! Filling the last liberty removes the stone.',
}
```

#### Component Changes

1. **`LessonView.tsx`** — Add:
   - Board click handler (when `step.prompt` exists)
   - Challenge state UI (prompt text, feedback toast, attempt counter)
   - "Show Answer" button (after 3 failed attempts)
   - Disable "Next" button until challenge is solved
   - Animate captured stones on correct answer (reuse `CaptureAnimation`)

2. **`LessonOverlay.tsx`** — Add:
   - Wrong-answer red flash at clicked point
   - Correct-answer green pulse at answer point
   - Progressive hint highlights (reveal after each wrong attempt)

3. **New: `src/lib/lessons/validators.ts`** — Engine-based validation functions

#### AI Integration (Optional Enhancement)

For *complex* challenge steps where static hints aren't enough, add an "Ask Sensei" button:

```typescript
// Serialize the lesson position + student's wrong answer → send to AI
const msg = `
  The student is working on a lesson about ${lesson.title}.
  Board position: ${boardToText(lessonGameState)}
  Challenge: ${step.prompt}
  Student tried: ${pointToCoord(wrongMove, boardSize)} (incorrect)
  Correct answer: ${pointToCoord(step.expectedMove, boardSize)}
  Explain why their move doesn't work and give a hint toward the correct move.
`;
```

This is **optional** and rate-limited (max 1 AI call per challenge step) since most validation is engine-side.

---

### 4.2 Tsumego Engine

**Impact: ★★★★★ | Feasibility: ★★★★☆ | Priority: P0**

#### What It Does

Adds a dedicated problem-solving mode with categorized Go puzzles (life/death, capture, escape, connection). Problems are static data bundled in the app, validated by the Go engine, with AI commentary on demand.

#### Why It's Critical

Tsumego (詰碁) is *the* universally recommended way to improve at Go. Every Go teacher in history says: "Do tsumego daily." A 20-kyu reaching 10-kyu solves thousands of problems. Without this, the app cannot claim to teach Go.

#### How It Works

**Problem Format:**

```typescript
export interface TsumegoProblem {
  id: string;                          // e.g., 'capture-001'
  category: ProblemCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;     // 1=easiest (25k), 5=hardest (10k)
  title?: string;                      // Optional descriptive title
  boardSize: BoardSize;                // Usually 9 for problems
  setupStones: LessonStone[];         // Initial position
  playerColor: StoneColor;            // Who to play as
  objective: ProblemObjective;
  
  // Solution tree
  correctMoves: Point[];               // First move(s) that solve it
  continuations?: TsumegoContinuation[]; // Multi-move sequences
  
  // Feedback
  hintText?: string;                   // First hint
  hintHighlights?: LessonHighlight[];  // Visual hint
  explanationText?: string;            // Shown after solve
  
  // Concepts this problem tests
  concepts: ConceptId[];
}

export type ProblemCategory = 
  | 'life-death'      // Kill or save a group
  | 'capture'         // Capture specific stones
  | 'escape'          // Save your group
  | 'connection'      // Connect two groups
  | 'tesuji'          // Tactical trick
  | 'endgame';        // Yose problems

export interface ProblemObjective {
  type: 'kill' | 'live' | 'capture_stones' | 'connect' | 'best_move';
  targetGroup?: Point;        // Group to kill/save
  description: string;        // "Kill the black group" / "Make two eyes"
}

export interface TsumegoContinuation {
  playerMove: Point;          // Player's correct move
  opponentResponse: Point;    // Opponent's best response
  nextCorrectMoves: Point[];  // Player's follow-up options
}
```

**Solving Flow:**

```
1. Display problem position + objective text
2. User clicks a move
3. Engine validates:
   a. Is it a legal move?
   b. Does it match correctMoves[]?
   c. If continuation exists, play opponent response, wait for next move
4. On correct: 
   - Green highlight + "Correct!" 
   - Show explanation
   - Record solve in mastery tracker
5. On wrong:
   - Red flash + "Incorrect" 
   - After 2 fails: show hint text + hint highlights
   - After 4 fails: show answer (with arrow overlay showing sequence)
   - Record fail in mastery tracker
```

**Multi-move problems** use the continuation tree:

```
Problem: "Kill the white group" (player is Black)

Move 1: Player clicks B1 (correct: matches correctMoves[0])
  → Engine plays opponent response: White A2 (from continuations[0].opponentResponse)
  → Board updates with both moves
Move 2: Player clicks A1 (correct: matches continuations[0].nextCorrectMoves[0])
  → Engine verifies: is the white group captured?
  → ✅ Success!
```

The engine does the heavy lifting:

```typescript
function validateProblemMove(
  problem: TsumegoProblem,
  gameState: GameState,
  move: Point,
  moveIndex: number
): 'correct' | 'wrong' | 'legal_but_suboptimal' {
  // Check if move matches known correct moves for this step
  const validMoves = moveIndex === 0 
    ? problem.correctMoves 
    : getCurrentContinuation(problem, moveIndex).nextCorrectMoves;
  
  if (validMoves.some(m => pointEquals(m, move))) {
    return 'correct';
  }
  
  // For 'kill' objectives: check if the move still leads to death
  // (allows creative solutions not in the tree)
  if (problem.objective.type === 'kill') {
    const result = playMove(gameState, move);
    if (result.success) {
      const target = getGroup(result.newState.board, problem.objective.targetGroup!);
      if (target && countLiberties(result.newState.board, problem.objective.targetGroup!) <= 1) {
        return 'legal_but_suboptimal'; // Works but isn't the textbook answer
      }
    }
  }
  
  return 'wrong';
}
```

#### Problem Library

Start with **60 problems** across 3 difficulty tiers:

| Category | Diff 1 (25-20k) | Diff 2 (20-15k) | Diff 3 (15-10k) | Total |
|----------|-----------------|-----------------|-----------------|-------|
| Capture | 5 | 5 | 5 | 15 |
| Life/Death | 5 | 5 | 5 | 15 |
| Escape | 3 | 4 | 3 | 10 |
| Connection | 3 | 3 | 4 | 10 |
| Tesuji | 2 | 3 | 5 | 10 |
| **Total** | **18** | **20** | **22** | **60** |

Problems are stored as static TypeScript data (like lesson-data.ts), organized in files by category:

```
src/lib/tsumego/
  types.ts              // TsumegoProblem, ProblemCategory, etc.
  capture-problems.ts   // 15 capture problems
  life-death-problems.ts // 15 life/death problems
  escape-problems.ts    // 10 escape problems
  connection-problems.ts // 10 connection problems
  tesuji-problems.ts    // 10 tesuji problems
  index.ts              // getAllProblems(), getByCategory(), getByDifficulty()
  validators.ts         // validateProblemMove(), checkObjective()
```

#### Component Architecture

```
src/components/tsumego/
  ProblemPicker.tsx      // Grid of categories, difficulty filter, progress indicators
  ProblemView.tsx        // Board + objective + controls (similar to LessonView structure)
  ProblemFeedback.tsx    // Correct/wrong animation overlay
  ProblemControls.tsx    // Hint, Reset, Skip, Ask Sensei buttons
```

**`ProblemView`** reuses the existing board rendering (copy `LessonView`'s SVG board pattern) but adds:
- Click handlers that validate against the problem's solution tree
- Opponent auto-response (for multi-move problems)
- Timer (optional, for challenge mode)
- "Ask Sensei" button that serializes position + sends to AI for explanation

#### Store Changes

```typescript
// New top-level store slice:
tsumego: {
  active: boolean;
  currentProblemId: string | null;
  moveHistory: Point[];           // Student's moves in this attempt
  moveIndex: number;              // Current step in continuation tree
  attempts: number;               // Wrong attempts this problem
  hintsUsed: number;
  feedback: { variant: string; text: string } | null;
  solved: boolean;
  timer: number | null;           // Seconds elapsed (optional)
};

// New appPhase values:
appPhase: 'game' | 'lessons' | 'lesson' | 'tsumego-picker' | 'tsumego';
```

#### AI Integration

The AI is NOT in the solving loop (too slow, too expensive). It's invoked on demand:

1. **"Ask Sensei" button** — sends the problem position + student's wrong answer to AI for a natural-language explanation
2. **Post-solve commentary** — after solving, optionally sends position to AI for "Why does this work?" explanation
3. **Uses existing `/api/chat` endpoint** — no new API routes needed

#### Data Model for Progress

```typescript
// Stored in localStorage (new persistence layer):
interface ProblemProgress {
  [problemId: string]: {
    solved: boolean;
    attempts: number;           // Total attempts across all tries
    bestAttempts: number;       // Fewest wrong answers in one try
    hintsUsed: number;
    solvedAt: number | null;    // Timestamp
    lastAttemptAt: number;      // For spaced repetition
    streak: number;             // Consecutive correct solves
  };
}
```

---

### 4.3 Concept Mastery & Curriculum Tree

**Impact: ★★★★☆ | Feasibility: ★★★★★ | Priority: P1**

#### What It Does

Creates a structured concept taxonomy where each concept has a mastery level derived from lessons, problems, and game play. Concepts form a prerequisite tree — mastering "liberties" unlocks "atari and capture," which unlocks "life and death." The user sees a visual progress map.

#### Why It Matters

Without this, the app has no answer to "What should I learn next?" The user is left to wander. A curriculum tree provides:
- **Direction** — always know the next step
- **Motivation** — visible progress unlocking new content
- **Input to AI** — the system prompt knows exactly what the student has mastered

#### Concept Taxonomy

```typescript
export type ConceptId = 
  // Tier 1: Absolute Basics (25-20k)
  | 'rules-basics'           // Board, stones, turns
  | 'groups'                 // Connected stones
  | 'liberties'              // Breathing room
  | 'capture'                // Filling last liberty
  | 'territory-basics'       // Surrounding empty space
  | 'eyes'                   // Two eyes to live
  | 'ko-rule'                // Can't recreate position
  
  // Tier 2: Fundamental Tactics (20-15k)
  | 'atari'                  // Threatening capture
  | 'ladder'                 // Shicho
  | 'net'                    // Geta
  | 'snapback'               // Sacrifice-then-capture
  | 'connect-and-cut'        // Keeping/breaking connections
  | 'false-eyes'             // Eye that isn't really safe
  | 'life-death-basics'      // Basic tsumego patterns
  
  // Tier 3: Shape & Strategy (15-10k)
  | 'good-shape'             // Ponnuki, bamboo, tiger's mouth
  | 'bad-shape'              // Empty triangle, dumpling
  | 'opening-principles'     // Corners, sides, center
  | 'influence-territory'    // Thickness vs land
  | 'sente-gote'             // Initiative
  | 'invasion-reduction'     // When to invade vs reduce
  | 'double-atari'           // Fork attacks
  | 'throw-in'               // Sacrifice tesuji
  | 'counting-basics';       // Estimating score

export interface ConceptNode {
  id: ConceptId;
  name: string;
  description: string;
  tier: 1 | 2 | 3;
  prerequisites: ConceptId[];       // Must master these first
  lessons: string[];                // Lesson IDs that teach this
  problems: string[];               // Problem IDs that test this
  icon: string;                     // Emoji
}
```

#### Mastery Model

```typescript
export interface ConceptMastery {
  conceptId: ConceptId;
  level: MasteryLevel;
  evidence: MasteryEvidence[];      // What contributed to current level
  lastPracticed: number;            // Timestamp
  decayFactor: number;              // Decreases over time without practice
}

export type MasteryLevel = 
  | 'locked'          // Prerequisites not met
  | 'available'       // Ready to learn
  | 'introduced'      // Lesson completed
  | 'practicing'      // Some problems solved
  | 'learned'         // >70% of problems solved
  | 'mastered';       // >90% problems solved + demonstrated in games

export interface MasteryEvidence {
  type: 'lesson_completed' | 'problem_solved' | 'problem_failed' | 'game_demonstrated' | 'game_mistake';
  timestamp: number;
  detail: string;       // e.g., "Solved capture-003" or "Failed to see ladder in game"
}
```

**Mastery transitions:**

```
locked → available       When all prerequisites reach 'introduced' or higher
available → introduced   When the associated lesson is completed
introduced → practicing  When ≥1 associated problem is solved
practicing → learned     When ≥70% of associated problems are solved
learned → mastered       When ≥90% problems solved AND AI confirms demonstration in game
```

**Time decay** (lightweight spaced repetition):
- Mastery decays one level after 14 days without practice
- `mastered` → `learned` → `practicing` (but never below `practicing`)
- Any interaction with the concept resets the timer

#### Curriculum Tree Visualization

New component: `CurriculumMap.tsx` — displays concepts as nodes in a directed graph:

```
  [Rules ✅]──────[Groups ✅]──────[Connect & Cut 🔓]
       │               │
       ▼               ▼
  [Liberties ✅]──[Atari 🔓]──────[Ladder 🔒]
       │               │              │
       ▼               ▼              ▼
  [Capture ✅]───[Life/Death 🔓]──[Net 🔒]
       │               │
       ▼               ▼
  [Territory ✅]  [False Eyes 🔒]
       │
       ▼
  [Eyes ✅]
```

Legend: ✅ mastered, 🟡 practicing, 🔓 available, 🔒 locked

Clicking a node shows: description, mastery level, associated lessons/problems, and a "Practice" button that takes you to the next unsolved problem for that concept.

#### Store Changes

```typescript
// Replace simple learnedConcepts with rich mastery data:
// Stored in localStorage (separate from sessionStorage game state):

interface MasteryStore {
  concepts: Record<ConceptId, ConceptMastery>;
  totalProblemsAttempted: number;
  totalProblemsSolved: number;
  gamesPlayed: number;
  estimatedRank: string;           // "~18 kyu" based on mastery profile
  lastUpdated: number;
}
```

**Estimated rank** derives from mastery:
- All Tier 1 mastered → ~18 kyu
- All Tier 2 mastered → ~14 kyu  
- All Tier 3 mastered → ~10 kyu

#### Integration Points

- **Lessons** → on completion, update mastery for associated concepts
- **Tsumego** → on solve/fail, update mastery for problem's concept tags
- **Games** → AI tags its commentary with concept IDs (new tool described in §4.5)
- **Curriculum Map** → reads mastery store, computes unlock state
- **Recommendations** → "Based on your progress, try: [next available concept]"

---

### 4.4 Challenge Scenarios

**Impact: ★★★★☆ | Feasibility: ★★★★☆ | Priority: P1**

#### What It Does

Preset board positions with specific objectives ("Save this group," "Invade the corner," "Win by 5+ points in the endgame"). Unlike tsumego (which is pure tactics), challenges involve longer play sequences with the AI as opponent, testing strategic understanding.

#### How It Differs From Tsumego

| Aspect | Tsumego | Challenge |
|--------|---------|-----------|
| Scope | 1-5 moves | 10-30+ moves |
| Validation | Engine-side (deterministic) | AI-side (evaluative) |
| Focus | Tactics (reading) | Strategy + tactics |
| Opponent | Pre-scripted responses | Live AI play |
| Board area | Local (corner/edge) | Full board possible |

#### Challenge Format

```typescript
export interface ChallengeScenario {
  id: string;                         // e.g., 'invade-corner-001'
  title: string;                      // "Invade the 4-4 Corner"
  description: string;                // Context and backstory
  category: ChallengeCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  boardSize: BoardSize;               // Usually 9 or 13
  setupStones: LessonStone[];         // Initial board position
  playerColor: StoneColor;
  
  objective: ChallengeObjective;
  
  // AI behavior modification
  aiSystemPromptOverride?: string;    // Additional AI instructions
  aiPlayStyle?: 'passive' | 'balanced' | 'aggressive';
  
  // Time limit (optional)
  moveLimit?: number;                 // Max moves to achieve objective
  
  // Concepts tested
  concepts: ConceptId[];
  
  // Hints
  initialHint?: string;              // Shown at start
  strategicHints?: string[];          // Available on request
}

export type ChallengeCategory =
  | 'defense'          // Save a weak group
  | 'attack'           // Kill an opponent's group
  | 'invasion'         // Establish a living group in enemy territory
  | 'endgame'          // Win from a close position
  | 'connection'       // Connect two separated groups
  | 'territory';       // Build more territory than opponent

export interface ChallengeObjective {
  type: 'survive' | 'kill' | 'territory_lead' | 'connect_groups' | 'invade_and_live';
  description: string;                // "Make two eyes with the black group"
  targetGroup?: Point;                // Reference point for the group
  territoryMargin?: number;           // "Win by at least N points"
  evaluateAfter: 'game_end' | 'every_move' | 'move_limit';
}
```

#### Execution Flow

```
1. Load challenge position → set up board
2. Display objective banner: "🎯 Save the marked group. You have 20 moves."
3. Player and AI alternate moves (normal game loop)
4. AI receives modified system prompt:
   "You are playing a teaching challenge. The student's objective is to save 
    the black group near D4. Play naturally but don't make the challenge trivial.
    If the student succeeds, acknowledge it. If they fail, explain what went wrong."
5. After each AI move, evaluate objective:
   - 'survive': Is the target group alive (≥2 eyes or uncapturable)?
   - 'kill': Is the target group dead?
   - 'territory_lead': After scoring, is margin ≥ N?
6. On success: Celebration animation + AI commentary + mastery update
7. On failure: AI explains what went wrong + mastery update
```

**Key design choice: AI as active opponent, not scripted responses.** This makes challenges replayable — the AI might respond differently each time, so the student learns principles, not sequences.

#### Objective Validation

Combines engine validation with AI judgment:

```typescript
function evaluateChallenge(
  challenge: ChallengeScenario,
  gameState: GameState
): 'in_progress' | 'success' | 'failure' {
  const obj = challenge.objective;
  
  switch (obj.type) {
    case 'survive': {
      const group = getGroup(gameState.board, obj.targetGroup!);
      if (!group) return 'failure'; // Group was captured
      const libs = countLiberties(gameState.board, obj.targetGroup!);
      // Heuristic: 2+ eyes or 5+ liberties in a settled position = likely alive
      // For definitive answer, ask AI (expensive but accurate)
      if (libs >= 5) return 'success';
      if (libs <= 1) return 'failure';
      return 'in_progress';
    }
    
    case 'kill': {
      const group = getGroup(gameState.board, obj.targetGroup!);
      if (!group) return 'success'; // Group captured!
      return 'in_progress';
    }
    
    case 'territory_lead': {
      if (obj.evaluateAfter !== 'game_end') return 'in_progress';
      const territory = calculateTerritory(gameState.board, gameState.komi);
      const playerScore = challenge.playerColor === 'black' 
        ? territory.finalBlackScore : territory.finalWhiteScore;
      const opponentScore = challenge.playerColor === 'black'
        ? territory.finalWhiteScore : territory.finalBlackScore;
      return (playerScore - opponentScore >= (obj.territoryMargin ?? 0))
        ? 'success' : 'failure';
    }
    
    case 'connect_groups': {
      // Check if two previously separate groups are now one
      const group = getGroup(gameState.board, obj.targetGroup!);
      // Connected if both reference stones are in the same group
      return group && group.stones.length > previousGroupSize
        ? 'success' : 'in_progress';
    }
  }
}
```

#### Initial Challenge Library

Start with **15 challenges**:

| Category | Count | Example |
|----------|-------|---------|
| Defense | 3 | "Save the corner group" (9×9, 3 setups of increasing complexity) |
| Attack | 3 | "Kill the invading stones" |
| Invasion | 3 | "Establish a living group in White's corner" |
| Connection | 3 | "Connect your two groups before White cuts" |
| Endgame | 3 | "Win this close game" (13×13, pre-set positions) |

#### Component Architecture

```
src/components/challenges/
  ChallengePicker.tsx     // Category-filtered grid with difficulty + completion
  ChallengeView.tsx       // Board + objective banner + AI game loop + evaluation
  ObjectiveBanner.tsx     // Animated objective display with progress indicator
```

`ChallengeView` is essentially a **modified game view** (reuses `GoBoard`, `InteractionLayer`, `SenseiBubble`) with:
- Preset initial position instead of empty board
- Objective banner at top
- Modified AI system prompt (injected objective context)
- Post-move evaluation check
- Move counter / time limit display
- Victory/defeat modal

#### AI Prompt Modification

The existing `buildSystemPrompt()` gets an optional `challengeContext` parameter:

```typescript
function buildSystemPrompt(level: TeachingLevel, challengeContext?: string): string {
  let prompt = /* existing prompt */;
  
  if (challengeContext) {
    prompt += `\n\n## CHALLENGE MODE\n${challengeContext}\n`;
    prompt += `Play naturally as White. Don't make the challenge trivially easy or impossibly hard.`;
    prompt += `After each of your moves, briefly comment on whether the student is on track.`;
  }
  
  return prompt;
}
```

---

### 4.5 Adaptive AI Teaching Loop

**Impact: ★★★★★ | Feasibility: ★★★☆☆ | Priority: P2**

#### What It Does

Feeds the student's concept mastery profile into the AI system prompt so the AI can:
1. **Prioritize weak concepts** — if the student struggles with "life and death," the AI creates situations that force life/death decisions
2. **Name concepts explicitly** — instead of "that was bad," say "that's a false eye — you need to study false eyes"
3. **Tag its commentary** — a new tool `tag_concept` tells the mastery system which concept the AI just taught
4. **Set up teaching positions** — a new tool `setup_position` lets the AI place stones to demonstrate a concept mid-game (limited, controlled)

#### Why It's P2 (Not P0)

This feature is powerful but:
- Depends on §4.3 (mastery data must exist first)
- Requires prompt engineering iteration (may take multiple rounds to get right)
- The "setup position" tool is risky (AI might abuse it)
- Impact is diffuse (harder to measure than "did they solve the problem?")

#### New AI Tool: `tag_concept`

```typescript
{
  type: 'function',
  name: 'tag_concept',
  description: 'Tag your teaching comment with the Go concept being taught. This helps track the student\'s learning progress.',
  parameters: {
    type: 'object',
    properties: {
      concept: {
        type: 'string',
        enum: ['groups', 'liberties', 'capture', 'territory-basics', 'eyes', 
               'ko-rule', 'atari', 'ladder', 'net', 'snapback', 
               'connect-and-cut', 'false-eyes', 'life-death-basics',
               'good-shape', 'bad-shape', 'opening-principles',
               'influence-territory', 'sente-gote', 'invasion-reduction',
               'double-atari', 'throw-in', 'counting-basics'],
      },
      demonstrated: {
        type: 'boolean',
        description: 'true if the student demonstrated understanding, false if they made a mistake related to this concept',
      }
    },
    required: ['concept', 'demonstrated'],
  }
}
```

The AI calls this alongside its commentary:

```
AI response: "That's an empty triangle — one of the worst shapes in Go. 
              You're adding a stone that doesn't increase your liberties."
Tool call: tag_concept({ concept: 'bad-shape', demonstrated: false })
Tool call: make_move({ position: 'F5', reasoning: 'punish the heavy shape' })
```

Client-side handling:

```typescript
// In applyTools():
case 'tag_concept': {
  const { concept, demonstrated } = result;
  updateMastery(concept, demonstrated ? 'game_demonstrated' : 'game_mistake');
  break;
}
```

#### System Prompt Injection

Before each game, inject the mastery profile:

```typescript
function buildMasteryContext(mastery: MasteryStore): string {
  const weak = Object.entries(mastery.concepts)
    .filter(([_, m]) => m.level === 'introduced' || m.level === 'practicing')
    .map(([id, m]) => `${id} (${m.level})`);
  
  const strong = Object.entries(mastery.concepts)
    .filter(([_, m]) => m.level === 'mastered')
    .map(([id]) => id);
  
  if (weak.length === 0 && strong.length === 0) return '';
  
  return `
## STUDENT PROFILE
Estimated rank: ${mastery.estimatedRank}
Games played: ${mastery.gamesPlayed}

Weak areas (focus teaching here):
${weak.map(w => `- ${w}`).join('\n')}

Strong areas (don't over-explain):
${strong.map(s => `- ${s}`).join('\n')}

IMPORTANT: When you see the student make a mistake related to a weak area, 
use tag_concept to record it. When they demonstrate understanding of a concept, 
also tag it. Prioritize creating situations that test their weak areas.
`;
}
```

This gets appended to the system prompt in `buildSystemPrompt()`.

#### Proactive Teaching Positions (Experimental)

A new tool `suggest_practice` (NOT `setup_position` — too dangerous):

```typescript
{
  type: 'function',
  name: 'suggest_practice',
  description: 'Suggest a specific lesson, problem category, or challenge the student should try next based on what you observed in the game.',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['lesson', 'problem_category', 'challenge'] },
      target: { type: 'string', description: 'Lesson ID, problem category, or challenge ID' },
      reason: { type: 'string', description: 'Why this practice would help' },
    },
    required: ['type', 'target', 'reason'],
  }
}
```

After a game review, the AI might say:

```
"You lost three groups to ladders today. I recommend:
 - Practice: ladder problems (category: tesuji, focus: ladder)
 - Lesson: 'Connect & Cut' if you haven't completed it"

Tool call: suggest_practice({ type: 'problem_category', target: 'tesuji', reason: 'Failed to read ladders in moves 23, 41, 58' })
```

The client displays this as an actionable card: "🎯 Sensei suggests: Practice tesuji problems → [Go to Problems]"

#### Risk: AI Reliability

The AI may:
- Tag concepts incorrectly (false positive mastery)
- Over-tag (every move gets a concept tag)
- Ignore the mastery profile

**Mitigation:**
- Tag frequency limit: max 3 `tag_concept` calls per game
- Mastery updates from AI tags have lower weight than problem solves (0.3× vs 1.0×)
- System prompt explicitly says "Use tag_concept sparingly — only for notable moments"

---

## 5. Phased Implementation Roadmap

### Phase 1: Foundation (1-2 weeks)

**Goal:** Interactive lessons work, localStorage mastery store exists.

| Task | Depends On | Est. Effort |
|------|-----------|-------------|
| Extend `LessonStep` type with interactive fields | — | 1h |
| Create `src/lib/lessons/validators.ts` | LessonStep types | 3h |
| Add challenge state to lesson store slice | — | 1h |
| Wire click handlers in `LessonView.tsx` | Validators | 4h |
| Add feedback overlays (correct/wrong) | Click handlers | 2h |
| Update 5 existing lessons with 2-3 interactive steps each | Validators | 4h |
| Create `MasteryStore` with localStorage persistence | — | 3h |
| Define concept taxonomy (`ConceptId`, `ConceptNode`) | — | 2h |
| Wire lesson completion → mastery updates | MasteryStore | 2h |
| **Total** | | **~22h** |

**Exit criteria:** User can complete a lesson that includes "click the right move" challenges. Mastery data persists across sessions.

### Phase 2: Tsumego (2-3 weeks)

**Goal:** 60 problems solvable, progress tracked, concepts tagged.

| Task | Depends On | Est. Effort |
|------|-----------|-------------|
| Define `TsumegoProblem` types | Phase 1 types | 2h |
| Create tsumego validators (`validateProblemMove`) | Engine, types | 6h |
| Build `ProblemPicker.tsx` | — | 4h |
| Build `ProblemView.tsx` with board + click solving | Validators | 8h |
| Write 20 capture + life/death problems (Tier 1) | Types | 6h |
| Write 20 escape + connection problems (Tier 2) | Types | 6h |
| Write 20 tesuji problems (Tier 3) | Types | 6h |
| Add `appPhase: 'tsumego-picker' | 'tsumego'` routing | Store | 2h |
| Wire problem solve/fail → mastery updates | MasteryStore | 2h |
| Add "Ask Sensei" button (AI explanation) | `/api/chat` | 3h |
| Add problem progress to localStorage | — | 2h |
| **Total** | | **~47h** |

**Exit criteria:** User can browse problems by category/difficulty, solve them interactively, see progress, and get AI explanations on demand.

### Phase 3: Curriculum & Challenges (2-3 weeks)

**Goal:** Concept tree visualization, 15 challenge scenarios playable.

| Task | Depends On | Est. Effort |
|------|-----------|-------------|
| Build `CurriculumMap.tsx` (concept tree visualization) | MasteryStore | 8h |
| Add concept detail panel (mastery level, practice links) | CurriculumMap | 4h |
| Define `ChallengeScenario` types | Phase 1 types | 2h |
| Build challenge objective validators | Engine | 4h |
| Build `ChallengePicker.tsx` | — | 3h |
| Build `ChallengeView.tsx` (modified game view) | Game components | 8h |
| Write 15 challenge scenarios with positions | Types | 8h |
| Modify `buildSystemPrompt()` for challenge context | — | 2h |
| Add `appPhase: 'challenge-picker' | 'challenge'` routing | Store | 2h |
| Wire challenge outcomes → mastery updates | MasteryStore | 2h |
| Add navigation hub (lessons, problems, challenges, play) | All pickers | 4h |
| **Total** | | **~47h** |

**Exit criteria:** User sees their concept tree, can play 15 different challenge scenarios, and the app recommends what to do next.

### Phase 4: Adaptive AI (1-2 weeks)

**Goal:** AI reads mastery profile, tags concepts, suggests practice.

| Task | Depends On | Est. Effort |
|------|-----------|-------------|
| Add `tag_concept` tool to API route | Phase 3 mastery | 3h |
| Add `suggest_practice` tool to API route | Phase 3 | 3h |
| Build `buildMasteryContext()` prompt injection | MasteryStore | 2h |
| Handle `tag_concept` in `applyTools()` | Store | 2h |
| Handle `suggest_practice` as actionable card in bubble | UI | 3h |
| Add mastery decay (time-based) | MasteryStore | 2h |
| Add estimated rank calculation | MasteryStore | 2h |
| Prompt engineering: iterate on AI behavior with mastery | — | 4h |
| Add progress dashboard (rank estimate, streak, stats) | MasteryStore | 4h |
| **Total** | | **~25h** |

**Exit criteria:** AI mentions weak concepts by name, tags at most 3 concepts per game, suggests relevant practice, and the user sees their estimated rank.

### Timeline Summary

```
Week 1-2:   Phase 1 — Interactive Lessons + Mastery Foundation
Week 3-5:   Phase 2 — Tsumego Engine (60 problems)
Week 5-7:   Phase 3 — Curriculum Tree + Challenge Scenarios
Week 8-9:   Phase 4 — Adaptive AI Loop
```

Total: ~141h of focused implementation across 9 weeks.

---

## 6. Data Model Changes (Consolidated)

### New Files

```
src/lib/lessons/validators.ts           // Engine-based lesson step validators
src/lib/tsumego/types.ts                // TsumegoProblem, ProblemCategory, etc.
src/lib/tsumego/validators.ts           // Problem solving validation
src/lib/tsumego/capture-problems.ts     // 15 capture problems
src/lib/tsumego/life-death-problems.ts  // 15 life/death problems
src/lib/tsumego/escape-problems.ts      // 10 escape problems
src/lib/tsumego/connection-problems.ts  // 10 connection problems
src/lib/tsumego/tesuji-problems.ts      // 10 tesuji problems
src/lib/tsumego/index.ts                // Problem queries
src/lib/challenges/types.ts             // ChallengeScenario, ChallengeObjective
src/lib/challenges/scenarios.ts         // 15 preset challenges
src/lib/challenges/validators.ts        // Objective evaluation
src/lib/curriculum/types.ts             // ConceptId, ConceptNode, ConceptMastery
src/lib/curriculum/concept-tree.ts      // Concept definitions + prerequisites
src/lib/curriculum/mastery.ts           // Mastery computation, rank estimation
src/stores/mastery-store.ts             // Zustand store with localStorage persistence
src/components/tsumego/*                // Problem UI (4 components)
src/components/challenges/*             // Challenge UI (3 components)
src/components/curriculum/*             // Curriculum map + detail panel
src/components/hub/NavigationHub.tsx     // Central navigation (lessons, problems, challenges, play)
```

### Modified Files

```
src/lib/lessons/types.ts        // Extend LessonStep with interactive fields
src/lib/lessons/lesson-data.ts  // Add interactive steps to existing 5 lessons
src/stores/game-store.ts        // Add tsumego state, challenge state, appPhase values
src/lib/ai/system-prompt.ts     // Add challengeContext param, masteryContext injection
src/app/api/chat/route.ts       // Add tag_concept + suggest_practice tools
src/hooks/useGoMaster.ts        // Handle new tools in applyTools()
src/components/lessons/LessonView.tsx  // Add click handlers, challenge UI
src/app/page.tsx                // Route new appPhase values
```

### Storage Architecture

```
sessionStorage (existing):          localStorage (new):
├── game state                      ├── mastery-store
├── chat messages                   │   ├── concepts: Record<ConceptId, ConceptMastery>
├── phase                           │   ├── estimatedRank
├── teaching level                  │   ├── gamesPlayed
└── completed lessons               │   └── lastUpdated
                                    ├── problem-progress
                                    │   └── [problemId]: { solved, attempts, ... }
                                    └── challenge-progress
                                        └── [challengeId]: { completed, bestResult, ... }
```

**Why two storage systems:** `sessionStorage` is correct for ephemeral game state (losing a game in progress is fine). `localStorage` is needed for mastery data that must survive across sessions — a student returning after a week should see their progress.

---

## 7. Risks & Trade-offs

### R1: localStorage Durability

**Risk:** User clears browser data → loses all progress. No cross-device sync.

**Mitigation:**
- Export/import mastery data as JSON (manual backup)
- Clear warning in settings: "Progress is stored locally"
- Future: Optional GitHub Gist sync (store mastery JSON as a private gist via existing GitHub auth)

**Trade-off accepted:** Building a backend is out of scope. localStorage is the pragmatic choice.

### R2: Static Problem Library Scales Slowly

**Risk:** 60 problems is enough for a few weeks, but serious students will exhaust them.

**Mitigation:**
- Design problem format to be easily extensible (each file is independent)
- AI-generated problems (Phase 5, future): send "Generate a life/death problem at difficulty 2" to GPT, parse the response into `TsumegoProblem` format
- Community contribution: problem data is just TypeScript arrays, easy to PR

**Trade-off:** Static > generated for reliability. AI-generated problems may have incorrect solutions. Start static, add generation later with human verification.

### R3: AI Concept Tagging Accuracy

**Risk:** GPT tags wrong concepts, corrupting mastery data.

**Mitigation:**
- AI tags have 0.3× weight vs lesson/problem evidence (1.0×)
- Max 3 tags per game (system prompt enforced)
- Player can view and dispute mastery in settings (manual override)
- Mastery computation is majority-rules: one bad tag can't flip a level

### R4: Challenge AI Difficulty Calibration

**Risk:** AI plays too strong in challenges (beginner can't succeed) or too weak (trivializes the challenge).

**Mitigation:**
- Challenge `aiPlayStyle` parameter ('passive', 'balanced', 'aggressive')
- System prompt for challenges includes: "The student is approximately {rank}. Adjust your play to be slightly weaker than their level."
- Challenges are playtested at target difficulty before shipping
- "Skip" option always available (no blocking progression)

### R5: Curriculum Too Linear

**Risk:** A strict prerequisite tree feels restrictive. Some students want to jump ahead.

**Mitigation:**
- "Locked" concepts can still be *viewed* (lesson content is readable, just not marked complete)
- Problems are accessible regardless of mastery (but shown as "advanced" with warning)
- Challenges have difficulty ratings independent of concept locks
- The tree is a *recommendation*, not a gate (except for the curriculum map visualization)

### R6: Feature Bloat / Complexity

**Risk:** 4 new modes (interactive lessons, tsumego, challenges, curriculum) make the app overwhelming.

**Mitigation:**
- Single navigation hub with clear categories
- Default landing: "Recommended Next" card (one clear action)
- Progressive disclosure: new modes unlock as concepts progress
- Beginner flow: Lesson 1 → Problem 1 → First Game (guided, not open-ended)

### R7: LessonView Refactor Scope

**Risk:** Adding click handlers to `LessonView.tsx` means the component does two things (presentation + interaction). Could get messy.

**Mitigation:**
- Extract shared board rendering into `<LessonBoard>` component used by both `LessonView` and `ProblemView`
- Challenge state is a clean sub-state in the store (not tangled with step navigation)
- Interactive steps use a clearly separate code path: `if (step.prompt) { renderChallenge() } else { renderPresentation() }`

### R8: Multi-Move Tsumego Complexity

**Risk:** The continuation tree for multi-move problems could get complex (many branches). Authoring is tedious and error-prone.

**Mitigation:**
- Start with **single-move problems only** (Phase 2a). These cover 80% of beginner tsumego.
- Add 2-move problems in Phase 2b after the UI is proven.
- 3+ move problems are Phase 5 (future). Most 10k-level tsumego are solvable in 1-3 moves.
- For multi-move, the engine validates the *outcome* (is the group dead?), not the exact sequence. This allows creative solutions.

---

## 8. Appendix: Concept Taxonomy

### Full Concept Tree with Prerequisites

```
TIER 1: FOUNDATIONS (25-20 kyu)
├── rules-basics         (prereqs: none)
├── groups               (prereqs: rules-basics)
├── liberties            (prereqs: groups)
├── capture              (prereqs: liberties)
├── territory-basics     (prereqs: rules-basics)
├── eyes                 (prereqs: capture, territory-basics)
└── ko-rule              (prereqs: capture)

TIER 2: TACTICS (20-15 kyu)
├── atari                (prereqs: capture)
├── ladder               (prereqs: atari)
├── net                  (prereqs: atari)
├── snapback             (prereqs: capture)
├── connect-and-cut      (prereqs: groups, atari)
├── false-eyes           (prereqs: eyes)
└── life-death-basics    (prereqs: eyes, atari)

TIER 3: SHAPE & STRATEGY (15-10 kyu)
├── good-shape           (prereqs: groups, liberties)
├── bad-shape            (prereqs: good-shape)
├── opening-principles   (prereqs: territory-basics)
├── influence-territory  (prereqs: territory-basics, groups)
├── sente-gote           (prereqs: atari)
├── invasion-reduction   (prereqs: territory-basics, life-death-basics)
├── double-atari         (prereqs: atari, connect-and-cut)
├── throw-in             (prereqs: capture, life-death-basics)
└── counting-basics      (prereqs: territory-basics)
```

### Concept → Content Mapping (Initial)

| Concept | Lessons | Problems (count) | Challenges |
|---------|---------|-------------------|------------|
| rules-basics | groups, liberties | — | — |
| groups | groups | 3 (capture category) | — |
| liberties | liberties | 5 (capture) | — |
| capture | capture | 7 (capture) | — |
| territory-basics | territory | — | 3 (territory) |
| eyes | eyes | 8 (life-death) | 3 (defense) |
| ko-rule | — (needs new lesson) | 2 (tesuji) | — |
| atari | — (needs new lesson) | 5 (capture) | — |
| ladder | — (needs new lesson) | 3 (tesuji) | — |
| net | — | 2 (tesuji) | — |
| snapback | — | 2 (tesuji) | — |
| connect-and-cut | — (needs new lesson) | 5 (connection) | 3 (connection) |
| life-death-basics | eyes | 7 (life-death) | 3 (defense) |
| opening-principles | — (needs new lesson) | — | — |
| influence-territory | — | — | 3 (territory) |
| sente-gote | — | — | 3 (endgame) |
| invasion-reduction | — | — | 3 (invasion) |

**Gap analysis:** Tier 2 and 3 concepts need **5-7 new lessons** to cover:
- Ko Rule (with interactive ko fight)
- Atari & Escape  
- Ladders & Nets
- Connect & Cut
- Opening Principles (fuseki basics)
- Reading Practice (sequences)
- Sente & Initiative

These should be written as Phase 2-3 lesson content, using the same interactive lesson format from Phase 1.

---

*End of design document.*
