import type { Card } from '../core/cards.js';
import type { Meld } from '../rummy/melds.js';
import type { Player, Two } from '../gin/types.js';

export type { Player, Two } from '../gin/types.js';

export interface Rummy500Options {
  seed: number;
  /** A player who reaches this score ends the game (spec 18 §3.6). Default 500. */
  targetScore?: number;
}

/** `draw`: the start of a turn. `play`: after drawing, melding and laying off until a discard. */
export type Rummy500Phase = 'deal' | 'draw' | 'play' | 'hand_over' | 'game_over';

/** A meld on the table. Its cards may have been played by either player; `played` records who scores them. */
export interface TableMeld extends Meld {
  /** Who laid the meld down (it sits on their side of the table). */
  owner: Player;
}

export interface Rummy500HandResult {
  /** `out`: a player went out. `stock`: the stock ran out. */
  endedBy: 'out' | 'stock';
  outPlayer: Player | null;
  /** Value of the cards each player put on the table this hand. */
  melded: Two<number>;
  /** Value of the cards left in each hand. */
  inHand: Two<number>;
  /** The cards left in each hand. */
  handCards: Two<Card[]>;
  /** melded − inHand. */
  total: Two<number>;
}

/** Plain data. The top of the stock is its last element; the discard pile runs oldest (index 0) to top (last). */
export interface Rummy500State {
  targetScore: number;
  phase: Rummy500Phase;
  handNumber: number;
  dealer: Player;
  turn: Player;
  hands: Two<Card[]>;
  stock: Card[];
  discard: Card[];
  melds: TableMeld[];
  /** The cards each player has put on the table this hand (scored for them). */
  played: Two<Card[]>;
  /** Taken from below the top of the discard pile: the next meld or lay-off must use this card. */
  mustUse: Card | null;
  /** The top discard taken this turn: it can't be discarded again this turn (unless it is the last card). */
  takenTop: Card | null;
  scores: Two<number>;
  lastHand: Rummy500HandResult | null;
  winner: Player | null;
  rngState: number;
}

export type Rummy500Action =
  | { type: 'deal' }
  | { type: 'draw_stock'; player: Player }
  /** Take discard[index] and every card above it. */
  | { type: 'take_discard'; player: Player; index: number }
  | { type: 'meld'; player: Player; cards: Card[] }
  | { type: 'lay_off'; player: Player; card: Card; meld: number }
  | { type: 'discard'; player: Player; card: Card }
  | { type: 'continue' };

interface EventBase {
  player: Player | null;
  cards: Card[];
  scores: Two<number>;
}

export type Rummy500Event =
  | (EventBase & { type: 'hand_started'; handNumber: number })
  | (EventBase & { type: 'cards_dealt' })
  | (EventBase & { type: 'upcard_turned' })
  | (EventBase & { type: 'drew_stock' })
  | (EventBase & { type: 'took_discard'; index: number })
  | (EventBase & { type: 'melded'; meld: number; points: number })
  | (EventBase & { type: 'laid_off'; meld: number; meldOwner: Player; points: number })
  | (EventBase & { type: 'discarded' })
  | (EventBase & { type: 'went_out' })
  | (EventBase & { type: 'stock_empty' })
  | (EventBase & { type: 'hand_scored'; result: Rummy500HandResult })
  | (EventBase & { type: 'game_won' });

export interface Rummy500Step {
  state: Rummy500State;
  events: Rummy500Event[];
}

export class Rummy500RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Rummy500RuleError';
  }
}
