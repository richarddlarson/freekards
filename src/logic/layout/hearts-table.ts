/**
 * Hearts table layout and timing (spec 11 §2 and spec 12). Engine-neutral, pure math.
 * All coordinates are logical units on the reference table (1920×1280, 3:2), origin top-left,
 * positions are card/element CENTERS, rotations in degrees clockwise.
 */
import type { Seat } from '../hearts/types.js';

export const REF_W = 1920;
export const REF_H = 1280;
/** Card size at scale 1 (poker ratio 0.714). */
export const CARD_W = 150;
export const CARD_H = 210;

export interface Viewport {
  /** Multiply logical units by this to get window units. */
  scale: number;
  /** Logical size of the whole window (≥ the reference size in one dimension, equal in the other). */
  width: number;
  height: number;
}

/** Uniform scaling: the reference table always fits; extra width or height becomes more table. */
export function fitViewport(windowW: number, windowH: number): Viewport {
  const scale = Math.min(windowW / REF_W, windowH / REF_H);
  return { scale, width: windowW / scale, height: windowH / scale };
}

export interface Point {
  x: number;
  y: number;
}

export interface Placement extends Point {
  rot: number;
  scale: number;
}

export interface SeatLayout {
  /** Portrait center (computer seats); for South, the "You" marker. */
  portrait: Point;
  /** Which side of the portrait the speech bubble opens toward. */
  bubbleSide: 'left' | 'right';
  /** Where this seat's card lands in the trick. */
  trickSlot: Placement;
  /** Where won tricks fly to (then fade). */
  collect: Point;
}

export interface TableLayout {
  width: number;
  height: number;
  center: Point;
  deck: Point;
  seats: Record<Seat, SeatLayout>;
  scorePanel: { x: number; y: number; w: number; h: number };
  menuButton: { x: number; y: number; size: number };
  actionButton: Point;
  message: Point;
}

/** Layout constants (documented in spec 12 §2). */
export const LAYOUT = {
  margin: 40,
  portraitSize: 140,
  opponentCardScale: 0.55,
  opponentCardSpacing: 26,
  southMaxSpacing: 86,
  southMinSpacing: 40,
  southMaxSpan: 1300,
  selectedLift: 44,
  trickOffsetX: 150,
  trickOffsetY: 115,
  trickCardScale: 0.9,
  scorePanelW: 330,
  scorePanelH: 240,
  menuButtonSize: 72,
};

export function tableLayout(vp: Viewport): TableLayout {
  const { width, height } = vp;
  const L = LAYOUT;
  const cx = width / 2;
  const cy = height * 0.46;
  const southCardY = height - L.margin - CARD_H / 2;
  return {
    width,
    height,
    center: { x: cx, y: cy },
    deck: { x: cx, y: cy },
    seats: {
      0: {
        portrait: { x: cx, y: southCardY },
        bubbleSide: 'right',
        trickSlot: { x: cx, y: cy + L.trickOffsetY, rot: 0, scale: L.trickCardScale },
        collect: { x: cx, y: height + CARD_H },
      },
      1: {
        portrait: { x: L.margin + 120 + L.portraitSize / 2 + 20, y: cy - 140 },
        bubbleSide: 'right',
        trickSlot: { x: cx - L.trickOffsetX, y: cy, rot: 0, scale: L.trickCardScale },
        collect: { x: -CARD_H, y: cy },
      },
      2: {
        portrait: { x: cx - 330, y: L.margin + L.portraitSize / 2 + 10 },
        bubbleSide: 'right',
        trickSlot: { x: cx, y: cy - L.trickOffsetY, rot: 0, scale: L.trickCardScale },
        collect: { x: cx, y: -CARD_H },
      },
      3: {
        portrait: { x: width - (L.margin + 120 + L.portraitSize / 2 + 20), y: cy - 140 },
        bubbleSide: 'left',
        trickSlot: { x: cx + L.trickOffsetX, y: cy, rot: 0, scale: L.trickCardScale },
        collect: { x: width + CARD_H, y: cy },
      },
    },
    scorePanel: { x: width - L.margin - L.scorePanelW, y: L.margin, w: L.scorePanelW, h: L.scorePanelH },
    menuButton: { x: L.margin + L.menuButtonSize / 2, y: L.margin + L.menuButtonSize / 2, size: L.menuButtonSize },
    actionButton: { x: cx, y: southCardY - CARD_H / 2 - L.selectedLift - 60 },
    message: { x: cx, y: cy },
  };
}

/** Spacing between South's cards: as wide as fits, clamped (spec 11 §4: ≥ 40 units visible). */
export function southSpacing(layout: TableLayout, count: number): number {
  if (count <= 1) return 0;
  const span = Math.min(LAYOUT.southMaxSpan, layout.width - 2 * LAYOUT.margin - 2 * 200);
  const s = (span - CARD_W) / (count - 1);
  return Math.max(LAYOUT.southMinSpacing, Math.min(LAYOUT.southMaxSpacing, s));
}

/**
 * Placement of card `i` of `count` in a seat's hand (the hand in display-sort order).
 * South is face up along the bottom; opponents are face-down fans along their edge.
 */
export function handPlacement(layout: TableLayout, seat: Seat, i: number, count: number, lifted = false): Placement {
  const L = LAYOUT;
  const mid = (count - 1) / 2;
  if (seat === 0) {
    const sp = southSpacing(layout, count);
    return {
      x: layout.center.x + (i - mid) * sp,
      y: layout.height - L.margin - CARD_H / 2 - (lifted ? L.selectedLift : 0),
      rot: 0,
      scale: 1,
    };
  }
  const sp = L.opponentCardSpacing;
  const s = L.opponentCardScale;
  const edge = L.margin + (CARD_H * s) / 2;
  if (seat === 2) return { x: layout.center.x + (mid - i) * sp, y: edge, rot: 180, scale: s };
  if (seat === 1) return { x: edge, y: layout.center.y + (i - mid) * sp, rot: 90, scale: s };
  return { x: layout.width - edge, y: layout.center.y + (mid - i) * sp, rot: 270, scale: s };
}

/** Presentation timing (spec 12 §3), milliseconds. */
export const TIMING = {
  dealStagger: 30,
  dealFlight: 260,
  aiThinkMin: 550,
  aiThinkMax: 950,
  playFlight: 280,
  trickPause: 900,
  collect: 420,
  passFlight: 520,
  passReveal: 1400,
  resort: 220,
  idleHuman: 20000,
  idleRepeat: 60000,
};
