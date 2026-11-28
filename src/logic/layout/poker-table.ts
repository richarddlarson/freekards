/**
 * Poker table layout (spec 19 §4.2): the 4-seat positions of the Hearts table (portraits, score
 * panel, menu buttons) plus chip stacks, bets, the pot, the dealer button, and where hands are shown.
 * Engine-neutral, pure math. Logical units on the reference table (spec 11), element centers.
 */
import { CARD_H, CARD_W, LAYOUT, tableLayout as baseLayout, type Placement, type Point, type TableLayout, type Viewport } from './hearts-table.js';

export const POKER_LAYOUT = {
  /** The player's 5 cards: spacing between card centers (they overlap a little). */
  handSpacing: 150,
  /** A card chosen to discard lifts this far. */
  discardLift: 44,
  /** Chip stacks beside each player, relative to the portrait (computer seats). */
  stackBelowPortrait: 185,
  /** West's and East's stacks also move this far toward the center, clear of their cards. */
  sideStackInset: 60,
  northStackLeft: 235,
  /** The player's stack, right of the hand center. */
  youStackRight: 600,
  /** Bets: in front of each player, toward the center. */
  betSouth: 205,
  betSide: 430,
  betNorth: 215,
  /** The dealer button sits this far from the dealer's bet spot, toward the table edge. */
  buttonOffset: 95,
  /** Shown hands at a showdown: scale, card spacing, and how far from the center. */
  showScale: 0.55,
  showSpacing: 62,
  showSide: 450,
  showNorth: 255,
  /** Chips: drawn width, stacking step, gap between stacks, and the most chips in one stack. */
  chipWidth: 84,
  chipStep: 8.4,
  stackGap: 9,
  maxPerStack: 10,
  /** The action bar sits this far above the top of a lifted card. */
  actionAbove: 52,
};

export interface PokerLayout {
  base: TableLayout;
  center: Point;
  /** Where each seat's chips sit, by seat 0–3. */
  stacks: Point[];
  /** Where each seat's bet for the current round sits. */
  bets: Point[];
  /** The dealer button's place for each seat. */
  buttons: Point[];
  /** The center of each opponent's shown hand at a showdown (index 0 unused: the player's hand stays put). */
  show: Point[];
  pot: Point;
  /** Where new cards come from. */
  deck: Point;
  actionBar: Point;
  you: Point;
  handY: number;
}

export function pokerLayout(vp: Viewport): PokerLayout {
  const P = POKER_LAYOUT;
  const base = baseLayout(vp);
  const { width, height } = base;
  const c = base.center;
  const handY = height - LAYOUT.margin - CARD_H / 2;
  const portrait = (s: 1 | 2 | 3) => base.seats[s].portrait;
  const stacks: Point[] = [
    { x: c.x + P.youStackRight, y: handY + 30 },
    { x: portrait(1).x + P.sideStackInset, y: portrait(1).y + P.stackBelowPortrait },
    { x: portrait(2).x - P.northStackLeft, y: portrait(2).y + 20 },
    { x: portrait(3).x - P.sideStackInset, y: portrait(3).y + P.stackBelowPortrait },
  ];
  const bets: Point[] = [
    { x: c.x, y: c.y + P.betSouth },
    { x: c.x - P.betSide, y: c.y },
    { x: c.x, y: c.y - P.betNorth },
    { x: c.x + P.betSide, y: c.y },
  ];
  const o = P.buttonOffset;
  const buttons: Point[] = [
    { x: bets[0]!.x + o * 1.4, y: bets[0]!.y + o * 0.5 },
    { x: bets[1]!.x - o * 0.4, y: bets[1]!.y + o },
    { x: bets[2]!.x - o * 1.4, y: bets[2]!.y - o * 0.3 },
    { x: bets[3]!.x + o * 0.4, y: bets[3]!.y + o },
  ];
  const show: Point[] = [
    { x: c.x, y: handY },
    { x: c.x - P.showSide, y: c.y },
    { x: c.x, y: c.y - P.showNorth },
    { x: c.x + P.showSide, y: c.y },
  ];
  return {
    base,
    center: c,
    stacks,
    bets,
    buttons,
    show,
    pot: { x: c.x, y: c.y },
    deck: { x: c.x, y: c.y - 40 },
    actionBar: { x: c.x, y: handY - CARD_H / 2 - P.discardLift - P.actionAbove },
    you: { x: c.x - 2 * P.handSpacing - CARD_W / 2 - 110, y: handY },
    handY,
  };
}

/** Card `i` of the player's 5 (or however many), face up along the bottom. */
export function playerCardPlacement(l: PokerLayout, i: number, count: number, lifted: boolean): Placement {
  const mid = (count - 1) / 2;
  return { x: l.center.x + (i - mid) * POKER_LAYOUT.handSpacing, y: l.handY - (lifted ? POKER_LAYOUT.discardLift : 0), rot: 0, scale: 1 };
}

/** Card `i` of a shown hand (opponents at a showdown), upright and face up. */
export function shownCardPlacement(l: PokerLayout, seat: number, i: number, count: number): Placement {
  const mid = (count - 1) / 2;
  const p = l.show[seat]!;
  return { x: p.x + (i - mid) * POKER_LAYOUT.showSpacing, y: p.y, rot: 0, scale: POKER_LAYOUT.showScale };
}

/**
 * How an amount is drawn as chips: the fewest chips of the standard values (1,000, 500, 100, 25, 5, 1),
 * in stacks of at most `maxPerStack`, largest value first. Engine-neutral so every runtime draws the
 * same stacks (spec 19 §4.3).
 */
export const CHIP_VALUES: readonly number[] = [1000, 500, 100, 25, 5, 1];

export function chipStacks(amount: number, maxPerStack = POKER_LAYOUT.maxPerStack): { value: number; count: number }[] {
  const out: { value: number; count: number }[] = [];
  let left = Math.max(0, Math.floor(amount));
  for (const value of CHIP_VALUES) {
    let n = Math.floor(left / value);
    left -= n * value;
    while (n > 0) {
      const count = Math.min(n, maxPerStack);
      out.push({ value, count });
      n -= count;
    }
  }
  return out;
}
