// Go engine — pure TypeScript, zero dependencies

// Types
export type {
  StoneColor,
  CellState,
  Point,
  BoardSize,
  BoardState,
  GameState,
  Move,
  MoveResult,
  MoveError,
  PlayResult,
  Group,
  TerritoryResult,
} from './types';

// Board operations
export {
  createBoard,
  cloneBoard,
  getStone,
  setStone,
  isOnBoard,
  getAdjacentPoints,
  pointEquals,
  pointKey,
  boardHash,
} from './board';

// Group detection
export { getGroup, getAllGroups, getGroupAt } from './groups';

// Liberty counting
export {
  countLiberties,
  isInAtari,
  getLibertiesOf,
  wouldHaveLiberties,
} from './liberties';

// Rules and validation
export {
  isValidMove,
  findCaptures,
  applyCaptures,
  detectKo,
  isSuicide,
} from './rules';

// Game lifecycle
export {
  createGame,
  playMove,
  passMove,
  resignGame,
  undoMove,
  finishGame,
  getOpponent,
} from './game';

// Scoring
export { calculateTerritory, countStones, floodFillEmpty } from './scoring';

// Serialization
export { boardToText, pointToCoord, coordToPoint } from './serialization';

// Influence
export { computeInfluence } from './influence';
