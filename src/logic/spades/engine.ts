/**
 * Spades rules engine (spec 17 §1–§6).
 *
 * Pure and deterministic: `applySpadesAction(state, action)` returns a new state plus the events
 * produced. The input state is never mutated. All randomness comes from `state.rngState`.
 */

import { newDeck, rankOf, suitOf, type Card } from '../core/cards.js';
import { Rng } from '../core/rng.js';
import { nextSeat } from '../core/seats.js';
import {
  SpadesRuleError,
  type CompletedTrick,
  type Four,
  type Seat,
  type SpadesAction,
  type SpadesEvent,
  type SpadesOptions,
  type SpadesState,
  type SpadesStep,
  type Team,
  type TeamHandResult,
  type Two,
} from './types.js';

export const DEFAULT_TARGET_SCORE = 300;
/** A team at or below this score ends the game (spec 17 §5). */
export const MERCY_SCORE = -200;
export const NIL_POINTS = 100;
export const BAG_LIMIT = 10;
export const BAG_PENALTY = 100;
/** The first hand's dealer (spec 17 §3): South, so the player bids last on hand 1. */
export const FIRST_DEALER: Seat = 0;

// ---------------------------------------------------------------- helpers

export function teamOf(seat: Seat): Team {
  return (seat % 2) as Team;
}

export function partnerOf(seat: Seat): Seat {
  return nextSeat(seat, 2);
}

export function teamSeats(team: Team): [Seat, Seat] {
  return team === 0 ? [0, 2] : [1, 3];
}

/** Seat whose turn it is in the bid or play phase (null otherwise). */
export function currentSeat(state: SpadesState): Seat | null {
  if (state.phase === 'bid') {
    const made = state.bids.filter((b) => b !== null).length;
    return nextSeat(state.dealer, 1 + made);
  }
  if (state.phase === 'play') return nextSeat(state.trick.leader, state.trick.plays.length);
  return null;
}

/** Winner of a (complete or partial) trick: highest spade, else highest card of the led suit. */
export function trickWinner(trick: { leader: Seat; plays: readonly { seat: Seat; card: Card }[] }): Seat {
  const first = trick.plays[0];
  if (!first) return trick.leader;
  let best = first;
  for (const p of trick.plays) if (beats(p.card, best.card, suitOf(first.card))) best = p;
  return best.seat;
}

/** Whether `a` beats `b` in a trick whose led suit is `led`. */
export function beats(a: Card, b: Card, led: string): boolean {
  const as = suitOf(a);
  const bs = suitOf(b);
  if (as === bs) return rankOf(a) > rankOf(b);
  if (as === 'S') return true;
  if (bs === 'S') return false;
  return as === led && bs !== led;
}

function four<T>(make: (seat: Seat) => T): Four<T> {
  return [make(0), make(1), make(2), make(3)];
}

function cloneState(s: SpadesState): SpadesState {
  return {
    ...s,
    hands: four((i) => [...s.hands[i]]),
    bids: [...s.bids] as Four<number | null>,
    tricks: s.tricks.map((t) => ({ ...t, plays: t.plays.map((p) => ({ ...p })) })),
    trick: { leader: s.trick.leader, plays: s.trick.plays.map((p) => ({ ...p })) },
    won: [...s.won] as Four<number>,
    scores: [...s.scores] as Two<number>,
    bags: [...s.bags] as Two<number>,
    lastHand: s.lastHand ? (s.lastHand.map((r) => ({ ...r, nils: r.nils.map((n) => ({ ...n })) })) as Two<TeamHandResult>) : null,
  };
}

// ---------------------------------------------------------------- setup

/** Create a new game, ready for the first `deal` action. (The `setup` UI phase precedes this.) */
export function createSpadesGame(options: SpadesOptions): SpadesState {
  return {
    targetScore: options.targetScore ?? DEFAULT_TARGET_SCORE,
    phase: 'deal',
    handNumber: 0,
    // The deal action moves the dealer on before dealing, so hand 1 is dealt by FIRST_DEALER.
    dealer: nextSeat(FIRST_DEALER, 3),
    hands: [[], [], [], []],
    bids: [null, null, null, null],
    tricks: [],
    trick: { leader: 0, plays: [] },
    spadesBroken: false,
    won: [0, 0, 0, 0],
    scores: [0, 0],
    bags: [0, 0],
    lastHand: null,
    winner: null,
    rngState: options.seed >>> 0,
  };
}

// ---------------------------------------------------------------- legality

/** All cards `seat` may legally play right now (empty if it is not their turn). */
export function legalPlays(state: SpadesState, seat: Seat): Card[] {
  if (state.phase !== 'play' || currentSeat(state) !== seat) return [];
  const hand = state.hands[seat];
  if (state.trick.plays.length === 0) {
    if (!state.spadesBroken) {
      const nonSpades = hand.filter((c) => suitOf(c) !== 'S');
      if (nonSpades.length > 0) return nonSpades;
    }
    return [...hand];
  }
  const led = suitOf(state.trick.plays[0]!.card);
  const following = hand.filter((c) => suitOf(c) === led);
  return following.length > 0 ? following : [...hand];
}

export function isLegalPlay(state: SpadesState, seat: Seat, card: Card): boolean {
  return legalPlays(state, seat).includes(card);
}

// ---------------------------------------------------------------- reducer

export function applySpadesAction(state: SpadesState, action: SpadesAction): SpadesStep {
  const s = cloneState(state);
  const events: SpadesEvent[] = [];
  const emit: Emit = (e) => {
    events.push({ ...e, scores: [...s.scores] as Two<number> } as SpadesEvent);
  };
  switch (action.type) {
    case 'deal':
      doDeal(s, emit);
      break;
    case 'bid':
      doBid(s, action.seat, action.bid, emit);
      break;
    case 'play':
      doPlay(s, action.seat, action.card, emit);
      break;
    case 'continue':
      doContinue(s, emit);
      break;
  }
  return { state: s, events };
}

/** An event without its score snapshot (the reducer adds the snapshot when emitting). */
type EventInput = SpadesEvent extends infer E ? (E extends SpadesEvent ? Omit<E, 'scores'> : never) : never;
type Emit = (e: EventInput) => void;

function doDeal(s: SpadesState, emit: Emit): void {
  if (s.phase !== 'deal') throw new SpadesRuleError(`Cannot deal during ${s.phase}`);
  const rng = new Rng(s.rngState);
  const deck = rng.shuffle(newDeck());
  s.rngState = rng.state;

  s.handNumber += 1;
  s.dealer = nextSeat(s.dealer, 1);
  s.hands = [[], [], [], []];
  // One card at a time, clockwise, starting with the dealer's left.
  deck.forEach((card, i) => s.hands[nextSeat(s.dealer, 1 + i)].push(card));
  s.bids = [null, null, null, null];
  s.tricks = [];
  s.trick = { leader: nextSeat(s.dealer, 1), plays: [] };
  s.spadesBroken = false;
  s.won = [0, 0, 0, 0];
  s.lastHand = null;
  s.phase = 'bid';

  emit({ type: 'hand_started', seat: s.dealer, cards: [], handNumber: s.handNumber });
  emit({ type: 'cards_dealt', seat: null, cards: [] });
}

function doBid(s: SpadesState, seat: Seat, bid: number, emit: Emit): void {
  if (s.phase !== 'bid') throw new SpadesRuleError(`Cannot bid during ${s.phase}`);
  const turn = currentSeat(s);
  if (turn !== seat) throw new SpadesRuleError(`It is seat ${turn}'s turn to bid, not seat ${seat}'s`);
  if (!Number.isInteger(bid) || bid < 0 || bid > 13) throw new SpadesRuleError('A bid must be a whole number from 0 (Nil) to 13');
  s.bids[seat] = bid;
  emit({ type: 'bid_made', seat, cards: [], bid });
  if (s.bids.some((b) => b === null)) return;

  s.phase = 'play';
  const leader = nextSeat(s.dealer, 1);
  s.trick = { leader, plays: [] };
  emit({ type: 'bidding_complete', seat: null, cards: [], bids: [...s.bids] as Four<number> });
  emit({ type: 'trick_started', seat: leader, cards: [], trickNumber: 1 });
}

function doPlay(s: SpadesState, seat: Seat, card: Card, emit: Emit): void {
  if (s.phase !== 'play') throw new SpadesRuleError(`Cannot play during ${s.phase}`);
  const turn = currentSeat(s);
  if (turn !== seat) throw new SpadesRuleError(`It is seat ${turn}'s turn, not seat ${seat}'s`);
  if (!isLegalPlay(s, seat, card)) throw new SpadesRuleError(`Seat ${seat} may not play ${card} now`);

  const trickNumber = s.tricks.length + 1;
  s.hands[seat] = s.hands[seat].filter((c) => c !== card);
  s.trick.plays.push({ seat, card });
  emit({ type: 'card_played', seat, cards: [card], trickNumber });
  if (suitOf(card) === 'S' && !s.spadesBroken) {
    s.spadesBroken = true;
    emit({ type: 'spades_broken', seat, cards: [card] });
  }
  if (s.trick.plays.length < 4) return;

  const winner = trickWinner(s.trick);
  const cards = s.trick.plays.map((p) => p.card);
  const led = suitOf(cards[0]!);
  const winning = s.trick.plays.find((p) => p.seat === winner)!.card;
  const completed: CompletedTrick = { leader: s.trick.leader, plays: s.trick.plays, winner };
  s.tricks.push(completed);
  s.won[winner] += 1;
  emit({ type: 'trick_won', seat: winner, cards, trickNumber, trumped: led !== 'S' && suitOf(winning) === 'S' });
  if (s.bids[winner] === 0 && s.won[winner] === 1) emit({ type: 'nil_failed', seat: winner, cards: [] });

  if (s.tricks.length < 13) {
    s.trick = { leader: winner, plays: [] };
    emit({ type: 'trick_started', seat: winner, cards: [], trickNumber: trickNumber + 1 });
    return;
  }
  scoreHand(s, emit);
}

/** One team's hand score (spec 17 §4), given the bags it carried in. Exported for tests. */
export function scoreTeam(team: Team, bids: readonly number[], won: readonly number[], bagsBefore: number): { result: TeamHandResult; bagsAfter: number } {
  const seats = teamSeats(team);
  const bidders = seats.filter((st) => bids[st]! > 0);
  const nilSeats = seats.filter((st) => bids[st] === 0);
  const contract = bidders.reduce<number>((sum, st) => sum + bids[st]!, 0);
  const counted = bidders.reduce<number>((sum, st) => sum + won[st]!, 0);
  const made = contract > 0 && counted >= contract;
  let contractPoints = 0;
  let bags = 0;
  if (contract > 0) {
    if (made) {
      contractPoints = 10 * contract;
      bags += counted - contract;
    } else contractPoints = -10 * contract;
  } else bags += counted;
  const nils = nilSeats.map((st) => ({ seat: st, made: won[st] === 0 }));
  for (const st of nilSeats) bags += won[st]!;
  const nilPoints = nils.reduce((sum, n) => sum + (n.made ? NIL_POINTS : -NIL_POINTS), 0);
  let bagsAfter = bagsBefore + bags;
  let bagPenalty = 0;
  while (bagsAfter >= BAG_LIMIT) {
    bagsAfter -= BAG_LIMIT;
    bagPenalty -= BAG_PENALTY;
  }
  const total = contractPoints + bags + nilPoints + bagPenalty;
  return { result: { contract, counted, made, contractPoints, bags, nils, nilPoints, bagPenalty, total }, bagsAfter };
}

function scoreHand(s: SpadesState, emit: Emit): void {
  const bids = s.bids as Four<number>;
  const results = ([0, 1] as const).map((team) => scoreTeam(team, bids, s.won, s.bags[team]));
  for (const team of [0, 1] as const) {
    s.scores[team] += results[team]!.result.total;
    s.bags[team] = results[team]!.bagsAfter;
  }
  s.lastHand = [results[0]!.result, results[1]!.result];
  s.phase = 'score';
  emit({ type: 'hand_scored', seat: null, cards: [], results: s.lastHand });
  for (const team of [0, 1] as const) {
    for (let k = 0; k < -s.lastHand[team].bagPenalty / BAG_PENALTY; k++) emit({ type: 'bag_penalty', seat: null, cards: [], team });
  }
}

/** The winning team if the game is over, else null (spec 17 §5). */
export function gameWinner(scores: readonly number[], targetScore: number): Team | null {
  const [a, b] = scores as Two<number>;
  const over = a >= targetScore || b >= targetScore || a <= MERCY_SCORE || b <= MERCY_SCORE;
  if (!over || a === b) return null;
  return a > b ? 0 : 1;
}

/** A team reached the target (or fell to the mercy score) but the scores are tied, so play goes on (D-100). */
export function tiedAtEnd(scores: readonly number[], targetScore: number): boolean {
  const [a, b] = scores as Two<number>;
  const over = a >= targetScore || b >= targetScore || a <= MERCY_SCORE || b <= MERCY_SCORE;
  return over && a === b;
}

function doContinue(s: SpadesState, emit: Emit): void {
  if (s.phase !== 'score') throw new SpadesRuleError(`Cannot continue during ${s.phase}`);
  const winner = gameWinner(s.scores, s.targetScore);
  if (winner !== null) {
    s.phase = 'game_over';
    s.winner = winner;
    emit({ type: 'game_won', seat: null, cards: [], team: winner });
  } else {
    s.phase = 'deal';
  }
}

/** Tricks a team still needs for its contract this hand: contract − counted tricks (spec 17 §7.3). */
export function teamNeed(state: SpadesState, team: Team): number {
  const seats = teamSeats(team);
  let need = 0;
  for (const st of seats) {
    const b = state.bids[st];
    if (b !== null && b > 0) need += b - state.won[st];
  }
  return need;
}

