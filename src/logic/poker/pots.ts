/**
 * Pots and side pots (spec 19 §2.5). Engine-neutral and pure; shared by every poker variant.
 */

export interface Pot {
  amount: number;
  /** Seats that can win this pot (still in the hand, and put in at least this pot's level). */
  eligible: number[];
}

/**
 * Split everything put in this hand into a main pot and side pots. `committed[seat]` is the seat's
 * total for the hand (antes and bets); folded seats' chips count but they can't win.
 * Consecutive pots with the same eligible seats are merged.
 */
export function buildPots(committed: readonly number[], folded: readonly boolean[]): Pot[] {
  const live = committed.map((_, s) => s).filter((s) => !folded[s] && committed[s]! > 0);
  const levels = [...new Set(live.map((s) => committed[s]!))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;
  for (const lvl of levels) {
    let amount = 0;
    for (const c of committed) amount += Math.max(0, Math.min(c, lvl) - prev);
    const eligible = live.filter((s) => committed[s]! >= lvl);
    const last = pots.at(-1);
    if (last && last.eligible.length === eligible.length && last.eligible.every((s, i) => s === eligible[i])) last.amount += amount;
    else if (amount > 0) pots.push({ amount, eligible });
    prev = lvl;
  }
  // Chips a folded seat put in above every live seat's level (rare) go to the last pot.
  const leftover = committed.reduce((sum, c) => sum + Math.max(0, c - prev), 0);
  if (leftover > 0 && pots.length) pots.at(-1)!.amount += leftover;
  return pots;
}

/**
 * Share one pot among `winners` (seats with the same best hand). An odd chip goes to the winner
 * closest to the left of the button (spec 19 §2.5). Returns the amount per seat.
 */
export function splitPot(amount: number, winners: readonly number[], button: number, seatCount: number): Map<number, number> {
  const order = [...winners].sort((a, b) => ((a - button - 1 + seatCount) % seatCount) - ((b - button - 1 + seatCount) % seatCount));
  const share = Math.floor(amount / order.length);
  let odd = amount - share * order.length;
  const out = new Map<number, number>();
  for (const s of order) {
    out.set(s, share + (odd > 0 ? 1 : 0));
    if (odd > 0) odd--;
  }
  return out;
}
