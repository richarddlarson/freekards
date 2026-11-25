import { describe, expect, it } from 'vitest';
import { isCard, makeCard, newDeck, rankOf, sortHand, suitOf } from '../../src/logic/core/cards.js';
import { Rng, nextRandom } from '../../src/logic/core/rng.js';
import { effectiveSkill } from '../../src/logic/core/skill.js';

describe('cards', () => {
  it('builds a 52-card deck of unique, valid cards', () => {
    const deck = newDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
    expect(deck.every(isCard)).toBe(true);
  });

  it('parses rank and suit', () => {
    expect(rankOf('AS')).toBe(14);
    expect(rankOf('TD')).toBe(10);
    expect(rankOf('2C')).toBe(2);
    expect(suitOf('QH')).toBe('H');
    expect(makeCard(12, 'S')).toBe('QS');
    expect(() => makeCard(15, 'S')).toThrow();
  });

  it('sorts a hand by suit then rank', () => {
    expect(sortHand(['AH', '2C', 'KS', '3C', 'TD'])).toEqual(['AH', 'KS', 'TD', '2C', '3C']);
  });
});

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it('matches the documented Mulberry32 reference values', () => {
    // Reference values for seed 0; any port must reproduce these exactly.
    const r1 = nextRandom(0);
    const r2 = nextRandom(r1.state);
    expect(r1.value).toBeCloseTo(0.26642920868471265, 15);
    expect(r2.value).toBeCloseTo(0.0003297457005828619, 15);
  });

  it('shuffles into a permutation, differently for different seeds', () => {
    const deck = newDeck();
    const s1 = new Rng(1).shuffle(deck);
    const s2 = new Rng(2).shuffle(deck);
    expect([...s1].sort()).toEqual([...deck].sort());
    expect(s1).not.toEqual(s2);
    expect(new Rng(1).shuffle(deck)).toEqual(s1);
  });
});

describe('skill', () => {
  it('adds the character adjustment to the baseline and clamps', () => {
    expect(effectiveSkill('easy', 0)).toBeCloseTo(0.3);
    expect(effectiveSkill('medium', 0.1)).toBeCloseTo(0.65);
    expect(effectiveSkill('hard', 0.15)).toBeCloseTo(0.95);
    expect(effectiveSkill('hard', 0.5)).toBeCloseTo(0.95); // adjustment clamped to +0.15
    expect(effectiveSkill('easy', -1)).toBeCloseTo(0.15); // adjustment clamped to −0.15
  });
});
