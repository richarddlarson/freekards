/**
 * Poker chips and KardCoins (spec 15 §6.3, spec 19 §3.2): buying in, more chips, saving the table
 * after every hand, cashing out, and returning chips from a game that was never finished. The
 * player's and the regulars' chips come out of their balances when they sit down and go back when
 * they leave, so the table never creates or destroys coins. Engine-neutral and pure.
 */
import { STAKES, type Stakes, type StakesId } from '../poker/betting.js';
import { addCoins, WELCOME_COINS, type PokerStats, type Profile } from '../profile/profile.js';
import { afterGame, type Regular } from './economy.js';

export const POKER_GAME_NAME = 'Five-Card Draw';
const STAKES_NAMES: Record<StakesId, string> = { low: 'Low', medium: 'Medium', high: 'High' };

/** Chips someone with this balance sits down with: the buy-in, or all of it if less but at least the minimum. */
export function buyInAmount(balance: number, stakes: Stakes): number | null {
  if (balance < stakes.minBuyIn) return null;
  return Math.min(balance, stakes.buyIn);
}

export const regularBalance = (p: Profile, id: string): number => p.casino.regulars[id] ?? WELCOME_COINS;

/**
 * The player and the chosen regulars sit down. Regulars who can't afford the minimum are left out
 * (the caller picks someone else). Throws if the player can't afford the minimum.
 */
export function sitDown(p: Profile, stakesId: StakesId, regularIds: readonly string[], now: string): Profile {
  const stakes = STAKES[stakesId];
  const you = buyInAmount(p.coins, stakes);
  if (you === null) throw new RangeError('not enough KardCoins to sit down');
  const regulars = { ...p.casino.regulars };
  const atTable: Record<string, number> = {};
  for (const id of regularIds) {
    const amt = buyInAmount(regularBalance(p, id), stakes);
    if (amt === null) continue;
    regulars[id] = regularBalance(p, id) - amt;
    atTable[id] = amt;
  }
  const q = addCoins(p, -you, `${POKER_GAME_NAME}: sat down (${STAKES_NAMES[stakesId]} stakes)`, now);
  return { ...q, casino: { ...q.casino, regulars, pokerTable: { stakes: stakesId, you, regulars: atTable } } };
}

/** A regular takes an empty seat mid-session. Returns null if they can't afford it. */
export function seatRegular(p: Profile, id: string): { profile: Profile; chips: number } | null {
  const t = p.casino.pokerTable;
  if (!t) return null;
  const amt = buyInAmount(regularBalance(p, id), STAKES[t.stakes]);
  if (amt === null) return null;
  const regulars = { ...p.casino.regulars, [id]: regularBalance(p, id) - amt };
  return { profile: { ...p, casino: { ...p.casino, regulars, pokerTable: { ...t, regulars: { ...t.regulars, [id]: amt } } } }, chips: amt };
}

/** A regular leaves mid-session: their chips go back to their balance. */
export function regularLeaves(p: Profile, id: string): Profile {
  const t = p.casino.pokerTable;
  if (!t || t.regulars[id] === undefined) return p;
  const { [id]: chips, ...rest } = t.regulars;
  const regulars = { ...p.casino.regulars, [id]: regularBalance(p, id) + chips! };
  return { ...p, casino: { ...p.casino, regulars, pokerTable: { ...t, regulars: rest } } };
}

/** The player buys more chips (after running out). Returns null if the balance is below the minimum. */
export function rebuy(p: Profile, now: string): { profile: Profile; chips: number } | null {
  const t = p.casino.pokerTable;
  if (!t) return null;
  const amt = buyInAmount(p.coins, STAKES[t.stakes]);
  if (amt === null) return null;
  const q = addCoins(p, -amt, `${POKER_GAME_NAME}: more chips`, now);
  return { profile: { ...q, casino: { ...q.casino, pokerTable: { ...t, you: t.you + amt } } }, chips: amt };
}

/** Save everyone's chips after a hand, so nothing is lost if the app closes. */
export function saveTable(p: Profile, you: number, regulars: Record<string, number>): Profile {
  const t = p.casino.pokerTable;
  if (!t) return p;
  return { ...p, casino: { ...p.casino, pokerTable: { ...t, you, regulars: { ...regulars } } } };
}

/** What the table reports about a session when the player leaves (spec 15 §2). */
export interface PokerSession {
  /** Chips brought to the table (buy-in plus any more chips). */
  broughtIn: number;
  handsPlayed: number;
  handsWon: number;
  biggestPot: number | null;
  bestHand: { score: number; name: string } | null;
  /** Every regular who sat at the table during the session. */
  regularIds: readonly string[];
}

/**
 * The player leaves: everyone's chips go back to their balances, the statistics are updated, and the
 * regulars who weren't at the table play a background round (spec 15 §6.2).
 */
export function cashOut(p: Profile, session: PokerSession, roster: readonly Regular[], now: string): { profile: Profile; net: number; cashed: number } {
  const t = p.casino.pokerTable;
  const cashed = t?.you ?? 0;
  const net = cashed - session.broughtIn;
  const regulars = { ...p.casino.regulars };
  for (const [id, chips] of Object.entries(t?.regulars ?? {})) regulars[id] = regularBalance(p, id) + chips;
  let q: Profile = { ...p, casino: { ...p.casino, regulars, pokerTable: null } };
  if (cashed > 0) q = addCoins(q, cashed, `${POKER_GAME_NAME}: cashed out`, now);
  const s = q.stats.fiveCardDraw;
  const better = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));
  const stats: PokerStats = {
    sessions: s.sessions + 1,
    handsPlayed: s.handsPlayed + session.handsPlayed,
    handsWon: s.handsWon + session.handsWon,
    biggestPot: better(s.biggestPot, session.biggestPot),
    bestHand: !s.bestHand || (session.bestHand && session.bestHand.score > s.bestHand.score) ? (session.bestHand ?? s.bestHand) : s.bestHand,
    netCoins: s.netCoins + net,
    bestSession: better(s.bestSession, net),
  };
  q = { ...q, stats: { ...q.stats, fiveCardDraw: stats } };
  q = afterGame(q, roster, session.regularIds.map((id) => ({ id, amount: 0 })));
  return { profile: q, net, cashed };
}

/** Chips left at a table when the app closed mid-session go back to everyone's balance (spec 15 §6.3). */
export function recoverTable(p: Profile, now: string): Profile {
  const t = p.casino.pokerTable;
  if (!t) return p;
  const regulars = { ...p.casino.regulars };
  for (const [id, chips] of Object.entries(t.regulars)) regulars[id] = regularBalance(p, id) + chips;
  const q: Profile = { ...p, casino: { ...p.casino, regulars, pokerTable: null } };
  return t.you > 0 ? addCoins(q, t.you, `${POKER_GAME_NAME}: chips returned from an unfinished game`, now) : q;
}
