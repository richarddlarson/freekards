import { describe, expect, it } from 'vitest';
import { CARD_H, CARD_W, fitViewport, LAYOUT, tableLayout } from '../../src/logic/layout/hearts-table.js';
import { chipStacks, playerCardPlacement, pokerLayout, POKER_LAYOUT, shownCardPlacement, stackPositions } from '../../src/logic/layout/poker-table.js';

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

    it(`keeps three chip stacks clear of the cards and portraits (${w}×${h})`, () => {
      // A full stack's top must clear the nameplate under the portrait (side seats) and the table edge.
      const tall = 58.8 + (POKER_LAYOUT.maxPerStack - 1) * POKER_LAYOUT.chipStep;
      const base = tableLayout(fitViewport(w, h));
      for (const s of [1, 3] as const) expect(L.stacks[s]!.y - tall).toBeGreaterThan(base.seats[s].portrait.y + LAYOUT.portraitSize / 2 + 40);
      expect(L.stacks[2]!.y - tall).toBeGreaterThan(0);
      const half = (3 * POKER_LAYOUT.chipWidth + 2 * POKER_LAYOUT.stackGap) / 2;
      const fanEdge = LAYOUT.margin + CARD_H * LAYOUT.opponentCardScale;
      expect(L.stacks[1]!.x - half).toBeGreaterThan(fanEdge);
      expect(L.stacks[3]!.x + half).toBeLessThan(L.base.width - fanEdge);
      const north = tableLayout(fitViewport(w, h)).seats[2].portrait;
      expect(L.stacks[2]!.x + half).toBeLessThan(north.x - LAYOUT.portraitSize / 2);
    });

    it(`fits the player's chip meter between the action bar and her tallest stacks (${w}×${h})`, () => {
      const meterHalf = 50;
      const tallest = 58.8 + (POKER_LAYOUT.maxPerStack - 1) * POKER_LAYOUT.chipStep + POKER_LAYOUT.rowStep;
      expect(L.meter.y - meterHalf).toBeGreaterThan(L.actionBar.y + 38);
      expect(L.stacks[0]!.y - tallest).toBeGreaterThan(L.meter.y + meterHalf);
      expect(L.stacks[0]!.y + POKER_LAYOUT.rowStep).toBeLessThan(L.base.height - 40);
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
  it('puts more than three stacks in balanced rows, never wider than three', () => {
    expect(stackPositions(3).map((p) => p.y)).toEqual([0, 0, 0]);
    expect(stackPositions(4).map((p) => p.y)).toEqual([36, 36, 0, 0]);
    expect(stackPositions(5).map((p) => p.y)).toEqual([36, 36, 36, 0, 0]);
    const widest = (3 * POKER_LAYOUT.chipWidth + 2 * POKER_LAYOUT.stackGap) / 2;
    for (const n of [1, 2, 3, 4, 5, 6, 7]) for (const p of stackPositions(n)) expect(Math.abs(p.x) + POKER_LAYOUT.chipWidth / 2).toBeLessThanOrEqual(widest + 0.01);
  });

  it("breaks a player's stack down like a cashier's buy-in, keeping some small chips", () => {
    const flat = (st: { value: number; count: number }[]) => st.map((x) => `${x.count}×${x.value}`).join(' ');
    expect(flat(chipStacks(100, 8, 'stack'))).toBe('3×25 4×5 5×1');
    expect(flat(chipStacks(94, 8, 'stack'))).toBe('2×25 8×5 4×1');
    expect(flat(chipStacks(200, 8, 'stack'))).toBe('1×100 3×25 4×5 5×1');
    expect(flat(chipStacks(400, 8, 'stack'))).toBe('2×100 7×25 4×5 5×1');
    expect(flat(chipStacks(12, 8, 'stack'))).toBe('2×5 2×1');
    // Kept small chips plus the change never need a second stack of one value.
    for (let n = 0; n <= 1000; n++) for (const st of chipStacks(n, 8, 'stack')) if (st.value < 100) expect(st.count).toBeLessThanOrEqual(8);
    for (const n of [0, 7, 49, 50, 185, 249, 250, 1234, 9999]) {
      expect(chipStacks(n, 10, 'stack').reduce((sum, x) => sum + x.value * x.count, 0)).toBe(n);
    }
  });

  it('uses the fewest chips, largest first, in stacks of at most 8', () => {
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
      { value: 1000, count: 8 },
      { value: 1000, count: 6 },
    ]);
  });
});
