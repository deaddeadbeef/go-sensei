import type { Lesson } from './types';

export const LESSONS: Lesson[] = [
  {
    id: 'groups',
    title: 'What is a Group?',
    description: 'Connected stones form groups — the basic unit of Go.',
    icon: '🔗',
    steps: [
      {
        stones: [{ point: { x: 4, y: 4 }, color: 'black' }],
        highlights: [{ point: { x: 4, y: 4 }, color: 'green', label: 'One stone' }],
        text: 'A single stone on the board is the simplest group — a group of one.',
      },
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'black' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'green', label: 'Connected' },
          { point: { x: 5, y: 4 }, color: 'green', label: 'Connected' },
        ],
        text: 'When two stones are next to each other (horizontally or vertically), they form one group. These two black stones are connected.',
      },
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 5, y: 5 }, color: 'black' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'blue', label: 'Group 1' },
          { point: { x: 5, y: 5 }, color: 'blue', label: 'Group 2' },
        ],
        text: 'Diagonal stones are NOT connected. These are two separate groups — each alone.',
      },
      {
        stones: [
          { point: { x: 3, y: 4 }, color: 'black' },
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'black' },
          { point: { x: 5, y: 3 }, color: 'black' },
        ],
        highlights: [
          { point: { x: 3, y: 4 }, color: 'green' },
          { point: { x: 4, y: 4 }, color: 'green' },
          { point: { x: 5, y: 4 }, color: 'green' },
          { point: { x: 5, y: 3 }, color: 'green' },
        ],
        text: 'Groups can be any shape. All 4 of these stones are one group because each connects to at least one neighbor.',
      },
      {
        stones: [
          { point: { x: 3, y: 4 }, color: 'black' },
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'black' },
          { point: { x: 5, y: 3 }, color: 'black' },
          { point: { x: 6, y: 3 }, color: 'white' },
          { point: { x: 6, y: 4 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 3, y: 4 }, color: 'green', label: 'Black group' },
          { point: { x: 6, y: 3 }, color: 'red', label: 'White group' },
        ],
        text: 'Groups are always one color. The black stones form one group, the white stones form another. Groups compete for territory!',
      },
    ],
  },
  {
    id: 'liberties',
    title: 'Liberties: Breathing Room',
    description: 'Every group needs empty spaces next to it to survive.',
    icon: '💨',
    steps: [
      {
        stones: [{ point: { x: 4, y: 4 }, color: 'black' }],
        highlights: [
          { point: { x: 3, y: 4 }, color: 'green', label: 'Liberty' },
          { point: { x: 5, y: 4 }, color: 'green', label: 'Liberty' },
          { point: { x: 4, y: 3 }, color: 'green', label: 'Liberty' },
          { point: { x: 4, y: 5 }, color: 'green', label: 'Liberty' },
        ],
        text: 'Liberties are the empty points directly next to a stone (up, down, left, right). This stone has 4 liberties — the green dots.',
      },
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 3, y: 4 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 5, y: 4 }, color: 'green', label: 'Liberty' },
          { point: { x: 4, y: 3 }, color: 'green', label: 'Liberty' },
          { point: { x: 4, y: 5 }, color: 'green', label: 'Liberty' },
          { point: { x: 3, y: 4 }, color: 'red', label: 'Blocked' },
        ],
        text: 'When an opponent places a stone next to yours, it takes away one liberty. Now black has only 3 liberties. The red dot shows the blocked one.',
      },
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 3, y: 4 }, color: 'white' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 3 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 5 }, color: 'red', label: 'Last liberty!' },
        ],
        text: 'Three white stones surround black. Only ONE liberty remains! This is called "atari" — the stone is in danger of being captured.',
      },
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'black' },
          { point: { x: 3, y: 4 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 3 }, color: 'green', label: 'Liberty' },
          { point: { x: 4, y: 5 }, color: 'green', label: 'Liberty' },
          { point: { x: 5, y: 3 }, color: 'green', label: 'Liberty' },
          { point: { x: 5, y: 5 }, color: 'green', label: 'Liberty' },
          { point: { x: 6, y: 4 }, color: 'green', label: 'Liberty' },
        ],
        text: 'Connected stones SHARE liberties. These two black stones together have 5 liberties — more than either would alone. Connecting makes groups stronger!',
      },
    ],
  },
  {
    id: 'capture',
    title: 'Capturing Stones',
    description: 'Remove a group by filling all its liberties.',
    icon: '⚔️',
    steps: [
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 3, y: 4 }, color: 'white' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 3 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 5 }, color: 'red', label: 'Last liberty!' },
        ],
        text: 'Remember atari? This black stone has only one liberty left. If white plays on that last liberty...',
      },
      {
        stones: [
          { point: { x: 3, y: 4 }, color: 'white' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 3 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'green', label: 'Captured!' },
        ],
        text: 'The black stone is removed from the board! When a group has zero liberties, it is captured and taken off. White gets one prisoner.',
      },
      {
        stones: [
          { point: { x: 4, y: 3 }, color: 'black' },
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 4, y: 5 }, color: 'black' },
          { point: { x: 3, y: 3 }, color: 'white' },
          { point: { x: 3, y: 4 }, color: 'white' },
          { point: { x: 3, y: 5 }, color: 'white' },
          { point: { x: 5, y: 3 }, color: 'white' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 5, y: 5 }, color: 'white' },
          { point: { x: 4, y: 2 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 6 }, color: 'red', label: 'Last liberty!' },
        ],
        text: 'Bigger groups can be captured too. This group of 3 black stones has only one liberty left. The whole group lives or dies together.',
      },
      {
        stones: [
          { point: { x: 3, y: 3 }, color: 'white' },
          { point: { x: 3, y: 4 }, color: 'white' },
          { point: { x: 3, y: 5 }, color: 'white' },
          { point: { x: 5, y: 3 }, color: 'white' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 5, y: 5 }, color: 'white' },
          { point: { x: 4, y: 2 }, color: 'white' },
          { point: { x: 4, y: 6 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 3 }, color: 'green', label: 'Gone' },
          { point: { x: 4, y: 4 }, color: 'green', label: 'Gone' },
          { point: { x: 4, y: 5 }, color: 'green', label: 'Gone' },
        ],
        text: 'All three black stones are captured at once! In Go, you capture entire groups, not individual stones. This is why keeping your groups connected and with enough liberties is critical.',
      },
    ],
  },
  {
    id: 'territory',
    title: 'Territory: Claiming Land',
    description: 'Surround empty space to score points.',
    icon: '🏰',
    steps: [
      {
        stones: [
          { point: { x: 0, y: 0 }, color: 'black' },
          { point: { x: 1, y: 0 }, color: 'black' },
          { point: { x: 2, y: 0 }, color: 'black' },
          { point: { x: 2, y: 1 }, color: 'black' },
          { point: { x: 2, y: 2 }, color: 'black' },
        ],
        highlights: [
          { point: { x: 0, y: 1 }, color: 'green', label: 'Territory' },
          { point: { x: 1, y: 1 }, color: 'green', label: 'Territory' },
          { point: { x: 0, y: 2 }, color: 'green', label: 'Territory' },
          { point: { x: 1, y: 2 }, color: 'green', label: 'Territory' },
        ],
        text: 'Territory is empty space surrounded by your stones. Black has walled off a corner — those 4 green points are black\'s territory. Each point = 1 point at the end!',
      },
      {
        stones: [
          { point: { x: 0, y: 0 }, color: 'black' },
          { point: { x: 1, y: 0 }, color: 'black' },
          { point: { x: 2, y: 0 }, color: 'black' },
          { point: { x: 2, y: 1 }, color: 'black' },
          { point: { x: 2, y: 2 }, color: 'black' },
          { point: { x: 6, y: 6 }, color: 'white' },
          { point: { x: 7, y: 6 }, color: 'white' },
          { point: { x: 8, y: 6 }, color: 'white' },
          { point: { x: 6, y: 7 }, color: 'white' },
          { point: { x: 6, y: 8 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 0, y: 1 }, color: 'green', label: 'Black: 4 pts' },
          { point: { x: 7, y: 7 }, color: 'red', label: 'White: 4 pts' },
        ],
        text: 'Both players claim territory. Black owns the top-left corner (4 points), white owns the bottom-right corner (4 points). The player with more territory wins!',
      },
      {
        stones: [
          { point: { x: 0, y: 0 }, color: 'black' },
          { point: { x: 1, y: 0 }, color: 'black' },
          { point: { x: 2, y: 0 }, color: 'black' },
          { point: { x: 3, y: 0 }, color: 'black' },
          { point: { x: 4, y: 0 }, color: 'black' },
          { point: { x: 4, y: 1 }, color: 'black' },
          { point: { x: 4, y: 2 }, color: 'black' },
          { point: { x: 4, y: 3 }, color: 'black' },
          { point: { x: 4, y: 4 }, color: 'black' },
        ],
        highlights: [
          { point: { x: 1, y: 2 }, color: 'green', label: 'Big territory!' },
        ],
        text: 'Efficient walls claim more territory with fewer stones. This L-shaped wall uses the board edge as a natural boundary — free walls! Corner territory is the easiest to make.',
      },
    ],
  },
  {
    id: 'eyes',
    title: 'Eyes & Life',
    description: 'Two eyes make a group immortal.',
    icon: '👁️',
    steps: [
      {
        stones: [
          { point: { x: 0, y: 0 }, color: 'black' },
          { point: { x: 1, y: 0 }, color: 'black' },
          { point: { x: 2, y: 0 }, color: 'black' },
          { point: { x: 3, y: 0 }, color: 'black' },
          { point: { x: 0, y: 1 }, color: 'black' },
          { point: { x: 3, y: 1 }, color: 'black' },
          { point: { x: 0, y: 2 }, color: 'black' },
          { point: { x: 1, y: 2 }, color: 'black' },
          { point: { x: 2, y: 2 }, color: 'black' },
          { point: { x: 3, y: 2 }, color: 'black' },
        ],
        highlights: [
          { point: { x: 1, y: 1 }, color: 'green', label: 'Eye' },
          { point: { x: 2, y: 1 }, color: 'green', label: 'Eye' },
        ],
        text: 'An "eye" is an empty point completely surrounded by your own stones. This group has TWO eyes — the green dots. This group can NEVER be captured!',
      },
      {
        stones: [
          { point: { x: 0, y: 0 }, color: 'black' },
          { point: { x: 1, y: 0 }, color: 'black' },
          { point: { x: 2, y: 0 }, color: 'black' },
          { point: { x: 3, y: 0 }, color: 'black' },
          { point: { x: 0, y: 1 }, color: 'black' },
          { point: { x: 3, y: 1 }, color: 'black' },
          { point: { x: 0, y: 2 }, color: 'black' },
          { point: { x: 1, y: 2 }, color: 'black' },
          { point: { x: 2, y: 2 }, color: 'black' },
          { point: { x: 3, y: 2 }, color: 'black' },
          { point: { x: 4, y: 0 }, color: 'white' },
          { point: { x: 4, y: 1 }, color: 'white' },
          { point: { x: 4, y: 2 }, color: 'white' },
          { point: { x: 0, y: 3 }, color: 'white' },
          { point: { x: 1, y: 3 }, color: 'white' },
          { point: { x: 2, y: 3 }, color: 'white' },
          { point: { x: 3, y: 3 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 1, y: 1 }, color: 'green', label: 'Safe!' },
          { point: { x: 2, y: 1 }, color: 'green', label: 'Safe!' },
        ],
        text: 'Even completely surrounded by white, this black group is alive! White cannot play inside either eye (it would have zero liberties = suicide). Two eyes = permanent life.',
      },
      {
        stones: [
          { point: { x: 0, y: 0 }, color: 'black' },
          { point: { x: 1, y: 0 }, color: 'black' },
          { point: { x: 2, y: 0 }, color: 'black' },
          { point: { x: 0, y: 1 }, color: 'black' },
          { point: { x: 2, y: 1 }, color: 'black' },
          { point: { x: 0, y: 2 }, color: 'black' },
          { point: { x: 1, y: 2 }, color: 'black' },
          { point: { x: 2, y: 2 }, color: 'black' },
          { point: { x: 3, y: 0 }, color: 'white' },
          { point: { x: 3, y: 1 }, color: 'white' },
          { point: { x: 3, y: 2 }, color: 'white' },
          { point: { x: 0, y: 3 }, color: 'white' },
          { point: { x: 1, y: 3 }, color: 'white' },
          { point: { x: 2, y: 3 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 1, y: 1 }, color: 'red', label: 'Only one eye!' },
        ],
        text: 'Danger! This group has only ONE eye. White can eventually fill the outside liberties and then play inside the eye — killing the whole group. One eye is NOT enough to live.',
      },
      {
        stones: [],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'green', label: 'Remember!' },
        ],
        text: 'The most important rule in Go: groups need TWO eyes to live permanently. When building your groups, always think about whether they can make two eyes. This is the foundation of life & death!',
      },
    ],
  },
  {
    id: 'ko',
    title: 'Ko: The Eternal Fight',
    description: 'A special rule prevents infinite loops.',
    icon: '♾️',
    steps: [
      {
        stones: [
          { point: { x: 3, y: 3 }, color: 'black' },
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 3, y: 5 }, color: 'black' },
          { point: { x: 4, y: 3 }, color: 'white' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'green', label: 'Black' },
          { point: { x: 3, y: 4 }, color: 'red', label: 'Empty' },
        ],
        text: 'This position creates a "ko." Black has one stone at the center, and white surrounds it on three sides. The empty point to the left is key.',
      },
      {
        stones: [
          { point: { x: 3, y: 3 }, color: 'black' },
          { point: { x: 3, y: 5 }, color: 'black' },
          { point: { x: 4, y: 3 }, color: 'white' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
          { point: { x: 3, y: 4 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'green', label: 'Captured!' },
        ],
        text: 'White plays at the empty point and captures black\'s stone! But now white\'s new stone has only one liberty...',
      },
      {
        stones: [
          { point: { x: 3, y: 3 }, color: 'black' },
          { point: { x: 3, y: 5 }, color: 'black' },
          { point: { x: 4, y: 3 }, color: 'white' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
          { point: { x: 3, y: 4 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'red', label: 'Ko rule!' },
        ],
        text: 'Black CANNOT immediately recapture — that would recreate the exact same position forever! This is the "ko rule." Black must play elsewhere first (a "ko threat"), then come back.',
        prompt: 'Where is black NOT allowed to play right now?',
        expectedMove: { x: 4, y: 4 },
        wrongMoveHint: 'The ko rule forbids recapturing immediately — look at the spot where black\'s stone was just taken.',
      },
      {
        stones: [
          { point: { x: 3, y: 3 }, color: 'black' },
          { point: { x: 3, y: 5 }, color: 'black' },
          { point: { x: 7, y: 7 }, color: 'black' },
          { point: { x: 4, y: 3 }, color: 'white' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
          { point: { x: 3, y: 4 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 7, y: 7 }, color: 'blue', label: 'Ko threat' },
          { point: { x: 4, y: 4 }, color: 'green', label: 'Now legal!' },
        ],
        text: 'Black played a "ko threat" elsewhere — a move that demands a response. After white responds to the threat, the board has changed, so black CAN now recapture the ko!',
      },
      {
        stones: [
          { point: { x: 3, y: 3 }, color: 'black' },
          { point: { x: 3, y: 5 }, color: 'black' },
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 7, y: 7 }, color: 'black' },
          { point: { x: 4, y: 3 }, color: 'white' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'green', label: 'Recaptured!' },
        ],
        text: 'Black recaptures! Now it\'s white\'s turn to find a ko threat or give up the ko. Ko fights are some of the most exciting moments in Go — the side with more threats wins!',
        prompt: 'Click the stone that black just recaptured with.',
        expectedMove: { x: 4, y: 4 },
        wrongMoveHint: 'Look for the black stone that was just placed back in the ko position.',
      },
    ],
  },
  {
    id: 'ladder',
    title: 'The Ladder',
    description: 'Chase a stone in a zigzag toward the edge.',
    icon: '🪜',
    steps: [
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'red', label: 'In atari!' },
          { point: { x: 3, y: 4 }, color: 'green', label: 'Escape?' },
          { point: { x: 4, y: 3 }, color: 'green', label: 'Escape?' },
        ],
        text: 'Black\'s stone is in atari (one liberty left). If black tries to run, white can chase it in a zigzag pattern called a "ladder" (shicho).',
      },
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 4, y: 3 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
          { point: { x: 5, y: 3 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 3 }, color: 'blue', label: 'Ran here' },
          { point: { x: 5, y: 3 }, color: 'red', label: 'Chased!' },
          { point: { x: 3, y: 3 }, color: 'green', label: 'Run again?' },
        ],
        text: 'Black ran, but white keeps chasing. Each time black extends, white puts it in atari again. The zigzag pattern continues toward the edge...',
      },
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 4, y: 3 }, color: 'black' },
          { point: { x: 3, y: 3 }, color: 'black' },
          { point: { x: 3, y: 2 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
          { point: { x: 5, y: 3 }, color: 'white' },
          { point: { x: 4, y: 2 }, color: 'white' },
          { point: { x: 3, y: 1 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 3, y: 2 }, color: 'red', label: 'Atari!' },
        ],
        text: 'The chase continues in a staircase pattern. Black keeps running but can never gain a third liberty. Eventually the edge of the board stops the run.',
        prompt: 'Where should white play to continue the ladder chase?',
        expectedMove: { x: 2, y: 2 },
        wrongMoveHint: 'Follow the zigzag — white needs to put black in atari again diagonally.',
      },
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 4, y: 3 }, color: 'black' },
          { point: { x: 3, y: 3 }, color: 'black' },
          { point: { x: 3, y: 2 }, color: 'black' },
          { point: { x: 1, y: 5 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
          { point: { x: 5, y: 3 }, color: 'white' },
          { point: { x: 4, y: 2 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 1, y: 5 }, color: 'blue', label: 'Breaker!' },
        ],
        text: 'But wait! If a friendly stone sits in the ladder\'s path, the running stones connect to it and escape! This is a "ladder breaker." Before starting a ladder, always check the path is clear!',
      },
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'white' },
          { point: { x: 4, y: 5 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 5, y: 3 }, color: 'green', label: 'Net here' },
        ],
        text: 'When the ladder is broken, use a "net" instead. A net loosely surrounds the stone so it can\'t escape in any direction — we\'ll learn about nets next!',
        prompt: 'If the ladder is broken, where could white play a net to capture?',
        expectedMove: { x: 5, y: 3 },
        wrongMoveHint: 'The net goes diagonally — one point away from the stone, cutting off its escape routes.',
        acceptRadius: 1,
      },
    ],
  },
  {
    id: 'net',
    title: 'The Net (Geta)',
    description: 'Surround a stone loosely — it cannot escape.',
    icon: '🥅',
    steps: [
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 5, y: 5 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'red', label: 'Target' },
          { point: { x: 5, y: 5 }, color: 'blue', label: 'Net stone' },
        ],
        text: 'A net (geta) captures by surrounding a stone loosely. Unlike a ladder that chases in a line, the net blocks all escape directions at once.',
      },
      {
        stones: [
          { point: { x: 4, y: 4 }, color: 'black' },
          { point: { x: 4, y: 5 }, color: 'white' },
          { point: { x: 5, y: 3 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'red', label: 'Trapped' },
          { point: { x: 4, y: 5 }, color: 'green', label: 'Blocks down' },
          { point: { x: 5, y: 3 }, color: 'green', label: 'Blocks right' },
        ],
        text: 'White has two stones forming a net. Even though they don\'t touch the black stone, every direction black tries to run leads to capture.',
      },
      {
        stones: [
          { point: { x: 5, y: 4 }, color: 'black' },
          { point: { x: 5, y: 5 }, color: 'white' },
          { point: { x: 6, y: 3 }, color: 'white' },
          { point: { x: 4, y: 4 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 5, y: 4 }, color: 'red', label: 'Caught' },
        ],
        text: 'The beauty of the net: if black runs in one direction, white blocks the other. The stone is captured no matter what. Nets are more reliable than ladders because they can\'t be broken!',
        prompt: 'A black stone is at E5. Where would you place a white net stone to trap it?',
        expectedMove: { x: 5, y: 3 },
        wrongMoveHint: 'Think diagonally — the net stone should be placed so black can\'t escape in any direction.',
        acceptRadius: 1,
      },
      {
        stones: [],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'green', label: 'Remember!' },
        ],
        text: 'Nets beat ladders when: the ladder path has a breaker stone, or you\'re near a board edge. Always look for the net first — it\'s the safer capturing technique!',
      },
    ],
  },
  {
    id: 'snapback',
    title: 'Snapback',
    description: 'Sacrifice one stone to capture many.',
    icon: '🪤',
    steps: [
      {
        stones: [
          { point: { x: 3, y: 4 }, color: 'black' },
          { point: { x: 4, y: 3 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'black' },
          { point: { x: 4, y: 5 }, color: 'black' },
          { point: { x: 4, y: 4 }, color: 'white' },
          { point: { x: 3, y: 3 }, color: 'white' },
          { point: { x: 5, y: 3 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 4 }, color: 'red', label: '1 liberty!' },
          { point: { x: 4, y: 3 }, color: 'blue', label: 'Last lib' },
        ],
        text: 'White\'s center stone is almost captured — it has only one liberty left. But if white captures at that liberty, something tricky happens...',
      },
      {
        stones: [
          { point: { x: 3, y: 4 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'black' },
          { point: { x: 4, y: 5 }, color: 'black' },
          { point: { x: 4, y: 4 }, color: 'white' },
          { point: { x: 3, y: 3 }, color: 'white' },
          { point: { x: 5, y: 3 }, color: 'white' },
          { point: { x: 4, y: 3 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 3 }, color: 'green', label: 'Captured black!' },
        ],
        text: 'White captured black\'s stone at the key point. But now look — white\'s group of stones has only ONE liberty itself! Black can immediately snap back!',
      },
      {
        stones: [
          { point: { x: 3, y: 4 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'black' },
          { point: { x: 4, y: 5 }, color: 'black' },
          { point: { x: 4, y: 4 }, color: 'white' },
          { point: { x: 3, y: 3 }, color: 'white' },
          { point: { x: 5, y: 3 }, color: 'white' },
          { point: { x: 4, y: 3 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 4, y: 2 }, color: 'green', label: 'Snap back!' },
        ],
        text: 'This is the snapback! Black sacrificed one stone, white captured it, but now black can capture the ENTIRE white group by playing at its last liberty.',
        prompt: 'Where should black play to execute the snapback?',
        expectedMove: { x: 4, y: 2 },
        wrongMoveHint: 'Look for the single liberty of white\'s group — that\'s where black snaps back.',
      },
      {
        stones: [
          { point: { x: 3, y: 4 }, color: 'black' },
          { point: { x: 5, y: 4 }, color: 'black' },
          { point: { x: 4, y: 5 }, color: 'black' },
          { point: { x: 4, y: 2 }, color: 'black' },
        ],
        highlights: [
          { point: { x: 4, y: 3 }, color: 'green', label: 'All gone!' },
          { point: { x: 4, y: 4 }, color: 'green', label: 'All gone!' },
        ],
        text: 'Snap! Black captures the entire white group — sacrificing 1 stone to capture 4! The snapback is a powerful tesuji (tactical trick). Look for it whenever your opponent captures into a cramped position.',
      },
    ],
  },
  {
    id: 'territory-vs-influence',
    title: 'Territory vs Influence',
    description: 'The third line claims land, the fourth builds power.',
    icon: '⚖️',
    steps: [
      {
        stones: [
          { point: { x: 2, y: 2 }, color: 'black' },
          { point: { x: 2, y: 6 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 2, y: 2 }, color: 'green', label: '3rd line' },
          { point: { x: 2, y: 6 }, color: 'blue', label: '3rd line' },
        ],
        text: 'The third line from the edge (row 3 or 7 on a 9×9) is the "line of territory." Stones here hug the edge and claim solid, immediate territory.',
      },
      {
        stones: [
          { point: { x: 3, y: 3 }, color: 'black' },
          { point: { x: 3, y: 5 }, color: 'white' },
        ],
        highlights: [
          { point: { x: 3, y: 3 }, color: 'green', label: '4th line' },
          { point: { x: 3, y: 5 }, color: 'blue', label: '4th line' },
        ],
        text: 'The fourth line is the "line of influence." Stones here project power toward the center. They don\'t claim as much immediate territory but influence a larger area.',
      },
      {
        stones: [
          { point: { x: 2, y: 4 }, color: 'black' },
          { point: { x: 3, y: 4 }, color: 'black' },
        ],
        highlights: [
          { point: { x: 2, y: 4 }, color: 'green', label: 'Territory' },
          { point: { x: 3, y: 4 }, color: 'blue', label: 'Influence' },
        ],
        text: 'Compare: the 3rd-line stone secures about 5 points of edge territory. The 4th-line stone claims less edge territory but builds a wall of influence toward the center. Good Go means balancing both!',
        prompt: 'Which position would you play for solid territory?',
        expectedMove: { x: 2, y: 4 },
        wrongMoveHint: 'Territory means hugging the edge — the 3rd line (closer to the edge) is the territory line.',
      },
      {
        stones: [
          { point: { x: 3, y: 0 }, color: 'black' },
          { point: { x: 3, y: 1 }, color: 'black' },
          { point: { x: 3, y: 2 }, color: 'black' },
          { point: { x: 3, y: 3 }, color: 'black' },
          { point: { x: 3, y: 4 }, color: 'black' },
        ],
        highlights: [
          { point: { x: 1, y: 2 }, color: 'green', label: 'Territory' },
          { point: { x: 5, y: 2 }, color: 'blue', label: 'Influence' },
        ],
        text: 'A wall of stones radiates influence! This 4th-line wall doesn\'t just claim territory on one side — it projects enormous power. Opponents who invade near this wall will struggle to survive.',
      },
      {
        stones: [
          { point: { x: 3, y: 0 }, color: 'black' },
          { point: { x: 3, y: 1 }, color: 'black' },
          { point: { x: 3, y: 2 }, color: 'black' },
          { point: { x: 3, y: 3 }, color: 'black' },
          { point: { x: 3, y: 4 }, color: 'black' },
        ],
        highlights: [
          { point: { x: 6, y: 4 }, color: 'green', label: 'Play away!' },
        ],
        text: 'Key Go proverb: "Play AWAY from your thickness (strong wall)." Don\'t make territory right next to your wall — use it to attack opponents elsewhere. The wall does its job by existing!',
        prompt: 'Where should black play next — near the wall or far from it?',
        expectedMove: { x: 6, y: 4 },
        wrongMoveHint: 'Remember: play AWAY from thickness! Choose the point far from your wall.',
        acceptRadius: 2,
      },
    ],
  },
];
