/**
 * Five-Card Draw computer player (spec 19 §5). Engine-neutral. It sees only its own cards and public
 * information: the bets, how many cards each player drew, and the pot. Skill and risk come from the
 * character model (spec 08). Each player has its own seeded generator.
 */
import { newDeck, rankOf, type Card } from '../core/cards.js';
import { Rng } from '../core/rng.js';
import type { AiProfile } from '../core/skill.js';
import { liveSeats, type BetKind } from './betting.js';
import { drawLegalBets, potTotal, type DrawState } from './draw.js';
import { evaluate5 } from './hands.js';
import { chooseDiscards, STANDARD_DRAW, type DrawStyle } from './strategy.js';

/** Tuning (spec 19 §5). */
export const DRAW_AI = {
  /** Simulated deals per decision: base + per point of skill. */
  samplesBase: 60,
  samplesPerSkill: 160,
  /** Tries to find a sampled hand that fits what a player has shown before giving up on the read. */
  readTries: 20,
  /** Without a good read (failed skill roll), the estimate is off by up to ± half of this. */
  noise: 0.3,
  /** Bet when the chance of winning is at least fair + (1 − fair) × betShare − risk × riskBonus (fair = 1 / players). */
  betShare: 0.2,
  /** Raise when it is at least fair + (1 − fair) × raiseShare − risk × riskBonus. */
  raiseShare: 0.35,
  riskBonus: 0.08,
  /** Each raise already made this round asks for this much more. */
  perRaise: 0.05,
  /** Call when the chance of winning is at least the pot odds − slack + (1 − risk) × caution. */
  callSlack: 0.02,
  caution: 0.04,
  /** Chance of bluffing after the draw (× risk), with at most two opponents left. */
  bluff: 0.18,
  /** Chance of a loose call of one small bet before the draw (× risk). */
  looseCall: 0.25,
};

export interface DrawAiPlayer {
  chooseBet(s: DrawState, seat: number): BetKind;
  chooseDiscards(s: DrawState, seat: number): Card[];
  /** Whether the player's last bet or raise was a bluff (for dialogue). */
  readonly bluffing: boolean;
}

/** A player's betting before the draw: bet or raised (they likely have something). */
function aggressive(s: DrawState, seat: number, round: 0 | 1): boolean {
  return s.log.some((e) => e.seat === seat && e.round === round && (e.kind === 'bet' || e.kind === 'raise'));
}

/** Take `k` random cards out of `pool` (in place) if `ok` accepts them within `tries`; else any `k`. */
function takeCards(pool: Card[], k: number, rng: Rng, tries: number, ok: ((cs: Card[]) => boolean) | null): Card[] {
  for (let t = 0; ; t++) {
    // Partial Fisher–Yates: move k random cards to the end, then test them.
    for (let i = 0; i < k; i++) {
      const last = pool.length - 1 - i;
      const j = rng.int(last + 1);
      [pool[j], pool[last]] = [pool[last]!, pool[j]!];
    }
    const pick = pool.slice(pool.length - k);
    if (!ok || t >= tries - 1 || ok(pick)) {
      pool.length -= k;
      return pick;
    }
  }
}

/**
 * The chance of winning at a showdown, estimated by dealing out random hands for the other players
 * (and, before the draw, playing out everyone's draw). With `read`, the sampled hands must fit what
 * each player has shown: betting before the draw, the number of cards drawn, and betting after it.
 */
export function estimateEquity(s: DrawState, seat: number, rng: Rng, samples: number, read: boolean, style: DrawStyle = STANDARD_DRAW): number {
  const me = s.hands[seat]!;
  const opps = liveSeats(s).filter((x) => x !== seat);
  if (opps.length === 0) return 1;
  const unknown = newDeck().filter((c) => !me.includes(c));
  const preDraw = s.phase === 'bet1';
  let total = 0;
  for (let i = 0; i < samples; i++) {
    const pool = [...unknown];
    let mine = me;
    if (preDraw) {
      const d = chooseDiscards(me, style);
      mine = [...me.filter((c) => !d.includes(c)), ...takeCards(pool, d.length, rng, 1, null)];
    }
    const myScore = evaluate5(mine).score;
    let best = -1;
    let ties = 0;
    for (const o of opps) {
      const drew = s.drawn[o];
      const ok = !read
        ? null
        : (cs: Card[]) => {
            if (aggressive(s, o, 0) && evaluate5(cs).category < 1 && chooseDiscards(cs).length > 1) return false;
            return preDraw || drew === null || chooseDiscards(cs).length === drew;
          };
      const start = takeCards(pool, 5, rng, read ? DRAW_AI.readTries : 1, ok);
      let fin = start;
      if (preDraw || drew !== null) {
        const d = chooseDiscards(start);
        const count = preDraw ? d.length : Math.min(drew!, 5);
        const gone = d.length === count ? d : start.slice(0, count);
        fin = [...start.filter((c) => !gone.includes(c)), ...takeCards(pool, count, rng, 1, null)];
      }
      // After the draw, a bet or raise usually means at least a pair: re-deal the draw once if not.
      if (read && !preDraw && aggressive(s, o, 1) && evaluate5(fin).category < 1 && pool.length > 5) {
        fin = [...fin.slice(0, 5 - Math.min(drew ?? 0, 5)), ...takeCards(pool, Math.min(drew ?? 0, 5), rng, 1, null)];
      }
      const sc = evaluate5(fin).score;
      if (sc > best) [best, ties] = [sc, 0];
      if (sc === best) ties++;
    }
    if (myScore > best) total += 1;
    else if (myScore === best) total += 1 / (ties + 1);
  }
  return total / samples;
}

export function createDrawAi(profile: AiProfile, seed: number): DrawAiPlayer {
  const rng = new Rng(seed);
  const { skill, risk } = profile;
  let bluffing = false;
  const style = (): DrawStyle => ({
    breakSmallPairForFlush: risk >= 0.7,
    keepAceKicker: risk >= 0.6 && rng.next() < 0.5,
  });
  return {
    get bluffing() {
      return bluffing;
    },
    chooseBet(s, seat) {
      const lb = drawLegalBets(s, seat);
      if (lb.kinds.length === 0) throw new Error('not this player\'s turn to bet');
      const read = rng.next() < skill;
      const samples = Math.round(DRAW_AI.samplesBase + DRAW_AI.samplesPerSkill * skill);
      let e = estimateEquity(s, seat, rng, samples, read);
      if (!read) e = Math.min(1, Math.max(0, e + (rng.next() - 0.5) * DRAW_AI.noise));
      const n = liveSeats(s).length - 1;
      const fair = 1 / (n + 1);
      const bar = (share: number) => fair + (1 - fair) * share - risk * DRAW_AI.riskBonus + DRAW_AI.perRaise * (s.round?.raises ?? 0);
      bluffing = false;
      if (lb.kinds.includes('check')) {
        if (lb.kinds.includes('bet') && e >= bar(DRAW_AI.betShare)) return 'bet';
        if (lb.kinds.includes('bet') && s.phase === 'bet2' && n <= 2 && rng.next() < risk * DRAW_AI.bluff) {
          bluffing = e < fair;
          return 'bet';
        }
        return 'check';
      }
      if (lb.kinds.includes('raise') && e >= bar(DRAW_AI.raiseShare) && rng.next() < 0.9) return 'raise';
      const potOdds = lb.toCall / (potTotal(s) + lb.toCall);
      if (e >= potOdds - DRAW_AI.callSlack + (1 - risk) * DRAW_AI.caution) return 'call';
      if (s.phase === 'bet1' && lb.toCall <= s.stakes.smallBet && rng.next() < risk * DRAW_AI.looseCall) return 'call';
      return 'fold';
    },
    chooseDiscards(s, seat) {
      const hand = s.hands[seat]!;
      const d = chooseDiscards(hand, style());
      // A failed skill roll with a pair: keep the highest other card too (a common beginner's habit).
      if (d.length === 3 && rng.next() >= skill) {
        const high = d.reduce((a, b) => (rankOf(a) >= rankOf(b) ? a : b));
        return d.filter((c) => c !== high);
      }
      return d;
    },
  };
}
