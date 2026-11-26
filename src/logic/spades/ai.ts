/**
 * Spades computer player (spec 17 §7, skill model in 08-characters.md).
 *
 * The AI only looks at public information plus its own hand: its cards, every bid, every card
 * played so far, and the tricks each seat has won. Every play decision scores each legal card
 * (lower = better); the skill roll then picks the best card, the second best, or a random legal card.
 */
import { newDeck, rankOf, suitOf, type Card, type Suit } from '../core/cards.js';
import { Rng } from '../core/rng.js';
import { nextSeat } from '../core/seats.js';
import type { AiProfile } from '../core/skill.js';
import { beats, legalPlays, partnerOf, teamNeed, teamOf, trickWinner } from './engine.js';
import type { Seat, SpadesState } from './types.js';

/** Tuning constants (documented in spec 17 §7). */
export const SPADES_AI_TUNING = {
  /** Bid noise amplitude at skill 0, in tricks; scales by (1 − skill). */
  bidNoise: 3,
  /** Taken off the estimate before rounding: a bag costs far less than being set. */
  bidHedge: 0.5,
  /** Nil: estimate must be below this. */
  nilMaxEstimate: 1.2,
  /** Nil: chance = base + risk × riskShare. */
  nilBase: 0.3,
  nilRiskShare: 0.5,
  /** When not playing the best card, chance of the 2nd-best card instead of a random legal card. */
  secondBestShare: 0.5,
  /** "Want the trick" to set the opponents when tricks left − their need ≤ this. */
  setMargin: 2,
};

export interface SpadesAiPlayer {
  readonly profile: AiProfile;
  chooseBid(state: SpadesState, seat: Seat): number;
  choosePlay(state: SpadesState, seat: Seat): Card;
}

/** Create a computer player. Each player owns its own seeded generator, so games replay exactly. */
export function createSpadesAi(profile: AiProfile, seed: number): SpadesAiPlayer {
  const rng = new Rng(seed);
  return {
    profile,
    chooseBid: (state, seat) => chooseBid(state, seat, profile, rng),
    choosePlay: (state, seat) => choosePlayCard(state, seat, profile, rng),
  };
}

// ---------------------------------------------------------------- bidding

const SIDE_SUITS: readonly Suit[] = ['C', 'D', 'H'];

function bySuit(hand: readonly Card[], suit: Suit): Card[] {
  return hand.filter((c) => suitOf(c) === suit);
}

function has(hand: readonly Card[], card: string): boolean {
  return (hand as readonly string[]).includes(card);
}

/** Estimated tricks for a hand (spec 17 §7.1). Also shown to the player as the bid suggestion. */
export function estimateTricks(hand: readonly Card[]): number {
  let est = 0;
  for (const suit of SIDE_SUITS) {
    const cards = bySuit(hand, suit);
    const n = cards.length;
    const ace = has(cards, `A${suit}`);
    const king = has(cards, `K${suit}`);
    if (ace) est += n >= 6 ? 0.8 : 1;
    if (king) est += n >= 2 ? (ace ? 0.9 : 0.8) : 0.1;
    if (has(cards, `Q${suit}`) && n >= 3) est += ace || king ? 0.5 : 0.25;
  }
  const spades = bySuit(hand, 'S');
  const s = spades.length;
  let honors = 0;
  if (has(spades, 'AS')) {
    est += 1;
    honors++;
  }
  if (has(spades, 'KS')) {
    est += s >= 2 ? 1 : 0.5;
    honors++;
  }
  if (has(spades, 'QS')) {
    est += s >= 3 ? 1 : 0.3;
    honors++;
  }
  if (has(spades, 'JS') && s >= 4) {
    est += 0.5;
    honors++;
  }
  // Long spades: every spade beyond the third not already counted as an honor.
  const lowSpades = s - honors;
  const longCount = Math.max(0, Math.min(lowSpades, s - 3));
  est += 0.8 * longCount;
  // Ruffing with the remaining small spades.
  let spare = lowSpades - longCount;
  for (const suit of SIDE_SUITS) {
    if (bySuit(hand, suit).length === 0) {
      const use = Math.min(2, spare);
      est += 0.9 * use;
      spare -= use;
    }
  }
  for (const suit of SIDE_SUITS) {
    if (bySuit(hand, suit).length === 1 && spare > 0) {
      est += 0.6;
      spare -= 1;
    }
  }
  return est;
}

/** Whether a hand is suitable for Nil (spec 17 §7.2), before the risk roll. */
export function nilCandidate(hand: readonly Card[], estimate: number): boolean {
  if (estimate >= SPADES_AI_TUNING.nilMaxEstimate) return false;
  if (hand.some((c) => rankOf(c) === 14) || has(hand, 'KS')) return false;
  const spades = bySuit(hand, 'S');
  if (spades.length > 3 || spades.some((c) => rankOf(c) > 9)) return false;
  for (const suit of SIDE_SUITS) {
    const cards = bySuit(hand, suit);
    if (cards.length <= 2 && cards.some((c) => rankOf(c) >= 12)) return false;
  }
  return true;
}

export function chooseBid(state: SpadesState, seat: Seat, profile: AiProfile, rng: Rng): number {
  const hand = state.hands[seat];
  const est = estimateTricks(hand);
  const partnerBid = state.bids[partnerOf(seat)];
  if (partnerBid !== 0 && nilCandidate(hand, est)) {
    if (rng.next() < SPADES_AI_TUNING.nilBase + SPADES_AI_TUNING.nilRiskShare * profile.risk) return 0;
  }
  const noise = (rng.next() - 0.5) * SPADES_AI_TUNING.bidNoise * (1 - profile.skill);
  let bid = Math.round(est - SPADES_AI_TUNING.bidHedge + noise);
  if (partnerBid === 0) bid += 1;
  bid = Math.min(13, Math.max(1, bid));
  if (partnerBid !== null && partnerBid > 0 && partnerBid + bid > 13) bid = Math.max(1, 13 - partnerBid);
  return bid;
}

// ---------------------------------------------------------------- playing

interface PlayContext {
  state: SpadesState;
  seat: Seat;
  hand: Card[];
  memory: boolean;
  /** Cards that may still be in other hands. */
  outstanding: Set<Card>;
  /** Seats known to be void in a suit (with memory). */
  voids: Set<string>;
  tricksLeft: number;
}

function buildContext(state: SpadesState, seat: Seat, memory: boolean): PlayContext {
  const hand = state.hands[seat];
  const played = new Set<Card>();
  const voids = new Set<string>();
  for (const t of [...state.tricks, state.trick]) {
    const led = t.plays[0] ? suitOf(t.plays[0].card) : null;
    for (const p of t.plays) {
      played.add(p.card);
      if (led && suitOf(p.card) !== led) voids.add(`${p.seat}${led}`);
    }
  }
  const outstanding = new Set<Card>();
  for (const c of newDeck()) {
    if (hand.includes(c)) continue;
    if (memory && played.has(c)) continue;
    // Without memory, cards on the current trick are still seen (they are on the table).
    if (!memory && state.trick.plays.some((p) => p.card === c)) continue;
    outstanding.add(c);
  }
  return { state, seat, hand, memory, outstanding, voids: memory ? voids : new Set(), tricksLeft: 13 - state.tricks.length };
}

/** No outstanding card of the same suit is higher. */
function isBoss(ctx: PlayContext, card: Card): boolean {
  const s = suitOf(card);
  const r = rankOf(card);
  for (const c of ctx.outstanding) if (suitOf(c) === s && rankOf(c) > r) return false;
  return true;
}

function nilIntact(state: SpadesState, seat: Seat): boolean {
  return state.bids[seat] === 0 && state.won[seat] === 0;
}

/** Seats still to play in the current trick after `seat`. */
function seatsAfter(state: SpadesState, seat: Seat): Seat[] {
  const left = 3 - state.trick.plays.length;
  return Array.from({ length: left }, (_, i) => nextSeat(seat, i + 1));
}

/** Whether `card` would be winning the trick as it stands. */
function winsNow(state: SpadesState, card: Card): boolean {
  const plays = state.trick.plays;
  if (plays.length === 0) return true;
  const led = suitOf(plays[0]!.card);
  const best = plays.find((p) => p.seat === trickWinner(state.trick))!.card;
  return beats(card, best, led);
}

function suitLength(hand: readonly Card[], suit: Suit): number {
  return hand.filter((c) => suitOf(c) === suit).length;
}

/** Score one legal card (lower = better), following spec 17 §7.4. */
export function scoreCard(ctx: PlayContext, card: Card): number {
  const { state, seat, hand } = ctx;
  const r = rankOf(card);
  const s = suitOf(card);
  const partner = partnerOf(seat);
  const leading = state.trick.plays.length === 0;
  const winner = leading ? null : trickWinner(state.trick);
  const partnerPlayed = state.trick.plays.some((p) => p.seat === partner);
  const after = seatsAfter(state, seat);
  const last = after.length === 0;

  // 1. Own Nil.
  if (nilIntact(state, seat)) {
    if (leading) return r;
    return winsNow(state, card) ? 100 + r : -100 - r;
  }
  // 2–3. Partner's Nil.
  if (nilIntact(state, partner)) {
    if (leading) return -r;
    if (!partnerPlayed) return winsNow(state, card) ? -50 - r : r;
    if (winner === partner) return winsNow(state, card) ? -100 + r : r;
  }
  // 4. An opponent's Nil.
  const oppNil = ([nextSeat(seat, 1), nextSeat(seat, 3)] as Seat[]).find((o) => nilIntact(state, o));
  if (oppNil !== undefined) {
    if (leading) return r;
    if (after.includes(oppNil)) return r;
    if (winner === oppNil) return winsNow(state, card) ? 100 + r : -r;
  }

  // 5. Normal play.
  const team = teamOf(seat);
  const need = teamNeed(state, team);
  const oppNeed = teamNeed(state, (1 - team) as 0 | 1);
  const want = need > 0 || (oppNeed > 0 && ctx.tricksLeft - oppNeed <= SPADES_AI_TUNING.setMargin);

  if (leading) {
    if (!want) return r + (isBoss(ctx, card) ? 20 : 0);
    if (s !== 'S' && isBoss(ctx, card) && !opponentVoid(ctx, s)) return -30 - r;
    if (s === 'S' && isBoss(ctx, card)) return -20;
    const len = suitLength(hand, s);
    if (r === 13 && !hand.includes(`A${s}` as Card) && len <= 2) return r + 8;
    return r - 0.5 * len;
  }

  const led = suitOf(state.trick.plays[0]!.card);
  const partnerWinning = winner === partner;
  const partnerCard = state.trick.plays.find((p) => p.seat === partner)?.card;
  const partnerSafe = partnerWinning && (last || (partnerCard !== undefined && isBoss(ctx, partnerCard) && suitOf(partnerCard) === led));

  if (s === led) {
    if (partnerSafe) return r;
    if (want) {
      if (!winsNow(state, card)) return r;
      if (last) return -50 + r;
      return isBoss(ctx, card) ? -60 + r : -40 + r;
    }
    return winsNow(state, card) ? 50 + r : -r;
  }

  // Void in the led suit.
  if (partnerSafe) return s === 'S' ? 30 + r : r - (suitLength(hand, s) <= 2 ? 3 : 0);
  if (want) {
    if (s === 'S') return winsNow(state, card) ? -50 + r : 40 + r;
    return r;
  }
  return s === 'S' ? 50 + r : -r;
}

function opponentVoid(ctx: PlayContext, suit: Suit): boolean {
  const o1 = nextSeat(ctx.seat, 1);
  const o2 = nextSeat(ctx.seat, 3);
  return ctx.voids.has(`${o1}${suit}`) || ctx.voids.has(`${o2}${suit}`);
}

export function choosePlayCard(state: SpadesState, seat: Seat, profile: AiProfile, rng: Rng): Card {
  const legal = legalPlays(state, seat);
  if (legal.length === 0) throw new Error(`seat ${seat} has no legal play`);
  if (legal.length === 1) return legal[0]!;
  const r = rng.next();
  const m = rng.next();
  const ctx = buildContext(state, seat, m < profile.skill);
  const ranked = legal
    .map((card) => ({ card, score: scoreCard(ctx, card) }))
    .sort((a, b) => a.score - b.score || rankOf(a.card) - rankOf(b.card));
  if (r < profile.skill) return ranked[0]!.card;
  if (rng.next() < SPADES_AI_TUNING.secondBestShare) return ranked[1]!.card;
  return legal[rng.int(legal.length)]!;
}
