import type { Card } from '../../src/logic/core/cards.js';
import {
  applyHeartsAction,
  createHeartsGame,
  createHeartsAi,
  currentSeat,
  type HeartsAiPlayer,
  type HeartsEvent,
  type HeartsRuleSet,
  type HeartsState,
  type Seat,
} from '../../src/logic/hearts/index.js';

/** Build a play-phase state directly, with the given hands. */
export function playState(opts: {
  hands: [Card[], Card[], Card[], Card[]];
  leader: Seat;
  plays?: { seat: Seat; card: Card }[];
  firstTrick?: boolean;
  heartsBroken?: boolean;
  ruleSet?: HeartsRuleSet;
}): HeartsState {
  const s = createHeartsGame({ ruleSet: opts.ruleSet ?? 'standard', seed: 1 });
  s.phase = 'play';
  s.handNumber = 1;
  s.hands = opts.hands;
  s.trick = { leader: opts.leader, plays: opts.plays ?? [] };
  s.heartsBroken = opts.heartsBroken ?? false;
  if (opts.firstTrick === false) {
    // Pretend one trick of irrelevant cards has already been played.
    s.tricks = [
      {
        leader: 0,
        winner: 0,
        plays: [
          { seat: 0, card: '2C' },
          { seat: 1, card: '3C' },
          { seat: 2, card: '4C' },
          { seat: 3, card: '5C' },
        ],
      },
    ];
  }
  return s;
}

export interface SimResult {
  state: HeartsState;
  events: HeartsEvent[];
  actions: number;
}

/** Play a full AI-only game. Throws if any AI makes an illegal move (the engine rejects it). */
export function simulateGame(
  seed: number,
  ruleSet: HeartsRuleSet,
  profiles: { skill: number; risk: number }[],
  maxActions = 20000,
): SimResult {
  let state = createHeartsGame({ ruleSet, seed });
  const players: HeartsAiPlayer[] = profiles.map((p, i) => createHeartsAi(p, seed * 31 + i + 1));
  const events: HeartsEvent[] = [];
  let actions = 0;
  const step = (a: Parameters<typeof applyHeartsAction>[1]): void => {
    const r = applyHeartsAction(state, a);
    state = r.state;
    events.push(...r.events);
    actions++;
  };
  while (state.phase !== 'game_over') {
    if (actions > maxActions) throw new Error(`Game did not finish (seed ${seed})`);
    switch (state.phase) {
      case 'deal':
        step({ type: 'deal' });
        break;
      case 'pass':
        for (const seat of [0, 1, 2, 3] as Seat[]) {
          step({ type: 'pass', seat, cards: players[seat]!.choosePass(state, seat) });
        }
        break;
      case 'play': {
        const seat = currentSeat(state)!;
        step({ type: 'play', seat, card: players[seat]!.choosePlay(state, seat) });
        break;
      }
      case 'score':
        step({ type: 'continue' });
        break;
    }
  }
  return { state, events, actions };
}
