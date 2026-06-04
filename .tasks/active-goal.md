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
- Let learners pin and unpin a read-sequence row's board highlights, so one reading position can stay visible while they study the branch.
- Reflected pinned read-sequence rows in transcript replay actions, so a learner can reopen the same branch with the last studied sequence step still pressed and highlighted.
- Added concise teaching summaries to sequence-focus transcript messages, so saved steps explain what to compare with the live branch or real-game handoff.
- Added a replay-only saved-read next-question prompt under restored sequence-focus rows, so learners know what to inspect after reopening a saved step.
- Added a one-click "Compare from here" continuation under restored baseline sequence rows, so learners can return from a saved D8 step to the live D6 comparison without hunting for the older branch control.
- Added a one-click "Play from here" continuation under restored handoff sequence rows, so a saved real-game handoff step can immediately become the actual extension move.
- Added one-click continuation controls under restored defense and follow-up sequence rows, so saved defensive reads can keep reading the new short side or hand off to the real extension without hunting through the full panel.
- Added direct "defense from here" controls under restored comparison sequence rows that reveal a short side, so a saved comparison can immediately become the defensive read it asks for.
- Refactored restored replay continuation controls into shared compact row and button helpers, keeping future replay actions easier to add without changing the learner-facing labels or behavior.
- Added concise tactical hints to restored multi-choice defense continuations, so saved comparison and follow-up reads explain whether each option grows liberties, levels the sides, or connects both stones before the learner clicks.
- Added hover/focus board previews for restored defense and follow-up continuations, so learners can inspect simulated outcome stones and liberties before committing to a replay branch.
- Added next-choice summaries to read-sequence focus transcript messages, so saved comparison and defense steps preserve the same tactical option hints even before the learner reopens the board-side continuation controls.
- Added direct safest-continuation transcript actions for saved comparison and defense focus messages, so learners can jump straight to the best defensive or connecting simulation from chat without reopening the board-side continuation panel first.
- Marked direct transcript continuations as recommended and appended the simulated reason, so learners see why C6 or E6 is the safest next click instead of treating the shortcut as an unexplained command.
- Added a deterministic pre-mount app shell so persisted lesson, review, auth, and game state cannot cause a server/client hydration mismatch before the browser chooses the learner's actual path.
- Added hover/focus board previews for recommended transcript shortcuts, so direct C6 and E6 chat actions now show the same simulated markers as the board-side continuation controls before the learner commits.
- Added hover/focus board previews for saved sequence-focus transcript actions, so Show step chat shortcuts reveal their exact D8, defense, or handoff markers before reopening a saved read.
- Added hover/focus board previews for pressure replay transcript actions, so Show branch, Show recount, Show comparison, Show defense, and Show follow-up reveal their restored markers before the learner clicks.
- Added a board-side restored-read cue after replaying pressure transcript actions, so saved chat context is visibly separate from the live branch and clears when the learner starts a fresh read.
- Delayed target hover/focus help just enough that a learner's first click on a guided target still plays the move instead of only opening the explanation.
- Added a one-click "Return to live read" control inside restored pressure reads, so learners can leave saved chat context and recover the live branch's text and board highlights.
- Added a compact transcript note after returning from restored pressure reads, so chat records when the learner leaves saved context and which live branch they returned to.
- Added a one-click "Reopen saved read" shortcut to return-to-live transcript notes, with hover/focus board previews that recover the same saved read or pinned step the learner just left.
- Rechecked the rendered D6 branch switch after browser smoke; active and restored D8 recount states both switch to D6 correctly, so the earlier concern was a smoke-observation artifact rather than a product bug.
- Added a compact saved-vs-live branch cue under restored pressure reads, so reopening a saved D8 recount while the live read is D6 plainly names both branches before the learner chooses where to continue.
- Extended restored-read orientation cues with the live branch's next action, so reopened recounts, comparisons, and defenses say whether the live read is waiting to recount, compare, or defend next.
- Added a stable-read handoff fallback to restored-read orientation cues, so reopening a saved branch after the live read has resolved now says which real move the live branch unlocked.
- Added a "Show live handoff" shortcut to return-to-live transcript notes when the live read has already unlocked a real-game handoff, with the same G7 preview marker as the board-side handoff row.
- Labeled restored-read navigation as "Live branch" and restored sequence prompts as "Saved read next question", so saved-context continuations and live-context exits are visually distinct in the same panel.
- Added saved/live branch badges to restored read-sequence rows when a saved comparison crosses branches, so each replayed step names whether it belongs to the saved branch or the live branch.
- Added saved/live branch labels to restored read-sequence focus messages in chat, so transcript notes match the branch context shown beside the board.
- Added a last-inspected sequence-step summary to return-to-live transcript notes, so learners know which saved or live row they just left when they resume the live branch.
- Restored the live branch's most specific sequence-row highlight when returning from saved reads, so a resolved live handoff lands on the G7 real-game move instead of broad recount markers.
- Renamed return-to-live saved-read actions with their branch coordinate and read type, so transcript buttons say exactly whether they reopen a D8 recount, D6 comparison, defense, or follow-up defense.
- Renamed top-level restored-read transcript actions with their saved coordinate and read type, so chat buttons now say "Show saved D6 comparison" or "Show saved C6 defense" instead of generic "Show comparison" or "Show defense".

Next investigation candidates:
- Whether pinned sequence-step transcript actions should name the saved/live row they restore, rather than the generic "Show step" label.
