/**
 * Basic Hearts computer player (spec 06-hearts.md §5, skill model in 08-characters.md).
 *
 * The AI only looks at public information plus its own hand: its cards, cards already
 * played (tricks + current trick), cards each seat has taken, and the rules state.
 * Every decision scores each legal card (lower score = better), then the skill roll
 * decides whether the best card, the second-best card, or a random legal card is played.
 */

import { rankOf, suitOf, type Card, type Suit } from '../core/cards.js';
import { Rng } from '../core/rng.js';
import type { AiProfile } from '../core/skill.js';
import {
  JACK_OF_DIAMONDS,
  QUEEN_OF_SPADES,
  cardsPoints,
  isPointCard,
  legalPlays,
  trickWinner,
} from './engine.js';
import { SEATS, type HeartsState, type Seat } from './types.js';

/** Tuning constants (documented in spec 06 §5). */
export const AI_TUNING = {
  /** Pass-selection noise amplitude at skill 0; scales by (1 − skill). */
  passNoise: 12,
  /** When not playing the best card, chance of the 2nd-best card instead of a random legal card. */
  secondBestShare: 0.5,
  /** Moon attempt: min count of Q/K/A in hand, min hearts, must hold A♥. */
  moonMinHighCards: 6,
  moonMinHearts: 4,
  /** Moon blocking: min skill, and min point cards a single opponent must hold with nobody else holding any. */
  moonBlockMinSkill: 0.5,
  moonThreatPointCards: 5,
};

export interface HeartsAiPlayer {
  readonly profile: AiProfile;
  choosePass(state: HeartsState, seat: Seat): Card[];
  choosePlay(state: HeartsState, seat: Seat): Card;
}

/** Create a computer player. Each player owns its own seeded generator, so games replay exactly. */
export function createHeartsAi(profile: AiProfile, seed: number): HeartsAiPlayer {
  const rng = new Rng(seed);
  // Per-hand memory: whether this player decided to attempt shooting the moon.
  let moonHand = -1;
  let moonAttempt = false;

  return {
    profile,
    choosePass(state, seat) {
      return choosePassCards(state.hands[seat], profile, rng);
    },
    choosePlay(state, seat) {
      if (moonHand !== state.handNumber) {
        moonHand = state.handNumber;
        moonAttempt = decideMoonAttempt(state.hands[seat], profile, rng);
      }
      if (moonAttempt && opponentsHavePoints(state, seat)) moonAttempt = false;
      return choosePlayCard(state, seat, profile, rng, moonAttempt);
    },
  };
}

// ---------------------------------------------------------------- passing

function suitCount(hand: readonly Card[], suit: Suit): number {
  return hand.filter((c) => suitOf(c) === suit).length;
}

/** Danger score of keeping a card (higher = pass it first). */
export function passDanger(card: Card, hand: readonly Card[]): number {
  const r = rankOf(card);
  const s = suitOf(card);
  const spades = suitCount(hand, 'S');
  const holdsQueen = hand.includes(QUEEN_OF_SPADES);
  let d = r;
  if (s === 'H') d += 4;
  if (card === QUEEN_OF_SPADES) d += spades < 4 ? 20 : -10;
  else if (s === 'S' && r > 12) d += !holdsQueen && spades < 4 ? 12 : 0;
  else if (s === 'S' && r < 12) d -= 8; // low spades guard against the queen
  if ((s === 'C' || s === 'D') && suitCount(hand, s) <= 3) d += 5; // work toward a void
  if (card === JACK_OF_DIAMONDS) d -= 6; // keep the jack: it can be worth −10 (harmless otherwise)
  return d;
}

export function choosePassCards(hand: readonly Card[], profile: AiProfile, rng: Rng): Card[] {
  const noise = (1 - profile.skill) * AI_TUNING.passNoise;
  const scored = hand.map((card) => ({ card, d: passDanger(card, hand) + rng.next() * noise }));
  scored.sort((a, b) => b.d - a.d);
  return scored.slice(0, 3).map((x) => x.card);
}

// ---------------------------------------------------------------- moon

function decideMoonAttempt(hand: readonly Card[], profile: AiProfile, rng: Rng): boolean {
  const high = hand.filter((c) => rankOf(c) >= 12).length;
  const hearts = suitCount(hand, 'H');
  const strong = high >= AI_TUNING.moonMinHighCards && hearts >= AI_TUNING.moonMinHearts && hand.includes('AH');
  return strong && rng.next() < profile.risk * profile.skill;
}

function pointCardsTaken(state: HeartsState): number[] {
  return SEATS.map((seat) => state.taken[seat].filter(isPointCard).length);
}

function opponentsHavePoints(state: HeartsState, seat: Seat): boolean {
  const counts = pointCardsTaken(state);
  return SEATS.some((s) => s !== seat && counts[s]! > 0);
}

/** Seat that looks like it is shooting the moon (has all point cards taken so far, enough of them), or null. */
export function moonThreat(state: HeartsState, self: Seat): Seat | null {
  const counts = pointCardsTaken(state);
  const holders = SEATS.filter((s) => counts[s]! > 0);
  if (holders.length !== 1) return null;
  const only = holders[0]!;
  if (only === self || counts[only]! < AI_TUNING.moonThreatPointCards) return null;
  return only;
}

// ---------------------------------------------------------------- playing

interface PlayContext {
  hand: readonly Card[];
  ruleSet: HeartsState['ruleSet'];
  plays: HeartsState['trick']['plays'];
  isLast: boolean;
  /** True when the AI remembers which cards have been played (rolled per decision). */
  memory: boolean;
  /** Queen of spades is still unplayed and in someone else's hand (needs memory). */
  queenOut: boolean;
  threat: Seat | null;
  moon: boolean;
  seat: Seat;
}

/** Score one legal card. Lower is better. */
export function scorePlay(card: Card, ctx: PlayContext): number {
  const r = rankOf(card);
  const s = suitOf(card);
  const short = (suit: Suit): boolean => suitCount(ctx.hand, suit) <= 2;

  // ---- Leading
  if (ctx.plays.length === 0) {
    if (ctx.moon) return -r;
    let v = r;
    if (s === 'H') v += 3;
    if (card === QUEEN_OF_SPADES) v += 40;
    else if (s === 'S' && ctx.queenOut) v += r < 12 ? -6 : 30;
    if ((s === 'C' || s === 'D') && short(s)) v -= 2;
    if (ctx.ruleSet === 'jack-of-diamonds' && card === JACK_OF_DIAMONDS) v += 15;
    return v;
  }

  const led = suitOf(ctx.plays[0]!.card);
  const trickCards = ctx.plays.map((p) => p.card);
  const winnerSeat = trickWinner({ leader: ctx.plays[0]!.seat, plays: ctx.plays });
  const winnerCard = ctx.plays.find((p) => p.seat === winnerSeat)!.card;

  // ---- Discarding (void in the led suit; this card cannot win the trick)
  if (s !== led) {
    if (ctx.moon) return isPointCard(card) ? 1000 + r : r;
    if (ctx.threat !== null && ctx.threat === winnerSeat) {
      // Don't feed points to a player who is shooting the moon.
      return isPointCard(card) ? 500 + r : -r;
    }
    if (ctx.ruleSet === 'jack-of-diamonds' && card === JACK_OF_DIAMONDS) return 200;
    if (card === QUEEN_OF_SPADES) return -1000;
    if (s === 'S' && r > 12 && ctx.queenOut) return -500 - r;
    if (s === 'H') return -100 - r;
    return -r - (short(s) ? 3 : 0);
  }

  // ---- Following suit
  const wins = r > rankOf(winnerCard);
  const trickPts = cardsPoints([...trickCards, card], ctx.ruleSet);

  if (ctx.moon) return wins ? -r : r;

  if (ctx.threat !== null && wins && trickCards.some((c) => suitOf(c) === 'H') && trickPts <= 3) {
    return -200 - r; // take a heart to stop the moon
  }

  if (!wins) {
    // Duck under the winner with the highest card possible; dumping the queen is best of all.
    return -r - (card === QUEEN_OF_SPADES ? 20 : 0);
  }

  // This card would (currently) win the trick.
  if (ctx.isLast) {
    if (trickPts < 0) return -100 - r; // grab the jack of diamonds
    return 50 - r + (card === QUEEN_OF_SPADES ? 100 : 0);
  }
  let v = 60 + r;
  if (card === QUEEN_OF_SPADES) v += 100;
  else if (s === 'S' && r > 12 && ctx.queenOut) v += 40;
  if (ctx.ruleSet === 'jack-of-diamonds' && card === JACK_OF_DIAMONDS) v -= 20;
  return v;
}

export function choosePlayCard(
  state: HeartsState,
  seat: Seat,
  profile: AiProfile,
  rng: Rng,
  moon = false,
): Card {
  const legal = legalPlays(state, seat);
  if (legal.length === 0) throw new Error(`Seat ${seat} has no legal play`);
  if (legal.length === 1) return legal[0]!;

  // Skill roll: below skill → play the best-scored card.
  const roll = rng.next();
  const memory = rng.next() < profile.skill;
  const played = new Set<Card>([
    ...state.tricks.flatMap((t) => t.plays.map((p) => p.card)),
    ...state.trick.plays.map((p) => p.card),
  ]);
  const hand = state.hands[seat];
  const ctx: PlayContext = {
    hand,
    ruleSet: state.ruleSet,
    plays: state.trick.plays,
    isLast: state.trick.plays.length === 3,
    memory,
    queenOut: memory && !played.has(QUEEN_OF_SPADES) && !hand.includes(QUEEN_OF_SPADES),
    threat: memory && profile.skill >= AI_TUNING.moonBlockMinSkill ? moonThreat(state, seat) : null,
    moon,
    seat,
  };
  const ranked = [...legal].sort((a, b) => scorePlay(a, ctx) - scorePlay(b, ctx) || rankOf(a) - rankOf(b));

  if (roll < profile.skill) return ranked[0]!;
  return rng.next() < AI_TUNING.secondBestShare ? ranked[1]! : rng.pick(legal);
}
