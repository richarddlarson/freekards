/**
 * Per-player settings (spec 16, D-053 to D-056, D-062). Engine-neutral and pure. Each profile carries one
 * PlayerSettings object; anything missing or unknown on load falls back to the default.
 */
import type { CardOrder } from '../core/cards.js';

export type { CardOrder };
/** How quickly the player's own cards react to a touch (D-055). */
export type CardResponse = 'standard' | 'quick' | 'instant';
/** Pace of the computer players and the table (D-056). */
export type GameSpeed = 'relaxed' | 'normal' | 'fast';
/** Which card deck the table draws (D-062). Each id is a folder of the theme's decks. */
export type CardDeck = 'classic' | 'rounded';

export interface PlayerSettings {
  cardOrder: CardOrder;
  cardResponse: CardResponse;
  gameSpeed: GameSpeed;
  cardDeck: CardDeck;
}

export const CARD_ORDERS: readonly CardOrder[] = ['low-left', 'low-right'];
export const CARD_RESPONSES: readonly CardResponse[] = ['standard', 'quick', 'instant'];
export const GAME_SPEEDS: readonly GameSpeed[] = ['relaxed', 'normal', 'fast'];
export const CARD_DECKS: readonly CardDeck[] = ['classic', 'rounded'];

export const DEFAULT_PLAYER_SETTINGS: Readonly<PlayerSettings> = {
  cardOrder: 'low-left',
  cardResponse: 'standard',
  gameSpeed: 'normal',
  cardDeck: 'classic',
};

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Repair settings read from disk: every field is checked on its own. */
export function normalizePlayerSettings(raw: unknown): PlayerSettings {
  const r = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof PlayerSettings, unknown>>) : {};
  const d = DEFAULT_PLAYER_SETTINGS;
  return {
    cardOrder: pick(r.cardOrder, CARD_ORDERS, d.cardOrder),
    cardResponse: pick(r.cardResponse, CARD_RESPONSES, d.cardResponse),
    gameSpeed: pick(r.gameSpeed, GAME_SPEEDS, d.gameSpeed),
    cardDeck: pick(r.cardDeck, CARD_DECKS, d.cardDeck),
  };
}
