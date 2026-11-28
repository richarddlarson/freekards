/**
 * Five-Card Draw (spec 19 §2): ante, deal 5, a betting round, one draw, a second betting round, and a
 * showdown. Fixed limit. A pure state machine (spec 10 §4): `applyDrawAction(state, action)` returns a
 * new state and the events, and never changes its input. Chips are conserved: the table's chips plus
 * what is in the pot never change during a hand.
 */
import { newDeck, type Card } from '../core/cards.js';
import { Rng } from '../core/rng.js';
import {
  applyBet,
  canAct,
  legalBets,
  liveSeats,
  nextSeat,
  openRound,
  uncalledBet,
  type BetKind,
  type BettingRound,
  type BettingTable,
  type Stakes,
} from './betting.js';
import { evaluate5, handName, type HandValue } from './hands.js';
import { buildPots, splitPot } from './pots.js';

export const DRAW_HAND_SIZE = 5;

export type DrawPhase = 'idle' | 'bet1' | 'draw' | 'bet2' | 'hand_over';

/** One public betting action, for the computer players' reads (spec 19 §5). */
export interface BetLogEntry {
  seat: number;
  kind: BetKind;
  round: 0 | 1;
  amount: number;
}

export interface PotResult {
  amount: number;
  eligible: number[];
  winners: number[];
  /** The winning hand's name, or null when nobody else was left (no showdown). */
  handName: string | null;
}

export interface DrawHandResult {
  pots: PotResult[];
  /** Chips each seat won this hand (0 for most). */
  won: number[];
  /** The hands shown at a showdown, or null if everyone else folded. */
  shown: { seat: number; cards: Card[]; value: HandValue }[] | null;
}

export interface DrawState extends BettingTable {
  stakes: Stakes;
  /** Someone is sitting in the seat (they may have 0 chips after losing them all). */
  present: boolean[];
  phase: DrawPhase;
  handNumber: number;
  /** The dealer button; −1 before the first hand. */
  button: number;
  /** Undealt cards; the top is the last element. */
  stock: Card[];
  /** Discards and folded hands. */
  muck: Card[];
  hands: Card[][];
  round: BettingRound | null;
  /** Whose turn it is to draw. */
  drawTurn: number | null;
  /** Cards each seat drew this hand (null = hasn't drawn yet). */
  drawn: (number | null)[];
  log: BetLogEntry[];
  rng: number;
  lastHand: DrawHandResult | null;
}

export type DrawAction =
  | { type: 'deal' }
  | { type: BetKind; seat: number }
  | { type: 'draw'; seat: number; discards: Card[] }
  | { type: 'sit'; seat: number; chips: number }
  | { type: 'leave'; seat: number };

export type DrawEvent =
  | { type: 'hand_started'; handNumber: number; button: number }
  | { type: 'ante'; seat: number; amount: number; allIn: boolean }
  | { type: 'dealt' }
  | { type: 'bet_action'; seat: number; kind: BetKind; amount: number; allIn: boolean; round: 0 | 1 }
  | { type: 'round_over'; round: 0 | 1 }
  | { type: 'bet_returned'; seat: number; amount: number }
  | { type: 'drew'; seat: number; count: number }
  | { type: 'showdown'; hands: { seat: number; cards: Card[]; value: HandValue }[] }
  | { type: 'pot_won'; potIndex: number; amount: number; winners: number[]; shares: [number, number][]; handName: string | null }
  | { type: 'hand_over' }
  | { type: 'busted'; seat: number }
  | { type: 'sat'; seat: number; chips: number }
  | { type: 'left'; seat: number; chips: number };

export interface DrawStep {
  state: DrawState;
  events: DrawEvent[];
}

export class PokerRuleError extends Error {}

export interface DrawOptions {
  seed: number;
  stakes: Stakes;
  /** Chips for each seat, or null for an empty seat. Seat 0 is the player. */
  chips: (number | null)[];
}

export function createDrawGame(o: DrawOptions): DrawState {
  const n = o.chips.length;
  return {
    stakes: o.stakes,
    chips: o.chips.map((c) => c ?? 0),
    present: o.chips.map((c) => c !== null),
    inHand: Array(n).fill(false),
    folded: Array(n).fill(false),
    committed: Array(n).fill(0),
    phase: 'idle',
    handNumber: 0,
    button: -1,
    stock: [],
    muck: [],
    hands: Array.from({ length: n }, () => []),
    round: null,
    drawTurn: null,
    drawn: Array(n).fill(null),
    log: [],
    rng: o.seed >>> 0,
    lastHand: null,
  };
}

function clone(s: DrawState): DrawState {
  return {
    ...s,
    chips: [...s.chips],
    present: [...s.present],
    inHand: [...s.inHand],
    folded: [...s.folded],
    committed: [...s.committed],
    stock: [...s.stock],
    muck: [...s.muck],
    hands: s.hands.map((h) => [...h]),
    round: s.round ? { ...s.round, bets: [...s.round.bets], acted: [...s.round.acted] } : null,
    drawn: [...s.drawn],
    log: [...s.log],
  };
}

/** Seats that can be dealt in: sitting, with chips. */
export function dealableSeats(s: DrawState): number[] {
  return s.present.flatMap((p, i) => (p && s.chips[i]! > 0 ? [i] : []));
}

/** Total chips in the pot this hand (everything committed). */
export function potTotal(s: DrawState): number {
  return s.committed.reduce((a, b) => a + b, 0);
}

/** Whose turn it is to act (bet or draw), or null. */
export function actingSeat(s: DrawState): number | null {
  if (s.phase === 'bet1' || s.phase === 'bet2') return s.round?.toAct ?? null;
  if (s.phase === 'draw') return s.drawTurn;
  return null;
}

/** The betting choices for a seat right now (empty when it isn't their turn to bet). */
export function drawLegalBets(s: DrawState, seat: number) {
  if ((s.phase !== 'bet1' && s.phase !== 'bet2') || !s.round) return { kinds: [] as BetKind[], toCall: 0, callAmount: 0, raiseAmount: 0 };
  return legalBets(s, s.round, seat);
}

export function applyDrawAction(state: DrawState, action: DrawAction): DrawStep {
  const s = clone(state);
  const events: DrawEvent[] = [];
  const n = s.chips.length;
  switch (action.type) {
    case 'sit': {
      if (s.phase !== 'idle' && s.phase !== 'hand_over') throw new PokerRuleError('players sit down between hands');
      if (s.present[action.seat] && s.chips[action.seat]! > 0) throw new PokerRuleError('seat is taken');
      if (!(action.chips > 0)) throw new PokerRuleError('must bring chips');
      s.present[action.seat] = true;
      s.chips[action.seat] = Math.floor(action.chips);
      events.push({ type: 'sat', seat: action.seat, chips: s.chips[action.seat]! });
      break;
    }
    case 'leave': {
      if (s.phase !== 'idle' && s.phase !== 'hand_over') throw new PokerRuleError('players leave between hands');
      if (!s.present[action.seat]) throw new PokerRuleError('seat is empty');
      events.push({ type: 'left', seat: action.seat, chips: s.chips[action.seat]! });
      s.present[action.seat] = false;
      s.chips[action.seat] = 0;
      break;
    }
    case 'deal':
      deal(s, events);
      break;
    case 'draw': {
      if (s.phase !== 'draw' || s.drawTurn !== action.seat) throw new PokerRuleError('not your turn to draw');
      const hand = s.hands[action.seat]!;
      const discards = [...new Set(action.discards)];
      if (discards.some((c) => !hand.includes(c))) throw new PokerRuleError('can only discard cards in your hand');
      if (discards.length > DRAW_HAND_SIZE) throw new PokerRuleError('too many discards');
      const kept = hand.filter((c) => !discards.includes(c));
      const rng = new Rng(s.rng);
      // Reshuffle the muck if the stock runs short (never possible with 4 players, but kept general).
      if (s.stock.length < discards.length) {
        s.stock = [...rng.shuffle(s.muck), ...s.stock];
        s.muck = [];
      }
      s.rng = rng.state;
      for (let i = 0; i < discards.length; i++) kept.push(s.stock.pop()!);
      s.muck.push(...discards);
      s.hands[action.seat] = kept;
      s.drawn[action.seat] = discards.length;
      events.push({ type: 'drew', seat: action.seat, count: discards.length });
      s.drawTurn = nextSeat(n, action.seat, (x) => s.inHand[x]! && !s.folded[x] && s.drawn[x] === null);
      advance(s, events);
      break;
    }
    default: {
      const seat = action.seat;
      if ((s.phase !== 'bet1' && s.phase !== 'bet2') || !s.round || s.round.toAct !== seat) throw new PokerRuleError('not your turn to bet');
      if (!legalBets(s, s.round, seat).kinds.includes(action.type)) throw new PokerRuleError(`can't ${action.type} now`);
      const round = s.phase === 'bet1' ? 0 : 1;
      const r = applyBet(s, s.round, seat, action.type);
      if (action.type === 'fold') s.muck.push(...s.hands[seat]!);
      s.log.push({ seat, kind: action.type, round, amount: r.amount });
      events.push({ type: 'bet_action', seat, kind: action.type, amount: r.amount, allIn: r.allIn, round });
      advance(s, events);
    }
  }
  return { state: s, events };
}

function deal(s: DrawState, events: DrawEvent[]): void {
  if (s.phase !== 'idle' && s.phase !== 'hand_over') throw new PokerRuleError('a hand is in progress');
  const seats = dealableSeats(s);
  if (seats.length < 2) throw new PokerRuleError('need at least two players with chips');
  const n = s.chips.length;
  const rng = new Rng(s.rng);
  s.button = s.button < 0 ? rng.pick(seats) : nextSeat(n, s.button, (x) => seats.includes(x))!;
  s.handNumber++;
  s.inHand = s.chips.map((_, i) => seats.includes(i));
  s.folded.fill(false);
  s.committed.fill(0);
  s.drawn.fill(null);
  s.hands = Array.from({ length: n }, () => []);
  s.log = [];
  s.muck = [];
  s.lastHand = null;
  s.stock = rng.shuffle(newDeck());
  s.rng = rng.state;
  events.push({ type: 'hand_started', handNumber: s.handNumber, button: s.button });
  for (const seat of seats) {
    const amount = Math.min(s.stakes.ante, s.chips[seat]!);
    s.chips[seat]! -= amount;
    s.committed[seat]! += amount;
    events.push({ type: 'ante', seat, amount, allIn: s.chips[seat] === 0 });
  }
  // One card at a time, starting left of the button.
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9].slice(0, n).map((k) => (s.button + k) % n).filter((x) => s.inHand[x]);
  for (let i = 0; i < DRAW_HAND_SIZE; i++) for (const seat of order) s.hands[seat]!.push(s.stock.pop()!);
  events.push({ type: 'dealt' });
  s.phase = 'bet1';
  s.round = openRound(s, s.button, s.stakes.smallBet);
  advance(s, events);
}

/** Move the hand on after an action: end betting rounds, start the draw, or settle the hand. */
function advance(s: DrawState, events: DrawEvent[]): void {
  const n = s.chips.length;
  for (;;) {
    if ((s.phase === 'bet1' || s.phase === 'bet2') && s.round && s.round.toAct === null) {
      const round = s.phase === 'bet1' ? 0 : 1;
      const back = uncalledBet(s, s.round);
      if (back) {
        s.chips[back.seat]! += back.amount;
        s.committed[back.seat]! -= back.amount;
        s.round.bets[back.seat]! -= back.amount;
        events.push({ type: 'bet_returned', seat: back.seat, amount: back.amount });
      }
      events.push({ type: 'round_over', round });
      s.round = null;
      if (liveSeats(s).length <= 1) return settle(s, events, false);
      if (round === 1) return settle(s, events, true);
      s.phase = 'draw';
      s.drawTurn = nextSeat(n, s.button, (x) => s.inHand[x]! && !s.folded[x]);
      continue;
    }
    if (s.phase === 'draw' && s.drawTurn === null) {
      s.phase = 'bet2';
      s.round = openRound(s, s.button, s.stakes.bigBet);
      continue;
    }
    return;
  }
}

/** Award the pots: by showdown, or to the last player left. */
function settle(s: DrawState, events: DrawEvent[], showdown: boolean): void {
  const n = s.chips.length;
  const live = liveSeats(s);
  const won: number[] = Array(n).fill(0);
  const pots: PotResult[] = [];
  let shown: DrawHandResult['shown'] = null;
  if (showdown && live.length > 1) {
    shown = live.map((seat) => ({ seat, cards: [...s.hands[seat]!], value: evaluate5(s.hands[seat]!) }));
    events.push({ type: 'showdown', hands: shown });
  }
  const values = new Map(shown?.map((h) => [h.seat, h.value]) ?? []);
  buildPots(s.committed, s.folded).forEach((pot, potIndex) => {
    let winners = pot.eligible;
    let name: string | null = null;
    if (shown && pot.eligible.length > 1) {
      const best = Math.max(...pot.eligible.map((x) => values.get(x)!.score));
      winners = pot.eligible.filter((x) => values.get(x)!.score === best);
      name = handName(values.get(winners[0]!)!);
    } else if (shown && values.has(pot.eligible[0]!)) name = handName(values.get(pot.eligible[0]!)!);
    const shares = splitPot(pot.amount, winners, s.button, n);
    for (const [seat, amt] of shares) {
      s.chips[seat]! += amt;
      won[seat]! += amt;
    }
    pots.push({ amount: pot.amount, eligible: pot.eligible, winners, handName: name });
    events.push({ type: 'pot_won', potIndex, amount: pot.amount, winners, shares: [...shares], handName: name });
  });
  s.lastHand = { pots, won, shown };
  s.committed.fill(0); // everything put in is now paid out
  s.phase = 'hand_over';
  s.drawTurn = null;
  events.push({ type: 'hand_over' });
  for (let seat = 0; seat < n; seat++) if (s.present[seat] && s.inHand[seat] && s.chips[seat] === 0) events.push({ type: 'busted', seat });
}

/** Whether the seat may still act in this hand at all (for the presentation). */
export function stillIn(s: DrawState, seat: number): boolean {
  return s.inHand[seat]! && !s.folded[seat];
}

export { canAct };
