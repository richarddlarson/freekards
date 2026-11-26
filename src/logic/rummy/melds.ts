/**
 * Melds shared by the rummy games (spec 18 §1): sets and runs, the best arrangement of a hand, and
 * laying cards off on melds. Engine-neutral and pure.
 */
import { rankOf, suitOf, type Card } from '../core/cards.js';

/** Gin Rummy: the Ace is always low (A-2-3). Rummy 500: low or high (A-2-3 or Q-K-A), never both. */
export type AceMode = 'low' | 'both';

export interface Meld {
  kind: 'set' | 'run';
  /** A run's cards in rank order, lowest first; a set's cards in the order given. */
  cards: Card[];
}

export interface Arrangement {
  melds: Meld[];
  /** Cards in no meld, in hand order. */
  deadwood: Card[];
  /** Total value of the deadwood. */
  deadwoodValue: number;
}

/** Rank of a card in a run: 2–13 for 2–K; the Ace is 1 (low) or 14 (high). */
function runRanks(card: Card, aceHigh: boolean): number {
  const r = rankOf(card);
  return r === 14 && !aceHigh ? 1 : r;
}

/** 3 or 4 cards of one rank. */
export function isSet(cards: readonly Card[]): boolean {
  if (cards.length < 3 || cards.length > 4) return false;
  const r = cards[0]![0];
  return cards.every((c) => c[0] === r) && new Set(cards).size === cards.length;
}

/** 3 or more consecutive cards of one suit. Returns them in run order, or null. */
export function asRun(cards: readonly Card[], aceMode: AceMode): Card[] | null {
  if (cards.length < 3 || new Set(cards).size !== cards.length) return null;
  const suit = suitOf(cards[0]!);
  if (!cards.every((c) => suitOf(c) === suit)) return null;
  for (const aceHigh of aceMode === 'both' ? [false, true] : [false]) {
    const sorted = [...cards].sort((a, b) => runRanks(a, aceHigh) - runRanks(b, aceHigh));
    if (sorted.every((c, i) => i === 0 || runRanks(c, aceHigh) === runRanks(sorted[i - 1]!, aceHigh) + 1)) return sorted;
  }
  return null;
}

/** The meld these cards form, or null. */
export function asMeld(cards: readonly Card[], aceMode: AceMode): Meld | null {
  if (isSet(cards)) return { kind: 'set', cards: [...cards] };
  const run = asRun(cards, aceMode);
  return run ? { kind: 'run', cards: run } : null;
}

/** Whether `card` can be laid off on `meld` (a set's missing suit, or the next card at either end of a run). */
export function canLayOff(card: Card, meld: Meld, aceMode: AceMode): boolean {
  if (meld.cards.includes(card)) return false;
  if (meld.kind === 'set') return meld.cards.length < 4 && card[0] === meld.cards[0]![0];
  return asRun([...meld.cards, card], aceMode) !== null;
}

/** The meld with `card` added (in run order for runs). Assumes canLayOff. */
export function layOff(meld: Meld, card: Card, aceMode: AceMode): Meld {
  if (meld.kind === 'set') return { kind: 'set', cards: [...meld.cards, card] };
  return { kind: 'run', cards: asRun([...meld.cards, card], aceMode)! };
}

/**
 * Every meld that can be made from `hand`: each set of 3 (all of them, from 4 of a rank) and of 4,
 * and every run segment of length 3 or more.
 */
export function allMelds(hand: readonly Card[], aceMode: AceMode): Meld[] {
  const out: Meld[] = [];
  const byRank = new Map<string, Card[]>();
  for (const c of hand) byRank.set(c[0]!, [...(byRank.get(c[0]!) ?? []), c]);
  for (const cards of byRank.values()) {
    if (cards.length === 4) {
      out.push({ kind: 'set', cards: [...cards] });
      for (let skip = 0; skip < 4; skip++) out.push({ kind: 'set', cards: cards.filter((_, i) => i !== skip) });
    } else if (cards.length === 3) out.push({ kind: 'set', cards: [...cards] });
  }
  const seen = new Set<string>();
  for (const suit of ['C', 'D', 'S', 'H']) {
    const cards = hand.filter((c) => suitOf(c) === suit);
    for (const aceHigh of aceMode === 'both' ? [false, true] : [false]) {
      const sorted = [...cards].sort((a, b) => runRanks(a, aceHigh) - runRanks(b, aceHigh));
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 2; j < sorted.length; j++) {
          const seg = sorted.slice(i, j + 1);
          if (!seg.every((c, k) => k === 0 || runRanks(c, aceHigh) === runRanks(seg[k - 1]!, aceHigh) + 1)) break;
          const key = seg.join(',');
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ kind: 'run', cards: seg });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Search every way of splitting `hand` into melds and leftover cards. `visit` gets each split's melds
 * and leftovers; the search keeps the split with the lowest `cost`. Exhaustive, memoized by the set
 * of cards still to place.
 */
function search<T>(
  hand: readonly Card[],
  aceMode: AceMode,
  cost: (melds: Meld[], rest: Card[]) => { cost: number; extra: T },
  /** With a value function, the cost is exactly the leftover value, so branches already as costly as the best are cut. */
  prune?: (c: Card) => number,
): { melds: Meld[]; rest: Card[]; cost: number; extra: T } {
  const melds = allMelds(hand, aceMode);
  const index = new Map(hand.map((c, i) => [c, i]));
  const byCard: number[][][] = hand.map(() => []);
  const meldIdx = melds.map((m) => m.cards.map((c) => index.get(c)!));
  melds.forEach((m, j) => {
    for (const c of m.cards) byCard[index.get(c)!]!.push(meldIdx[j]!);
  });
  const meldOf = new Map(meldIdx.map((idx, j) => [idx, melds[j]!]));
  let best: { melds: Meld[]; rest: Card[]; cost: number; extra: T } | null = null;
  const used = hand.map(() => false);
  const chosen: Meld[] = [];
  const rest: Card[] = [];
  let restValue = 0;
  const recurse = (from: number): void => {
    if (prune && best && restValue >= best.cost) return;
    let i = from;
    while (i < hand.length && used[i]) i++;
    if (i === hand.length) {
      const r = cost(chosen, rest);
      if (!best || r.cost < best.cost) best = { melds: [...chosen], rest: [...rest], cost: r.cost, extra: r.extra };
      return;
    }
    for (const idx of byCard[i]!) {
      if (idx.some((k) => used[k])) continue;
      for (const k of idx) used[k] = true;
      chosen.push(meldOf.get(idx)!);
      recurse(i + 1);
      chosen.pop();
      for (const k of idx) used[k] = false;
    }
    used[i] = true;
    rest.push(hand[i]!);
    const v = prune ? prune(hand[i]!) : 0;
    restValue += v;
    recurse(i + 1);
    restValue -= v;
    rest.pop();
    used[i] = false;
  };
  recurse(0);
  return best!;
}

/** Sum of card values. */
export function valueOf(cards: readonly Card[], value: (c: Card) => number): number {
  return cards.reduce((s, c) => s + value(c), 0);
}

/**
 * The arrangement of `hand` into melds with the least deadwood value. Ties go to the arrangement
 * found first (cards earlier in the hand are tried in melds before being left out).
 */
export function bestArrangement(hand: readonly Card[], value: (c: Card) => number, aceMode: AceMode): Arrangement {
  if (hand.length === 0) return { melds: [], deadwood: [], deadwoodValue: 0 };
  const r = search(hand, aceMode, (_m, rest) => ({ cost: valueOf(rest, value), extra: null }), value);
  const order = new Map(hand.map((c, i) => [c, i]));
  const deadwood = [...r.rest].sort((a, b) => order.get(a)! - order.get(b)!);
  return { melds: r.melds, deadwood, deadwoodValue: r.cost };
}

/** One card laid off on one of the target melds (by index). */
export interface LayOff {
  card: Card;
  meld: number;
}

/**
 * Lay off as many of `cards` as possible on `targets`, repeating until nothing more fits (a card can
 * fit only after another extends a run). Run extensions are tried before sets, because a set card
 * never lets another card fit. Returns the lay-offs, the extended melds, and what is left.
 */
export function layOffAll(cards: readonly Card[], targets: readonly Meld[], aceMode: AceMode): { layoffs: LayOff[]; melds: Meld[]; rest: Card[] } {
  const melds = targets.map((m) => ({ kind: m.kind, cards: [...m.cards] }));
  let rest = [...cards];
  const layoffs: LayOff[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (const kind of ['run', 'set'] as const) {
      for (const card of rest) {
        const i = melds.findIndex((m) => m.kind === kind && canLayOff(card, m, aceMode));
        if (i < 0) continue;
        melds[i] = layOff(melds[i]!, card, aceMode);
        layoffs.push({ card, meld: i });
        rest = rest.filter((c) => c !== card);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return { layoffs, melds, rest };
}

/**
 * Gin Rummy defender (spec 18 §2.6): the melds of `hand` plus lay-offs on the knocker's `targets`
 * that leave the least deadwood. Every split of the hand is tried, because breaking up a meld can
 * sometimes let more cards be laid off.
 */
export function bestWithLayoffs(
  hand: readonly Card[],
  targets: readonly Meld[],
  value: (c: Card) => number,
  aceMode: AceMode,
): Arrangement & { layoffs: LayOff[] } {
  if (hand.length === 0) return { melds: [], deadwood: [], deadwoodValue: 0, layoffs: [] };
  const r = search(hand, aceMode, (_m, rest) => {
    const l = layOffAll(rest, targets, aceMode);
    return { cost: valueOf(l.rest, value), extra: l };
  });
  const order = new Map(hand.map((c, i) => [c, i]));
  const deadwood = [...r.extra.rest].sort((a, b) => order.get(a)! - order.get(b)!);
  return { melds: r.melds, deadwood, deadwoodValue: r.cost, layoffs: r.extra.layoffs };
}
