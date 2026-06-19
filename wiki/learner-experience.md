# Learner Experience and Product Loop

Go Sensei is a teaching app first and a Go board second. The learner is not left to choose from a loose menu of features. The product loop keeps pointing them at one concrete next activity: start a guided board, complete a lesson, solve a problem, review due material, inspect progress, or play a guided game.

## Core Promise

The learner should always know:

- What to do next.
- Why that activity matters.
- What a successful finish line looks like.
- How the board position proves the idea.

This is why the app combines navigation, visible board goals, explanations, and progress evidence. The AI tutor can answer questions and play moves, but the product itself also has enough structure to keep learning moving when the AI is unavailable.

## Main App Phases

The main page renders one app phase at a time from [src/app/page.tsx](../src/app/page.tsx):

| Phase | Main component | Learner job |
| --- | --- | --- |
| `path` | `LearningPath` | Pick the recommended next activity. |
| `lessons` | `LessonPicker` | Browse structured concept lessons. |
| `lesson` | `LessonView` | Prove lesson ideas on a board checkpoint. |
| `problems` | `ProblemPicker` | Choose tactical practice by category. |
| `problem` | `ProblemView` | Solve an engine-backed problem line. |
| `skills` | `SkillTree` | Inspect concept mastery and prerequisites. |
| `review` | `DailyReview` | Clear due spaced-review cards. |
| `dashboard` | `ProgressDashboard` | See progress, weak spots, streaks, and next actions. |
| `game` | Board, controls, chat, teaching panels | Play Go with coaching and visual feedback. |

The important design decision is that these phases are not isolated tools. They are routes through one learning loop, and many surfaces route back to review or the learning path when that is the next best step.

## First Beginner Experience

For a complete beginner, the best path is:

1. Start from the learning path hub.
2. Enter a guided 9x9 intro game.
3. Follow one visible objective at a time.
4. Read move-level feedback and board highlights.
5. Move into lessons and problems after the learner has a board context.

The guided game is owned by the game store and coaching helpers, then shown through the board and objective components:

- [src/stores/game-store.ts](../src/stores/game-store.ts)
- [src/components/game/BeginnerObjectiveCard.tsx](../src/components/game/BeginnerObjectiveCard.tsx)
- [src/lib/coaching/beginner-objectives.ts](../src/lib/coaching/beginner-objectives.ts)

The first-run goal is modest: make Go feel playable, concrete, and spatial before asking the learner to study abstractions.

## Learning Path Hub

The hub is the product's traffic controller. It reads progress, due reviews, problem history, and concept mastery, then presents the next recommended action.

Key source:

- [src/components/hub/LearningPath.tsx](../src/components/hub/LearningPath.tsx)
- [src/lib/learning-path/recommendations.ts](../src/lib/learning-path/recommendations.ts)

The current recommendation priority is:

1. Due review before new material.
2. Repair a recent missed or slow problem.
3. First guided 9x9 if the learner has no progress yet.
4. First incomplete lesson.
5. Practice required by completed lessons.
6. Guided game once enough lessons and problems are complete.
7. Latest relevant practice if the formal path is exhausted.

This priority matters because it prevents the app from feeling like a static content library. The hub should behave like a coach choosing useful work.

## Lessons

Lessons teach core concepts through short steps with board positions, highlights, prompts, expected moves, and wrong-move hints.

Key source:

- [src/lib/lessons/lesson-data.ts](../src/lib/lessons/lesson-data.ts)
- [src/components/lessons/LessonPicker.tsx](../src/components/lessons/LessonPicker.tsx)
- [src/components/lessons/LessonView.tsx](../src/components/lessons/LessonView.tsx)

Lesson completion should create concept evidence. A lesson is not just read; the learner should prove the concept through interaction.

## Problems

Problems are tsumego-style board tasks backed by the real Go engine. The learner makes moves, the problem runtime applies responses, and captures or failures happen through board state rather than fake text.

Key source:

- [src/lib/problems/problem-data.ts](../src/lib/problems/problem-data.ts)
- [src/lib/problems/runtime.ts](../src/lib/problems/runtime.ts)
- [src/components/problems/ProblemPicker.tsx](../src/components/problems/ProblemPicker.tsx)
- [src/components/problems/ProblemView.tsx](../src/components/problems/ProblemView.tsx)

Problem categories currently include capture, life and death, tesuji, reading, and endgame. Attempts feed the progress store, review store, and learning path.

## Daily Review

Review keeps old problem patterns alive. Due review intentionally takes priority over new material in the learning path, skill tree, problem library, and dashboard.

Key source:

- [src/components/review/DailyReview.tsx](../src/components/review/DailyReview.tsx)
- [src/stores/review-store.ts](../src/stores/review-store.ts)
- [src/lib/review/sm2.ts](../src/lib/review/sm2.ts)
- [src/lib/review/due-review-preview.ts](../src/lib/review/due-review-preview.ts)

Recent learner-facing work made review previews specific by naming due positions, for example `Corner Capture` and `Make Two Eyes`, instead of showing only generic counts.

## Dashboard And Skill Tree

The dashboard summarizes progress and offers entrypoints back into practice. The skill tree frames the same progress as concept mastery and prerequisites.

Key source:

- [src/components/dashboard/ProgressDashboard.tsx](../src/components/dashboard/ProgressDashboard.tsx)
- [src/components/concepts/SkillTree.tsx](../src/components/concepts/SkillTree.tsx)
- [src/stores/concept-store.ts](../src/stores/concept-store.ts)

These surfaces should stay action-oriented. Their job is not just reporting; they should help the learner decide what to do next.

## Game Screen

The game phase combines:

- Board and overlays.
- Sensei bubble.
- Rules panel.
- Teaching panel.
- Chat log.
- Input box.
- Controls for pass, undo, new game, and review.
- Beginner objective card when guided mode is active.
- Score card and post-game review entrypoint.

Key source:

- [src/app/page.tsx](../src/app/page.tsx)
- [src/components/board/BoardContainer.tsx](../src/components/board/BoardContainer.tsx)
- [src/components/ui/SenseiBubble.tsx](../src/components/ui/SenseiBubble.tsx)
- [src/components/chat/SenseiChatLog.tsx](../src/components/chat/SenseiChatLog.tsx)
- [src/components/game/ScoreCard.tsx](../src/components/game/ScoreCard.tsx)

The board is the shared teaching surface. Text explains, but overlays point at liberties, groups, suggestions, influence, and sequences.

## Product Quality Bar

The learner experience is strongest when:

- The next action is named and reachable.
- Empty states explain what is actually true.
- Review previews name concrete positions.
- Missed work routes to repair, not shame.
- AI failures preserve a playable board and offer local guidance.
- The board state and progress state never disagree.

The current product is already coherent enough to feel like a release candidate. The remaining 1.0.0 question is less about the shape of the learner loop and more about production release evidence.
