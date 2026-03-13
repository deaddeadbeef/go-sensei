export type StoneColor = 'black' | 'white';
export type CellState = StoneColor | null;

export interface Point {
  x: number;
  y: number;
}

export type BoardSize = 9 | 13 | 19;

export interface BoardState {
  size: BoardSize;
  grid: CellState[][]; // grid[y][x] — row-major for easy serialization
}

export interface GameState {
  board: BoardState;
  currentPlayer: StoneColor;
  moveHistory: Move[];
  captures: { black: number; white: number }; // stones captured BY each color
  koPoint: Point | null; // position that can't be played this turn (simple ko)
  consecutivePasses: number;
  phase: 'playing' | 'scoring' | 'finished';
  komi: number; // 6.5 default for even game
  winner: StoneColor | 'draw' | null;
  positionHistory: Set<string>; // board hashes for superko detection
}

export type Move =
  | { type: 'place'; point: Point; color: StoneColor; captured: Point[] }
  | { type: 'pass'; color: StoneColor }
  | { type: 'resign'; color: StoneColor };

export interface MoveResult {
  success: true;
  newState: GameState;
  captured: Point[];
}

export interface MoveError {
  success: false;
  reason: string;
}

export type PlayResult = MoveResult | MoveError;

export interface Group {
  color: StoneColor;
  stones: Point[];
  liberties: Point[];
}

export interface TerritoryResult {
  blackTerritory: Point[];
  whiteTerritory: Point[];
  blackScore: number;
  whiteScore: number;
  finalBlackScore: number; // Chinese scoring: territory + stones on board
  finalWhiteScore: number; // Chinese scoring: territory + stones on board + komi
}
