/**
 * Hearts rules engine (spec 06-hearts.md §1–§4).
 *
 * Pure and deterministic: `applyHeartsAction(state, action)` returns a new state plus the
 * events produced. The input state is never mutated. All randomness comes from `state.rngState`.
 */

import { newDeck, rankOf, suitOf, type Card } from '../core/cards.js';
import { Rng } from '../core/rng.js';
import {
  HeartsRuleError,
  SEATS,
  type CompletedTrick,
  type HeartsAction,
  type HeartsEvent,
  type HeartsOptions,
  type HeartsRuleSet,
  type HeartsState,
  type HeartsStep,
  type PassDirection,
  type Seat,
} from './types.js';

export const QUEEN_OF_SPADES: Card = 'QS';
export const JACK_OF_DIAMONDS: Card = 'JD';
export const TWO_OF_CLUBS: Card = '2C';
export const MOON_PENALTY = 26;
export const DEFAULT_TARGET_SCORE = 100;
const PASS_CYCLE: readonly PassDirection[] = ['left', 'right', 'across', 'none'];

type Four<T> = [T, T, T, T];

// ---------------------------------------------------------------- helpers

export { nextSeat } from '../core/seats.js';
import { nextSeat } from '../core/seats.js';

/** Pass direction for a 1-based hand number: left, right, across, none, repeating. */
export function passDirectionFor(handNumber: number): PassDirection {
  return PASS_CYCLE[(handNumber - 1) % 4]!;
}

/** The seat that receives `from`'s passed cards. Left = next clockwise seat. */
export function passTarget(from: Seat, direction: PassDirection): Seat {
  switch (direction) {
    case 'left':
      return nextSeat(from, 1);
    case 'across':
      return nextSeat(from, 2);
    case 'right':
      return nextSeat(from, 3);
    case 'none':
      return from;
  }
}

export function isPointCard(card: Card): boolean {
  return suitOf(card) === 'H' || card === QUEEN_OF_SPADES;
}

/** Point value of one card under a rule set. */
export function cardPoints(card: Card, ruleSet: HeartsRuleSet): number {
  if (suitOf(card) === 'H') return 1;
  if (card === QUEEN_OF_SPADES) return 13;
  if (card === JACK_OF_DIAMONDS && ruleSet === 'jack-of-diamonds') return -10;
  return 0;
}

export function cardsPoints(cards: readonly Card[], ruleSet: HeartsRuleSet): number {
  return cards.reduce((sum, c) => sum + cardPoints(c, ruleSet), 0);
}

/** Seat whose turn it is in the play phase (null otherwise). */
export function currentSeat(state: HeartsState): Seat | null {
  if (state.phase !== 'play') return null;
  return nextSeat(state.trick.leader, state.trick.plays.length);
}

/** Winner of a (complete or partial) trick: highest card of the led suit. */
export function trickWinner(trick: { leader: Seat; plays: readonly { seat: Seat; card: Card }[] }): Seat {
  const first = trick.plays[0];
  if (!first) return trick.leader;
  const led = suitOf(first.card);
  let best = first;
  for (const p of trick.plays) {
    if (suitOf(p.card) === led && rankOf(p.card) > rankOf(best.card)) best = p;
  }
  return best.seat;
}

function four<T>(make: (seat: Seat) => T): Four<T> {
  return [make(0), make(1), make(2), make(3)];
}

function cloneState(s: HeartsState): HeartsState {
  return {
    ...s,
    hands: four((i) => [...s.hands[i]]),
    passSelections: four((i) => (s.passSelections[i] ? [...s.passSelections[i]!] : null)),
    received: four((i) => [...s.received[i]]),
    tricks: s.tricks.map((t) => ({ ...t, plays: t.plays.map((p) => ({ ...p })) })),
    trick: { leader: s.trick.leader, plays: s.trick.plays.map((p) => ({ ...p })) },
    taken: four((i) => [...s.taken[i]]),
    scores: [...s.scores] as Four<number>,
    lastHand: s.lastHand
      ? { points: [...s.lastHand.points] as Four<number>, moonShooter: s.lastHand.moonShooter }
      : null,
  };
}

// ---------------------------------------------------------------- setup

/** Create a new game, ready for the first `deal` action. (The `setup` UI phase precedes this.) */
export function createHeartsGame(options: HeartsOptions): HeartsState {
  return {
    ruleSet: options.ruleSet,
    targetScore: options.targetScore ?? DEFAULT_TARGET_SCORE,
    phase: 'deal',
    handNumber: 0,
    passDirection: 'left',
    hands: [[], [], [], []],
    passSelections: [null, null, null, null],
    received: [[], [], [], []],
    tricks: [],
    trick: { leader: 0, plays: [] },
    heartsBroken: false,
    taken: [[], [], [], []],
    scores: [0, 0, 0, 0],
    lastHand: null,
    winner: null,
    rngState: options.seed >>> 0,
  };
}

// ---------------------------------------------------------------- legality

/** All cards `seat` may legally play right now (empty if it is not their turn). */
export function legalPlays(state: HeartsState, seat: Seat): Card[] {
  if (state.phase !== 'play' || currentSeat(state) !== seat) return [];
  const hand = state.hands[seat];
  const firstTrick = state.tricks.length === 0;
  const leading = state.trick.plays.length === 0;

  if (leading) {
    if (firstTrick) return hand.includes(TWO_OF_CLUBS) ? [TWO_OF_CLUBS] : [];
    if (!state.heartsBroken) {
      const nonHearts = hand.filter((c) => suitOf(c) !== 'H');
      if (nonHearts.length > 0) return nonHearts;
    }
    return [...hand];
  }

  const led = suitOf(state.trick.plays[0]!.card);
  const following = hand.filter((c) => suitOf(c) === led);
  if (following.length > 0) return following;

  if (firstTrick) {
    const safe = hand.filter((c) => !isPointCard(c));
    if (safe.length > 0) return safe;
  }
  return [...hand];
}

export function isLegalPlay(state: HeartsState, seat: Seat, card: Card): boolean {
  return legalPlays(state, seat).includes(card);
}

// ---------------------------------------------------------------- reducer

export function applyHeartsAction(state: HeartsState, action: HeartsAction): HeartsStep {
  const s = cloneState(state);
  const events: HeartsEvent[] = [];
  const emit: Emit = (e) => {
    events.push({ ...e, scores: [...s.scores] as Four<number> } as HeartsEvent);
  };

  switch (action.type) {
    case 'deal':
      doDeal(s, emit);
      break;
    case 'pass':
      doPass(s, action.seat, action.cards, emit);
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
type EventInput = HeartsEvent extends infer E ? (E extends HeartsEvent ? Omit<E, 'scores'> : never) : never;
type Emit = (e: EventInput) => void;

function doDeal(s: HeartsState, emit: Emit): void {
  if (s.phase !== 'deal') throw new HeartsRuleError(`Cannot deal during ${s.phase}`);
  const rng = new Rng(s.rngState);
  const deck = rng.shuffle(newDeck());
  s.rngState = rng.state;

  s.handNumber += 1;
  s.passDirection = passDirectionFor(s.handNumber);
  s.hands = [[], [], [], []];
  // One card at a time, clockwise, starting with West (seat 1).
  deck.forEach((card, i) => s.hands[nextSeat(1, i)].push(card));
  s.passSelections = [null, null, null, null];
  s.received = [[], [], [], []];
  s.tricks = [];
  s.taken = [[], [], [], []];
  s.heartsBroken = false;
  s.lastHand = null;

  emit({ type: 'hand_started', seat: null, cards: [], handNumber: s.handNumber });
  emit({ type: 'cards_dealt', seat: null, cards: [] });
  emit({ type: 'pass_direction_announced', seat: null, cards: [], direction: s.passDirection });

  if (s.passDirection === 'none') startPlay(s, emit);
  else s.phase = 'pass';
}

function doPass(s: HeartsState, seat: Seat, cards: Card[], emit: Emit): void {
  if (s.phase !== 'pass') throw new HeartsRuleError(`Cannot pass during ${s.phase}`);
  if (s.passSelections[seat]) throw new HeartsRuleError(`Seat ${seat} has already passed`);
  if (cards.length !== 3 || new Set(cards).size !== 3) {
    throw new HeartsRuleError('Exactly 3 different cards must be passed');
  }
  for (const c of cards) {
    if (!s.hands[seat].includes(c)) throw new HeartsRuleError(`Seat ${seat} does not hold ${c}`);
  }
  s.passSelections[seat] = [...cards];
  if (s.passSelections.some((p) => p === null)) return;

  // Everyone has chosen: exchange simultaneously.
  const selections = s.passSelections as Four<Card[]>;
  for (const from of SEATS) {
    s.hands[from] = s.hands[from].filter((c) => !selections[from].includes(c));
  }
  s.received = [[], [], [], []];
  for (const from of SEATS) {
    const to = passTarget(from, s.passDirection);
    s.hands[to].push(...selections[from]);
    s.received[to] = [...selections[from]];
    emit({ type: 'cards_passed', seat: from, cards: [...selections[from]], direction: s.passDirection, from, to });
  }
  s.passSelections = [null, null, null, null];
  startPlay(s, emit);
}

function startPlay(s: HeartsState, emit: Emit): void {
  s.phase = 'play';
  const leader = SEATS.find((seat) => s.hands[seat].includes(TWO_OF_CLUBS))!;
  s.trick = { leader, plays: [] };
  emit({ type: 'trick_started', seat: leader, cards: [], trickNumber: 1 });
}

function doPlay(s: HeartsState, seat: Seat, card: Card, emit: Emit): void {
  if (s.phase !== 'play') throw new HeartsRuleError(`Cannot play during ${s.phase}`);
  const turn = currentSeat(s);
  if (turn !== seat) throw new HeartsRuleError(`It is seat ${turn}'s turn, not seat ${seat}'s`);
  if (!isLegalPlay(s, seat, card)) throw new HeartsRuleError(`Seat ${seat} may not play ${card} now`);

  const trickNumber = s.tricks.length + 1;
  s.hands[seat] = s.hands[seat].filter((c) => c !== card);
  s.trick.plays.push({ seat, card });
  emit({ type: 'card_played', seat, cards: [card], trickNumber });

  if (suitOf(card) === 'H' && !s.heartsBroken) {
    s.heartsBroken = true;
    emit({ type: 'hearts_broken', seat, cards: [card] });
  }

  if (s.trick.plays.length < 4) return;

  // Trick complete.
  const winner = trickWinner(s.trick);
  const cards = s.trick.plays.map((p) => p.card);
  const completed: CompletedTrick = { leader: s.trick.leader, plays: s.trick.plays, winner };
  s.tricks.push(completed);
  s.taken[winner].push(...cards);
  emit({ type: 'trick_won', seat: winner, cards, trickNumber, trickPoints: cardsPoints(cards, s.ruleSet) });
  if (cards.includes(QUEEN_OF_SPADES)) emit({ type: 'queen_of_spades_taken', seat: winner, cards: [QUEEN_OF_SPADES] });
  if (s.ruleSet === 'jack-of-diamonds' && cards.includes(JACK_OF_DIAMONDS)) {
    emit({ type: 'jack_of_diamonds_taken', seat: winner, cards: [JACK_OF_DIAMONDS] });
  }

  if (s.tricks.length < 13) {
    s.trick = { leader: winner, plays: [] };
    emit({ type: 'trick_started', seat: winner, cards: [], trickNumber: trickNumber + 1 });
    return;
  }
  scoreHand(s, emit);
}

/** Hand scoring including shoot-the-moon (spec 06 §2). Exported for tests. */
export function computeHandResult(
  taken: readonly (readonly Card[])[],
  ruleSet: HeartsRuleSet,
): { result: { points: Four<number>; moonShooter: Seat | null }; nearMoon: { seat: Seat; blocker: Seat } | null } {
  const pointCardCounts = SEATS.map((seat) => taken[seat]!.filter(isPointCard).length);
  const shooter = SEATS.find((seat) => pointCardCounts[seat] === 14) ?? null;
  const jdBonus = (seat: Seat): number =>
    ruleSet === 'jack-of-diamonds' && taken[seat]!.includes(JACK_OF_DIAMONDS) ? -10 : 0;

  let points: Four<number>;
  if (shooter !== null) {
    points = four((seat) => (seat === shooter ? 0 : MOON_PENALTY) + jdBonus(seat));
  } else {
    points = four((seat) => cardsPoints(taken[seat]!, ruleSet));
  }

  let nearMoon: { seat: Seat; blocker: Seat } | null = null;
  const near = SEATS.find((seat) => pointCardCounts[seat] === 13);
  if (near !== undefined) {
    const blocker = SEATS.find((seat) => seat !== near && pointCardCounts[seat] === 1)!;
    nearMoon = { seat: near, blocker };
  }
  return { result: { points, moonShooter: shooter }, nearMoon };
}

function scoreHand(s: HeartsState, emit: Emit): void {
  const { result, nearMoon } = computeHandResult(s.taken, s.ruleSet);
  if (result.moonShooter !== null) {
    emit({ type: 'moon_shot', seat: result.moonShooter, cards: s.taken[result.moonShooter].filter(isPointCard) });
  } else if (nearMoon) {
    emit({ type: 'moon_shot_blocked', seat: nearMoon.seat, cards: [], blocker: nearMoon.blocker });
  }
  for (const seat of SEATS) s.scores[seat] += result.points[seat];
  s.lastHand = result;
  s.phase = 'score';
  emit({ type: 'hand_scored', seat: null, cards: [], handPoints: [...result.points] as Four<number> });
}

/** Returns the winning seat if the game is over, else null (spec 06 §2: ≥ target, unique lowest). */
export function gameWinner(scores: readonly number[], targetScore: number): Seat | null {
  if (!scores.some((v) => v >= targetScore)) return null;
  const low = Math.min(...scores);
  const lows = SEATS.filter((seat) => scores[seat] === low);
  return lows.length === 1 ? lows[0]! : null;
}

function doContinue(s: HeartsState, emit: Emit): void {
  if (s.phase !== 'score') throw new HeartsRuleError(`Cannot continue during ${s.phase}`);
  const winner = gameWinner(s.scores, s.targetScore);
  if (winner !== null) {
    s.phase = 'game_over';
    s.winner = winner;
    emit({ type: 'game_won', seat: winner, cards: [] });
  } else {
    s.phase = 'deal';
  }
}
