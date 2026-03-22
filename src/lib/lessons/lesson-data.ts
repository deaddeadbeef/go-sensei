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
];
