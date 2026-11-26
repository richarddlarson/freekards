import { describe, expect, it } from 'vitest';
import {
  applyRummy500Action,
  createRummy500Ai,
  createRummy500Game,
  rummy500Value,
  type Player,
  type Rummy500Action,
  type Rummy500Event,
  type Rummy500State,
} from '../../src/logic/rummy500/index.js';

interface Sim {
  state: Rummy500State;
  events: Rummy500Event[];
}

export function simulateRummy500(seed: number, profiles: { skill: number; risk: number }[], targetScore = 500): Sim {
  let state = createRummy500Game({ seed, targetScore });
  const players = profiles.map((p, i) => createRummy500Ai(p, seed * 31 + i + 1));
  const events: Rummy500Event[] = [];
  const step = (a: Rummy500Action) => {
    const r = applyRummy500Action(state, a);
    state = r.state;
    events.push(...r.events);
    players.forEach((p, i) => p.observe(r.events, i as Player));
  };
  for (let n = 0; state.phase !== 'game_over'; n++) {
    if (n > 50000) throw new Error(`Game did not finish (seed ${seed})`);
    const p = state.turn;
    const ai = players[p]!;
    if (state.phase === 'deal') step({ type: 'deal' });
    else if (state.phase === 'draw') {
      const d = ai.chooseDraw(state, p);
      step(d.source === 'stock' ? { type: 'draw_stock', player: p } : { type: 'take_discard', player: p, index: d.index });
    } else if (state.phase === 'play') {
      const a = ai.nextPlay(state, p);
      step(a ?? { type: 'discard', player: p, card: ai.chooseDiscard(state, p) });
    } else if (state.phase === 'hand_over') step({ type: 'continue' });
  }
  return { state, events };
}

describe('AI-only Rummy 500 games', () => {
  it('always finish with legal moves and consistent scoring (100 seeds)', { timeout: 120000 }, () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { state, events } = simulateRummy500(seed, [{ skill: [0.3, 0.55, 0.8][seed % 3]!, risk: 0.3 }, { skill: 0.55, risk: 0.9 }]);
      expect(state.winner).not.toBeNull();
      expect(state.scores[state.winner!]).toBeGreaterThanOrEqual(500);
      expect(state.scores[state.winner!]).toBeGreaterThan(state.scores[1 - state.winner!]!);
      const total: [number, number] = [0, 0];
      for (const e of events) {
        if (e.type !== 'hand_scored') continue;
        total[0] += e.result.total[0];
        total[1] += e.result.total[1];
        for (const p of [0, 1]) expect(e.result.handCards[p]!.reduce((n, c) => n + rummy500Value(c), 0)).toBe(e.result.inHand[p]);
      }
      expect(total).toEqual(state.scores);
    }
  });

  it('a strong player beats a weak one most of the time', { timeout: 120000 }, () => {
    let wins = 0;
    const N = 80;
    for (let seed = 1; seed <= N; seed++) {
      const strongFirst = seed % 2 === 0;
      const strong = { skill: 0.95, risk: 0.3 };
      const weak = { skill: 0.1, risk: 0.3 };
      const { state } = simulateRummy500(seed + 1000, strongFirst ? [strong, weak] : [weak, strong]);
      if (state.winner === (strongFirst ? 0 : 1)) wins++;
    }
    expect(wins / N).toBeGreaterThan(0.6);
  });
});

/** Measurements for spec 18 §3.9 (run with MEASURE=1). */
describe.runIf(process.env['MEASURE'])('Rummy 500 measurements', () => {
  it('prints hands per game and hand outcomes', { timeout: 600000 }, () => {
    for (const skill of [0.3, 0.55, 0.8]) {
      let hands = 0;
      let out = 0;
      let turns = 0;
      let points = 0;
      let bigPick = 0;
      const N = 150;
      for (let seed = 1; seed <= N; seed++) {
        const { events } = simulateRummy500(seed, [{ skill, risk: 0.3 }, { skill, risk: 0.6 }]);
        for (const e of events) {
          if (e.type === 'hand_scored') {
            hands++;
            if (e.result.endedBy === 'out') out++;
            points += e.result.total[0] + e.result.total[1];
          }
          if (e.type === 'discarded' || e.type === 'went_out') turns++;
          if (e.type === 'took_discard' && e.cards.length >= 3) bigPick++;
        }
      }
      process.stderr.write(`\nskill ${skill}: ${(hands / N).toFixed(1)} hands/game, ${(turns / hands).toFixed(1)} turns/hand, went out ${Math.round((100 * out) / hands)}%, ${(points / hands / 2).toFixed(0)} pts/player/hand, ${(bigPick / hands).toFixed(2)} pick-ups of 3+ per hand`);
    }
    for (const [a, b] of [[0.95, 0.1], [0.8, 0.55], [0.8, 0.3]]) {
      let wins = 0;
      const N = 150;
      for (let seed = 1; seed <= N; seed++) {
        const first = seed % 2 === 0;
        const { state } = simulateRummy500(seed + 5000, first ? [{ skill: a!, risk: 0.3 }, { skill: b!, risk: 0.3 }] : [{ skill: b!, risk: 0.3 }, { skill: a!, risk: 0.3 }]);
        if (state.winner === (first ? 0 : 1)) wins++;
      }
      process.stderr.write(`\nskill ${a} vs ${b}: ${Math.round((100 * wins) / N)}% wins`);
    }
  });
});
