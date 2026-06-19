# Go Engine and Application Architecture

Go Sensei is a Next.js app wrapped around a pure TypeScript Go engine. The architecture works because the rules engine, AI route, state stores, and UI overlays have clear responsibilities.

## Stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Pages and API routes. |
| UI | React 19 and Tailwind CSS | Interactive app surfaces. |
| Animation | Framer Motion | Stone drops, captures, highlights. |
| State | Zustand | Game, progress, review, and concept state. |
| Engine | Pure TypeScript | Go rules, scoring, serialization, influence. |
| AI | GitHub Copilot plus Responses API-compatible calls | Tutoring, move play, visual tool use. |
| Tests | Vitest and Testing Library | Unit, component, hook, store, and docs checks. |

## Application Shell

The main shell is [src/app/page.tsx](../src/app/page.tsx). It is a client component that:

- Selects the current app phase from the game store.
- Renders the phase-specific component.
- Runs the welcome or guided intro flow.
- Watches move history and asks the tutor to respond to player moves.
- Handles settings, board size, teaching level, pass, undo, new game, and review actions.

Most user-visible workflows are phase changes rather than routes. This keeps the board state, chat state, and learning surfaces in one app session.

## Go Engine

The engine public API is [src/lib/go-engine/index.ts](../src/lib/go-engine/index.ts). It exports:

- Board operations.
- Group detection.
- Liberty counting.
- Move validation.
- Capture application.
- Ko and suicide detection.
- Game lifecycle.
- Territory scoring.
- Board serialization and coordinate conversion.
- Influence computation.

Engine files:

| File | Responsibility |
| --- | --- |
| [src/lib/go-engine/types.ts](../src/lib/go-engine/types.ts) | Shared game, board, move, group, and scoring types. |
| [src/lib/go-engine/board.ts](../src/lib/go-engine/board.ts) | Board creation, cloning, adjacency, point keys, and hashes. |
| [src/lib/go-engine/groups.ts](../src/lib/go-engine/groups.ts) | Flood-fill group detection. |
| [src/lib/go-engine/liberties.ts](../src/lib/go-engine/liberties.ts) | Liberty counting and atari checks. |
| [src/lib/go-engine/rules.ts](../src/lib/go-engine/rules.ts) | Legal move validation, captures, ko, and suicide. |
| [src/lib/go-engine/game.ts](../src/lib/go-engine/game.ts) | Play, pass, resign, undo, finish, and opponent helpers. |
| [src/lib/go-engine/scoring.ts](../src/lib/go-engine/scoring.ts) | Chinese territory scoring helpers. |
| [src/lib/go-engine/serialization.ts](../src/lib/go-engine/serialization.ts) | Text board output and Go coordinate conversion. |
| [src/lib/go-engine/influence.ts](../src/lib/go-engine/influence.ts) | Distance-based influence and moyo computation. |

The engine is dependency-free, which lets the client, server route, tests, problem runtime, and local coaching use the same rules.

## State Stores

State is split by domain:

| Store | File | Role |
| --- | --- | --- |
| Game | [src/stores/game-store.ts](../src/stores/game-store.ts) | Active board, move history, overlays, chat, phase routing, guided state, lesson and problem interaction. |
| Progress | [src/stores/progress-store.ts](../src/stores/progress-store.ts) | Completed lessons and problem attempt history. |
| Review | [src/stores/review-store.ts](../src/stores/review-store.ts) | SM-2 cards, review history, due problems, stats. |
| Concepts | [src/stores/concept-store.ts](../src/stores/concept-store.ts) | Concept mastery, evidence, prerequisites, and stats. |

The persisted stores use `localStorage` through Zustand middleware. The game store also owns volatile UI state such as overlays and current interaction state.

## Board And Overlay UI

The board UI is composed from [src/components/board/](../src/components/board/):

- `BoardContainer`
- `GoBoard`
- Grid, stone, ghost, interaction, and coordinate layers.
- Overlays for highlights, suggestions, arrows, groups, influence, liberties, territory, ko, captures, dead stones, and beginner targets.

This layered approach is central to Go Sensei's teaching style. The tutor can point at a weak group, count liberties, draw a reading sequence, or preview a move without forcing the learner to parse text alone.

## Server-Side AI Boundary

The server chat route reconstructs board state and validates AI tool calls through the Go engine. This prevents the model from bypassing rules when it plays a move.

Key source:

- [src/app/api/chat/route.ts](../src/app/api/chat/route.ts)
- [src/lib/ai/tools.ts](../src/lib/ai/tools.ts)
- [src/lib/ai/format-board.ts](../src/lib/ai/format-board.ts)
- [src/lib/ai/system-prompt.ts](../src/lib/ai/system-prompt.ts)

The route is also the trust boundary for GitHub Copilot tokens and model calls.

## Tests

Tests are broad and organized around behavior:

- App navigation and recovery.
- Auth routes.
- Board and overlay components.
- Coaching and local answers.
- Concept mastery and skill tree.
- Dashboard.
- Game objective behavior.
- Go engine rules.
- Hooks.
- Learning path recommendations.
- Lessons.
- Problems.
- Review and review store.
- Store persistence and problem interaction.
- UI components.
- Release docs.

Source root: [__tests__/](../__tests__)

The release gate in `package.json` is:

```bash
npm run lint && npm run test:run && npm run build && npm audit --audit-level=high
```

## Release Architecture Status

The codebase is organized well enough for a 1.0.0 release candidate:

- Go rules are centralized in the pure TypeScript engine.
- AI tool calls are server-mediated and validated.
- Learning-state stores are separated by concern.
- The learning loop has tests across recommendations, review, problems, dashboard, and navigation.
- Release readiness has an explicit checklist and notes draft.

It is not yet tag-ready for `v1.0.0` because version metadata, production OAuth evidence, production smoke evidence, and final release-note evidence are still required by the release checklist.

## Future Work

Architecture improvements that would help the project mature:

- Add a documented end-to-end smoke path for the full beginner loop.
- Add production telemetry for auth failures, model failures, and tool-call failures.
- Keep README tool counts aligned with the actual chat route as functions evolve.
- Consider route-level tests around chat request validation and tool execution.
- Keep new UI surfaces driven by the same progress and recommendation model instead of duplicating path logic.
