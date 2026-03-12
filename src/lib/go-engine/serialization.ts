import type { BoardSize, GameState, Point } from './types';
import { getStone, pointEquals } from './board';

// Go convention: skip 'I' in column labels
const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST';

/**
 * Serializes the game state to a human-readable text format suitable for AI
 * consumption.
 */
export function boardToText(state: GameState): string {
  const { board, currentPlayer, moveHistory, captures, koPoint, komi } = state;
  const size = board.size;

  // Determine last move for marking with ★/☆
  const lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;
  const lastPlacePoint: Point | null =
    lastMove && lastMove.type === 'place' ? lastMove.point : null;
  const lastPlaceColor = lastMove && lastMove.type === 'place' ? lastMove.color : null;

  // Header
  const moveNumber = moveHistory.length;
  const lines: string[] = [];
  lines.push(
    `Current Board (${size}×${size}) — Move ${moveNumber}, ${capitalize(currentPlayer)} to play`
  );
  lines.push(`Captures: Black ${captures.black}, White ${captures.white}`);
  lines.push(`Komi: ${komi}`);
  lines.push(`Ko: ${koPoint ? pointToCoord(koPoint, size) : 'none'}`);
  lines.push('');

  // Column header
  const colLetters = COLUMN_LETTERS.slice(0, size).split('');
  lines.push('  ' + colLetters.join(' '));

  // Board rows (top = highest row number)
  for (let y = 0; y < size; y++) {
    const rowNumber = size - y;
    const rowLabel = rowNumber.toString().padStart(2, ' ');
    const cells: string[] = [];

    for (let x = 0; x < size; x++) {
      const point: Point = { x, y };
      const stone = getStone(board, point);

      if (lastPlacePoint && pointEquals(point, lastPlacePoint)) {
        // Mark the last move
        cells.push(lastPlaceColor === 'black' ? '★' : '☆');
      } else if (stone === 'black') {
        cells.push('●');
      } else if (stone === 'white') {
        cells.push('○');
      } else {
        cells.push('.');
      }
    }

    lines.push(`${rowLabel} ${cells.join(' ')}`);
  }

  // Last move notation
  lines.push('');
  if (lastMove) {
    if (lastMove.type === 'place') {
      const coord = pointToCoord(lastMove.point, size);
      lines.push(`Last move: ${capitalize(lastMove.color)} ${coord}`);
    } else if (lastMove.type === 'pass') {
      lines.push(`Last move: ${capitalize(lastMove.color)} passed`);
    } else if (lastMove.type === 'resign') {
      lines.push(`Last move: ${capitalize(lastMove.color)} resigned`);
    }
  }

  return lines.join('\n');
}

/**
 * Converts a Point to a Go coordinate string (e.g., {x:3, y:5} on 9×9 → "D4").
 * Column letters skip 'I'. Row numbers count from bottom (1) to top (size).
 */
export function pointToCoord(point: Point, size: BoardSize): string {
  const col = COLUMN_LETTERS[point.x];
  const row = size - point.y;
  return `${col}${row}`;
}

/**
 * Parses a Go coordinate string back to a Point.
 * Returns null if the coordinate is invalid.
 */
export function coordToPoint(coord: string, size: BoardSize): Point | null {
  if (coord.length < 2) return null;

  const colChar = coord[0].toUpperCase();
  const colIndex = COLUMN_LETTERS.indexOf(colChar);
  if (colIndex < 0 || colIndex >= size) return null;

  const rowStr = coord.slice(1);
  const row = parseInt(rowStr, 10);
  if (isNaN(row) || row < 1 || row > size) return null;

  return { x: colIndex, y: size - row };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
