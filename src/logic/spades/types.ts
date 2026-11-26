import type { Card } from '../core/cards.js';
import type { Seat } from '../core/seats.js';

export { SEATS, HUMAN_SEAT, type Seat } from '../core/seats.js';

/** Team index = seat mod 2: 0 = South + North (the player's team), 1 = West + East. */
export type Team = 0 | 1;
export type Two<T> = [T, T];
export type Four<T> = [T, T, T, T];

export interface SpadesOptions {
  /** Seed for the shuffle generator. */
  seed: number;
  /** A team that reaches this score ends the game (spec 17 §5). Default 300. */
  targetScore?: number;
}

export type SpadesPhase = 'deal' | 'bid' | 'play' | 'score' | 'game_over';

export interface TrickPlay {
  seat: Seat;
  card: Card;
}

export interface Trick {
  leader: Seat;
  plays: TrickPlay[];
}

export interface CompletedTrick extends Trick {
  winner: Seat;
}

/** One team's scoring for one hand (spec 17 §4). */
export interface TeamHandResult {
  /** Sum of the partners' non-Nil bids. */
  contract: number;
  /** Tricks won by the partners who did not bid Nil. */
  counted: number;
  /** Contract above 0 and made. */
  made: boolean;
  /** +10 × contract, −10 × contract, or 0 when the contract is 0. */
  contractPoints: number;
  /** Bags added this hand: overtricks plus tricks won by Nil bidders. Each is also +1 point. */
  bags: number;
  nils: { seat: Seat; made: boolean }[];
  nilPoints: number;
  /** −100 for each time the team's bag count reached 10 this hand (0 if none). */
  bagPenalty: number;
  total: number;
}

/** Plain data: safe to serialize for save games and replays. */
export interface SpadesState {
  targetScore: number;
  phase: SpadesPhase;
  /** 1-based hand counter; 0 before the first deal. */
  handNumber: number;
  dealer: Seat;
  hands: Four<Card[]>;
  /** Bids this hand (0 = Nil), null until made. */
  bids: Four<number | null>;
  /** Tricks completed this hand. */
  tricks: CompletedTrick[];
  /** The trick in progress (only meaningful in the play phase). */
  trick: Trick;
  spadesBroken: boolean;
  /** Tricks won this hand, per seat. */
  won: Four<number>;
  /** Cumulative team scores. */
  scores: Two<number>;
  /** Running bag counts (0–9 after each hand's penalty). */
  bags: Two<number>;
  /** Result of the most recent scored hand. */
  lastHand: Two<TeamHandResult> | null;
  /** Winning team once phase is game_over. */
  winner: Team | null;
  /** Shuffle generator state (see core/rng.ts). */
  rngState: number;
}

export type SpadesAction =
  | { type: 'deal' }
  | { type: 'bid'; seat: Seat; bid: number }
  | { type: 'play'; seat: Seat; card: Card }
  | { type: 'continue' };

interface EventBase {
  /** Acting seat, or null for table-level events. */
  seat: Seat | null;
  cards: Card[];
  /** Snapshot of the two team scores at the time of the event. */
  scores: Two<number>;
}

export type SpadesEvent =
  | (EventBase & { type: 'hand_started'; handNumber: number })
  | (EventBase & { type: 'cards_dealt' })
  | (EventBase & { type: 'bid_made'; bid: number })
  | (EventBase & { type: 'bidding_complete'; bids: Four<number> })
  | (EventBase & { type: 'trick_started'; trickNumber: number })
  | (EventBase & { type: 'card_played'; trickNumber: number })
  | (EventBase & { type: 'spades_broken' })
  | (EventBase & { type: 'trick_won'; trickNumber: number; trumped: boolean })
  | (EventBase & { type: 'nil_failed' })
  | (EventBase & { type: 'hand_scored'; results: Two<TeamHandResult> })
  | (EventBase & { type: 'bag_penalty'; team: Team })
  | (EventBase & { type: 'game_won'; team: Team });

export type SpadesEventType = SpadesEvent['type'];

export interface SpadesStep {
  state: SpadesState;
  events: SpadesEvent[];
}

export class SpadesRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpadesRuleError';
  }
}
