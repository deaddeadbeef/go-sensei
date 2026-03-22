import { TeachingLevel } from './system-prompt';

// =============================================================================
// A. OPENING PRINCIPLES (Fuseki)
// =============================================================================

const OPENING_PRINCIPLES = {
  beginner: `- Corners first, then sides, then center — corners are the most efficient for territory (only 2 walls needed)
- Play on the 3rd and 4th lines: 3rd line secures territory, 4th line builds influence
- Star point (4-4, hoshi) = influence-oriented; 3-4 (komoku) = territory-oriented; 3-3 (san-san) = immediate corner territory
- Never play on the 1st or 2nd line in the opening — far too small
- Extend from your corner stones along the side to claim territory
- Each opening move should be worth roughly 10-15 points`,

  intermediate: `- Shimari (corner enclosures): 3-4 + 5-3, 3-4 + 6-3, or 4-4 + 3-6 — these secure corners efficiently
- Kakari (approach moves): approach an opponent's lone corner stone before they enclose it
- Framework building (moyo): balance making territory with building influence walls
- Speed vs. solidity: fast extensions claim more but leave weaknesses; solid shapes claim less but are hard to invade
- Common fuseki patterns: Chinese opening (two star points + side extension), Sanrensei (three star points on one side)
- Direction of play: always play away from your own thickness — use it for attacking, not territory`,

  advanced: `- Whole-board thinking: every move exists in a global context — local "best moves" may be globally wrong
- Oba (big points): evaluate the largest remaining moves on the board; the biggest open area is usually the priority
- Tenuki (playing elsewhere): ignore a local situation when a bigger move exists elsewhere — this requires accurate reading
- Thickness utilization: "don't use thickness to make territory directly" — use it to attack and profit elsewhere
- Framework erasure timing: invade when the opponent's moyo is still open; reduce from the outside when it's nearly closed`,
};

// =============================================================================
// B. SHAPE AND EFFICIENCY
// =============================================================================

const SHAPE_PRINCIPLES = {
  beginner: `- Good shapes: ponnuki (diamond after capture — worth ~30 points), diagonal, bamboo joint, knight's move, one-point jump
- Bad shapes: empty triangle (3 stones in L with no adjacent enemy stone = wasteful), dumpling/clump (stones piled without efficiency)
- "Ponnuki is worth 30 points" — capturing one stone to make a ponnuki radiates influence in all directions
- Connected stones are stronger than scattered ones — keep your groups linked
- A diagonal connection can theoretically be cut, but it's usually efficient shape`,

  intermediate: `- Tiger's mouth (hanging connection): flexible, hard to cut, and threatens a capture — one of the best defensive shapes
- "Hane at the head of two stones is worth a thousand moves" — extending your hane over two opponent stones dominates shape
- Belly attachment: attaching underneath an opponent's stone to steal their base
- Thick vs. thin shapes: thick shapes have no weaknesses; thin shapes have cutting points or shortage of liberties
- Cutting and connecting: cut when your opponent's stones are weak on both sides; connect when being cut would create two weak groups
- Nobi (solid extension) vs. one-point jump: nobi is safe but slow; the jump is fast but can be cut under pressure`,

  advanced: `- Sabaki: making light, flexible shape inside enemy territory — sacrifice stones freely to get a living shape
- Shinogi: surviving with a thin, weak group through resourceful shape moves — the art of not dying
- Aji (latent potential): stones that are "dead" can still have aji — don't remove your own aji by playing unnecessary moves
- Miai: when two points are equivalent in value, either one is fine — the opponent can only take one
- Double hane at the head of two: extremely powerful but requires careful reading to avoid a cutting counterattack`,
};

// =============================================================================
// C. GO PROVERBS (mapped to situations)
// =============================================================================

const GO_PROVERBS = {
  beginner: `- "Corners, sides, center" — always prioritize corners in the opening, then sides, then center
- "There is death in the hane" — a hane (diagonal contact at the edge of a group) can be a killing move
- "Even a moron connects against a peep" — when your opponent peeps at your cutting point, always connect
- "Ponnuki is worth 30 points" — capturing one stone to form the diamond shape is enormously valuable
- "Don't try to cut bamboo joints" — the bamboo joint (two-point jump with two stones) cannot be cut
- "In a ko, the first to play tenuki loses" — respect ko fights; ignoring them gives the opponent a free capture`,

  intermediate: `- "Hane at the head of two is worth a thousand moves" — dominating the head of an opponent's group is huge
- "Play away from thickness" — don't crowd your own strong groups; they already have influence
- "Don't use thickness to make territory" — use thickness for attacking; making territory near it is inefficient
- "Answer a shoulder hit with a diagonal" — the standard response to a shoulder hit (tsuke on the 4th line)
- "Make a fist before striking" — strengthen your own weaknesses before launching an attack
- "If you don't know what to do, tenuki" — sometimes the best local move is to play somewhere bigger
- "Urgent moves before big moves" — fix critical weaknesses before grabbing large open points`,

  advanced: `- "Lose your first 50 games as quickly as possible" — for the student: learning requires losing; play fast, fail fast
- "A rich man doesn't pick fights" — when ahead in territory, play safe and simple; don't create complications
- "Strange things happen at the 1-2 point" — edge and corner tesuji at the 1-2 point can be surprising
- "The enemy's key point is your key point" — the point that's best for your opponent is often best for you too
- "Don't attach to weak stones" — attaching to a weak stone strengthens it by forcing a response; attack from a distance
- "On the boundary between two moyos, there's a point of maximum profit" — the frontier between frameworks is the biggest area`,
};

// =============================================================================
// D. TACTICAL PATTERNS (Tesuji)
// =============================================================================

const TACTICAL_PATTERNS = {
  beginner: `- Ladder (shicho): chasing a group in a zigzag toward the edge — works unless a "ladder breaker" stone exists along the path
- Net (geta): capturing by surrounding a stone loosely so it can't escape — more reliable than a ladder
- Snapback: sacrificing one stone so the opponent fills their own liberty, then you capture a larger group
- Double atari: placing one stone that puts two separate opponent groups in atari simultaneously — one must die
- Throw-in: sacrificing a stone inside an opponent's eye space to reduce their liberties`,

  intermediate: `- Squeeze tesuji: forcing the opponent to capture a stone, then using that capture to gain a huge positional advantage
- Clamp: placing a stone between two opponent stones — powerful in endgame and attacking positions
- Cross-cut: "when you cross-cut, extend" — the standard response; extending builds better shape than capturing
- Under-the-stones: capturing a group, then allowing recapture, to play a move that was previously impossible
- Placement tesuji: a first-line stone that threatens to connect underneath or destroy eye shape
- Reading: calculate if-then sequences at least 3-5 moves ahead before playing tactical moves`,

  advanced: `- Shortage of liberties (damezumari): engineering positions where the opponent's group runs out of liberties at a critical moment
- Ko threats and ko fighting strategy: count ko threats before starting a ko; the side with more threats wins
- Semeai (capturing race): count liberties of both groups; approach from the outside to maximize your own liberties
- Sente and gote: sente moves force a response; double sente endgame moves are the most valuable moves on the board
- Probes: forcing moves that make the opponent reveal their plan before you commit to a strategy`,
};

// =============================================================================
// E. LIFE AND DEATH (Tsumego)
// =============================================================================

const LIFE_AND_DEATH = {
  beginner: `- Two eyes = unconditionally alive — the opponent can never capture your group
- A group needs at least two separate internal spaces (eyes) to live
- False eyes: an "eye" where the surrounding stones aren't fully connected — the opponent can fill it
- Corner and edge groups need less space to make two eyes than center groups
- Big eye shapes: L-group (lives), T-group (lives), bulky five (lives with correct play), rabbity six (dead with correct opponent play)
- If in doubt, play inside an opponent's eye space to test if their group is alive`,

  intermediate: `- Kill by reducing eye space: play at the vital point inside the opponent's group to prevent two eyes
- Status categories: alive (two eyes), dead (cannot make two eyes), unsettled (can live or die depending on who plays first), seki (mutual life)
- Seki: neither player can capture the other without losing their own group — both live with no territory
- Bent four in the corner is dead (under Japanese rules, no ko needed; under Chinese rules, resolved as ko)
- One-eye vs. no-eye capturing races: the group with one eye wins if liberties are equal
- Nakade: the vital point inside a big eye shape that prevents it from forming two eyes (e.g., center of a bulky five)`,

  advanced: `- Complex seki positions: recognizing when an apparent kill leads to seki and adjusting strategy
- Approach-move ko vs. direct ko: approach-move ko requires extra moves before the ko can be taken
- Mannen ko (ten-thousand year ko): a ko position that neither side wants to start because the ko threats are too costly
- Deep life-and-death reading: accurate 10+ move sequences are required for complex corner positions
- Optimal endgame around settled groups: squeezing maximum points from groups whose life/death status is resolved`,
};

// =============================================================================
// F. MIDDLE GAME STRATEGY
// =============================================================================

const MIDDLE_GAME = {
  beginner: `- Keep your groups connected — getting cut into separate weak groups is often fatal
- Attack weak groups: groups with few liberties and no eyes are targets
- Run toward the center when your group is weak — the center offers the most escape routes
- Don't follow your opponent everywhere — if they play a small move, take a big point elsewhere
- Recognize when to fight (your groups are stronger) vs. when to settle (make safe shape and move on)`,

  intermediate: `- Attacking strategy: don't try to kill — profit while attacking by building territory or influence on the side
- Leaning attack: push the opponent's strong group to build strength, then use that strength against their weak group
- Cap and shoulder hit: capping (playing directly above) and shoulder hitting (diagonal contact) are reduction techniques
- When to invade vs. when to reduce: invade deep when there's room to live; reduce from outside when the area is too solid
- Managing multiple weak groups: stabilize the weakest group first; letting two groups die is almost always fatal
- Sacrifice strategy: giving up a few stones to gain sente, build a wall, or capture something bigger`,

  advanced: `- Positional judgment: count territory mid-game to know whether to play aggressively or defensively
- Influence conversion: turn walls and outside thickness into attacks that generate territory elsewhere
- Timing of invasions: too early and your stones get killed; too late and the opponent's territory is too solid to break
- Multi-directional attack: profit on multiple sides of the board while chasing a single opponent group
- Thickness and thinness: recognize which groups are worth preserving and which should be sacrificed`,
};

// =============================================================================
// G. ENDGAME (Yose)
// =============================================================================

const ENDGAME = {
  beginner: `- Pass when there are no more useful moves — the game ends when both players pass consecutively
- Filling dame (neutral points) doesn't change the score but must be completed before counting
- Play big boundary moves before small ones — a move worth 5 points is better than one worth 1 point`,

  intermediate: `- Double sente endgame moves are the most valuable — both players want to play them, so grab them first
- Sente endgame before gote endgame: always take moves that force a response before moves that don't
- Hane-and-connect on the second line: a common endgame sequence worth 4-6 points
- Monkey jump: the large knight's move along the first line — often the single biggest endgame move available
- Territory counting: learn to estimate territory mid-game so you know whether you're winning or losing`,

  advanced: `- Precise endgame counting: miai counting (each move's value = half the swing) vs. deiri counting (full swing value)
- Fractional values: some endgame moves are worth 1/3, 2/3, etc. — precision matters when the score is close
- Ko endgame: when ko threats become the largest endgame moves; managing ko threat inventory
- Reverse sente: gote moves that prevent the opponent from playing a sente move — often more valuable than they appear
- Temperature theory basics: as moves get smaller, the board "cools down" — the player with more sente moves gains`,
};

// =============================================================================
// EXPORT: Level-gated knowledge assembly
// =============================================================================

export function getGoKnowledge(level: TeachingLevel): string {
  const sections: string[] = [
    '## GO KNOWLEDGE BASE',
    'Use this knowledge to teach accurately. Reference specific principles when evaluating moves.',
  ];

  const addSection = (title: string, source: Record<TeachingLevel, string>) => {
    sections.push('');
    sections.push(`### ${title}`);
    sections.push(source.beginner);

    if (level === 'intermediate' || level === 'advanced') {
      sections.push('');
      sections.push(source.intermediate);
    }

    if (level === 'advanced') {
      sections.push('');
      sections.push(source.advanced);
    }
  };

  addSection('OPENING PRINCIPLES (Fuseki)', OPENING_PRINCIPLES);
  addSection('SHAPE AND EFFICIENCY', SHAPE_PRINCIPLES);
  addSection('GO PROVERBS', GO_PROVERBS);
  addSection('TACTICAL PATTERNS (Tesuji)', TACTICAL_PATTERNS);
  addSection('LIFE AND DEATH (Tsumego)', LIFE_AND_DEATH);
  addSection('MIDDLE GAME STRATEGY', MIDDLE_GAME);
  addSection('ENDGAME (Yose)', ENDGAME);

  return sections.join('\n');
}
