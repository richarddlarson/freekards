import {
  actingSeat,
  applyDrawAction,
  createDrawAi,
  createDrawGame,
  dealableSeats,
  STAKES,
  type DrawEvent,
  type DrawState,
  type Stakes,
} from '../../src/logic/poker/index.js';

export interface PokerSim {
  state: DrawState;
  events: DrawEvent[];
  hands: number;
}

/** Play `hands` hands among computer players; busted players stay out. */
export function simulateDraw(seed: number, profiles: { skill: number; risk: number }[], hands: number, stakes: Stakes = STAKES.low, chips = stakes.buyIn): PokerSim {
  let state = createDrawGame({ seed, stakes, chips: profiles.map(() => chips) });
  const ais = profiles.map((p, i) => createDrawAi(p, seed * 31 + i + 1));
  const events: DrawEvent[] = [];
  const total = () => state.chips.reduce((a, b) => a + b, 0) + state.committed.reduce((a, b) => a + b, 0);
  const start = total();
  let played = 0;
  while (played < hands && dealableSeats(state).length >= 2) {
    let r = applyDrawAction(state, { type: 'deal' });
    state = r.state;
    events.push(...r.events);
    for (let n = 0; state.phase !== 'hand_over'; n++) {
      if (n > 200) throw new Error(`hand did not finish (seed ${seed})`);
      const seat = actingSeat(state)!;
      const ai = ais[seat]!;
      r = state.phase === 'draw' ? applyDrawAction(state, { type: 'draw', seat, discards: ai.chooseDiscards(state, seat) }) : applyDrawAction(state, { type: ai.chooseBet(state, seat), seat });
      state = r.state;
      events.push(...r.events);
      if (total() !== start) throw new Error(`chips not conserved (seed ${seed})`);
    }
    played++;
  }
  return { state, events, hands: played };
}

