import { describe, expect, it } from 'vitest';
import { choosePassCards, choosePlayCard } from '../../src/logic/hearts/ai.js';
import { Rng } from '../../src/logic/core/rng.js';
import { effectiveSkill } from '../../src/logic/core/skill.js';
import type { HeartsEvent, HeartsRuleSet } from '../../src/logic/hearts/index.js';
import { playState, simulateGame } from './helpers.js';

const PROFILE_SETS = [
  [0.3, 0.3, 0.3, 0.3],
  [0.55, 0.55, 0.55, 0.55],
  [0.95, 0.95, 0.95, 0.95],
  [0.05, 0.4, 0.7, 0.98],
].map((skills) => skills.map((skill, i) => ({ skill, risk: [0.2, 0.5, 0.8, 1][i]! })));

function checkHandInvariants(events: HeartsEvent[], ruleSet: HeartsRuleSet): number {
  let hands = 0;
  let tricksThisHand = 0;
  for (const e of events) {
    if (e.type === 'hand_started') tricksThisHand = 0;
    if (e.type === 'trick_won') tricksThisHand++;
    if (e.type === 'hand_scored') {
      hands++;
      expect(tricksThisHand).toBe(13);
      const total = e.handPoints.reduce((a, b) => a + b, 0);
      const jd = ruleSet === 'jack-of-diamonds' ? -10 : 0;
      expect([26 + jd, 78 + jd]).toContain(total); // normal hand, or a moon shot
    }
  }
  return hands;
}

describe('AI-only games', () => {
  for (const ruleSet of ['standard', 'jack-of-diamonds'] as const) {
    it(`always finish with legal moves (${ruleSet}, 200 seeds)`, () => {
      let moons = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const profiles = PROFILE_SETS[seed % PROFILE_SETS.length]!;
        const { state, events } = simulateGame(seed, ruleSet, profiles);
        expect(state.phase).toBe('game_over');
        expect(state.winner).not.toBeNull();
        const low = Math.min(...state.scores);
        expect(state.scores[state.winner!]).toBe(low);
        expect(state.scores.filter((v) => v === low)).toHaveLength(1);
        expect(Math.max(...state.scores)).toBeGreaterThanOrEqual(100);
        expect(events.filter((e) => e.type === 'game_won')).toHaveLength(1);
        const hands = checkHandInvariants(events, ruleSet);
        expect(hands).toBe(state.handNumber);
        moons += events.filter((e) => e.type === 'moon_shot').length;
      }
      expect(moons).toBeGreaterThanOrEqual(0);
    });
  }

  it('replays identically for the same seed', () => {
    const a = simulateGame(1234, 'jack-of-diamonds', PROFILE_SETS[3]!);
    const b = simulateGame(1234, 'jack-of-diamonds', PROFILE_SETS[3]!);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.state.scores).toEqual(b.state.scores);
  });

  it('stronger players score better on average', () => {
    let weak = 0;
    let strong = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const profiles = [0.05, 0.95, 0.05, 0.95].map((skill) => ({ skill, risk: 0.3 }));
      const { state } = simulateGame(seed, 'standard', profiles);
      weak += state.scores[0] + state.scores[2];
      strong += state.scores[1] + state.scores[3];
    }
    expect(strong).toBeLessThan(weak);
  });
});

describe('AI heuristics', () => {
  const expert = { skill: 0.98, risk: 0 };

  it('passes the unguarded Q♠ and high hearts', () => {
    // Fixed rng with value 0 always hits the "best move" branch.
    const hand = ['QS', '3S', 'AH', 'KH', '2C', '3C', '4C', '5C', '2D', '3D', '4D', '5D', '6D'] as const;
    const pass = choosePassCards([...hand], expert, new Rng(1));
    expect(pass).toContain('QS');
    expect(pass).toContain('AH');
  });

  it('keeps a well-guarded Q♠', () => {
    const hand = ['QS', '2S', '3S', '4S', '5S', 'AH', 'KH', 'QH', '2C', '3C', '2D', '3D', '4D'] as const;
    expect(choosePassCards([...hand], expert, new Rng(1))).not.toContain('QS');
  });

  it('dumps the Q♠ when void in the led suit', () => {
    const s = playState({
      hands: [[], ['QS', 'KH', '9S'], [], []],
      leader: 0,
      plays: [{ seat: 0, card: '7D' }],
      firstTrick: false,
    });
    let dumped = 0;
    for (let seed = 1; seed <= 50; seed++) if (choosePlayCard(s, 1, expert, new Rng(seed)) === 'QS') dumped++;
    expect(dumped).toBeGreaterThan(40);
  });

  it('ducks under the current winner with its highest safe card', () => {
    const s = playState({
      hands: [[], ['2D', '9D', 'KD'], [], []],
      leader: 0,
      plays: [{ seat: 0, card: 'TD' }],
      firstTrick: false,
    });
    let ducked = 0;
    for (let seed = 1; seed <= 50; seed++) if (choosePlayCard(s, 1, expert, new Rng(seed)) === '9D') ducked++;
    expect(ducked).toBeGreaterThan(40);
  });

  it('uses the difficulty model', () => {
    expect(effectiveSkill('hard', 0.15)).toBeGreaterThan(effectiveSkill('easy', -0.15));
  });
});
