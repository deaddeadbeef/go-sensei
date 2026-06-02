# Active Goal: AI Go Tutor Improvement

Objective: Keep improving this AI go tutor until it becomes truly inspiring and useful.

Current branch: `codex/go-sensei-learning-foundation`

Current PR: draft PR #24

Working approach:
- Keep changes learner-facing and evidence-driven.
- Probe local guided questions before adding new router behavior.
- Add focused failing tests before implementation.
- Verify with unit tests, static checks, build, and browser smoke when behavior reaches the UI.

Latest completed slice:
- Added local guided answers for second-objective questions around tenuki, playing away, sente, defending first, keeping the extension plan, and center play after a corner anchor.
- Verified the slice with the full unit suite, typecheck, lint, build, and browser smoke.
- Fixed guided-game routing so learning path, dashboard, and Sensei guided-game actions restore a true guided 9x9 board instead of returning to a stale non-guided game.
- Fixed the Sensei bubble typewriter so guided-game coaching text appears after React Strict Mode replays the initial effect.
- Added local attack-vs-defense decisions so guided learners get a board-specific priority call during simple fights.
- Added local capture-race guidance so beginner fight questions compare adjacent group liberties before giving a priority.
- Added occupied-cut guidance so a beginner sees both split Black groups, the White cutting stone, and the liberties to attack after White enters a one-space jump gap.
- Added local snapback guidance so the tutor explains the concept without cloud fallback and marks the immediate recapture point after White captures into a cramped shape.
- Added local late-fight follow-up routing so natural "what if White answers?" questions reuse the current snapback, occupied-cut, capture-race, or attack/defense board guidance instead of falling back to generic reply text.
- Added a plan-style occupied-cut follow-up so "what should I read next after this cut?" becomes a three-step beginner sequence: attack the cutting stone, recount both Black groups, then defend or keep filling White liberties.
- Added a plan-style capture-race follow-up so "what should I read next in this race?" teaches a count-save-recount routine when Black is behind on liberties.
- Hardened the action-routing UI tests so typewriter timing and Skill Tree animation scheduling no longer make the full suite retry-dependent.
- Added a plan-style snapback follow-up so "what should I read next after this snapback?" teaches capture-count-continue, marks every White group the snapback removes, and shows the post-capture liberty count.
- Added durable guided-board snapshots so the learning path can restore a paused guided 9x9 after session storage is lost, with learner-facing resume coaching.
- Made restored guided boards immediately playable and actionable by locally passing an interrupted White turn, restoring ranked board-analysis suggestions, and highlighting the last learner move.
- Added a compact board-side "What changed" recap after guided learner moves so the last-move lesson stays visible near the stones instead of only in the sidebar or chat.
- Added hover/focus explanations for guided objective target buttons so learners can see why a specific coordinate is suggested before playing it.
- Added transient board highlights for guided target explanations so hovering or focusing a coordinate also marks the target, anchor, gap, or weak group stones on the board.
- Added a compact board-side "Read next" prompt after completed one-space jumps so learners know which open gap to read before extending again.

Next investigation candidates:
- Whether the one-space-jump gap prompt should offer a quick White-in-the-gap variation so learners can compare connecting, defending, or continuing outward.
