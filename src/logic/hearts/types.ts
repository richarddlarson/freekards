import type { Card } from '../core/cards.js';

/** Seats in clockwise play order (spec 10 §2); shared by every 4-player game. */
export { SEATS, SEAT_NAMES, HUMAN_SEAT, type Seat } from '../core/seats.js';
import type { Seat } from '../core/seats.js';

export type HeartsRuleSet = 'standard' | 'jack-of-diamonds';

export interface HeartsOptions {
  ruleSet: HeartsRuleSet;
  /** Seed for the shuffle generator. */
  seed: number;
  /** Game ends after a hand in which someone reaches this score. Default 100. */
  targetScore?: number;
}

export type PassDirection = 'left' | 'right' | 'across' | 'none';

export type HeartsPhase = 'deal' | 'pass' | 'play' | 'score' | 'game_over';

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

export interface HandResult {
  /** Points added to each seat's game score for this hand (after moon-shot adjustment). */
  points: [number, number, number, number];
  /** Seat that shot the moon, or null. */
  moonShooter: Seat | null;
}

/** Plain data: safe to serialize for save games and replays. */
export interface HeartsState {
  ruleSet: HeartsRuleSet;
  targetScore: number;
  phase: HeartsPhase;
  /** 1-based hand counter; 0 before the first deal. */
  handNumber: number;
  passDirection: PassDirection;
  hands: [Card[], Card[], Card[], Card[]];
  /** Cards each seat has chosen to pass (null until chosen). Only used in the pass phase. */
  passSelections: [Card[] | null, Card[] | null, Card[] | null, Card[] | null];
  /** Cards each seat received in the most recent pass (for presentation/highlighting). */
  received: [Card[], Card[], Card[], Card[]];
  /** Tricks completed this hand. */
  tricks: CompletedTrick[];
  /** The trick in progress (only meaningful in the play phase). */
  trick: Trick;
  heartsBroken: boolean;
  /** Cards won this hand, per seat. */
  taken: [Card[], Card[], Card[], Card[]];
  /** Cumulative game scores. */
  scores: [number, number, number, number];
  /** Result of the most recent scored hand. */
  lastHand: HandResult | null;
  /** Winner once phase is game_over. */
  winner: Seat | null;
  /** Shuffle generator state (see core/rng.ts). */
  rngState: number;
}

export type HeartsAction =
  | { type: 'deal' }
  | { type: 'pass'; seat: Seat; cards: Card[] }
  | { type: 'play'; seat: Seat; card: Card }
  | { type: 'continue' };

interface EventBase {
  /** Acting seat, or null for table-level events. */
  seat: Seat | null;
  cards: Card[];
  /** Snapshot of cumulative game scores at the time of the event. */
  scores: [number, number, number, number];
}

export type HeartsEvent =
  | (EventBase & { type: 'hand_started'; handNumber: number })
  | (EventBase & { type: 'cards_dealt' })
  | (EventBase & { type: 'pass_direction_announced'; direction: PassDirection })
  | (EventBase & { type: 'cards_passed'; direction: PassDirection; from: Seat; to: Seat })
  | (EventBase & { type: 'trick_started'; trickNumber: number })
  | (EventBase & { type: 'card_played'; trickNumber: number })
  | (EventBase & { type: 'hearts_broken' })
  | (EventBase & { type: 'trick_won'; trickNumber: number; trickPoints: number })
  | (EventBase & { type: 'queen_of_spades_taken' })
  | (EventBase & { type: 'jack_of_diamonds_taken' })
  | (EventBase & { type: 'moon_shot' })
  | (EventBase & { type: 'moon_shot_blocked'; blocker: Seat })
  | (EventBase & { type: 'hand_scored'; handPoints: [number, number, number, number] })
  | (EventBase & { type: 'game_won' });

export type HeartsEventType = HeartsEvent['type'];

export interface HeartsStep {
  state: HeartsState;
  events: HeartsEvent[];
}

export class HeartsRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeartsRuleError';
  }
}
