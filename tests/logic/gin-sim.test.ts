import { describe, expect, it } from 'vitest';
import {
  applyGinAction,
  createGinAi,
  createGinGame,
  ginValue,
  type GinAction,
  type GinEvent,
  type GinState,
  type Player,
} from '../../src/logic/gin/index.js';

interface Sim {
  state: GinState;
  events: GinEvent[];
}

export function simulateGin(seed: number, profiles: { skill: number; risk: number }[], targetScore = 100): Sim {
  let state = createGinGame({ seed, targetScore });
  const players = profiles.map((p, i) => createGinAi(p, seed * 31 + i + 1));
  const events: GinEvent[] = [];
  const step = (a: GinAction) => {
    const r = applyGinAction(state, a);
    state = r.state;
    events.push(...r.events);
    players.forEach((p, i) => p.observe(r.events, i as Player));
  };
  for (let n = 0; state.phase !== 'game_over'; n++) {
    if (n > 20000) throw new Error(`Game did not finish (seed ${seed})`);
    const p = state.turn;
    const ai = players[p]!;
    if (state.phase === 'deal') step({ type: 'deal' });
    else if (state.phase === 'upcard') step(ai.takeUpcard(state, p) ? { type: 'take_upcard', player: p } : { type: 'pass_upcard', player: p });
    else if (state.phase === 'draw') step({ type: 'draw', player: p, source: ai.chooseDraw(state, p) });
    else if (state.phase === 'discard') {
      const d = ai.chooseDiscard(state, p);
      step({ type: d.knock ? 'knock' : 'discard', player: p, card: d.card });
    } else if (state.phase === 'hand_over') step({ type: 'continue' });
  }
  return { state, events };
}

describe('AI-only Gin games', () => {
  it('always finish with legal moves and consistent scoring (200 seeds)', { timeout: 60000 }, () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { state, events } = simulateGin(seed, [{ skill: [0.3, 0.55, 0.8][seed % 3]!, risk: 0.3 }, { skill: 0.55, risk: 0.9 }]);
      const r = state.result!;
      expect(state.scores[r.winner]).toBeGreaterThanOrEqual(100);
      expect(state.scores[1 - r.winner]).toBeLessThan(100);
      let total: [number, number] = [0, 0];
      for (const e of events) {
        if (e.type !== 'hand_scored') continue;
        const h = e.result;
        if (h.kind === 'dead') continue;
        total[h.winner!] += h.total;
        // Every card is accounted for: melds + deadwood (+ lay-offs) = 10 cards per player.
        for (const p of [0, 1] as Player[]) {
          const laid = p === h.knocker ? 0 : h.layoffs.length;
          expect(h.melds[p].reduce((n, m) => n + m.cards.length, 0) + h.deadwood[p].length + laid).toBe(10);
          expect(h.deadwood[p].reduce((n, c) => n + ginValue(c), 0)).toBe(h.deadwoodValue[p]);
        }
        expect(h.deadwoodValue[h.knocker!]).toBeLessThanOrEqual(10);
      }
      expect(total).toEqual(state.scores);
    }
  });

  it('a strong player beats a weak one most of the time', { timeout: 60000 }, () => {
    let wins = 0;
    const N = 150;
    for (let seed = 1; seed <= N; seed++) {
      const strongFirst = seed % 2 === 0;
      const strong = { skill: 0.95, risk: 0.3 };
      const weak = { skill: 0.1, risk: 0.3 };
      const { state } = simulateGin(seed + 1000, strongFirst ? [strong, weak] : [weak, strong]);
      if (state.result!.winner === (strongFirst ? 0 : 1)) wins++;
    }
    expect(wins / N).toBeGreaterThan(0.6);
  });
});

/** Measurements for spec 18 §2.9 (run with MEASURE=1). */
describe.runIf(process.env['MEASURE'])('Gin measurements', () => {
  it('prints hands per game and hand outcomes', { timeout: 600000 }, () => {
    for (const skill of [0.3, 0.55, 0.8]) {
      let hands = 0;
      const kinds: Record<string, number> = { knock: 0, gin: 0, undercut: 0, dead: 0 };
      let turns = 0;
      const N = 300;
      for (let seed = 1; seed <= N; seed++) {
        const { events } = simulateGin(seed, [{ skill, risk: 0.3 }, { skill, risk: 0.6 }]);
        for (const e of events) {
          if (e.type === 'hand_scored') {
            hands++;
            kinds[e.result.kind]!++;
          }
          if (e.type === 'discarded' || e.type === 'knocked' || e.type === 'gin') turns++;
        }
      }
      const pct = (k: string) => `${Math.round((100 * kinds[k]!) / hands)}%`;
      process.stderr.write('\n' + `skill ${skill}: ${(hands / N).toFixed(1)} hands/game, ${(turns / hands).toFixed(1)} turns/hand, knock ${pct('knock')} gin ${pct('gin')} undercut ${pct('undercut')} dead ${pct('dead')}`);
    }
    for (const [a, b] of [[0.95, 0.1], [0.8, 0.55], [0.8, 0.3]]) {
      let wins = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const first = seed % 2 === 0;
        const { state } = simulateGin(seed + 5000, first ? [{ skill: a!, risk: 0.3 }, { skill: b!, risk: 0.3 }] : [{ skill: b!, risk: 0.3 }, { skill: a!, risk: 0.3 }]);
        if (state.result!.winner === (first ? 0 : 1)) wins++;
      }
      process.stderr.write('\n' + `skill ${a} vs ${b}: ${Math.round(wins / 3)}% wins`);
    }
  });
});
