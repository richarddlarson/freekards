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
  stackBelowPortrait: 230,
  /** West's and East's stacks also move this far toward the center, clear of their cards. */
  sideStackInset: 60,
  northStackLeft: 235,
  /** North's stack sits this far below the portrait's center. */
  northStackDown: 50,
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
  maxPerStack: 8,
  /** A pile is at most this many stacks wide; more stacks go in rows, each further row this much lower (in front). */
  maxColumns: 3,
  rowStep: 36,
  /** Building a stack (D-095): each chip drops from this high, over `buildDrop` ms, `buildStagger` ms apart. */
  buildHeight: 70,
  buildDrop: 260,
  buildStagger: 55,
  /** Seats start building this far apart (the player first, then West, North, East). */
  buildSeatGap: 380,
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
    { x: portrait(2).x - P.northStackLeft, y: portrait(2).y + P.northStackDown },
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

export function chipStacks(amount: number, maxPerStack = POKER_LAYOUT.maxPerStack, style: ChipStyle = 'fewest'): { value: number; count: number }[] {
  const total = Math.max(0, Math.floor(amount));
  const counts = new Map<number, number>();
  let left = total;
  // A player's stack keeps some small chips, like a cashier's buy-in (spec 19 §4.3, D-095).
  if (style === 'stack') {
    for (const r of STACK_RESERVES) {
      if (total >= r.from) {
        counts.set(r.value, r.count);
        left -= r.value * r.count;
      }
    }
  }
  for (const value of CHIP_VALUES) {
    const n = Math.floor(left / value);
    left -= n * value;
    if (n > 0) counts.set(value, (counts.get(value) ?? 0) + n);
  }
  const out: { value: number; count: number }[] = [];
  for (const value of CHIP_VALUES) {
    let n = counts.get(value) ?? 0;
    while (n > 0) {
      const count = Math.min(n, maxPerStack);
      out.push({ value, count });
      n -= count;
    }
  }
  return out;
}

/**
 * Where each stack of a pile goes: rows of at most `maxColumns`, balanced, each row centered. The
 * first stacks (the largest values, the shortest stacks) go in the front row, lowest on screen, so the
 * taller stacks of small chips behind them still show.
 */
export function stackPositions(count: number): { x: number; y: number }[] {
  const P = POKER_LAYOUT;
  const rows = Math.ceil(count / P.maxColumns);
  const perRow = Math.ceil(count / Math.max(1, rows));
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const col = i - row * perRow;
    const width = inRow * P.chipWidth + (inRow - 1) * P.stackGap;
    out.push({ x: -width / 2 + col * (P.chipWidth + P.stackGap) + P.chipWidth / 2, y: (rows - 1 - row) * P.rowStep });
  }
  return out;
}

/** `fewest`: bets and pots. `stack`: the chips in front of a player, with some small chips kept. */
export type ChipStyle = 'fewest' | 'stack';

/** For a player's stack of at least `from`, keep `count` chips of `value` (spec 19 §4.3). */
export const STACK_RESERVES: readonly { value: number; count: number; from: number }[] = [
  { value: 1, count: 4, from: 20 },
  { value: 5, count: 4, from: 50 },
  { value: 25, count: 4, from: 250 },
];
