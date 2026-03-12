export const COLORS = {
  board: {
    bg: '#dcb35c',
    line: '#3d2e1a',
    star: '#3d2e1a',
  },
  stone: {
    black: '#1a1a1a',
    blackShine: '#444',
    white: '#f0ece4',
    whiteShine: '#fff',
    whiteShadow: '#d4d0c8',
  },
  overlay: {
    positive: '#4ade80',
    warning: '#f59e0b',
    danger: '#ef4444',
    suggestion: '#818cf8',
    territoryBlack: 'rgba(0, 0, 0, 0.25)',
    territoryWhite: 'rgba(255, 255, 255, 0.35)',
    dame: 'rgba(128, 128, 128, 0.3)',
  },
  ui: {
    bgPrimary: '#1a1612',
    bgCard: '#2a2420',
    textPrimary: '#f5f0e8',
    textSecondary: '#a89880',
    accent: '#d4a544',
  },
  ripple: {
    black: '#d4a54480',
    white: '#93c5fd40',
  },
} as const;

export function libertyColor(count: number): string {
  if (count <= 1) return COLORS.overlay.danger;
  if (count === 2) return COLORS.overlay.warning;
  return COLORS.overlay.positive;
}
