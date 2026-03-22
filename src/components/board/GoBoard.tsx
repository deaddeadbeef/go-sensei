"use client";

import { SVG_SIZE, BOARD_PADDING } from '@/utils/coordinates';
import { COLORS } from '@/utils/colors';
import { BoardGrid } from './BoardGrid';
import { StoneLayer } from './StoneLayer';
import { GhostStone } from './GhostStone';
import { HighlightOverlay } from './overlays/HighlightOverlay';
import { GroupOverlay } from './overlays/GroupOverlay';
import { LibertyOverlay } from './overlays/LibertyOverlay';
import { SuggestionOverlay } from './overlays/SuggestionOverlay';
import { ArrowOverlay } from './overlays/ArrowOverlay';
import { CaptureAnimation } from './overlays/CaptureAnimation';
import { TerritoryOverlay } from './overlays/TerritoryOverlay';
import { InfluenceOverlay } from './overlays/InfluenceOverlay';
import { KoMarker } from './overlays/KoMarker';
import { InteractionLayer } from './InteractionLayer';
import { CoordinateLabels } from './CoordinateLabels';

// Inset so coordinate labels sit outside the gold board area
const boardInset = BOARD_PADDING * 0.75;

export function GoBoard() {
  return (
    <svg
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      className="w-full h-full select-none"
    >
      <defs>
        {/* Stone gradients for 3D look */}
        <radialGradient id="black-stone-gradient" cx="35%" cy="35%">
          <stop offset="0%" stopColor={COLORS.stone.blackShine} />
          <stop offset="100%" stopColor={COLORS.stone.black} />
        </radialGradient>
        <radialGradient id="white-stone-gradient" cx="35%" cy="35%">
          <stop offset="0%" stopColor={COLORS.stone.whiteShine} />
          <stop offset="100%" stopColor={COLORS.stone.whiteShadow} />
        </radialGradient>
        {/* Drop shadow for stones */}
        <filter id="stone-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="1" stdDeviation="1.5" floodColor="#00000040" />
        </filter>
      </defs>

      {/* Background rect – inset so coordinate labels sit outside the gold area */}
      <rect x={boardInset} y={boardInset} width={SVG_SIZE - boardInset * 2} height={SVG_SIZE - boardInset * 2} fill={COLORS.board.bg} stroke="none" />

      {/* Layers in z-order (bottom to top) */}
      <BoardGrid />
      <CoordinateLabels />
      <InfluenceOverlay />
      <TerritoryOverlay />
      <StoneLayer />
      <CaptureAnimation />
      <GroupOverlay />
      <HighlightOverlay />
      <LibertyOverlay />
      <SuggestionOverlay />
      <ArrowOverlay />
      <KoMarker />
      <GhostStone />
      <InteractionLayer />
    </svg>
  );
}
