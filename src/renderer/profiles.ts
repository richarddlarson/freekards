/**
 * Profile store for the renderer (spec 15, D-049, D-051). Holds the profiles file in memory and
 * persists every change through the preload bridge (a JSON file in the app's data folder). Without
 * the bridge (e.g. a plain browser preview) it falls back to localStorage. All logic is in the
 * engine-neutral `profile` module.
 */
import { casino, profile, settings } from '../logic/index.js';
import { CHARACTERS } from './content.js';

type Profile = profile.Profile;
const DOC = 'profiles';
const FALLBACK_KEY = 'cardtable.profiles.v1';

interface StoreBridge {
  read(name: string): Promise<string | null>;
  write(name: string, text: string): Promise<void>;
}

function bridge(): StoreBridge | undefined {
  return (window as unknown as { freekards?: { store?: StoreBridge } }).freekards?.store;
}

let file: profile.ProfilesFile = { schemaVersion: 1, activeProfileId: null, profiles: [] };
const listeners = new Set<() => void>();

async function readRaw(): Promise<string | null> {
  try {
    const b = bridge();
    if (b) return await b.read(DOC);
  } catch (e) {
    console.warn('profiles: bridge read failed, using local storage', e);
  }
  try {
    return localStorage.getItem(FALLBACK_KEY);
  } catch {
    return null;
  }
}

async function persist(): Promise<void> {
  const text = JSON.stringify(file, null, 1);
  try {
    const b = bridge();
    if (b) {
      await b.write(DOC, text);
      return;
    }
  } catch (e) {
    console.warn('profiles: bridge write failed, using local storage', e);
  }
  try {
    localStorage.setItem(FALLBACK_KEY, text);
  } catch {
    /* nowhere to save: the session still works */
  }
}

function changed(): void {
  void persist();
  for (const fn of listeners) fn();
}

export async function loadProfiles(): Promise<void> {
  const raw = await readRaw();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  file = profile.normalizeProfilesFile(parsed);
  // Chips left at a poker table go back to everyone, and every regular gets a balance (spec 15 §6).
  const now = new Date().toISOString();
  const fixed = file.profiles.map((p) => casino.syncRegulars(casino.recoverTable(p, now), REGULARS));
  if (fixed.some((p, i) => p !== file.profiles[i])) {
    file = { ...file, profiles: fixed };
    void persist();
  }
}

/** The computer characters as casino regulars (spec 15 §6). */
export const REGULARS: readonly casino.Regular[] = CHARACTERS.map((c) => ({ id: c.id, skillAdjust: c.traits.skillAdjust, risk: c.traits.risk }));

/** After the player finishes a game: pay the regulars who played and run a background round (spec 15 §6.2). */
export function settleRegulars(credits: readonly casino.Credit[]): void {
  const p = activeProfile();
  if (p) replaceProfile(casino.afterGame(p, REGULARS, credits));
}

export function onProfilesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const allProfiles = (): readonly Profile[] => file.profiles;
export const activeProfile = (): Profile | null => file.profiles.find((p) => p.id === file.activeProfileId) ?? null;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function addProfile(name: string, prefs?: profile.HeartsPrefs): Profile {
  const p = profile.createProfile(name, newId(), new Date().toISOString(), prefs);
  file = { ...file, profiles: [...file.profiles, p], activeProfileId: p.id };
  changed();
  return p;
}

export function selectProfile(id: string): void {
  if (!file.profiles.some((p) => p.id === id)) return;
  file = { ...file, activeProfileId: id };
  changed();
}

export function replaceProfile(p: Profile): void {
  file = { ...file, profiles: file.profiles.map((x) => (x.id === p.id ? p : x)) };
  changed();
}

/** The active player's settings (spec 16), or the defaults when nobody is signed in (demo hashes). */
export function activeSettings(): settings.PlayerSettings {
  return activeProfile()?.settings ?? { ...settings.DEFAULT_PLAYER_SETTINGS };
}

/** Change some of the active player's settings and save at once. Ignored when nobody is active. */
export function updateActiveSettings(patch: Partial<settings.PlayerSettings>): void {
  const p = activeProfile();
  if (p) replaceProfile({ ...p, settings: { ...p.settings, ...patch } });
}

export function renameProfile(id: string, name: string): boolean {
  const clean = profile.cleanName(name);
  const p = file.profiles.find((x) => x.id === id);
  if (!clean || !p) return false;
  replaceProfile({ ...p, name: clean });
  return true;
}

export function deleteProfile(id: string): void {
  const profiles = file.profiles.filter((p) => p.id !== id);
  const active = file.activeProfileId === id ? (profiles[0]?.id ?? null) : file.activeProfileId;
  file = { ...file, profiles, activeProfileId: active };
  changed();
}

/** Format a coin amount with thousands separators. */
export const coinText = (n: number): string => n.toLocaleString('en-US');
