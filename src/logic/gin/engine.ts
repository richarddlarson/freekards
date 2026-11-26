/**
 * Gin Rummy rules engine (spec 18 §2). Pure and deterministic: `applyGinAction(state, action)`
 * returns a new state and the events produced. The input state is never mutated.
 */
import { newDeck, rankOf, type Card } from '../core/cards.js';
import { Rng } from '../core/rng.js';
import { bestArrangement, bestWithLayoffs, type Arrangement } from '../rummy/melds.js';
import {
  GinRuleError,
  type GinAction,
  type GinEvent,
  type GinGameResult,
  type GinHandResult,
  type GinOptions,
  type GinState,
  type GinStep,
  type Player,
  type Two,
} from './types.js';

export const DEFAULT_GIN_TARGET = 100;
export const HAND_SIZE = 10;
export const KNOCK_LIMIT = 10;
export const GIN_BONUS = 25;
export const UNDERCUT_BONUS = 25;
export const GAME_BONUS = 100;
export const BOX_BONUS = 25;
/** The hand is dead when a discard leaves this many cards (or fewer) in the stock without a knock. */
export const DEAD_STOCK = 2;
/** The computer deals hand 1, so the player gets the first look at the upcard (spec 18 §2.2). */
export const FIRST_DEALER: Player = 1;

/** Card value in Gin: Ace 1, 2–10 face value, J Q K 10. */
export function ginValue(card: Card): number {
  const r = rankOf(card);
  return r === 14 ? 1 : Math.min(10, r);
}

export function ginArrangement(hand: readonly Card[]): Arrangement {
  return bestArrangement(hand, ginValue, 'low');
}

export function deadwoodValue(hand: readonly Card[]): number {
  return ginArrangement(hand).deadwoodValue;
}

export function other(p: Player): Player {
  return (1 - p) as Player;
}

function clone(s: GinState): GinState {
  return {
    ...s,
    hands: [[...s.hands[0]], [...s.hands[1]]],
    stock: [...s.stock],
    discard: [...s.discard],
    scores: [...s.scores] as Two<number>,
    handsWon: [...s.handsWon] as Two<number>,
  };
}

export function createGinGame(options: GinOptions): GinState {
  return {
    targetScore: options.targetScore ?? DEFAULT_GIN_TARGET,
    phase: 'deal',
    handNumber: 0,
    // The deal action moves the dealer on first, so FIRST_DEALER deals hand 1.
    dealer: other(FIRST_DEALER),
    turn: FIRST_DEALER,
    hands: [[], []],
    stock: [],
    discard: [],
    upcardPasses: 0,
    stockOnly: false,
    takenDiscard: null,
    scores: [0, 0],
    handsWon: [0, 0],
    lastHand: null,
    result: null,
    rngState: options.seed >>> 0,
  };
}

/** Cards the player may discard now (everything except a card just taken from the discard pile). */
export function legalDiscards(state: GinState, player: Player): Card[] {
  if (state.phase !== 'discard' || state.turn !== player) return [];
  return state.hands[player].filter((c) => c !== state.takenDiscard);
}

/** Whether discarding `card` would leave deadwood of 10 or less, so the player may knock. */
export function canKnockWith(state: GinState, player: Player, card: Card): boolean {
  if (!legalDiscards(state, player).includes(card)) return false;
  return deadwoodValue(state.hands[player].filter((c) => c !== card)) <= KNOCK_LIMIT;
}

/** The game is over when a player has reached the target (spec 18 §2.7). */
export function ginGameWinner(scores: Two<number>, target: number): Player | null {
  if (scores[0] >= target && scores[0] >= scores[1]) return 0;
  if (scores[1] >= target) return 1;
  return null;
}

/** Score a knock (or gin): spec 18 §2.6. */
export function scoreKnock(knocker: Player, knockerHand: readonly Card[], defenderHand: readonly Card[]): GinHandResult {
  const defender = other(knocker);
  const k = ginArrangement(knockerHand);
  if (k.deadwoodValue > KNOCK_LIMIT) throw new GinRuleError('too much deadwood to knock');
  const gin = k.deadwoodValue === 0;
  const d = gin ? { ...ginArrangement(defenderHand), layoffs: [] } : bestWithLayoffs(defenderHand, k.melds, ginValue, 'low');
  const melds = [[], []] as Two<GinHandResult['melds'][0]>;
  const deadwood = [[], []] as Two<Card[]>;
  const value = [0, 0] as Two<number>;
  melds[knocker] = k.melds;
  deadwood[knocker] = k.deadwood;
  value[knocker] = k.deadwoodValue;
  melds[defender] = d.melds;
  deadwood[defender] = d.deadwood;
  value[defender] = d.deadwoodValue;
  if (gin) {
    const points = d.deadwoodValue;
    return { kind: 'gin', knocker, winner: knocker, melds, deadwood, deadwoodValue: value, layoffs: [], points, bonus: GIN_BONUS, total: points + GIN_BONUS };
  }
  if (d.deadwoodValue <= k.deadwoodValue) {
    const points = k.deadwoodValue - d.deadwoodValue;
    return { kind: 'undercut', knocker, winner: defender, melds, deadwood, deadwoodValue: value, layoffs: d.layoffs, points, bonus: UNDERCUT_BONUS, total: points + UNDERCUT_BONUS };
  }
  const points = d.deadwoodValue - k.deadwoodValue;
  return { kind: 'knock', knocker, winner: knocker, melds, deadwood, deadwoodValue: value, layoffs: d.layoffs, points, bonus: 0, total: points };
}

/** End-of-game bonuses (spec 18 §2.7). */
export function gameResult(winner: Player, scores: Two<number>, handsWon: Two<number>): GinGameResult {
  const boxBonus: Two<number> = [handsWon[0] * BOX_BONUS, handsWon[1] * BOX_BONUS];
  const shutout = handsWon[other(winner)] === 0;
  const finalTotals: Two<number> = [scores[0] + boxBonus[0], scores[1] + boxBonus[1]];
  finalTotals[winner] += GAME_BONUS;
  if (shutout) finalTotals[winner] *= 2;
  return { winner, gameBonus: GAME_BONUS, boxBonus, shutout, finalTotals };
}

/** An event before the scores snapshot is added (distributes over the event union). */
type WithoutScores<T> = T extends unknown ? Omit<T, 'scores'> : never;

export function applyGinAction(state: GinState, action: GinAction): GinStep {
  const s = clone(state);
  const events: GinEvent[] = [];
  const ev = (e: WithoutScores<GinEvent>): void => {
    events.push({ ...e, scores: [...s.scores] as Two<number> } as GinEvent);
  };
  const turnCheck = (player: Player, phase: GinState['phase']): void => {
    if (s.phase !== phase) throw new GinRuleError(`not in ${phase} phase`);
    if (s.turn !== player) throw new GinRuleError('not your turn');
  };

  switch (action.type) {
    case 'deal': {
      if (s.phase !== 'deal') throw new GinRuleError('not in deal phase');
      s.dealer = other(s.dealer);
      s.handNumber += 1;
      const rng = new Rng(s.rngState);
      const deck = rng.shuffle(newDeck());
      s.rngState = rng.state;
      s.hands = [[], []];
      for (let i = 0; i < 2 * HAND_SIZE; i++) s.hands[((s.dealer + 1 + i) % 2) as Player].push(deck[i]!);
      s.discard = [deck[2 * HAND_SIZE]!];
      s.stock = deck.slice(2 * HAND_SIZE + 1);
      s.turn = other(s.dealer);
      s.upcardPasses = 0;
      s.stockOnly = false;
      s.takenDiscard = null;
      s.lastHand = null;
      s.phase = 'upcard';
      ev({ type: 'hand_started', player: s.dealer, cards: [], handNumber: s.handNumber });
      ev({ type: 'cards_dealt', player: null, cards: [] });
      ev({ type: 'upcard_turned', player: null, cards: [s.discard[0]!] });
      break;
    }
    case 'take_upcard': {
      turnCheck(action.player, 'upcard');
      const card = s.discard.pop()!;
      s.hands[action.player].push(card);
      s.takenDiscard = card;
      s.phase = 'discard';
      ev({ type: 'drew', player: action.player, cards: [card], source: 'discard' });
      break;
    }
    case 'pass_upcard': {
      turnCheck(action.player, 'upcard');
      ev({ type: 'upcard_passed', player: action.player, cards: [] });
      s.upcardPasses += 1;
      s.turn = other(action.player);
      if (s.upcardPasses === 2) {
        s.phase = 'draw';
        s.stockOnly = true;
      }
      break;
    }
    case 'draw': {
      turnCheck(action.player, 'draw');
      let card: Card;
      if (action.source === 'discard') {
        if (s.stockOnly) throw new GinRuleError('must draw from the stock after both players pass the upcard');
        if (s.discard.length === 0) throw new GinRuleError('discard pile is empty');
        card = s.discard.pop()!;
        s.takenDiscard = card;
      } else {
        if (s.stock.length === 0) throw new GinRuleError('stock is empty');
        card = s.stock.pop()!;
        s.takenDiscard = null;
      }
      s.stockOnly = false;
      s.hands[action.player].push(card);
      s.phase = 'discard';
      ev({ type: 'drew', player: action.player, cards: [card], source: action.source });
      break;
    }
    case 'discard': {
      turnCheck(action.player, 'discard');
      if (!legalDiscards(s, action.player).includes(action.card)) throw new GinRuleError('illegal discard');
      s.hands[action.player] = s.hands[action.player].filter((c) => c !== action.card);
      s.discard.push(action.card);
      s.takenDiscard = null;
      ev({ type: 'discarded', player: action.player, cards: [action.card] });
      if (s.stock.length <= DEAD_STOCK) {
        const a0 = ginArrangement(s.hands[0]);
        const a1 = ginArrangement(s.hands[1]);
        s.lastHand = {
          kind: 'dead',
          knocker: null,
          winner: null,
          melds: [a0.melds, a1.melds],
          deadwood: [a0.deadwood, a1.deadwood],
          deadwoodValue: [a0.deadwoodValue, a1.deadwoodValue],
          layoffs: [],
          points: 0,
          bonus: 0,
          total: 0,
        };
        s.phase = 'hand_over';
        ev({ type: 'hand_dead', player: null, cards: [] });
        ev({ type: 'hand_scored', player: null, cards: [], result: s.lastHand });
      } else {
        s.turn = other(action.player);
        s.phase = 'draw';
      }
      break;
    }
    case 'knock': {
      turnCheck(action.player, 'discard');
      if (!canKnockWith(s, action.player, action.card)) throw new GinRuleError('cannot knock with that discard');
      const knocker = action.player;
      s.hands[knocker] = s.hands[knocker].filter((c) => c !== action.card);
      s.discard.push(action.card);
      s.takenDiscard = null;
      const r = scoreKnock(knocker, s.hands[knocker], s.hands[other(knocker)]);
      if (r.kind === 'gin') ev({ type: 'gin', player: knocker, cards: [action.card] });
      else ev({ type: 'knocked', player: knocker, cards: [action.card], deadwoodValue: r.deadwoodValue[knocker] });
      if (r.layoffs.length > 0) ev({ type: 'laid_off', player: other(knocker), cards: r.layoffs.map((l) => l.card) });
      if (r.kind === 'undercut') ev({ type: 'undercut', player: other(knocker), cards: [] });
      s.scores[r.winner!] += r.total;
      s.handsWon[r.winner!] += 1;
      s.lastHand = r;
      s.phase = 'hand_over';
      ev({ type: 'hand_scored', player: r.winner, cards: [], result: r });
      break;
    }
    case 'continue': {
      if (s.phase !== 'hand_over') throw new GinRuleError('not in hand_over phase');
      const winner = ginGameWinner(s.scores, s.targetScore);
      if (winner !== null) {
        s.result = gameResult(winner, s.scores, s.handsWon);
        s.phase = 'game_over';
        ev({ type: 'game_won', player: winner, cards: [], result: s.result });
      } else s.phase = 'deal';
      break;
    }
  }
  return { state: s, events };
}
