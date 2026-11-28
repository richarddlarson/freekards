import { describe, expect, it } from 'vitest';
import { STAKES } from '../../src/logic/poker/index.js';
import { simulateDraw, TEST_STAKES } from './poker-helpers.js';

describe('Five-Card Draw simulation (spec 19 §5.3)', () => {
  it('plays hundreds of hands with legal moves, conserving chips', () => {
    const profiles = [0.3, 0.55, 0.8, 0.55].map((skill, i) => ({ skill, risk: [0.3, 0.6, 0.9, 0.2][i]! }));
    let showdowns = 0;
    let hands = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const sim = simulateDraw(seed, profiles, 40);
      hands += sim.hands;
      showdowns += sim.events.filter((e) => e.type === 'showdown').length;
    }
    expect(hands).toBeGreaterThan(100);
    // Some hands are won without a showdown, and plenty go to one.
    expect(showdowns / hands).toBeGreaterThan(0.2);
    expect(showdowns / hands).toBeLessThan(0.95);
  });

  it('a strong player wins chips from weak ones over many hands', () => {
    let strongNet = 0;
    const weak = { skill: 0.15, risk: 0.4 };
    for (let seed = 1; seed <= 3; seed++) {
      const sim = simulateDraw(seed * 7, [{ skill: 0.9, risk: 0.4 }, weak, weak, weak], 50, TEST_STAKES, 3000);
      strongNet += sim.state.chips[0]! - 3000;
    }
    expect(strongNet).toBeGreaterThan(0);
  });
});
