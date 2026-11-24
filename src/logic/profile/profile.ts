/**
 * Player profiles, statistics, and KardCoins (spec 15, D-049, D-050). Engine-neutral and pure:
 * every function returns new data and never mutates its input. Time and ids are passed in.
 */
import type { Difficulty } from '../core/skill.js';
import { DEFAULT_PLAYER_SETTINGS, normalizePlayerSettings, type PlayerSettings } from '../settings/player-settings.js';

export const PROFILE_SCHEMA = 1;
export const WELCOME_COINS = 500;
export const NAME_MAX = 20;
/** Most recent coin transactions kept per profile. */
export const LEDGER_MAX = 50;

/** Hearts payout table (D-050). */
export const HEARTS_PLACE_COINS: readonly number[] = [100, 40, 15, 5];
export const DIFFICULTY_MULTIPLIER: Readonly<Record<Difficulty, number>> = { easy: 1, medium: 1.5, hard: 2 };
export const MOON_BONUS = 25;

export interface CoinEntry {
  /** ISO 8601 timestamp. */
  at: string;
  amount: number;
  /** Short human-readable reason, e.g. "Welcome bonus" or "Hearts: 2nd place (Medium)". */
  reason: string;
}

export interface HeartsStats {
  gamesPlayed: number;
  gamesWon: number;
  /** Finishes by place: [1st, 2nd, 3rd, 4th]. */
  placings: [number, number, number, number];
  handsPlayed: number;
  moonsShot: number;
  queensTaken: number;
  /** Lowest final score in a finished game, or null before the first game. */
  bestScore: number | null;
  worstScore: number | null;
  currentWinStreak: number;
  bestWinStreak: number;
  coinsEarned: number;
}

export interface HeartsPrefs {
  difficulty: Difficulty;
  ruleSet: 'standard' | 'jack-of-diamonds';
  /** Opponent ids for West, North, East, or null for Random. */
  opponents: string[] | null;
}

export interface Profile {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  coins: number;
  ledger: CoinEntry[];
  stats: { hearts: HeartsStats };
  prefs: { hearts: HeartsPrefs };
  /** The player's settings (spec 16). */
  settings: PlayerSettings;
}

export interface ProfilesFile {
  schemaVersion: 1;
  activeProfileId: string | null;
  profiles: Profile[];
}

export function emptyHeartsStats(): HeartsStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    placings: [0, 0, 0, 0],
    handsPlayed: 0,
    moonsShot: 0,
    queensTaken: 0,
    bestScore: null,
    worstScore: null,
    currentWinStreak: 0,
    bestWinStreak: 0,
    coinsEarned: 0,
  };
}

export const DEFAULT_HEARTS_PREFS: HeartsPrefs = { difficulty: 'medium', ruleSet: 'standard', opponents: null };

/** Trim, collapse spaces, and cap the length. Returns null if nothing usable remains. */
export function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return name.length > 0 ? name : null;
}

function addCoins(p: Profile, amount: number, reason: string, now: string): Profile {
  const ledger = [{ at: now, amount, reason }, ...p.ledger].slice(0, LEDGER_MAX);
  return { ...p, coins: p.coins + amount, ledger };
}

export function createProfile(name: string, id: string, now: string, prefs: HeartsPrefs = DEFAULT_HEARTS_PREFS): Profile {
  const clean = cleanName(name);
  if (!clean) throw new RangeError('profile name is empty');
  const base: Profile = {
    schemaVersion: PROFILE_SCHEMA,
    id,
    name: clean,
    createdAt: now,
    coins: 0,
    ledger: [],
    stats: { hearts: emptyHeartsStats() },
    prefs: { hearts: { ...prefs, opponents: prefs.opponents ? [...prefs.opponents] : null } },
    settings: { ...DEFAULT_PLAYER_SETTINGS },
  };
  return addCoins(base, WELCOME_COINS, 'Welcome bonus', now);
}

/** Standard competition ranking (1 + number of strictly better scores); lower Hearts score is better. */
export function heartsPlaces(scores: readonly number[]): number[] {
  return scores.map((s) => 1 + scores.filter((o) => o < s).length);
}

export interface HeartsPayout {
  place: number;
  placeCoins: number;
  multiplier: number;
  moonBonus: number;
  total: number;
}

/** Coins for one finished Hearts game (D-050). */
export function heartsPayout(place: number, difficulty: Difficulty, moonsShot: number): HeartsPayout {
  const placeCoins = HEARTS_PLACE_COINS[Math.min(Math.max(place, 1), 4) - 1]!;
  const multiplier = DIFFICULTY_MULTIPLIER[difficulty];
  const moonBonus = MOON_BONUS * moonsShot;
  return { place, placeCoins, multiplier, moonBonus, total: Math.round(placeCoins * multiplier) + moonBonus };
}

export interface HeartsGameSummary {
  /** Final game scores, indexed by seat; seat 0 is the player. */
  finalScores: readonly number[];
  handsPlayed: number;
  /** Moons shot and Queens of Spades taken by the player during this game. */
  moonsShot: number;
  queensTaken: number;
  difficulty: Difficulty;
}

const PLACE_NAMES = ['1st', '2nd', '3rd', '4th'];
const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** Record a finished Hearts game for the player in seat 0. Abandoned games are never recorded. */
export function recordHeartsGame(p: Profile, g: HeartsGameSummary, now: string): { profile: Profile; payout: HeartsPayout } {
  const place = heartsPlaces(g.finalScores)[0]!;
  const payout = heartsPayout(place, g.difficulty, g.moonsShot);
  const s = p.stats.hearts;
  const score = g.finalScores[0]!;
  const won = place === 1;
  const placings = [...s.placings] as HeartsStats['placings'];
  placings[place - 1]! += 1;
  const streak = won ? s.currentWinStreak + 1 : 0;
  const hearts: HeartsStats = {
    gamesPlayed: s.gamesPlayed + 1,
    gamesWon: s.gamesWon + (won ? 1 : 0),
    placings,
    handsPlayed: s.handsPlayed + g.handsPlayed,
    moonsShot: s.moonsShot + g.moonsShot,
    queensTaken: s.queensTaken + g.queensTaken,
    bestScore: s.bestScore === null ? score : Math.min(s.bestScore, score),
    worstScore: s.worstScore === null ? score : Math.max(s.worstScore, score),
    currentWinStreak: streak,
    bestWinStreak: Math.max(s.bestWinStreak, streak),
    coinsEarned: s.coinsEarned + payout.total,
  };
  const reason = `Hearts: ${PLACE_NAMES[place - 1]} place (${DIFFICULTY_NAMES[g.difficulty]})${g.moonsShot ? ` + ${g.moonsShot} moon${g.moonsShot > 1 ? 's' : ''}` : ''}`;
  const updated = addCoins({ ...p, stats: { ...p.stats, hearts } }, payout.total, reason, now);
  return { profile: updated, payout };
}

export function winRate(s: HeartsStats): number | null {
  return s.gamesPlayed === 0 ? null : s.gamesWon / s.gamesPlayed;
}

/**
 * Validate and repair a profiles file read from disk. Unknown or malformed data never crashes the
 * game: bad profiles are dropped and missing fields get defaults.
 */
export function normalizeProfilesFile(raw: unknown): ProfilesFile {
  const empty: ProfilesFile = { schemaVersion: 1, activeProfileId: null, profiles: [] };
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as Partial<ProfilesFile>;
  const profiles: Profile[] = [];
  for (const x of Array.isArray(r.profiles) ? r.profiles : []) {
    const p = x as Partial<Profile>;
    const name = typeof p.name === 'string' ? cleanName(p.name) : null;
    if (typeof p.id !== 'string' || !name) continue;
    const hs = { ...emptyHeartsStats(), ...(p.stats?.hearts ?? {}) };
    const hp = { ...DEFAULT_HEARTS_PREFS, ...(p.prefs?.hearts ?? {}) };
    profiles.push({
      schemaVersion: 1,
      id: p.id,
      name,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date(0).toISOString(),
      coins: Number.isFinite(p.coins) ? Math.max(0, Math.floor(p.coins as number)) : 0,
      ledger: Array.isArray(p.ledger) ? p.ledger.slice(0, LEDGER_MAX) : [],
      stats: { hearts: hs },
      prefs: { hearts: hp },
      settings: normalizePlayerSettings(p.settings),
    });
  }
  const active = profiles.some((p) => p.id === r.activeProfileId) ? (r.activeProfileId as string) : (profiles[0]?.id ?? null);
  return { schemaVersion: 1, activeProfileId: active, profiles };
}
