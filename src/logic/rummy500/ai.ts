/**
 * Rummy 500 computer player (spec 18 §3.8). Sees only public information plus its own hand: the
 * whole discard pile (it is spread face up), the melds on the table, and what the opponent picked up.
 */
import { rankOf, suitOf, type Card } from '../core/cards.js';
import { Rng } from '../core/rng.js';
import type { AiProfile } from '../core/skill.js';
import { allMelds, bestArrangement, canLayOff, layOff, valueOf, type Meld } from '../rummy/melds.js';
import { legalDiscards, rummy500Value, takeableIndexes } from './engine.js';
import type { Player, Rummy500Action, Rummy500Event, Rummy500State, TableMeld } from './types.js';

export const RUMMY500_AI_TUNING = {
  /** Cost per point of a picked-up card left unmelded, by how close the opponent is to going out. */
  stuckCost: 0.4,
  stuckCostClose: 1.0,
  /** The opponent counts as close to going out with this many cards or fewer. */
  closeHand: 4,
  /** Credit per extra picked-up card while the stock is still deep (more cards to build melds with). */
  extraCardCredit: 2,
  deepStock: 15,
  /** A pick-up from below the top must score more than this. */
  minGain: 4,
  /** Credit for each live partial meld a card belongs to, when choosing a discard. */
  partialCredit: 6,
  /** Extra reluctance to discard a card the opponent is probably collecting (with memory). */
  dangerPenalty: 8,
};

const lowRank = (c: Card): number => (rankOf(c) === 14 ? 1 : rankOf(c));
const val = rummy500Value;

/** What the computer would put down from `hand`: the best melds, then lay-offs on the table and on those melds. */
export interface MeldPlan {
  melds: Meld[];
  layoffs: { card: Card; meld: number }[];
  rest: Card[];
  points: number;
}

/** The plan with the most points. Lay-off targets are the table melds followed by the new melds. */
export function planMelds(hand: readonly Card[], table: readonly Meld[]): MeldPlan {
  const a = bestArrangement(hand, val, 'both');
  const targets: Meld[] = [...table.map((m) => ({ kind: m.kind, cards: [...m.cards] })), ...a.melds.map((m) => ({ kind: m.kind, cards: [...m.cards] }))];
  let rest = [...a.deadwood];
  const layoffs: { card: Card; meld: number }[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (const card of rest) {
      const i = targets.findIndex((m) => m.kind === 'run' && canLayOff(card, m, 'both'));
      const j = i >= 0 ? i : targets.findIndex((m) => canLayOff(card, m, 'both'));
      if (j < 0) continue;
      targets[j] = layOff(targets[j]!, card, 'both');
      layoffs.push({ card, meld: j });
      rest = rest.filter((c) => c !== card);
      changed = true;
      break;
    }
  }
  const points = valueOf(hand, val) - valueOf(rest, val);
  return { melds: a.melds, layoffs, rest, points };
}

/** The best plan that uses `card` (a picked-up card that must be used): in a new meld, or laid off on the table. */
function forcedPlan(card: Card, hand: readonly Card[], table: readonly Meld[]): MeldPlan | null {
  let best: MeldPlan | null = null;
  for (const m of allMelds(hand, 'both')) {
    if (!m.cards.includes(card)) continue;
    const p = planMelds(hand.filter((c) => !m.cards.includes(c)), [...table, m]);
    const plan = { melds: [m, ...p.melds], layoffs: p.layoffs, rest: p.rest, points: p.points + valueOf(m.cards, val) };
    if (!best || plan.points > best.points) best = plan;
  }
  const t = table.findIndex((m) => canLayOff(card, m, 'both'));
  if (t >= 0) {
    const ext = [...table];
    ext[t] = layOff(ext[t]!, card, 'both');
    const p = planMelds(hand.filter((c) => c !== card), ext);
    const plan = { melds: p.melds, layoffs: [{ card, meld: t }, ...p.layoffs], rest: p.rest, points: p.points + val(card) };
    if (!best || plan.points > best.points) best = plan;
  }
  return best;
}

export interface Rummy500AiPlayer {
  /** Draw from the stock, or take from the discard pile at `index`. */
  chooseDraw(state: Rummy500State, me: Player): { source: 'stock' } | { source: 'discard'; index: number };
  /** The next meld or lay-off to make this turn, or null when done. Called repeatedly. */
  nextPlay(state: Rummy500State, me: Player): Rummy500Action | null;
  chooseDiscard(state: Rummy500State, me: Player): Card;
  observe(events: readonly Rummy500Event[], me: Player): void;
}

export function createRummy500Ai(profile: AiProfile, seed: number): Rummy500AiPlayer {
  const rng = new Rng(seed);
  const T = RUMMY500_AI_TUNING;
  let oppTook = new Set<Card>();
  let memory = false;
  /** Melds and lay-offs this turn that a weaker player overlooked; not retried until next turn. */
  let skipped = new Set<string>();

  const roll = (): boolean => {
    memory = rng.next() < profile.skill;
    return rng.next() < profile.skill;
  };

  const danger = (card: Card): boolean => {
    if (!memory) return false;
    for (const c of oppTook) {
      if (c[0] === card[0]) return true;
      if (suitOf(c) === suitOf(card) && Math.abs(lowRank(c) - lowRank(card)) <= 2) return true;
    }
    return false;
  };

  /** Live partial melds `card` forms with the other cards: pairs, or suited cards one or two apart. */
  const partialsWith = (card: Card, others: readonly Card[], gone: ReadonlySet<Card>): number => {
    let n = 0;
    for (const o of others) {
      if (o === card) continue;
      if (o[0] === card[0]) {
        const missing = ['C', 'D', 'S', 'H'].filter((s) => s !== suitOf(o) && s !== suitOf(card)).map((s) => `${o[0]}${s}`);
        if (missing.some((c) => !gone.has(c as Card))) n++;
      } else if (suitOf(o) === suitOf(card) && Math.abs(lowRank(o) - lowRank(card)) <= 2) n++;
    }
    return n;
  };

  return {
    chooseDraw(state, me) {
      skipped = new Set();
      const good = roll();
      const hand = state.hands[me];
      const base = planMelds(hand, state.melds).points;
      const oppCards = state.hands[(1 - me) as Player].length;
      const stuck = oppCards <= T.closeHand ? T.stuckCostClose : T.stuckCost;
      const top = state.discard.length - 1;
      let bestIndex = -1;
      let bestScore = 0;
      for (const i of takeableIndexes(state, me)) {
        const taken = state.discard.slice(i);
        const h = [...hand, ...taken];
        const plan = i === top ? planMelds(h, state.melds) : forcedPlan(taken[0]!, h, state.melds);
        if (!plan) continue;
        const left = taken.filter((c) => plan.rest.includes(c));
        let score = plan.points - base - stuck * valueOf(left, val);
        if (state.stock.length >= T.deepStock) score += T.extraCardCredit * (taken.length - 1);
        if (i < top) score -= T.minGain;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      // A weaker player sometimes misses a good pick-up.
      if (bestIndex >= 0 && (good || rng.next() < 0.5)) return { source: 'discard', index: bestIndex };
      return { source: 'stock' };
    },

    nextPlay(state, me) {
      const hand = state.hands[me];
      if (state.mustUse) {
        const plan = forcedPlan(state.mustUse, hand, state.melds);
        if (!plan) return null;
        const first = plan.layoffs.find((l) => l.card === state.mustUse);
        if (first && first.meld < state.melds.length) return { type: 'lay_off', player: me, card: first.card, meld: first.meld };
        const m = plan.melds.find((x) => x.cards.includes(state.mustUse!))!;
        return { type: 'meld', player: me, cards: m.cards };
      }
      const plan = planMelds(hand, state.melds);
      const options: Rummy500Action[] = [
        ...plan.melds.map((m): Rummy500Action => ({ type: 'meld', player: me, cards: m.cards })),
        ...plan.layoffs.filter((l) => l.meld < state.melds.length).map((l): Rummy500Action => ({ type: 'lay_off', player: me, card: l.card, meld: l.meld })),
      ];
      for (const a of options) {
        const key = a.type === 'meld' ? a.cards.join() : a.type === 'lay_off' ? `${a.card}@${a.meld}` : '';
        if (skipped.has(key)) continue;
        // A chained lay-off only fits once the card before it is down.
        if (a.type === 'lay_off' && !canLayOff(a.card, state.melds[a.meld]!, 'both')) continue;
        if (rng.next() >= 0.5 + 0.5 * profile.skill) {
          skipped.add(key);
          continue;
        }
        return a;
      }
      return null;
    },

    chooseDiscard(state, me) {
      const good = roll();
      const hand = state.hands[me];
      const legal = legalDiscards(state, me);
      const gone = new Set<Card>([...state.discard, ...state.melds.flatMap((m) => m.cards)]);
      const close = state.hands[(1 - me) as Player].length <= T.closeHand;
      // Higher score = better to throw away.
      const score = (c: Card): number => {
        let s = val(c) * (close ? 1.5 : 1) - T.partialCredit * partialsWith(c, hand, gone);
        if (danger(c)) s -= T.dangerPenalty;
        // Never hand the opponent a card that fits a meld on the table.
        if (state.melds.some((m: TableMeld) => canLayOff(c, m, 'both'))) s -= 30;
        return s;
      };
      const ranked = [...legal].sort((a, b) => score(b) - score(a) || val(b) - val(a));
      skipped = new Set();
      if (!good && ranked.length > 1) return rng.next() < 0.5 ? ranked[1]! : ranked[rng.int(ranked.length)]!;
      return ranked[0]!;
    },

    observe(events, me) {
      for (const e of events) {
        if (e.type === 'hand_started') oppTook = new Set();
        if (e.player !== ((1 - me) as Player)) continue;
        if (e.type === 'took_discard') for (const c of e.cards) oppTook.add(c);
        if (e.type === 'melded' || e.type === 'laid_off' || e.type === 'discarded') for (const c of e.cards) oppTook.delete(c);
      }
    },
  };
}
