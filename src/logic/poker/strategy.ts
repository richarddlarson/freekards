/**
 * Which cards to throw away in a draw (spec 19 §5.2). Used by the computer players, and by their
 * estimates of what other players are holding. Engine-neutral and pure.
 */
import { rankOf, suitOf, type Card } from '../core/cards.js';
import { evaluate5 } from './hands.js';

export interface DrawStyle {
  /** Break a low pair (6s or lower) to draw to a four-card flush. */
  breakSmallPairForFlush: boolean;
  /** Keep an Ace kicker with a pair (draw 2 instead of 3). */
  keepAceKicker: boolean;
}

export const STANDARD_DRAW: DrawStyle = { breakSmallPairForFlush: false, keepAceKicker: false };

/** Four cards of one suit, if any. */
function fourFlush(hand: readonly Card[]): Card[] | null {
  for (const s of ['C', 'D', 'H', 'S']) {
    const cs = hand.filter((c) => suitOf(c) === s);
    if (cs.length === 4) return cs;
  }
  return null;
}

/** Four cards in a row that can be completed at either end (not A-2-3-4 or J-Q-K-A). */
function openEnded(hand: readonly Card[]): Card[] | null {
  for (const skip of hand) {
    const four = hand.filter((c) => c !== skip);
    const r = four.map(rankOf).sort((a, b) => a - b);
    if (new Set(r).size === 4 && r[3]! - r[0]! === 3 && r[0]! >= 2 && r[3]! <= 13) return four;
  }
  return null;
}

/** The cards to discard. */
export function chooseDiscards(hand: readonly Card[], style: DrawStyle = STANDARD_DRAW): Card[] {
  const v = evaluate5(hand);
  const byRank = (r: number) => hand.filter((c) => rankOf(c) === r);
  const keepOnly = (keep: readonly Card[]) => hand.filter((c) => !keep.includes(c));
  switch (v.category) {
    case 8:
    case 7:
    case 6:
    case 5:
    case 4:
      return []; // stand pat
    case 3:
      return keepOnly(byRank(v.kickers[0]!));
    case 2:
      return keepOnly([...byRank(v.kickers[0]!), ...byRank(v.kickers[1]!)]);
    case 1: {
      const pair = byRank(v.kickers[0]!);
      const flush = fourFlush(hand);
      if (flush && style.breakSmallPairForFlush && v.kickers[0]! <= 6) return keepOnly(flush);
      const ace = hand.find((c) => rankOf(c) === 14 && !pair.includes(c));
      if (ace && style.keepAceKicker) return keepOnly([...pair, ace]);
      return keepOnly(pair);
    }
    default: {
      const flush = fourFlush(hand);
      if (flush) return keepOnly(flush);
      const straight = openEnded(hand);
      if (straight) return keepOnly(straight);
      // Nothing: keep an Ace, or a high card (Jack or better); otherwise draw five.
      const high = [...hand].sort((a, b) => rankOf(b) - rankOf(a))[0]!;
      return rankOf(high) >= 11 ? keepOnly([high]) : [...hand];
    }
  }
}
