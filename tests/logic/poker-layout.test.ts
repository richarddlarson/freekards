import { describe, expect, it } from 'vitest';
import { CARD_H, CARD_W, fitViewport } from '../../src/logic/layout/hearts-table.js';
import { chipStacks, playerCardPlacement, pokerLayout, POKER_LAYOUT, shownCardPlacement } from '../../src/logic/layout/poker-table.js';

describe('poker table layout (spec 19 §4.2)', () => {
  for (const [w, h] of [[1920, 1280], [1920, 1080], [2560, 1440]] as const) {
    const L = pokerLayout(fitViewport(w, h));
    const inside = (p: { x: number; y: number }, margin = 40) => p.x > margin && p.x < L.base.width - margin && p.y > margin && p.y < L.base.height - margin;

    it(`keeps every stack, bet, button, and shown hand on the table (${w}×${h})`, () => {
      for (const p of [...L.stacks, ...L.bets, ...L.buttons, L.pot]) expect(inside(p)).toBe(true);
      for (const seat of [1, 2, 3]) {
        const first = shownCardPlacement(L, seat, 0, 5);
        const last = shownCardPlacement(L, seat, 4, 5);
        expect(first.x - (CARD_W * first.scale) / 2).toBeGreaterThan(0);
        expect(last.x + (CARD_W * last.scale) / 2).toBeLessThan(L.base.width);
      }
    });

    it(`spreads the player's five cards with every corner showing, clear of her stack (${w}×${h})`, () => {
      const xs = [0, 1, 2, 3, 4].map((i) => playerCardPlacement(L, i, 5, false).x);
      for (let i = 1; i < 5; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(POKER_LAYOUT.handSpacing);
      expect(xs[4]! + CARD_W / 2).toBeLessThan(L.stacks[0]!.x - 80);
      expect(xs[0]! - CARD_W / 2).toBeGreaterThan(L.you.x + 60);
      expect(playerCardPlacement(L, 0, 5, false).y + CARD_H / 2).toBeLessThanOrEqual(L.base.height);
      // The action bar sits above a lifted card.
      expect(L.actionBar.y).toBeLessThan(playerCardPlacement(L, 0, 5, true).y - CARD_H / 2);
    });
  }
});

describe('chip stacks (spec 19 §4.3)', () => {
  it('uses the fewest chips, largest first, in stacks of at most 12', () => {
    expect(chipStacks(0)).toEqual([]);
    expect(chipStacks(195)).toEqual([
      { value: 100, count: 1 },
      { value: 25, count: 3 },
      { value: 5, count: 4 },
    ]);
    expect(chipStacks(1631)).toEqual([
      { value: 1000, count: 1 },
      { value: 500, count: 1 },
      { value: 100, count: 1 },
      { value: 25, count: 1 },
      { value: 5, count: 1 },
      { value: 1, count: 1 },
    ]);
    expect(chipStacks(65, 12)).toEqual([
      { value: 25, count: 2 },
      { value: 5, count: 3 },
    ]);
    expect(chipStacks(14000)).toEqual([
      { value: 1000, count: 12 },
      { value: 1000, count: 2 },
    ]);
  });
});
