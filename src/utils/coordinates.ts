import type { Point, BoardSize } from '@/lib/go-engine/types';

// SVG viewBox is always 0 0 SVG_SIZE SVG_SIZE
export const SVG_SIZE = 500;
export const BOARD_PADDING = 30; // padding inside SVG for labels

export function cellSize(boardSize: BoardSize): number {
  return (SVG_SIZE - 2 * BOARD_PADDING) / (boardSize - 1);
}

export function pointToSvg(point: Point, boardSize: BoardSize): { cx: number; cy: number } {
  const cell = cellSize(boardSize);
  return {
    cx: BOARD_PADDING + point.x * cell,
    cy: BOARD_PADDING + point.y * cell,
  };
}

export function svgToPoint(svgX: number, svgY: number, boardSize: BoardSize): Point | null {
  const cell = cellSize(boardSize);
  const x = Math.round((svgX - BOARD_PADDING) / cell);
  const y = Math.round((svgY - BOARD_PADDING) / cell);
  if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return null;
  return { x, y };
}

export function stoneRadius(boardSize: BoardSize): number {
  return cellSize(boardSize) * 0.47; // slight gap between adjacent stones
}

export function getStarPoints(size: BoardSize): Point[] {
  if (size === 9) {
    return [
      { x: 2, y: 2 }, { x: 6, y: 2 },
      { x: 4, y: 4 }, // tengen (center)
      { x: 2, y: 6 }, { x: 6, y: 6 },
    ];
  }
  if (size === 13) {
    return [
      { x: 3, y: 3 }, { x: 9, y: 3 },
      { x: 6, y: 6 }, // tengen
      { x: 3, y: 9 }, { x: 9, y: 9 },
    ];
  }
  // 19x19
  return [
    { x: 3, y: 3 }, { x: 9, y: 3 }, { x: 15, y: 3 },
    { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 15, y: 9 },
    { x: 3, y: 15 }, { x: 9, y: 15 }, { x: 15, y: 15 },
  ];
}
