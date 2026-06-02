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
- Added a quick "Show pressure" variation for completed one-space jumps so learners can compare attacking the cutter, defending a short side, or continuing outward without mutating the game.
- Added a non-mutating playable mini-branch inside the pressure variation so learners can choose a first reply and get immediate feedback while the real guided game stays intact.
- Added a second-step recount inside the pressure mini-branch so learners can simulate White entering the gap, choose a reply, then count liberties on both Black sides before returning to the real game.
- Preserved pressure mini-branch choices and second-read recounts in the chat transcript so the sidebar remembers the same teaching moments shown beside the board.
- Added transcript actions that reopen the exact pressure branch or second-read recount on the board, so earlier reading work is recoverable after the learner switches replies or scrolls the chat.
- Added a direct compare-other-reply loop in the pressure mini-branch so learners can switch from one recounted answer to the alternate reply and immediately see the new liberty counts without changing the real game.
- Added a side-by-side comparison summary after pressure replies are compared, so learners can see both liberty counts and the directional difference in one place.
- Added a concrete defensive recommendation when a pressure comparison reveals one Black side has fewer liberties, and made the second-read sentence stop claiming both sides are safe in that case.
- Marked the short side and its actual defensive liberties on the board when a pressure recount shows one Black side has fewer liberties.
- Added transcript actions that restore the full pressure comparison panel, recommendation, and short-side liberty markers instead of reopening only the final recount.
- Added a non-mutating "try a defense" continuation after short-side pressure recommendations so learners can choose a defensive liberty and see why it stabilizes the short side.
- Added defense-read transcript actions that restore the selected defensive liberty marker, so earlier defense trials reopen as the same board-side lesson instead of only the parent comparison.
- Added a post-defense recount to the non-mutating defense trial, so learners see how the chosen liberty changes the short-side liberty count before returning to the real game.
- Switched defense-trial board markers to the post-defense recount, so the board shows the stabilized side's actual liberties and flags the newly shorter side instead of stale pre-defense warnings.
- Added a replayable follow-up defense continuation when a successful defense makes the other side shorter, so learners can keep reading the new weak side without mutating the real game.
- Added a follow-up defense comparison summary that contrasts E8, E6, and F7 and explicitly names E6 as the move that connects both Black sides into one group.
- Added a stable-read handoff that turns equal pressure comparisons and resolved follow-up defenses into a concrete real-game extension button.
- Added a post-handoff "Read applied" recap that ties the real extension move back to the simulated pressure read before moving on to the next gap.
- Added a compact read-sequence recap inside the pressure mini-branch, preserving the original reply, comparison reply, defense/follow-up, and real-game handoff as numbered steps.
- Made read-sequence recap rows keyboard-focusable and hoverable, so each step can temporarily show its matching stones, liberties, defense, follow-up, or real-game handoff target on the board.

Next investigation candidates:
- Whether the pressure mini-branch should let learners pin a sequence step's board highlights, so they can study one reading position without holding hover or keyboard focus.
