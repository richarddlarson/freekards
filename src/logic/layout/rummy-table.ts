/**
 * 2-player rummy table layout (spec 18 §4.2): Gin Rummy and Rummy 500. Engine-neutral, pure math.
 * Logical units on the reference table (spec 11), element centers, as in hearts-table.ts.
 */
import type { Card } from '../core/cards.js';
import { CARD_H, CARD_W, LAYOUT, type Placement, type Point, type Viewport } from './hearts-table.js';

export const RUMMY_LAYOUT = {
  /** The center row (stock and discard pile) sits at this fraction of the height. */
  centerRow: 0.41,
  pileScale: 0.75,
  /** Gin: stock and discard pile this far left and right of the center. */
  ginPileOffset: 125,
  /** Rummy 500: the stock this far left of the center; the spread pile starts at `spreadStart` and may reach `spreadEnd`. */
  r500StockOffset: 700,
  spreadStart: -520,
  spreadEnd: 720,
  spreadMaxSpacing: 58,
  spreadMinSpacing: 24,
  /** Meld rows: the computer's (top) and the player's (above the hand). */
  meldScale: 0.55,
  meldSpacing: 32,
  meldMinSpacing: 18,
  meldGap: 28,
  meldMinGap: 12,
  oppMeldY: 320,
  myMeldY: 740,
  /** The player's hand: spacing between cards, and the extra gap between groups (melds, deadwood). */
  handMaxSpacing: 80,
  handMinSpacing: 40,
  handMaxSpan: 1560,
  /** Room kept at each side of the hand (the "You" plate on the left). */
  handSide: 210,
  groupGap: 34,
  /** The computer's face-down fan at the top. */
  oppMaxSpan: 520,
  /** The action bar (prompt and buttons) sits this far above the top of a lifted card. */
  actionAbove: 52,
  /** Toasts sit this far below the center row. */
  toastBelow: 140,
};

export interface RummyLayout {
  width: number;
  height: number;
  center: Point;
  stock: Point;
  /** Gin: the discard pile. Rummy 500: where the oldest card of the spread pile sits. */
  discard: Point;
  actionBar: Point;
  you: Point;
}

export function tableLayout(vp: Viewport, game: 'gin' | 'rummy500'): RummyLayout {
  const { width, height } = vp;
  const R = RUMMY_LAYOUT;
  const cx = width / 2;
  const cy = height * R.centerRow;
  const handY = height - LAYOUT.margin - CARD_H / 2;
  const stock = game === 'gin' ? { x: cx - R.ginPileOffset, y: cy } : { x: cx - R.r500StockOffset, y: cy };
  const discard = game === 'gin' ? { x: cx + R.ginPileOffset, y: cy } : { x: cx + R.spreadStart, y: cy };
  return {
    width,
    height,
    center: { x: cx, y: cy },
    stock,
    discard,
    actionBar: { x: cx, y: handY - CARD_H / 2 - LAYOUT.selectedLift - R.actionAbove },
    you: { x: LAYOUT.margin + 80, y: handY },
  };
}

/** Rummy 500: where card `i` of a spread discard pile of `count` cards sits. */
export function spreadPlacement(L: RummyLayout, i: number, count: number): Placement {
  const R = RUMMY_LAYOUT;
  const w = CARD_W * R.pileScale;
  const room = R.spreadEnd - R.spreadStart - w;
  const sp = count <= 1 ? 0 : Math.max(R.spreadMinSpacing, Math.min(R.spreadMaxSpacing, room / (count - 1)));
  return { x: L.discard.x + w / 2 + i * sp, y: L.discard.y, rot: 0, scale: R.pileScale };
}

/**
 * The player's hand, shown in groups (melds, then deadwood) with a gap between groups. Returns a
 * placement for every card, in group order. Lifted cards rise by the usual selection lift.
 */
export function groupedHandPlacements(L: RummyLayout, groups: readonly (readonly Card[])[], lifted: ReadonlySet<Card>): Map<Card, Placement> {
  const R = RUMMY_LAYOUT;
  const cards = groups.flat();
  const n = cards.length;
  const gaps = Math.max(0, groups.filter((g) => g.length > 0).length - 1);
  const span = Math.min(R.handMaxSpan, L.width - 2 * R.handSide);
  const sp = n <= 1 ? 0 : Math.max(R.handMinSpacing, Math.min(R.handMaxSpacing, (span - CARD_W - gaps * R.groupGap) / (n - 1)));
  const total = (n - 1) * sp + gaps * R.groupGap;
  let x = L.center.x - total / 2;
  const y = L.height - LAYOUT.margin - CARD_H / 2;
  const out = new Map<Card, Placement>();
  for (const g of groups) {
    if (g.length === 0) continue;
    if (out.size > 0) x += R.groupGap;
    for (const c of g) {
      if (out.size > 0) x += sp;
      out.set(c, { x, y: y - (lifted.has(c) ? LAYOUT.selectedLift : 0), rot: 0, scale: 1 });
    }
  }
  return out;
}

/** The computer's face-down fan along the top edge. */
export function opponentHandPlacement(L: RummyLayout, i: number, count: number): Placement {
  const s = LAYOUT.opponentCardScale;
  const sp = count <= 1 ? 0 : Math.min(LAYOUT.opponentCardSpacing, RUMMY_LAYOUT.oppMaxSpan / (count - 1));
  const mid = (count - 1) / 2;
  return { x: L.center.x + (mid - i) * sp, y: LAYOUT.margin + (CARD_H * s) / 2, rot: 180, scale: s };
}

/** A row of melds (each a list of cards in display order), centered, compressed to fit the width. */
export function meldRowPlacements(L: RummyLayout, melds: readonly (readonly Card[])[], row: 'opponent' | 'player'): Map<Card, Placement> {
  const R = RUMMY_LAYOUT;
  const w = CARD_W * R.meldScale;
  const room = L.width - 2 * (LAYOUT.margin + 60);
  const n = melds.reduce((s, m) => s + m.length, 0);
  const width = (sp: number, gap: number) => melds.length * w + (n - melds.length) * sp + Math.max(0, melds.length - 1) * gap;
  let sp = R.meldSpacing;
  let gap = R.meldGap;
  if (width(sp, gap) > room) gap = R.meldMinGap;
  if (width(sp, gap) > room && n > melds.length) sp = Math.max(R.meldMinSpacing, (room - melds.length * w - Math.max(0, melds.length - 1) * gap) / (n - melds.length));
  // The computer's row is anchored to the top of the table, the player's to the bottom (above the hand).
  const y = row === 'opponent' ? R.oppMeldY : L.height - (1280 - R.myMeldY);
  let x = L.center.x - width(sp, gap) / 2 + w / 2;
  const out = new Map<Card, Placement>();
  melds.forEach((m, j) => {
    if (j > 0) x += w + gap;
    m.forEach((c, k) => {
      if (k > 0) x += sp;
      out.set(c, { x, y, rot: 0, scale: R.meldScale });
    });
  });
  return out;
}
