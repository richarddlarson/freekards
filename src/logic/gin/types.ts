import type { Card } from '../core/cards.js';
import type { Meld, LayOff } from '../rummy/melds.js';

/** 2-player games (spec 10 §2): player 0 is always the human, player 1 the computer. */
export type Player = 0 | 1;
export type Two<T> = [T, T];

export interface GinOptions {
  seed: number;
  /** First to this score wins the game (spec 18 §2.7). Default 100. */
  targetScore?: number;
}

/**
 * `upcard`: the first turn, when the non-dealer and then the dealer may take the turned-up card.
 * `draw` / `discard`: the two halves of a normal turn. `hand_over`: the hand is scored and shown.
 */
export type GinPhase = 'deal' | 'upcard' | 'draw' | 'discard' | 'hand_over' | 'game_over';

/** How a hand ended (spec 18 §2.6). */
export type GinHandKind = 'knock' | 'undercut' | 'gin' | 'dead';

export interface GinHandResult {
  kind: GinHandKind;
  /** Who knocked (or went gin); null for a dead hand. */
  knocker: Player | null;
  /** Who scored; null for a dead hand. */
  winner: Player | null;
  /** Both players' final melds and deadwood, by player. The defender's lay-offs are separate. */
  melds: Two<Meld[]>;
  deadwood: Two<Card[]>;
  deadwoodValue: Two<number>;
  /** The defender's cards laid off on the knocker's melds (meld = index into melds[knocker]). */
  layoffs: LayOff[];
  /** The deadwood difference (or the defender's deadwood, for gin). */
  points: number;
  /** 25 for gin or an undercut, else 0. */
  bonus: number;
  total: number;
}

/** End-of-game bonuses (spec 18 §2.7). */
export interface GinGameResult {
  winner: Player;
  /** 100 to the winner. */
  gameBonus: number;
  /** 25 per hand won, per player. */
  boxBonus: Two<number>;
  /** The loser won no hands: the winner's total is doubled. */
  shutout: boolean;
  /** Score + bonuses (doubled for a shutout). */
  finalTotals: Two<number>;
}

/** Plain data: safe to serialize. The top of the stock and of the discard pile is the last element. */
export interface GinState {
  targetScore: number;
  phase: GinPhase;
  handNumber: number;
  dealer: Player;
  /** Whose turn it is (upcard, draw, and discard phases). */
  turn: Player;
  hands: Two<Card[]>;
  stock: Card[];
  discard: Card[];
  /** Upcard phase: how many players have passed the upcard (0 or 1). After both pass, the non-dealer must draw from the stock. */
  upcardPasses: number;
  /** The next draw must come from the stock (both players passed the upcard). */
  stockOnly: boolean;
  /** The card just taken from the discard pile this turn; it can't be discarded again this turn. */
  takenDiscard: Card | null;
  scores: Two<number>;
  handsWon: Two<number>;
  lastHand: GinHandResult | null;
  result: GinGameResult | null;
  rngState: number;
}

export type GinAction =
  | { type: 'deal' }
  | { type: 'take_upcard'; player: Player }
  | { type: 'pass_upcard'; player: Player }
  | { type: 'draw'; player: Player; source: 'stock' | 'discard' }
  | { type: 'discard'; player: Player; card: Card }
  /** Discard `card` face down and knock (or go gin when no deadwood is left). */
  | { type: 'knock'; player: Player; card: Card }
  | { type: 'continue' };

interface EventBase {
  player: Player | null;
  cards: Card[];
  scores: Two<number>;
}

export type GinEvent =
  | (EventBase & { type: 'hand_started'; handNumber: number })
  | (EventBase & { type: 'cards_dealt' })
  | (EventBase & { type: 'upcard_turned' })
  | (EventBase & { type: 'upcard_passed' })
  | (EventBase & { type: 'drew'; source: 'stock' | 'discard' })
  | (EventBase & { type: 'discarded' })
  | (EventBase & { type: 'knocked'; deadwoodValue: number })
  | (EventBase & { type: 'gin' })
  | (EventBase & { type: 'laid_off' })
  | (EventBase & { type: 'undercut' })
  | (EventBase & { type: 'hand_dead' })
  | (EventBase & { type: 'hand_scored'; result: GinHandResult })
  | (EventBase & { type: 'game_won'; result: GinGameResult });

export interface GinStep {
  state: GinState;
  events: GinEvent[];
}

export class GinRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GinRuleError';
  }
}
