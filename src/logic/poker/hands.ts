/**
 * Poker hand ranking (spec 19 §1). Engine-neutral and pure. Shared by every poker variant: a hand is
 * any 5 cards, and `bestHand` picks the best 5 of more (7-card stud, Hold'em).
 */
import { rankOf, suitOf, type Card } from '../core/cards.js';

/** Hand categories, lowest to highest. */
export const CATEGORIES = [
  'high_card',
  'pair',
  'two_pair',
  'three_of_a_kind',
  'straight',
  'flush',
  'full_house',
  'four_of_a_kind',
  'straight_flush',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface HandValue {
  /** Index into CATEGORIES (0 = high card … 8 = straight flush). */
  category: number;
  /** Ranks that break ties, most important first (2–14; a 5-high straight counts as 5). */
  kickers: number[];
  /** One number that orders hands: higher is better, equal means a tie. */
  score: number;
  /** The 5 cards that make the hand. */
  cards: Card[];
}

const RANK_ONE = ['', '', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
const RANK_MANY = ['', '', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s', 'Jacks', 'Queens', 'Kings', 'Aces'];

function scoreOf(category: number, kickers: readonly number[]): number {
  let s = category;
  for (let i = 0; i < 5; i++) s = s * 15 + (kickers[i] ?? 0);
  return s;
}

/** The value of exactly 5 cards. */
export function evaluate5(cards: readonly Card[]): HandValue {
  if (cards.length !== 5) throw new RangeError('a poker hand is 5 cards');
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]!));
  const unique = [...new Set(ranks)];
  let straightHigh = 0;
  if (unique.length === 5) {
    if (ranks[0]! - ranks[4]! === 4) straightHigh = ranks[0]!;
    else if (ranks[0] === 14 && ranks[1] === 5) straightHigh = 5; // A-2-3-4-5, the "wheel"
  }
  // Group by count, then by rank: e.g. a full house K-K-K-4-4 → [[13,3],[4,2]].
  const counts = unique.map((r) => [r, ranks.filter((x) => x === r).length] as const).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const byGroup = counts.map(([r]) => r);
  let category: number;
  let kickers: number[];
  if (straightHigh && flush) [category, kickers] = [8, [straightHigh]];
  else if (counts[0]![1] === 4) [category, kickers] = [7, byGroup];
  else if (counts[0]![1] === 3 && counts[1]![1] === 2) [category, kickers] = [6, byGroup];
  else if (flush) [category, kickers] = [5, ranks];
  else if (straightHigh) [category, kickers] = [4, [straightHigh]];
  else if (counts[0]![1] === 3) [category, kickers] = [3, byGroup];
  else if (counts[0]![1] === 2 && counts[1]![1] === 2) [category, kickers] = [2, byGroup];
  else if (counts[0]![1] === 2) [category, kickers] = [1, byGroup];
  else [category, kickers] = [0, ranks];
  return { category, kickers, score: scoreOf(category, kickers), cards: [...cards] };
}

/** The best 5-card hand from 5 or more cards. */
export function bestHand(cards: readonly Card[]): HandValue {
  if (cards.length < 5) throw new RangeError('need at least 5 cards');
  if (cards.length === 5) return evaluate5(cards);
  let best: HandValue | null = null;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const v = evaluate5([cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!]);
            if (!best || v.score > best.score) best = v;
          }
  return best!;
}

/** A short name for a hand, e.g. "Two pair, Kings and 5s" (spec 19 §1). */
export function handName(v: HandValue): string {
  const k = v.kickers;
  switch (CATEGORIES[v.category]) {
    case 'straight_flush':
      return k[0] === 14 ? 'Royal flush' : `Straight flush, ${RANK_ONE[k[0]!]} high`;
    case 'four_of_a_kind':
      return `Four of a kind, ${RANK_MANY[k[0]!]}`;
    case 'full_house':
      return `Full house, ${RANK_MANY[k[0]!]} full of ${RANK_MANY[k[1]!]}`;
    case 'flush':
      return `Flush, ${RANK_ONE[k[0]!]} high`;
    case 'straight':
      return `Straight, ${RANK_ONE[k[0]!]} high`;
    case 'three_of_a_kind':
      return `Three of a kind, ${RANK_MANY[k[0]!]}`;
    case 'two_pair':
      return `Two pair, ${RANK_MANY[k[0]!]} and ${RANK_MANY[k[1]!]}`;
    case 'pair':
      return `Pair of ${RANK_MANY[k[0]!]}`;
    default:
      return `${RANK_ONE[k[0]!]} high`;
  }
}

/** Compare two hands: positive if `a` wins, negative if `b` wins, 0 for a tie. */
export function compareHands(a: HandValue, b: HandValue): number {
  return a.score - b.score;
}
