import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/logic/core/cards.js';
import { newDeck } from '../../src/logic/core/cards.js';
import { CARD_W, fitViewport } from '../../src/logic/layout/hearts-table.js';
import { groupedHandPlacements, meldRowPlacements, spreadPlacement, tableLayout } from '../../src/logic/layout/rummy-table.js';

const deck = newDeck();

describe('rummy table layout (spec 18 §4.2)', () => {
  for (const [w, h] of [[1920, 1280], [1920, 1080], [2560, 1440]] as const) {
    const L = tableLayout(fitViewport(w, h), 'rummy500');

    it(`keeps a big hand on screen with each card's corner visible (${w}×${h})`, () => {
      for (const n of [10, 13, 25]) {
        const places = groupedHandPlacements(L, [deck.slice(0, 3), deck.slice(3, n)], new Set());
        const xs = [...places.values()].map((p) => p.x).sort((a, b) => a - b);
        expect(xs[0]! - CARD_W / 2).toBeGreaterThan(150);
        expect(xs.at(-1)! + CARD_W / 2).toBeLessThan(L.width - 150);
        for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(40);
      }
    });

    it(`fits six melds in a row and a long discard pile (${w}×${h})`, () => {
      const melds: Card[][] = [0, 1, 2, 3, 4, 5].map((k) => deck.slice(k * 5, k * 5 + 5));
      const row = [...meldRowPlacements(L, melds, 'player').values()];
      expect(Math.min(...row.map((p) => p.x))).toBeGreaterThan(0);
      expect(Math.max(...row.map((p) => p.x))).toBeLessThan(L.width);
      const last = spreadPlacement(L, 29, 30);
      expect(last.x).toBeLessThan(L.width - 100);
    });
  }

  it('puts the groups in order with a wider gap between groups', () => {
    const L = tableLayout(fitViewport(1920, 1280), 'gin');
    const g1: Card[] = ['2H', '3H', '4H'];
    const g2: Card[] = ['9C', 'KS'];
    const p = groupedHandPlacements(L, [g1, g2], new Set(['KS']));
    const inGroup = p.get('3H')!.x - p.get('2H')!.x;
    const between = p.get('9C')!.x - p.get('4H')!.x;
    expect(between).toBeGreaterThan(inGroup);
    expect(p.get('KS')!.y).toBeLessThan(p.get('9C')!.y);
  });
});
