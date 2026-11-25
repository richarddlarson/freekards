import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sortHand } from '../../src/logic/core/cards.js';
import { GAME_SPEED_FACTOR, RESPONSE_TIMING, TIMING } from '../../src/logic/layout/hearts-table.js';
import { createProfile, normalizeProfilesFile } from '../../src/logic/profile/profile.js';
import { CARD_DECKS, DEFAULT_PLAYER_SETTINGS, normalizePlayerSettings } from '../../src/logic/settings/player-settings.js';

const NOW = '2026-11-24T12:00:00.000Z';

describe('card order (D-054, D-064)', () => {
  const hand = ['AH', '2C', 'KS', '3C', 'TD', '4H'] as const;
  it('low cards on the left is the default', () => {
    expect(sortHand(hand)).toEqual(['2C', '3C', 'TD', 'KS', '4H', 'AH']);
    expect(sortHand(hand, 'low-left')).toEqual(sortHand(hand));
  });
  it('low cards on the right reverses ranks but keeps the suit groups in place', () => {
    expect(sortHand(hand, 'low-right')).toEqual(['3C', '2C', 'TD', 'KS', 'AH', '4H']);
  });
  it('never reverses the suits: both orders show the same suit sequence', () => {
    const full = ['AS', '2H', 'KC', '9D', '5S', 'QH', '3C', 'JD', 'TS', '7H', '4C', '8D'] as const;
    const suits = (cards: readonly string[]) => [...new Set(cards.map((c) => c[1]))];
    expect(suits(sortHand(full, 'low-right'))).toEqual(suits(sortHand(full, 'low-left')));
    expect(suits(sortHand(full, 'low-left'))).toEqual(['C', 'D', 'S', 'H']);
  });
});

describe('player settings', () => {
  it('new profiles get the defaults', () => {
    expect(createProfile('Ann', 'a', NOW).settings).toEqual(DEFAULT_PLAYER_SETTINGS);
    expect(DEFAULT_PLAYER_SETTINGS).toEqual({ cardOrder: 'low-left', cardResponse: 'standard', gameSpeed: 'normal', cardDeck: 'classic' });
  });
  it('repairs each field on its own', () => {
    expect(normalizePlayerSettings(undefined)).toEqual(DEFAULT_PLAYER_SETTINGS);
    expect(normalizePlayerSettings({ cardOrder: 'low-right', cardResponse: 'warp', gameSpeed: 3, cardDeck: 'tarot' })).toEqual({
      cardOrder: 'low-right',
      cardResponse: 'standard',
      gameSpeed: 'normal',
      cardDeck: 'classic',
    });
    expect(normalizePlayerSettings({ cardDeck: 'rounded' }).cardDeck).toBe('rounded');
  });
  it('profiles saved before settings existed load with the defaults', () => {
    const f = normalizeProfilesFile({ profiles: [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bo', settings: { cardResponse: 'instant' } }] });
    expect(f.profiles[0]!.settings).toEqual(DEFAULT_PLAYER_SETTINGS);
    expect(f.profiles[1]!.settings.cardResponse).toBe('instant');
  });
});

describe('response and pace timing (D-055, D-056)', () => {
  it('Standard matches the original table timing', () => {
    expect(RESPONSE_TIMING.standard.playFlight).toBe(TIMING.playFlight);
    expect(RESPONSE_TIMING.standard.resort).toBe(TIMING.resort);
    expect(RESPONSE_TIMING.standard.tapOn).toBe('release');
    expect(GAME_SPEED_FACTOR.normal).toBe(1);
  });
  it('each level is at least as fast as the one before', () => {
    const [s, q, i] = [RESPONSE_TIMING.standard, RESPONSE_TIMING.quick, RESPONSE_TIMING.instant];
    for (const k of ['playFlight', 'resort', 'passToggle'] as const) {
      expect(q[k]).toBeLessThan(s[k]);
      expect(i[k]).toBeLessThanOrEqual(q[k]);
    }
    expect(i.tapOn).toBe('press');
    expect(GAME_SPEED_FACTOR.relaxed).toBeGreaterThan(1);
    expect(GAME_SPEED_FACTOR.fast).toBeLessThan(1);
  });
});

describe('card decks (D-062)', () => {
  it('every deck a player can choose has 52 faces and a back', () => {
    for (const deck of CARD_DECKS) {
      const dir = `assets/themes/classic-casino/decks/${deck}`;
      expect(existsSync(`${dir}/back.svg`), `${deck} back`).toBe(true);
      expect(readdirSync(`${dir}/faces`).filter((f) => f.endsWith('.svg'))).toHaveLength(52);
    }
  });
});
