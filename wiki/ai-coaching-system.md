# AI Coaching and Tutoring System

Go Sensei uses AI as a tutor, move partner, and visual teaching controller. The AI layer is powerful, but the app deliberately keeps board rules, local fallbacks, and progress state outside the model so the product remains playable and testable.

## Responsibilities

The AI system should:

- Explain Go in the learner's current teaching level.
- Make legal moves through server-validated tools.
- Point at board positions instead of relying only on text.
- Suggest repairs after mistakes.
- Trigger concept evidence when useful.
- Fall back gracefully when auth, network, or server calls fail.

It should not be the source of truth for Go legality. Legal moves, captures, ko, suicide, scoring, board reconstruction, and problem validation are owned by the Go engine and app code.

## Auth And Session Flow

The app uses GitHub OAuth Device Flow and GitHub Copilot session exchange.

Key source:

- [src/hooks/useGitHubAuth.ts](../src/hooks/useGitHubAuth.ts)
- [src/app/api/auth/device-code/route.ts](../src/app/api/auth/device-code/route.ts)
- [src/app/api/auth/poll/route.ts](../src/app/api/auth/poll/route.ts)
- [src/lib/ai/copilot-auth.ts](../src/lib/ai/copilot-auth.ts)

The learner logs in with GitHub. The client stores a GitHub token in session storage, then sends it to the chat API through `x-github-token`. The server exchanges that token for a Copilot session token before calling the model.

For production, [docs/release/1.0.0-readiness.md](../docs/release/1.0.0-readiness.md) requires a dedicated `GITHUB_OAUTH_CLIENT_ID`; the development fallback is not acceptable release configuration.

## Chat Route

The AI endpoint is [src/app/api/chat/route.ts](../src/app/api/chat/route.ts).

It does the following:

1. Parses and sanitizes the request body.
2. Reconstructs server-side game state from move history or a validated board snapshot.
3. Gets a Copilot session token.
4. Builds a system prompt for the current teaching level and guided context.
5. Calls the OpenAI Responses API-compatible endpoint for model `gpt-5.4`.
6. Executes function calls against server-side Go state.
7. Feeds tool outputs back into the model for up to five rounds.
8. Returns assistant text and tool results to the client.

The route has defensive parsing around chat history, board size, komi, move history, and tool arguments. Invalid move history returns a `400`; auth failures return a learner-safe `401`; other failures return a generic `500`.

## Tool Loop

The chat route exposes board-teaching tools in flat Responses API function format.

Current tools:

| Tool | Purpose |
| --- | --- |
| `make_move` | Place a legal stone after server validation. |
| `pass_turn` | Pass and advance game phase when needed. |
| `highlight_positions` | Mark educational points with visual styles. |
| `show_liberty_count` | Show liberties for a group. |
| `suggest_moves` | Show candidate moves and reasons. |
| `show_sequence` | Draw numbered arrows for reading lines. |
| `show_influence` | Compute and show influence heatmap. |
| `show_groups` | Expand group positions, liberties, and strength indicators. |
| `evaluate_concepts` | Tag concepts demonstrated in the current position. |

The README still describes "8 teaching tools" because `evaluate_concepts` is a learning-evidence tool rather than a direct visual teaching overlay. The chat route currently exposes nine functions total.

## Client Application Of Tool Results

The client hook [src/hooks/useGoMaster.ts](../src/hooks/useGoMaster.ts) sends moves and questions, receives tool results, and applies them to the store:

- Highlights.
- Liberty overlays.
- Suggestions.
- Arrows.
- Influence.
- Group overlays.
- AI moves.
- Concept encounters.
- Chat messages.

The game store then feeds those results into components under [src/components/board/](../src/components/board/), [src/components/ui/](../src/components/ui/), and [src/components/chat/](../src/components/chat/).

## System Prompt And Teaching Levels

The prompt builder is [src/lib/ai/system-prompt.ts](../src/lib/ai/system-prompt.ts). It supports teaching levels:

- `beginner`
- `intermediate`
- `advanced`
- `guided`

The main product promise is firm, concise coaching. Beginner and guided modes give more scaffolding; advanced mode should stay tighter and focus on the highest-value mistake, repair, and direction of play.

## Local Coaching And Fallbacks

Go Sensei has local coaching paths so the product is not fully blocked by AI availability.

Key source:

- [src/lib/coaching/local-guided-fallback.ts](../src/lib/coaching/local-guided-fallback.ts)
- [src/lib/coaching/local-question-answer.ts](../src/lib/coaching/local-question-answer.ts)
- [src/lib/coaching/local-study-plan-answer.ts](../src/lib/coaching/local-study-plan-answer.ts)
- [src/lib/coaching/sensei-actions.ts](../src/lib/coaching/sensei-actions.ts)

Local coaching handles useful cases such as:

- Guided beginner fallback turns.
- Study-plan answers from current progress.
- Game review answers that can be derived locally.
- Sensei action routing to lesson, problem, review, guided game, or learning path.

When AI calls fail, the hook can pass for White when needed so the board stays playable and then show a recovery message with a practical next step.

## Guided Context

The client builds guided context from:

- Concept mastery.
- Completed lessons.
- Problem attempts.
- Due review count.
- Whether the guided intro has started.
- Current beginner objective.
- Current board state.

This context is passed into the system prompt so the AI can speak to the learner's current path, not just the current stone.

## Safety Boundaries

Important boundaries:

- The AI proposes moves; the server validates legality.
- The server reconstructs board state from client move history before executing tools.
- Tool argument JSON parse failures are fed back to the model instead of silently applying bad inputs.
- Unknown or invalid concept ids are filtered before recording evidence.
- Auth failures are translated into recoverable learner-facing states.
- Production release requires dedicated OAuth config and smoke evidence.

## Future Work

The highest-value AI improvements are:

- Streaming responses, if it can preserve the tool loop and UI clarity.
- Stronger review summaries that cite exact board moments.
- Better concept tagging from both local and model-derived events.
- More local answers for common beginner questions.
- Tighter production observability around auth, tool-call failures, and model latency.
