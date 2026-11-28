/**
 * Fixed-limit betting (spec 19 §2.3), shared by every poker variant. Engine-neutral. The functions
 * work on a mutable working copy of the table that the variant's engine owns (it copies its state
 * before applying an action, so the caller's state is never changed).
 */

/** Table stakes (spec 19 §3). Chips are KardCoins. */
export type StakesId = 'low' | 'medium' | 'high';

export interface Stakes {
  id: StakesId;
  ante: number;
  /** The bet and raise size in the first betting round. */
  smallBet: number;
  /** The bet and raise size in the last betting round. */
  bigBet: number;
  /** Chips a player sits down with (or their whole balance, if less but at least the minimum). */
  buyIn: number;
  minBuyIn: number;
}

export const STAKES: Readonly<Record<StakesId, Stakes>> = {
  low: { id: 'low', ante: 1, smallBet: 5, bigBet: 10, buyIn: 100, minBuyIn: 25 },
  medium: { id: 'medium', ante: 2, smallBet: 10, bigBet: 20, buyIn: 200, minBuyIn: 50 },
  high: { id: 'high', ante: 5, smallBet: 20, bigBet: 40, buyIn: 400, minBuyIn: 100 },
};
export const STAKES_IDS: readonly StakesId[] = ['low', 'medium', 'high'];

/** Raises allowed in one betting round after the opening bet (so at most 4 bets in all). */
export const RAISE_CAP = 3;

export type BetKind = 'fold' | 'check' | 'call' | 'bet' | 'raise';

/** The parts of a table that betting reads and changes, indexed by seat. */
export interface BettingTable {
  /** Chips in front of the player (not yet put in this hand). */
  chips: number[];
  /** Dealt into the current hand. */
  inHand: boolean[];
  folded: boolean[];
  /** Everything put in this hand so far (antes and bets). */
  committed: number[];
}

export interface BettingRound {
  /** Bet and raise size for this round. */
  betSize: number;
  /** The amount each player must have put in this round to stay in. */
  currentBet: number;
  /** Raises made after the opening bet. */
  raises: number;
  /** Chips put in this round, by seat. */
  bets: number[];
  /** Whether the seat has acted since the last bet or raise. */
  acted: boolean[];
  /** Whose turn it is, or null when the round is over. */
  toAct: number | null;
}

/** Still holding cards (not folded). */
export const isLive = (t: BettingTable, s: number): boolean => t.inHand[s]! && !t.folded[s];
/** Live and with chips left, so able to act. */
export const canAct = (t: BettingTable, s: number): boolean => isLive(t, s) && t.chips[s]! > 0;

export function liveSeats(t: BettingTable): number[] {
  return t.inHand.flatMap((_, s) => (isLive(t, s) ? [s] : []));
}

/** The next seat clockwise after `from` that passes `test`, or null. */
export function nextSeat(n: number, from: number, test: (s: number) => boolean): number | null {
  for (let k = 1; k <= n; k++) {
    const s = (from + k) % n;
    if (test(s)) return s;
  }
  return null;
}

/** Start a betting round; the first to act is the first able seat after `afterSeat`. */
export function openRound(t: BettingTable, afterSeat: number, betSize: number): BettingRound {
  const n = t.chips.length;
  const r: BettingRound = { betSize, currentBet: 0, raises: 0, bets: Array(n).fill(0), acted: Array(n).fill(false), toAct: null };
  r.toAct = roundOver(t, r) ? null : nextSeat(n, afterSeat, (s) => canAct(t, s));
  return r;
}

export interface LegalBets {
  kinds: BetKind[];
  /** Chips needed to call (may be more than the seat has: a call then puts it all in). */
  toCall: number;
  /** Chips a call puts in now. */
  callAmount: number;
  /** Chips a bet or raise puts in now (including the call part). */
  raiseAmount: number;
}

export function legalBets(t: BettingTable, r: BettingRound, seat: number): LegalBets {
  const chips = t.chips[seat]!;
  const toCall = r.currentBet - r.bets[seat]!;
  const callAmount = Math.min(toCall, chips);
  const raiseAmount = Math.min(toCall + r.betSize, chips);
  if (r.toAct !== seat) return { kinds: [], toCall, callAmount, raiseAmount };
  const kinds: BetKind[] = [];
  // Someone else must still be able to answer a bet or raise.
  const othersCanAct = t.inHand.some((_, s) => s !== seat && canAct(t, s));
  if (toCall <= 0) {
    kinds.push('check');
    if (r.currentBet === 0 && othersCanAct) kinds.push('bet');
  } else {
    kinds.push('fold', 'call');
    if (r.raises < RAISE_CAP && chips > toCall && othersCanAct) kinds.push('raise');
  }
  return { kinds, toCall, callAmount, raiseAmount };
}

/** Whether every live player who can still act has acted and matched the current bet. */
export function roundOver(t: BettingTable, r: BettingRound): boolean {
  if (liveSeats(t).length <= 1) return true;
  const actors = t.inHand.flatMap((_, s) => (canAct(t, s) ? [s] : []));
  if (actors.length === 0) return true;
  // One player able to act, with no bet to answer: there is nobody to bet against.
  if (actors.length === 1 && r.bets[actors[0]!]! >= r.currentBet) return true;
  return actors.every((s) => r.acted[s] && r.bets[s]! === r.currentBet);
}

function putIn(t: BettingTable, r: BettingRound, seat: number, amount: number): void {
  t.chips[seat]! -= amount;
  t.committed[seat]! += amount;
  r.bets[seat]! += amount;
}

export interface BetResult {
  /** Chips put in now. */
  amount: number;
  allIn: boolean;
}

/**
 * Apply one betting action for the seat whose turn it is (checked by the caller with legalBets).
 * An all-in for more than the current bet counts as a raise and reopens the betting (spec 19 §2.3).
 */
export function applyBet(t: BettingTable, r: BettingRound, seat: number, kind: BetKind): BetResult {
  const n = t.chips.length;
  const lb = legalBets(t, r, seat);
  let amount = 0;
  switch (kind) {
    case 'fold':
      t.folded[seat] = true;
      break;
    case 'check':
      break;
    case 'call':
      amount = lb.callAmount;
      putIn(t, r, seat, amount);
      break;
    case 'bet':
    case 'raise': {
      amount = lb.raiseAmount;
      putIn(t, r, seat, amount);
      if (r.bets[seat]! > r.currentBet) {
        if (r.currentBet > 0) r.raises++;
        r.currentBet = r.bets[seat]!;
        r.acted.fill(false);
      }
      break;
    }
  }
  r.acted[seat] = true;
  const allIn = amount > 0 && t.chips[seat] === 0;
  r.toAct = roundOver(t, r) ? null : nextSeat(n, seat, (s) => canAct(t, s) && !(r.acted[s] && r.bets[s] === r.currentBet));
  return { amount, allIn };
}

/** Chips a seat bet this round that nobody else matched (returned at the end of the round). */
export function uncalledBet(t: BettingTable, r: BettingRound): { seat: number; amount: number } | null {
  const live = liveSeats(t);
  let top = -1;
  for (const s of live) if (top < 0 || r.bets[s]! > r.bets[top]!) top = s;
  if (top < 0) return null;
  // The most anyone else put in this round (folded players' bets count: they were called by the top bettor).
  let second = 0;
  for (let s = 0; s < r.bets.length; s++) if (s !== top) second = Math.max(second, r.bets[s]!);
  const amount = r.bets[top]! - second;
  return amount > 0 ? { seat: top, amount } : null;
}
