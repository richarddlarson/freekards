/**
 * Gin Rummy computer player (spec 18 §2.8). Reads only public information plus its own hand: the
 * discard pile, the cards the opponent took from it, and what it has seen discarded.
 */
import { makeCard, rankOf, suitOf, type Card, type Suit } from '../core/cards.js';
import { Rng } from '../core/rng.js';
import type { AiProfile } from '../core/skill.js';
import { deadwoodValue, ginArrangement, ginValue, KNOCK_LIMIT, legalDiscards, other } from './engine.js';
import type { GinEvent, GinState, Player } from './types.js';

export const GIN_AI_TUNING = {
  /** Weight of each partial meld (a pair, or two suited cards one or two apart) kept in the deadwood. */
  partialWeight: 2.5,
  /** Extra cost of discarding a card the opponent is probably collecting (with memory). */
  dangerPenalty: 5,
  /** Knock limit by stock size: knock with up to `early` deadwood while the stock has `earlyStock`+ cards… */
  knockEarly: 10,
  earlyStock: 20,
  knockMid: 7,
  midStock: 12,
  /** …and only with this much or less near the end, when the opponent is close too. */
  knockLate: 4,
};

/** Run rank with the Ace low. */
const lowRank = (c: Card): number => (rankOf(c) === 14 ? 1 : rankOf(c));

/** Cards that would make a meld with a pair or a suited two-card group from `a` and `b`. */
function completers(a: Card, b: Card): Card[] {
  if (a[0] === b[0]) return (['C', 'D', 'S', 'H'] as Suit[]).filter((s) => s !== suitOf(a) && s !== suitOf(b)).map((s) => `${a[0]}${s}` as Card);
  if (suitOf(a) !== suitOf(b)) return [];
  const [lo, hi] = [lowRank(a), lowRank(b)].sort((x, y) => x - y) as [number, number];
  const ranks = hi - lo === 1 ? [lo - 1, hi + 1] : hi - lo === 2 ? [lo + 1] : [];
  return ranks.filter((r) => r >= 1 && r <= 13).map((r) => makeCard(r === 1 ? 14 : r, suitOf(a)));
}

/** Number of live partial melds among the deadwood: groups whose completing cards are not all known to be gone. */
export function partials(deadwood: readonly Card[], dead: ReadonlySet<Card>): number {
  let n = 0;
  for (let i = 0; i < deadwood.length; i++) {
    for (let j = i + 1; j < deadwood.length; j++) {
      const need = completers(deadwood[i]!, deadwood[j]!);
      if (need.some((c) => !dead.has(c))) n++;
    }
  }
  return n;
}

export interface GinAiPlayer {
  /** Take the upcard on the first turn? */
  takeUpcard(state: GinState, me: Player): boolean;
  chooseDraw(state: GinState, me: Player): 'stock' | 'discard';
  /** The discard, and whether to knock with it. */
  chooseDiscard(state: GinState, me: Player): { card: Card; knock: boolean };
  /** Watch the game's events (to remember what the opponent picks up and throws away). */
  observe(events: readonly GinEvent[], me: Player): void;
}

export function createGinAi(profile: AiProfile, seed: number): GinAiPlayer {
  const rng = new Rng(seed);
  const T = GIN_AI_TUNING;
  /** Cards the opponent took from the discard pile and still holds, and cards it threw away this hand. */
  let oppTook = new Set<Card>();
  let oppThrew = new Set<Card>();
  let memory = false;

  /**
   * Cards known not to be available: its own hand and the top discard; with memory, also the buried
   * discards and the cards the opponent picked up.
   */
  const deadCards = (state: GinState, hand: readonly Card[]): Set<Card> => {
    const s = new Set<Card>(hand);
    if (memory) {
      for (const c of state.discard) s.add(c);
      for (const c of oppTook) s.add(c);
    } else if (state.discard.length > 0) s.add(state.discard.at(-1)!);
    return s;
  };

  /** Is the opponent likely to want this card (it took a card of the same rank, or a suited neighbor)? */
  const danger = (card: Card): boolean => {
    if (!memory) return false;
    for (const c of oppTook) {
      if (c[0] === card[0]) return true;
      if (suitOf(c) === suitOf(card) && Math.abs(lowRank(c) - lowRank(card)) <= 2) return true;
    }
    return false;
  };

  /** Lower is better: deadwood left after discarding `card`, less credit for live partial melds. */
  const discardScore = (state: GinState, hand: readonly Card[], card: Card): number => {
    const rest = hand.filter((c) => c !== card);
    const a = ginArrangement(rest);
    const dead = deadCards(state, hand);
    let score = a.deadwoodValue - T.partialWeight * partials(a.deadwood, dead);
    if (danger(card)) score += T.dangerPenalty;
    // With memory: a card the opponent just threw a neighbor of is safer.
    if (memory && [...oppThrew].some((c) => c[0] === card[0] || (suitOf(c) === suitOf(card) && Math.abs(lowRank(c) - lowRank(card)) === 1))) score -= 1;
    return score;
  };

  const knockLimit = (state: GinState): number => {
    const n = state.stock.length;
    if (n >= T.earlyStock) return T.knockEarly;
    if (n >= T.midStock) return T.knockMid;
    return T.knockLate;
  };

  /** Would taking `card` (and the best discard after it) put it in a meld, or let us knock? */
  const wantsCard = (state: GinState, me: Player, card: Card): boolean => {
    const hand = [...state.hands[me], card];
    const now = deadwoodValue(state.hands[me]);
    let best = Infinity;
    for (const d of state.hands[me]) best = Math.min(best, deadwoodValue(hand.filter((c) => c !== d)));
    const inMeld = ginArrangement(hand).melds.some((m) => m.cards.includes(card));
    return (inMeld && best < now) || (best <= KNOCK_LIMIT && best < now);
  };

  const roll = (): boolean => {
    memory = rng.next() < profile.skill;
    return rng.next() < profile.skill;
  };

  return {
    takeUpcard(state, me) {
      const good = roll();
      const want = wantsCard(state, me, state.discard.at(-1)!);
      return good ? want : want && rng.next() < 0.6;
    },

    chooseDraw(state, me) {
      if (state.stockOnly || state.discard.length === 0) return 'stock';
      const good = roll();
      const want = wantsCard(state, me, state.discard.at(-1)!);
      // A weaker player sometimes overlooks a useful discard.
      return want && (good || rng.next() < 0.6) ? 'discard' : 'stock';
    },

    chooseDiscard(state, me) {
      const hand = state.hands[me];
      const legal = legalDiscards(state, me);
      // Knock as soon as the deadwood is low enough for this point in the hand; gin always.
      let knockCard: Card | null = null;
      let knockDw = Infinity;
      const dwAfter = new Map(legal.map((c) => [c, deadwoodValue(hand.filter((x) => x !== c))]));
      for (const c of legal) {
        const dw = dwAfter.get(c)!;
        if (dw > KNOCK_LIMIT) continue;
        if (dw < knockDw || (dw === knockDw && ginValue(c) > ginValue(knockCard!))) {
          knockDw = dw;
          knockCard = c;
        }
      }
      if (knockCard && (knockDw === 0 || knockDw <= knockLimit(state))) {
        // A risk-taker holding very little deadwood early may wait a turn or two for gin.
        const holdForGin = knockDw > 0 && knockDw <= 3 && state.stock.length >= 16 && rng.next() < profile.risk * 0.5;
        if (!holdForGin) return { card: knockCard, knock: true };
      }
      const good = roll();
      const scores = new Map(legal.map((c) => [c, discardScore(state, hand, c)]));
      const ranked = [...legal].sort((a, b) => scores.get(a)! - scores.get(b)! || ginValue(b) - ginValue(a));
      let card = ranked[0]!;
      if (!good && ranked.length > 1) card = rng.next() < 0.5 ? ranked[1]! : ranked[rng.int(ranked.length)]!;
      return { card, knock: false };
    },

    observe(events, me) {
      for (const e of events) {
        if (e.type === 'hand_started') {
          oppTook = new Set();
          oppThrew = new Set();
        }
        if (e.player !== other(me)) continue;
        if (e.type === 'drew' && e.source === 'discard') for (const c of e.cards) oppTook.add(c);
        if (e.type === 'discarded') {
          for (const c of e.cards) {
            oppTook.delete(c);
            oppThrew.add(c);
          }
        }
      }
    },
  };
}
