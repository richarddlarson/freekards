import { describe, expect, it } from 'vitest';
import {
  CARD_W,
  LAYOUT,
  REF_H,
  REF_W,
  fitViewport,
  handPlacement,
  southSpacing,
  tableLayout,
} from '../../src/logic/layout/hearts-table.js';

/** Window sizes in logical (CSS) pixels for the supported range (spec 11 §1). */
const WINDOWS = {
  surfacePro9: [1440, 960], // 2880×1920 at 200%
  fullHd100: [1920, 1080],
  fullHd150: [1280, 720],
  uhd150: [2560, 1440],
  uhd100: [3840, 2160],
  wxga: [1280, 800], // 16:10
  minimum: [960, 600],
} as const;

describe('viewport fitting', () => {
  it('maps the Surface Pro 9 exactly onto the reference table', () => {
    const vp = fitViewport(1440, 960);
    expect(vp.scale).toBeCloseTo(0.75);
    expect(vp.width).toBeCloseTo(REF_W);
    expect(vp.height).toBeCloseTo(REF_H);
  });

  it('turns extra width into more table, never less', () => {
    for (const [w, h] of Object.values(WINDOWS)) {
      const vp = fitViewport(w, h);
      expect(vp.width).toBeGreaterThanOrEqual(REF_W - 1e-6);
      expect(vp.height).toBeGreaterThanOrEqual(REF_H - 1e-6);
      expect(vp.width * vp.scale).toBeCloseTo(w);
      expect(vp.height * vp.scale).toBeCloseTo(h);
    }
  });
});

describe('hand layout', () => {
  it("keeps every South card's corner index visible", () => {
    // The index column ends about 29% of the way across the card (scripts/generate-cards.mjs, D-060).
    expect(LAYOUT.southMinSpacing).toBeGreaterThanOrEqual(0.3 * CARD_W);
    for (const [w, h] of Object.values(WINDOWS)) {
      const layout = tableLayout(fitViewport(w, h));
      expect(southSpacing(layout, 13)).toBeGreaterThanOrEqual(LAYOUT.southMinSpacing);
    }
  });

  it('keeps the full South hand on screen at every supported size', () => {
    for (const [w, h] of Object.values(WINDOWS)) {
      const layout = tableLayout(fitViewport(w, h));
      const first = handPlacement(layout, 0, 0, 13);
      const last = handPlacement(layout, 0, 12, 13);
      expect(first.x - CARD_W / 2).toBeGreaterThanOrEqual(0);
      expect(last.x + CARD_W / 2).toBeLessThanOrEqual(layout.width);
    }
  });

  it('anchors West and East to the window edges on wide screens', () => {
    const wide = tableLayout(fitViewport(1920, 1080));
    expect(handPlacement(wide, 1, 0, 13).x).toBeLessThan(150);
    expect(handPlacement(wide, 3, 0, 13).x).toBeGreaterThan(wide.width - 150);
    expect(wide.width).toBeGreaterThan(REF_W);
  });
});
