/**
 * Player preferences (spec 12 §5). Stored in the renderer's localStorage, which Electron keeps in the
 * app's userData folder (D-034). Reads and writes never throw: defaults are used if storage fails.
 */
import type { Difficulty, hearts } from '../logic/index.js';
import { DEFAULT_VOLUMES, type Volumes } from './audio.js';

export interface Settings {
  difficulty: Difficulty;
  ruleSet: hearts.HeartsRuleSet;
  /** Chosen opponents for West, North, East, or null for "Random". */
  opponents: string[] | null;
  /** Channel levels 0–1 and mute (spec 13 §1). */
  volumes: Volumes;
  /** Track to repeat, or null to shuffle all (spec 13 §3). */
  musicTrack: string | null;
}

const KEY = 'cardtable.settings.v1';
const DEFAULTS: Settings = { difficulty: 'medium', ruleSet: 'standard', opponents: null, volumes: { ...DEFAULT_VOLUMES }, musicTrack: null };

function level(v: unknown, fallback: number): number {
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, volumes: { ...DEFAULTS.volumes } };
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      difficulty: s.difficulty === 'easy' || s.difficulty === 'hard' ? s.difficulty : 'medium',
      ruleSet: s.ruleSet === 'jack-of-diamonds' ? 'jack-of-diamonds' : 'standard',
      opponents: Array.isArray(s.opponents) && s.opponents.length === 3 ? s.opponents.map(String) : null,
      volumes: {
        music: level(s.volumes?.music, DEFAULT_VOLUMES.music),
        sfx: level(s.volumes?.sfx, DEFAULT_VOLUMES.sfx),
        voice: level(s.volumes?.voice, DEFAULT_VOLUMES.voice),
        muted: s.volumes?.muted === true,
      },
      musicTrack: typeof s.musicTrack === 'string' ? s.musicTrack : null,
    };
  } catch {
    return { ...DEFAULTS, volumes: { ...DEFAULTS.volumes } };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: preferences just won't persist */
  }
}
