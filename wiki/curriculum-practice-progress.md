# Curriculum, Practice, and Progress Model

The learning model turns Go study into an evidence loop. Lessons introduce ideas, problems make the learner apply them, review schedules them for recall, and concept mastery summarizes what the learner has actually practiced.

## What The Model Optimizes For

Go Sensei should not merely count clicks or completed pages. It should answer:

- Which Go ideas has this learner seen?
- Which ideas have they proved through board interaction?
- Which problem patterns are due for recall?
- Which missed or slow problems need repair before new material?
- Which activity is the best next step?

The model is intentionally simple enough to inspect in local state, tests, and UI surfaces.

## Curriculum Data

Lessons live in [src/lib/lessons/lesson-data.ts](../src/lib/lessons/lesson-data.ts). Each lesson is structured as steps with board stones, highlights, text, optional prompts, expected moves, and wrong-move hints.

Current lesson themes include:

- Groups
- Liberties
- Capture
- Territory
- Eyes and life
- Ko
- Ladder
- Net
- Snapback
- Territory vs influence

The lesson format is important because it allows curriculum to stay board-native. A lesson can explain a concept and immediately ask the learner to identify or play the key point.

## Problem Data

Problems live in [src/lib/problems/problem-data.ts](../src/lib/problems/problem-data.ts). A problem includes:

- Stable id and title.
- Category and difficulty.
- Board size.
- Description and hint.
- Player color.
- Setup stones.
- Solution tree with correct and incorrect branches.

The solution tree allows multi-move reading sequences, not just single-answer flashcards. The runtime can apply moves, responses, captures, and failure states while keeping the visible board honest.

Problem categories currently include:

| Category | Purpose |
| --- | --- |
| `capture` | Learn liberties, atari, ladders, snapback, and basic captures. |
| `life-and-death` | Learn eyes, vital points, killing, and living. |
| `tesuji` | Learn tactical techniques such as throw-ins and placements. |
| `reading` | Learn to calculate short variations. |
| `endgame` | Learn sente, point value, and late-game priorities. |

Key source:

- [src/lib/problems/runtime.ts](../src/lib/problems/runtime.ts)
- [src/lib/problems/validator.ts](../src/lib/problems/validator.ts)
- [src/lib/problems/solution-review.ts](../src/lib/problems/solution-review.ts)

## Concept Mastery

Concept mastery is stored by concept id, level, last seen time, encounter count, and an evidence score. It is managed in [src/stores/concept-store.ts](../src/stores/concept-store.ts).

The store accepts evidence types such as:

- `lesson_completed`
- `problem_solved`
- `problem_failed`
- `review_solved`
- `review_failed`
- `guided_insight`
- `ai_tag_success`
- `ai_tag_mistake`

Positive evidence raises the evidence score and can move a concept through mastery levels. Failures still count as encounters but do not inflate mastery. This keeps the skill tree from pretending that exposure is the same as competence.

Concept definitions and prerequisites live in [src/lib/concepts/concept-data.ts](../src/lib/concepts/concept-data.ts).

## Review Scheduling

Review uses an SM-2-style spaced repetition card per problem in [src/lib/review/sm2.ts](../src/lib/review/sm2.ts).

Each card tracks:

- Ease factor.
- Interval in days.
- Repetition count.
- Next review timestamp.

Problem attempts convert to quality grades:

| Attempt result | Quality |
| --- | --- |
| Failed | 1 |
| Solved first try without hint | 5 |
| Solved first try with hint | 4 |
| Solved after mistakes | 3 |

The review store persists cards and history in [src/stores/review-store.ts](../src/stores/review-store.ts), then exposes due problems, due count, and review stats for the learning path, dashboard, skill tree, and review UI.

## Recommendation Engine

The recommendation engine is [src/lib/learning-path/recommendations.ts](../src/lib/learning-path/recommendations.ts). It consumes:

- Completed lesson ids.
- Problem attempts.
- Due review count.
- Whether the intro game has started.
- Concept mastery.

Its output is one recommendation with:

- `kind`
- Title.
- Reason.
- Focus concepts.
- Action label.
- Finish line.
- Practice plan.

The current recommendation types are:

- `guided_intro`
- `lesson`
- `problem`
- `review`
- `guided_game`

The important behavioral rule is that due review beats new material. After review, the engine favors repair of recent missed or slow problems, then path progression.

## Progress Stores

Progress is split across small Zustand stores:

| Store | Responsibility |
| --- | --- |
| [src/stores/progress-store.ts](../src/stores/progress-store.ts) | Completed lessons and problem attempts. |
| [src/stores/review-store.ts](../src/stores/review-store.ts) | Spaced repetition cards and review history. |
| [src/stores/concept-store.ts](../src/stores/concept-store.ts) | Concept mastery and prerequisites. |
| [src/stores/game-store.ts](../src/stores/game-store.ts) | Active board, app phase, problem and lesson interaction, overlays, and chat state. |

This separation is useful because product surfaces can read the progress they need without embedding curriculum logic in every component.

## Progress Surfaces

Learners see the model through:

- Learning path recommendations.
- Lesson completion.
- Problem category progress.
- Daily review due cards.
- Dashboard stats.
- Skill tree mastery.
- Local study-plan answers from the tutor.

Key source:

- [src/components/hub/LearningPath.tsx](../src/components/hub/LearningPath.tsx)
- [src/components/dashboard/ProgressDashboard.tsx](../src/components/dashboard/ProgressDashboard.tsx)
- [src/components/concepts/SkillTree.tsx](../src/components/concepts/SkillTree.tsx)
- [src/lib/coaching/local-study-plan-answer.ts](../src/lib/coaching/local-study-plan-answer.ts)

## What Future Work Should Preserve

- Recommendations should stay explainable from learner state.
- Review should remain concrete by naming due positions where space allows.
- Problem attempts should mutate progress only for known problem ids.
- Concept mastery should require evidence, not just exposure.
- New curriculum should map to problem categories and concept ids.
- Dashboard and skill tree should route to the actual next practice action, not just display metrics.
