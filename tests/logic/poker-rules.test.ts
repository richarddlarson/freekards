import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/logic/core/cards.js';
import {
  applyDrawAction,
  bestHand,
  buildPots,
  chooseDiscards,
  createDrawGame,
  drawLegalBets,
  evaluate5,
  handName,
  splitPot,
  STAKES,
  type DrawAction,
  type DrawState,
} from '../../src/logic/poker/index.js';
import { pokerCandidates } from '../../src/logic/dialogue/poker-triggers.js';
import { TEST_STAKES } from './poker-helpers.js';

const hand = (s: string) => s.split(' ') as Card[];
const name = (s: string) => handName(evaluate5(hand(s)));
const score = (s: string) => evaluate5(hand(s)).score;

describe('hand ranking (spec 19 §1)', () => {
  it('names every category', () => {
    expect(name('AS KS QS JS TS')).toBe('Royal flush');
    expect(name('9H 8H 7H 6H 5H')).toBe('Straight flush, 9 high');
    expect(name('QC QD QH QS 2C')).toBe('Four of a kind, Queens');
    expect(name('KC KD KH 4S 4C')).toBe('Full house, Kings full of 4s');
    expect(name('AD 9D 7D 4D 2D')).toBe('Flush, Ace high');
    expect(name('TC 9D 8H 7S 6C')).toBe('Straight, 10 high');
    expect(name('5C 4D 3H 2S AC')).toBe('Straight, 5 high');
    expect(name('7C 7D 7H KS 2C')).toBe('Three of a kind, 7s');
    expect(name('JC JD 5H 5S 2C')).toBe('Two pair, Jacks and 5s');
    expect(name('9C 9D AH 5S 2C')).toBe('Pair of 9s');
    expect(name('AC JD 8H 5S 2C')).toBe('Ace high');
  });
  it('orders categories and breaks ties by kickers', () => {
    const ladder = ['AC JD 8H 5S 2C', '2C 2D 3H 4S 5C', '3C 3D 2H 2S 4C', '2C 2D 2H 3S 4C', '5C 4D 3H 2S AC', '6C 5D 4H 3S 2C', '2D 3D 4D 5D 7D', '2C 2D 2H 3S 3C', '2C 2D 2H 2S 3C', '5H 4H 3H 2H AH'];
    for (let i = 1; i < ladder.length; i++) expect(score(ladder[i]!)).toBeGreaterThan(score(ladder[i - 1]!));
    expect(score('KC KD 9H 5S 3C')).toBeGreaterThan(score('KH KS 9C 5D 2C')); // kicker
    expect(score('AC AD 3H 3S KC')).toBeGreaterThan(score('KH KS QC QD AH')); // higher top pair
    expect(score('AC AD 3H 3S KC')).toBe(score('AH AS 3C 3D KD')); // suits never break ties
    expect(score('6C 5D 4H 3S 2C')).toBeGreaterThan(score('5C 4D 3H 2S AC')); // the wheel is the lowest straight
  });
  it('picks the best five of seven', () => {
    expect(handName(bestHand(hand('AS KS 2D QS 7C JS TS')))).toBe('Royal flush');
    expect(handName(bestHand(hand('2C 2D 9H 9S 9C 4D KD')))).toBe('Full house, 9s full of 2s');
  });
});

describe('pots (spec 19 §2.5)', () => {
  it('builds a main pot and side pots by all-in level', () => {
    // Seat 0 all-in for 50, seats 1 and 2 put in 120, seat 3 folded after 10.
    const pots = buildPots([50, 120, 120, 10], [false, false, false, true]);
    expect(pots).toEqual([
      { amount: 160, eligible: [0, 1, 2] },
      { amount: 140, eligible: [1, 2] },
    ]);
  });
  it('splits a pot with the odd chip to the first winner left of the button', () => {
    expect([...splitPot(25, [1, 3], 2, 4)]).toEqual([
      [3, 13],
      [1, 12],
    ]);
  });
});

describe('Five-Card Draw engine (spec 19 §2)', () => {
  const start = (chips: (number | null)[] = [200, 200, 200, 200], seed = 3) => applyDrawAction(createDrawGame({ seed, stakes: TEST_STAKES, chips }), { type: 'deal' });
  const total = (s: DrawState) => s.chips.reduce((a, b) => a + b, 0) + s.committed.reduce((a, b) => a + b, 0);

  it('antes, deals five each, and opens betting left of the button', () => {
    const { state, events } = start();
    expect(events.filter((e) => e.type === 'ante')).toHaveLength(4);
    expect(state.hands.every((h) => h.length === 5)).toBe(true);
    expect(state.phase).toBe('bet1');
    expect(state.round!.toAct).toBe((state.button + 1) % 4);
    expect(total(state)).toBe(800);
    expect(drawLegalBets(state, state.round!.toAct!).kinds).toEqual(['check', 'bet']);
  });

  it('caps raises at a bet and three raises, and returns to the draw', () => {
    let { state } = start();
    const act = (type: DrawAction['type']) => (state = applyDrawAction(state, { type, seat: state.round!.toAct! } as DrawAction).state);
    act('bet');
    act('raise');
    act('raise');
    act('raise');
    expect(drawLegalBets(state, state.round!.toAct!).kinds).toEqual(['fold', 'call']);
    act('call');
    act('call');
    act('call');
    expect(state.phase).toBe('draw');
    expect(state.committed.every((c) => c === 45)).toBe(true);
  });

  it('gives the pot to the last player left, with the uncalled bet returned', () => {
    let { state } = start();
    const first = state.round!.toAct!;
    const r = applyDrawAction(state, { type: 'bet', seat: first });
    state = r.state;
    let events = r.events;
    for (let i = 0; i < 3; i++) {
      const x = applyDrawAction(state, { type: 'fold', seat: state.round!.toAct! });
      state = x.state;
      events = x.events;
    }
    expect(state.phase).toBe('hand_over');
    expect(events.find((e) => e.type === 'bet_returned')).toMatchObject({ seat: first, amount: 10 });
    expect(state.lastHand!.won[first]).toBe(20);
    expect(state.lastHand!.shown).toBeNull();
    expect(total(state)).toBe(800);
  });

  it('draws in order, replaces discards, and settles at a showdown', () => {
    let { state } = start();
    for (let i = 0; i < 4; i++) state = applyDrawAction(state, { type: 'check', seat: state.round!.toAct! }).state;
    expect(state.phase).toBe('draw');
    while (state.phase === 'draw') {
      const seat = state.drawTurn!;
      const d = state.hands[seat]!.slice(0, 2);
      state = applyDrawAction(state, { type: 'draw', seat, discards: d }).state;
      expect(state.hands[seat]!.some((c) => d.includes(c))).toBe(false);
      expect(state.hands[seat]).toHaveLength(5);
    }
    expect(state.phase).toBe('bet2');
    expect(state.round!.betSize).toBe(20);
    for (let i = 0; i < 4; i++) state = applyDrawAction(state, { type: 'check', seat: state.round!.toAct! }).state;
    expect(state.phase).toBe('hand_over');
    expect(state.lastHand!.shown).toHaveLength(4);
    expect(total(state)).toBe(800);
  });

  it('lets a short stack go all in for less, with a side pot', () => {
    let { state } = start([200, 12, 200, null]);
    const act = (type: DrawAction['type']) => (state = applyDrawAction(state, { type, seat: state.round!.toAct! } as DrawAction).state);
    // Antes: the short stack has 7 left. Bet, then everyone calls.
    act('bet');
    while (state.phase === 'bet1') act(drawLegalBets(state, state.round!.toAct!).kinds.includes('call') ? 'call' : 'check');
    expect(state.chips[1]).toBe(0);
    while (state.phase === 'draw') state = applyDrawAction(state, { type: 'draw', seat: state.drawTurn!, discards: [] }).state;
    while (state.phase === 'bet2') act('check');
    expect(state.phase).toBe('hand_over');
    expect(state.lastHand!.pots[0]!.eligible).toEqual([0, 1, 2]);
    expect(state.lastHand!.pots[0]!.amount).toBe(36);
    expect(total(state)).toBe(412);
  });

  it('rejects actions out of turn and out of phase', () => {
    const { state } = start();
    const other = (state.round!.toAct! + 1) % 4;
    expect(() => applyDrawAction(state, { type: 'check', seat: other })).toThrow();
    expect(() => applyDrawAction(state, { type: 'draw', seat: state.round!.toAct!, discards: [] })).toThrow();
    expect(() => applyDrawAction(state, { type: 'deal' })).toThrow();
    expect(() => applyDrawAction(state, { type: 'leave', seat: 0 })).toThrow();
  });

  it('seats and unseats players between hands, and skips empty seats', () => {
    let state = createDrawGame({ seed: 1, stakes: TEST_STAKES, chips: [200, null, 200, 0] });
    state = applyDrawAction(state, { type: 'deal' }).state;
    expect(state.inHand).toEqual([true, false, true, false]);
    expect(() => applyDrawAction(createDrawGame({ seed: 1, stakes: TEST_STAKES, chips: [200, null, null, null] }), { type: 'deal' })).toThrow();
    let idle = createDrawGame({ seed: 1, stakes: TEST_STAKES, chips: [200, null, 200, 0] });
    idle = applyDrawAction(idle, { type: 'sit', seat: 1, chips: 150 }).state;
    idle = applyDrawAction(idle, { type: 'leave', seat: 3 }).state;
    expect(idle.present).toEqual([true, true, true, false]);
  });
});

describe('draw strategy (spec 19 §5.2)', () => {
  const discards = (s: string) => chooseDiscards(hand(s)).length;
  it('stands pat with five-card hands and draws to the rest', () => {
    expect(discards('TC 9D 8H 7S 6C')).toBe(0);
    expect(discards('7C 7D 7H KS 2C')).toBe(2);
    expect(discards('JC JD 5H 5S 2C')).toBe(1);
    expect(discards('9C 9D AH 5S 2C')).toBe(3);
    expect(discards('AD 9D 7D 4D 2C')).toBe(1);
    expect(discards('9C 8D 7H 6S 2C')).toBe(1);
    expect(discards('KC 9D 7H 4S 2C')).toBe(4);
    expect(discards('9C 7D 5H 4S 2C')).toBe(5);
  });
});

describe('poker dialogue triggers (spec 08 §Poker triggers)', () => {
  const ctx = { computerSeats: [1, 2, 3], bigBet: 20 };
  const triggers = (events: Parameters<typeof pokerCandidates>[0], c: Parameters<typeof pokerCandidates>[1] = ctx) =>
    pokerCandidates(events, c).map((x) => `${x.seat}:${x.trigger}`);

  it('maps raises, folds, and standing pat to the right perspectives', () => {
    expect(triggers([{ type: 'bet_action', seat: 0, kind: 'raise', amount: 20, allIn: false, round: 0 }])).toEqual(['1:poker.raise.human', '2:poker.raise.human', '3:poker.raise.human']);
    expect(triggers([{ type: 'bet_action', seat: 2, kind: 'fold', amount: 0, allIn: false, round: 0 }])).toEqual(['2:poker.fold.self']);
    expect(triggers([{ type: 'drew', seat: 3, count: 0 }])).toEqual(['3:poker.stood_pat.self']);
  });

  it('talks about the main pot: winner, big pot, bluff, big hand, and bad beats', () => {
    const full = evaluate5(hand('KC KD KH 4S 4C'));
    const trips = evaluate5(hand('7C 7D 7H QS 2C'));
    const out = triggers(
      [
        { type: 'showdown', hands: [{ seat: 1, cards: full.cards, value: full }, { seat: 0, cards: trips.cards, value: trips }] },
        { type: 'pot_won', potIndex: 0, amount: 140, winners: [1], shares: [[1, 140]], handName: 'Full house, Kings full of 4s' },
      ],
      ctx,
    );
    expect(out).toContain('1:poker.big_pot.self');
    expect(out).toContain('2:poker.won_pot.other');
    expect(out).toContain('1:poker.big_hand.self');
    expect(out).toContain('2:poker.bad_beat.human');
    const bluff = triggers([{ type: 'pot_won', potIndex: 0, amount: 30, winners: [2], shares: [[2, 30]], handName: null }], { ...ctx, bluffing: new Set([2]) });
    expect(bluff).toContain('2:poker.bluff.self');
    expect(bluff).not.toContain('2:poker.big_pot.self');
  });

  it('only seated regulars speak', () => {
    expect(triggers([{ type: 'busted', seat: 0 }], { computerSeats: [1], bigBet: 20 })).toEqual(['1:poker.busted.human']);
    expect(triggers([{ type: 'sat', seat: 3, chips: 200 }], { computerSeats: [1, 3], bigBet: 20 })).toEqual(['3:poker.sit_down.self']);
  });
});
