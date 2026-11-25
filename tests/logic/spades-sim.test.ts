import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/logic/core/rng.js';
import type { Card } from '../../src/logic/core/cards.js';
import {
  applySpadesAction,
  choosePlayCard,
  createSpadesAi,
  createSpadesGame,
  currentSeat,
  estimateTricks,
  type Seat,
  type SpadesAction,
  type SpadesEvent,
  type SpadesState,
} from '../../src/logic/spades/index.js';

interface Sim {
  state: SpadesState;
  events: SpadesEvent[];
}

export function simulateSpades(seed: number, profiles: { skill: number; risk: number }[], targetScore = 500): Sim {
  let state = createSpadesGame({ seed, targetScore });
  const players = profiles.map((p, i) => createSpadesAi(p, seed * 31 + i + 1));
  const events: SpadesEvent[] = [];
  const step = (a: SpadesAction) => {
    const r = applySpadesAction(state, a);
    state = r.state;
    events.push(...r.events);
  };
  for (let n = 0; state.phase !== 'game_over'; n++) {
    if (n > 20000) throw new Error(`Game did not finish (seed ${seed})`);
    const seat = currentSeat(state);
    if (state.phase === 'deal') step({ type: 'deal' });
    else if (state.phase === 'bid') step({ type: 'bid', seat: seat!, bid: players[seat!]!.chooseBid(state, seat!) });
    else if (state.phase === 'play') step({ type: 'play', seat: seat!, card: players[seat!]!.choosePlay(state, seat!) });
    else if (state.phase === 'score') step({ type: 'continue' });
  }
  return { state, events };
}

const mixed = (skills: number[]) => skills.map((skill, i) => ({ skill, risk: [0.3, 0.6, 0.9, 0.2][i]! }));

describe('AI-only Spades games', () => {
  it('always finish with legal moves and consistent scoring (200 seeds)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { state, events } = simulateSpades(seed, mixed([0.3, 0.55, 0.8, 0.95].map((s, i) => [s, 0.55, 0.95, 0.05][(seed + i) % 4]!)));
      expect(state.phase).toBe('game_over');
      expect(state.winner).not.toBeNull();
      const [a, b] = state.scores;
      expect(a).not.toBe(b);
      expect(state.scores[state.winner!]).toBe(Math.max(a, b));
      expect(Math.max(a, b) >= 500 || Math.min(a, b) <= -200).toBe(true);
      let tricks = 0;
      for (const e of events) {
        if (e.type === 'hand_started') tricks = 0;
        if (e.type === 'trick_won') tricks++;
        if (e.type === 'hand_scored') expect(tricks).toBe(13);
      }
      expect(state.bags.every((x) => x >= 0 && x < 10)).toBe(true);
    }
  });

  it('replays identically for the same seed', () => {
    const a = simulateSpades(4321, mixed([0.3, 0.6, 0.9, 0.5]));
    const b = simulateSpades(4321, mixed([0.3, 0.6, 0.9, 0.5]));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });

  it('a strong partnership beats a weak one most of the time', () => {
    let strongWins = 0;
    const games = 120;
    for (let seed = 1; seed <= games; seed++) {
      // Team 1 (West + East) strong, team 0 weak.
      const { state } = simulateSpades(seed, [0.1, 0.95, 0.1, 0.95].map((skill) => ({ skill, risk: 0.4 })));
      if (state.winner === 1) strongWins++;
    }
    expect(strongWins / games).toBeGreaterThan(0.65);
  });

  it('bids are sensible: most hands are made or set by a little', () => {
    let hands = 0;
    let made = 0;
    let nils = 0;
    let nilsMade = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const { events } = simulateSpades(seed, mixed([0.8, 0.8, 0.8, 0.8]));
      for (const e of events) {
        if (e.type !== 'hand_scored') continue;
        for (const r of e.results) {
          if (r.contract === 0) continue;
          hands++;
          if (r.made) made++;
          for (const n of r.nils) {
            nils++;
            if (n.made) nilsMade++;
          }
        }
      }
    }
    expect(made / hands).toBeGreaterThan(0.55);
    expect(nils).toBeGreaterThan(0);
    expect(nilsMade / nils).toBeGreaterThan(0.4);
  });
});

describe('Spades AI heuristics', () => {
  const expert = { skill: 0.98, risk: 0 };

  it('estimates tricks from high cards and spades', () => {
    expect(estimateTricks(['AS', 'KS', 'QS', 'JS', 'TS', 'AH', 'KH', 'AD', 'AC', '2C', '3C', '4D', '5D'] as Card[])).toBeGreaterThan(8);
    expect(estimateTricks(['2S', '3H', '4H', '5H', '6D', '7D', '8D', '2C', '3C', '4C', '5C', '6C', '9H'] as Card[])).toBeLessThan(1);
  });

  it('a Nil bidder ducks with its highest safe card', () => {
    const s = createSpadesGame({ seed: 1 });
    s.phase = 'play';
    s.dealer = 3;
    s.bids = [3, 0, 3, 3];
    s.hands = [[], ['2D', '9D', 'KD'], [], []];
    s.trick = { leader: 0, plays: [{ seat: 0 as Seat, card: 'TD' }] };
    let ducked = 0;
    for (let seed = 1; seed <= 50; seed++) if (choosePlayCard(s, 1, expert, new Rng(seed)) === '9D') ducked++;
    expect(ducked).toBeGreaterThan(40);
  });

  it('does not overtake a partner who is winning on the last play', () => {
    const s = createSpadesGame({ seed: 1 });
    s.phase = 'play';
    s.dealer = 3;
    s.bids = [3, 3, 3, 3];
    s.hands = [[], ['2D', 'KD'], [], []];
    // Seat 1 plays last: leader 2 (W's partner is East, seat 3).
    s.trick = { leader: 2, plays: [{ seat: 2, card: '5D' }, { seat: 3, card: 'QD' }, { seat: 0, card: '7D' }] };
    let low = 0;
    for (let seed = 1; seed <= 50; seed++) if (choosePlayCard(s, 1, expert, new Rng(seed)) === '2D') low++;
    expect(low).toBeGreaterThan(40);
  });

  it('trumps in when its team needs tricks and the opponents are winning', () => {
    const s = createSpadesGame({ seed: 1 });
    s.phase = 'play';
    s.dealer = 3;
    s.bids = [3, 5, 3, 5];
    s.spadesBroken = true;
    s.hands = [[], ['4S', 'KS', '2C'], [], []];
    s.trick = { leader: 0, plays: [{ seat: 0, card: 'AH' }] };
    let trumped = 0;
    for (let seed = 1; seed <= 50; seed++) if (choosePlayCard(s, 1, expert, new Rng(seed)) === '4S') trumped++;
    expect(trumped).toBeGreaterThan(40);
  });
});
