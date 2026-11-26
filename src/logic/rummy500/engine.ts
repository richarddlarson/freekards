/**
 * Rummy 500 rules engine (spec 18 §3), for two players. Pure and deterministic:
 * `applyRummy500Action(state, action)` returns a new state and the events produced.
 */
import { newDeck, rankOf, type Card } from '../core/cards.js';
import { Rng } from '../core/rng.js';
import { allMelds, asMeld, canLayOff, layOff, valueOf } from '../rummy/melds.js';
import {
  Rummy500RuleError,
  type Player,
  type Rummy500Action,
  type Rummy500Event,
  type Rummy500HandResult,
  type Rummy500Options,
  type Rummy500State,
  type Rummy500Step,
  type TableMeld,
  type Two,
} from './types.js';

export const DEFAULT_RUMMY500_TARGET = 500;
export const RUMMY500_HAND_SIZE = 13;
/** The computer deals hand 1, so the player takes the first turn (spec 18 §3.2). */
export const RUMMY500_FIRST_DEALER: Player = 1;

/** Card value in Rummy 500: Ace 15, 10 J Q K 10, 2–9 face value. */
export function rummy500Value(card: Card): number {
  const r = rankOf(card);
  if (r === 14) return 15;
  return Math.min(10, r);
}

const other = (p: Player): Player => (1 - p) as Player;

function clone(s: Rummy500State): Rummy500State {
  return {
    ...s,
    hands: [[...s.hands[0]], [...s.hands[1]]],
    stock: [...s.stock],
    discard: [...s.discard],
    melds: s.melds.map((m) => ({ ...m, cards: [...m.cards] })),
    played: [[...s.played[0]], [...s.played[1]]],
    scores: [...s.scores] as Two<number>,
  };
}

export function createRummy500Game(options: Rummy500Options): Rummy500State {
  return {
    targetScore: options.targetScore ?? DEFAULT_RUMMY500_TARGET,
    phase: 'deal',
    handNumber: 0,
    dealer: other(RUMMY500_FIRST_DEALER),
    turn: RUMMY500_FIRST_DEALER,
    hands: [[], []],
    stock: [],
    discard: [],
    melds: [],
    played: [[], []],
    mustUse: null,
    takenTop: null,
    scores: [0, 0],
    lastHand: null,
    winner: null,
    rngState: options.seed >>> 0,
  };
}

/** Whether `card` can be used right away with `hand` (which includes it): in a new meld, or laid off on the table. */
export function canUse(card: Card, hand: readonly Card[], melds: readonly TableMeld[]): boolean {
  if (melds.some((m) => canLayOff(card, m, 'both'))) return true;
  return allMelds(hand, 'both').some((m) => m.cards.includes(card));
}

/** Discard-pile indexes the player may take now (spec 18 §3.3). The top card can always be taken. */
export function takeableIndexes(state: Rummy500State, player: Player): number[] {
  if (state.phase !== 'draw' || state.turn !== player) return [];
  const out: number[] = [];
  const top = state.discard.length - 1;
  for (let i = 0; i <= top; i++) {
    if (i === top || canUse(state.discard[i]!, [...state.hands[player], ...state.discard.slice(i)], state.melds)) out.push(i);
  }
  return out;
}

/** Cards the player may discard now. */
export function legalDiscards(state: Rummy500State, player: Player): Card[] {
  if (state.phase !== 'play' || state.turn !== player || state.mustUse) return [];
  const hand = state.hands[player];
  if (hand.length === 1) return [...hand];
  return hand.filter((c) => c !== state.takenTop);
}

/** Melds on the table that `card` can be laid off on (indexes). */
export function layOffTargets(state: Rummy500State, card: Card): number[] {
  return state.melds.flatMap((m, i) => (canLayOff(card, m, 'both') ? [i] : []));
}

/** Score a finished hand: what each player put on the table, minus what is left in hand. */
export function scoreHand(state: Rummy500State, endedBy: 'out' | 'stock', outPlayer: Player | null): Rummy500HandResult {
  const melded: Two<number> = [valueOf(state.played[0], rummy500Value), valueOf(state.played[1], rummy500Value)];
  const inHand: Two<number> = [valueOf(state.hands[0], rummy500Value), valueOf(state.hands[1], rummy500Value)];
  return {
    endedBy,
    outPlayer,
    melded,
    inHand,
    handCards: [[...state.hands[0]], [...state.hands[1]]],
    total: [melded[0] - inHand[0], melded[1] - inHand[1]],
  };
}

/** The winner once a player has reached the target, or null (also null on a tie: another hand is played). */
export function rummy500Winner(scores: Two<number>, target: number): Player | null {
  if (Math.max(...scores) < target || scores[0] === scores[1]) return null;
  return scores[0] > scores[1] ? 0 : 1;
}

/** An event before the scores snapshot is added (distributes over the event union). */
type WithoutScores<T> = T extends unknown ? Omit<T, 'scores'> : never;

export function applyRummy500Action(state: Rummy500State, action: Rummy500Action): Rummy500Step {
  const s = clone(state);
  const events: Rummy500Event[] = [];
  const ev = (e: WithoutScores<Rummy500Event>): void => {
    events.push({ ...e, scores: [...s.scores] as Two<number> } as Rummy500Event);
  };
  const turnCheck = (player: Player, phase: Rummy500State['phase']): void => {
    if (s.phase !== phase) throw new Rummy500RuleError(`not in ${phase} phase`);
    if (s.turn !== player) throw new Rummy500RuleError('not your turn');
  };
  const endHand = (endedBy: 'out' | 'stock', outPlayer: Player | null): void => {
    if (endedBy === 'out') ev({ type: 'went_out', player: outPlayer, cards: [] });
    else ev({ type: 'stock_empty', player: null, cards: [] });
    const r = scoreHand(s, endedBy, outPlayer);
    s.scores = [s.scores[0] + r.total[0], s.scores[1] + r.total[1]];
    s.lastHand = r;
    s.phase = 'hand_over';
    ev({ type: 'hand_scored', player: null, cards: [], result: r });
  };
  /** After a meld or lay-off: an empty hand means the player went out. */
  const afterPlay = (player: Player): void => {
    if (s.hands[player].length === 0) endHand('out', player);
  };

  switch (action.type) {
    case 'deal': {
      if (s.phase !== 'deal') throw new Rummy500RuleError('not in deal phase');
      s.dealer = other(s.dealer);
      s.handNumber += 1;
      const rng = new Rng(s.rngState);
      const deck = rng.shuffle(newDeck());
      s.rngState = rng.state;
      s.hands = [[], []];
      for (let i = 0; i < 2 * RUMMY500_HAND_SIZE; i++) s.hands[((s.dealer + 1 + i) % 2) as Player].push(deck[i]!);
      s.discard = [deck[2 * RUMMY500_HAND_SIZE]!];
      s.stock = deck.slice(2 * RUMMY500_HAND_SIZE + 1);
      s.melds = [];
      s.played = [[], []];
      s.mustUse = null;
      s.takenTop = null;
      s.lastHand = null;
      s.turn = other(s.dealer);
      s.phase = 'draw';
      ev({ type: 'hand_started', player: s.dealer, cards: [], handNumber: s.handNumber });
      ev({ type: 'cards_dealt', player: null, cards: [] });
      ev({ type: 'upcard_turned', player: null, cards: [s.discard[0]!] });
      break;
    }
    case 'draw_stock': {
      turnCheck(action.player, 'draw');
      if (s.stock.length === 0) throw new Rummy500RuleError('stock is empty');
      const card = s.stock.pop()!;
      s.hands[action.player].push(card);
      s.phase = 'play';
      ev({ type: 'drew_stock', player: action.player, cards: [card] });
      break;
    }
    case 'take_discard': {
      turnCheck(action.player, 'draw');
      if (!takeableIndexes(s, action.player).includes(action.index)) throw new Rummy500RuleError('cannot take that discard');
      const taken = s.discard.slice(action.index);
      s.discard = s.discard.slice(0, action.index);
      s.hands[action.player].push(...taken);
      const top = taken.length === 1;
      s.mustUse = top ? null : taken[0]!;
      s.takenTop = top ? taken[0]! : null;
      s.phase = 'play';
      ev({ type: 'took_discard', player: action.player, cards: taken, index: action.index });
      break;
    }
    case 'meld': {
      turnCheck(action.player, 'play');
      const hand = s.hands[action.player];
      if (!action.cards.every((c) => hand.includes(c))) throw new Rummy500RuleError('cards not in hand');
      const meld = asMeld(action.cards, 'both');
      if (!meld) throw new Rummy500RuleError('not a valid meld');
      if (s.mustUse && !meld.cards.includes(s.mustUse)) throw new Rummy500RuleError(`must use ${s.mustUse} first`);
      s.mustUse = null;
      s.hands[action.player] = hand.filter((c) => !meld.cards.includes(c));
      s.melds.push({ ...meld, owner: action.player });
      s.played[action.player].push(...meld.cards);
      ev({ type: 'melded', player: action.player, cards: meld.cards, meld: s.melds.length - 1, points: valueOf(meld.cards, rummy500Value) });
      afterPlay(action.player);
      break;
    }
    case 'lay_off': {
      turnCheck(action.player, 'play');
      const hand = s.hands[action.player];
      const target = s.melds[action.meld];
      if (!hand.includes(action.card)) throw new Rummy500RuleError('card not in hand');
      if (!target || !canLayOff(action.card, target, 'both')) throw new Rummy500RuleError('cannot lay off there');
      if (s.mustUse && s.mustUse !== action.card) throw new Rummy500RuleError(`must use ${s.mustUse} first`);
      s.mustUse = null;
      s.hands[action.player] = hand.filter((c) => c !== action.card);
      s.melds[action.meld] = { ...layOff(target, action.card, 'both'), owner: target.owner };
      s.played[action.player].push(action.card);
      ev({ type: 'laid_off', player: action.player, cards: [action.card], meld: action.meld, meldOwner: target.owner, points: rummy500Value(action.card) });
      afterPlay(action.player);
      break;
    }
    case 'discard': {
      turnCheck(action.player, 'play');
      if (!legalDiscards(s, action.player).includes(action.card)) throw new Rummy500RuleError('illegal discard');
      s.hands[action.player] = s.hands[action.player].filter((c) => c !== action.card);
      s.discard.push(action.card);
      s.takenTop = null;
      ev({ type: 'discarded', player: action.player, cards: [action.card] });
      if (s.hands[action.player].length === 0) endHand('out', action.player);
      else if (s.stock.length === 0) endHand('stock', null);
      else {
        s.turn = other(action.player);
        s.phase = 'draw';
      }
      break;
    }
    case 'continue': {
      if (s.phase !== 'hand_over') throw new Rummy500RuleError('not in hand_over phase');
      const winner = rummy500Winner(s.scores, s.targetScore);
      if (winner !== null) {
        s.winner = winner;
        s.phase = 'game_over';
        ev({ type: 'game_won', player: winner, cards: [] });
      } else s.phase = 'deal';
      break;
    }
  }
  return { state: s, events };
}
