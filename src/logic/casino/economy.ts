/**
 * The casino regulars (spec 15 §6, D-090): every computer character keeps a KardCoin balance, per
 * player profile. They start with 500, are paid like the player for the games they play with her,
 * and play a simulated game "elsewhere" each time she finishes a game. Engine-neutral and pure.
 */
import { Rng } from '../core/rng.js';
import type { Difficulty } from '../core/skill.js';
import {
  HEARTS_PLACE_COINS,
  heartsPayout,
  heartsPlaces,
  spadesPayout,
  twoPlayerPayout,
  WELCOME_COINS,
  type CasinoState,
  type Profile,
} from '../profile/profile.js';

/** What the economy needs to know about a regular. */
export interface Regular {
  id: string;
  /** Skill adjustment, −0.15 to +0.15 (spec 08). */
  skillAdjust: number;
  /** Risk, 0–1 (spec 08). */
  risk: number;
}

/** Background rounds (spec 15 §6.2). */
export const ECONOMY = {
  /** A regular needs this many coins to play a betting game in the background. */
  bettingMin: 200,
  /** Chance that a regular with enough coins plays a betting game instead of a coin-earning one. */
  bettingChance: 0.35,
  /** Coins put at stake in a background betting game: balance × (base + risk × perRisk), at most max. */
  stakeBase: 0.1,
  stakePerRisk: 0.3,
  stakeMax: 1000,
  /** Chance of coming out ahead: winBase + skill adjustment. */
  winBase: 0.47,
  /** A win returns stake × (winMin + random × winRange); a loss costs stake × (lossMin + random × lossRange). */
  winMin: 0.2,
  winRange: 0.8,
  lossMin: 0.3,
  lossRange: 0.7,
  /** Coin-earning games pay like Hearts at Medium. */
  earningMultiplier: 1.5,
};

/** A stable number from a profile id, to seed its regulars' rounds. */
export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function roundRng(profileId: string, round: number): Rng {
  return new Rng((seedFromId(profileId) ^ Math.imul(round + 1, 0x9e3779b1)) >>> 0);
}

/** One regular's background game: the coins won or lost. */
export function backgroundResult(r: Regular, balance: number, rng: Rng): number {
  const E = ECONOMY;
  const a = r.skillAdjust;
  if (balance >= E.bettingMin && rng.next() < E.bettingChance) {
    const stake = Math.round(Math.min(balance * (E.stakeBase + E.stakePerRisk * r.risk), E.stakeMax));
    return rng.next() < E.winBase + a ? Math.round(stake * (E.winMin + E.winRange * rng.next())) : -Math.round(stake * (E.lossMin + E.lossRange * rng.next()));
  }
  // A coin-earning game: a Hearts-style finish, better players finishing higher more often.
  const weights = [0.25 + a, 0.25 + a / 3, 0.25 - a / 3, 0.25 - a];
  let x = rng.next();
  let place = 0;
  while (place < 3 && x >= weights[place]!) x -= weights[place++]!;
  return Math.round(HEARTS_PLACE_COINS[place]! * E.earningMultiplier);
}

/** Give every regular on the roster a balance (500 for newcomers), then run any catch-up rounds owed. */
export function syncRegulars(p: Profile, roster: readonly Regular[]): Profile {
  const regulars = { ...p.casino.regulars };
  let changed = false;
  for (const r of roster) {
    if (regulars[r.id] === undefined) {
      regulars[r.id] = WELCOME_COINS;
      changed = true;
    }
  }
  let casino: CasinoState = { ...p.casino, regulars };
  for (let i = 0; i < p.casino.catchUp; i++) casino = backgroundRound(p.id, casino, roster, new Set());
  if (p.casino.catchUp > 0) {
    casino = { ...casino, catchUp: 0 };
    changed = true;
  }
  return changed ? { ...p, casino } : p;
}

/** Every regular not in `busy` plays one background game. */
export function backgroundRound(profileId: string, c: CasinoState, roster: readonly Regular[], busy: ReadonlySet<string>): CasinoState {
  const rng = roundRng(profileId, c.rounds);
  const regulars = { ...c.regulars };
  for (const r of roster) {
    if (busy.has(r.id)) continue;
    const bal = regulars[r.id] ?? WELCOME_COINS;
    regulars[r.id] = Math.max(0, bal + backgroundResult(r, bal, rng));
  }
  return { ...c, regulars, rounds: c.rounds + 1 };
}

/** A regular's earnings from a game with the player. */
export interface Credit {
  id: string;
  amount: number;
}

/**
 * After the player finishes a game: pay the regulars who played with her, then let everyone else play
 * a background game (spec 15 §6.2). For poker, the players' chips are settled at the table, so their
 * credits are 0 and they only skip the background round.
 */
export function afterGame(p: Profile, roster: readonly Regular[], credits: readonly Credit[]): Profile {
  const regulars = { ...p.casino.regulars };
  for (const c of credits) regulars[c.id] = Math.max(0, (regulars[c.id] ?? WELCOME_COINS) + c.amount);
  const busy = new Set(credits.map((c) => c.id));
  return { ...p, casino: backgroundRound(p.id, { ...p.casino, regulars }, roster, busy) };
}

/** Hearts: each opponent is paid for their place, like the player (no moon bonus). Ids by seat 1–3. */
export function heartsCredits(finalScores: readonly number[], ids: readonly string[], difficulty: Difficulty): Credit[] {
  const places = heartsPlaces(finalScores);
  return ids.map((id, i) => ({ id, amount: heartsPayout(places[i + 1]!, difficulty, 0).total }));
}

/** Spades: the partner shares the player's result, the opponents get the other one (no Nil bonus). */
export function spadesCredits(playerWon: boolean, partner: string, opponents: readonly string[], difficulty: Difficulty): Credit[] {
  return [
    { id: partner, amount: spadesPayout(playerWon, difficulty, 0).total },
    ...opponents.map((id) => ({ id, amount: spadesPayout(!playerWon, difficulty, 0).total })),
  ];
}

/** Gin Rummy and Rummy 500: the opponent gets the other result (no gin bonus). */
export function twoPlayerCredits(playerWon: boolean, opponent: string, difficulty: Difficulty): Credit[] {
  return [{ id: opponent, amount: twoPlayerPayout(!playerWon, difficulty).total }];
}

/** The regulars and the player, richest first (the leaderboard, spec 15 §4). */
export function leaderboard(p: Profile, roster: readonly { id: string }[]): { id: string | null; coins: number }[] {
  const atTable = p.casino.pokerTable;
  const rows = [
    { id: null as string | null, coins: p.coins + (atTable?.you ?? 0) },
    ...roster.map((r) => ({ id: r.id, coins: (p.casino.regulars[r.id] ?? WELCOME_COINS) + (atTable?.regulars[r.id] ?? 0) })),
  ];
  return rows.sort((a, b) => b.coins - a.coins);
}
