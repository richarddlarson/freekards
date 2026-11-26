import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/logic/core/cards.js';
import { allMelds, asMeld, asRun, bestArrangement, bestWithLayoffs, canLayOff, isSet, layOffAll } from '../../src/logic/rummy/melds.js';
import {
  applyGinAction,
  canKnockWith,
  createGinGame,
  gameResult,
  ginValue,
  legalDiscards,
  scoreKnock,
  type GinState,
} from '../../src/logic/gin/index.js';
import {
  applyRummy500Action,
  createRummy500Game,
  legalDiscards as r5Discards,
  rummy500Value,
  rummy500Winner,
  takeableIndexes,
  type Rummy500State,
} from '../../src/logic/rummy500/index.js';

const c = (s: string): Card[] => s.split(' ') as Card[];

describe('melds', () => {
  it('recognizes sets and runs', () => {
    expect(isSet(c('7C 7D 7H'))).toBe(true);
    expect(isSet(c('7C 7D 7H 7S'))).toBe(true);
    expect(isSet(c('7C 7D'))).toBe(false);
    expect(isSet(c('7C 7D 8H'))).toBe(false);
    expect(asRun(c('5H 3H 4H'), 'low')).toEqual(c('3H 4H 5H'));
    expect(asRun(c('3H 4H 6H'), 'low')).toBeNull();
    expect(asRun(c('3H 4H 5S'), 'low')).toBeNull();
  });

  it('treats the Ace as low in Gin and as low or high in Rummy 500, never around the corner', () => {
    expect(asRun(c('AH 2H 3H'), 'low')).toEqual(c('AH 2H 3H'));
    expect(asRun(c('QH KH AH'), 'low')).toBeNull();
    expect(asRun(c('QH KH AH'), 'both')).toEqual(c('QH KH AH'));
    expect(asRun(c('KH AH 2H'), 'both')).toBeNull();
    expect(asMeld(c('AS 2S 3S'), 'both')?.kind).toBe('run');
  });

  it('lays off on sets and on either end of a run', () => {
    const run = { kind: 'run' as const, cards: c('5D 6D 7D') };
    expect(canLayOff('4D', run, 'low')).toBe(true);
    expect(canLayOff('8D', run, 'low')).toBe(true);
    expect(canLayOff('9D', run, 'low')).toBe(false);
    expect(canLayOff('8C', run, 'low')).toBe(false);
    const set = { kind: 'set' as const, cards: c('9C 9D 9H') };
    expect(canLayOff('9S', set, 'low')).toBe(true);
    expect(canLayOff('9S', { kind: 'set', cards: c('9C 9D 9H 9S') }, 'low')).toBe(false);
  });

  it('lists every set of 3 within 4 of a rank, and every run segment', () => {
    const m = allMelds(c('8C 8D 8H 8S'), 'low');
    expect(m.length).toBe(5);
    expect(allMelds(c('2H 3H 4H 5H'), 'low').length).toBe(3); // 2-3-4, 3-4-5, 2-3-4-5
  });

  it('finds the arrangement with the least deadwood', () => {
    // 7♥ fits the set of sevens or the heart run. In the run it leaves 7♣ 7♦ (14) instead of 8♥ 9♥ (17).
    const a = bestArrangement(c('7C 7D 7H 8H 9H KS QD 2C AS 3D'), ginValue, 'low');
    expect(a.deadwoodValue).toBe(7 + 7 + 10 + 10 + 2 + 1 + 3);
    expect(a.melds).toEqual([{ kind: 'run', cards: c('7H 8H 9H') }]);
  });

  it('prefers keeping all four sevens with a separate run when that is possible', () => {
    const a = bestArrangement(c('7C 7D 7H 7S 4H 5H 6H'), ginValue, 'low');
    expect(a.deadwoodValue).toBe(0);
  });

  it('chains lay-offs along a run', () => {
    const r = layOffAll(c('9H TH 9C'), [{ kind: 'run', cards: c('6H 7H 8H') }], 'low');
    expect(r.rest).toEqual(c('9C'));
    expect(r.melds[0]!.cards).toEqual(c('6H 7H 8H 9H TH'));
  });

  it('a Gin defender may break up a meld when that lets more cards be laid off', () => {
    // Knocker has 4♠ 5♠ 6♠. Using 7♠ in a set of sevens would strand 8♠ 9♠; laying 3♠ off and keeping
    // (or laying off) 7♠ 8♠ 9♠ leaves only 7♣ 7♦ K♥.
    const r = bestWithLayoffs(c('3S 7S 8S 9S 7C 7D KH'), [{ kind: 'run', cards: c('4S 5S 6S') }], ginValue, 'low');
    expect(r.deadwood.sort()).toEqual(c('7C 7D KH').sort());
    expect(r.layoffs.map((l) => l.card)).toContain('3S');
  });
});

function ginState(hands: [string, string], extra: Partial<GinState> = {}): GinState {
  const s = createGinGame({ seed: 1 });
  return { ...s, phase: 'discard', handNumber: 1, dealer: 1, turn: 0, hands: [c(hands[0]), c(hands[1])], stock: c('2D 3D 4D 5D 6D 7D'), discard: c('KC'), ...extra };
}

describe('Gin Rummy', () => {
  it('deals 10 cards each, turns one up, and starts with the non-dealer offered the upcard', () => {
    const { state, events } = applyGinAction(createGinGame({ seed: 5 }), { type: 'deal' });
    expect(state.hands[0].length).toBe(10);
    expect(state.hands[1].length).toBe(10);
    expect(state.discard.length).toBe(1);
    expect(state.stock.length).toBe(31);
    expect(state.dealer).toBe(1);
    expect(state.turn).toBe(0);
    expect(state.phase).toBe('upcard');
    expect(events.map((e) => e.type)).toEqual(['hand_started', 'cards_dealt', 'upcard_turned']);
  });

  it('after both players pass the upcard, the non-dealer must draw from the stock', () => {
    let s = applyGinAction(createGinGame({ seed: 5 }), { type: 'deal' }).state;
    s = applyGinAction(s, { type: 'pass_upcard', player: 0 }).state;
    expect(s.turn).toBe(1);
    s = applyGinAction(s, { type: 'pass_upcard', player: 1 }).state;
    expect(s.phase).toBe('draw');
    expect(s.turn).toBe(0);
    expect(() => applyGinAction(s, { type: 'draw', player: 0, source: 'discard' })).toThrow();
    s = applyGinAction(s, { type: 'draw', player: 0, source: 'stock' }).state;
    expect(s.hands[0].length).toBe(11);
  });

  it('a card taken from the discard pile cannot be thrown straight back', () => {
    const s = ginState(['AC 2C 3C 4H 5H 6H 9S 9D TC JD QS', 'AD'], { takenDiscard: 'QS' });
    expect(legalDiscards(s, 0)).not.toContain('QS');
    expect(() => applyGinAction(s, { type: 'discard', player: 0, card: 'QS' })).toThrow();
  });

  it('knocking needs 10 or less deadwood after the discard', () => {
    const s = ginState(['AC 2C 3C 4H 5H 6H 7S 7D 7C 9H KS', 'AD 2D']);
    expect(canKnockWith(s, 0, 'KS')).toBe(true); // 9 deadwood left
    expect(canKnockWith(s, 0, '9H')).toBe(true); // only the King (10) is left: exactly 10 is allowed
    const s2 = ginState(['AC 2C 3C 4H 5H 6H 7S 7D 9C 9H KS', 'AD 2D']);
    expect(canKnockWith(s2, 0, 'KS')).toBe(false); // 7 7 9 9 = 32
  });

  it('scores a knock, an undercut, and gin', () => {
    // Knocker: 3 melds + 4♦ (4). Defender: lays 7♥ off on the heart run, leaves 9♣ 9♦ (18).
    const knock = scoreKnock(0, c('AC 2C 3C 4H 5H 6H 8S 8D 8C 4D'), c('7H 9C 9D QS QH QD KS KH KC 2S'));
    expect(knock.kind).toBe('knock');
    expect(knock.deadwoodValue).toEqual([4, 20]);
    expect(knock.layoffs.map((l) => l.card)).toEqual(['7H']);
    expect(knock.total).toBe(16);
    const under = scoreKnock(0, c('AC 2C 3C 4H 5H 6H 8S 8D 8C 9D'), c('7H 2S 3S 4S QH QD QC KS KH KC'));
    expect(under.kind).toBe('undercut');
    expect(under.winner).toBe(1);
    expect(under.total).toBe(9 + 25);
    const gin = scoreKnock(1, c('AC 2C 3C 4H 5H 6H 8S 8D 8C 8H'), c('7H 9C 9D QS QH QD KS KH KC 2S'));
    expect(gin.kind).toBe('gin');
    expect(gin.layoffs).toEqual([]); // no lay-offs against gin
    expect(gin.total).toBe(7 + 9 + 9 + 2 + 25);
  });

  it('the hand is dead when a discard leaves two cards in the stock', () => {
    const s = ginState(['AC 2C 3C 4H 5H 6H 7S 7D 9C 9H KS', 'AD'], { stock: c('2D 3D') });
    const r = applyGinAction(s, { type: 'discard', player: 0, card: 'KS' });
    expect(r.state.phase).toBe('hand_over');
    expect(r.state.lastHand?.kind).toBe('dead');
    expect(r.state.scores).toEqual([0, 0]);
  });

  it('adds the game bonus, 25 per hand won, and doubles a shutout', () => {
    expect(gameResult(0, [104, 40], [4, 2]).finalTotals).toEqual([104 + 100 + 100, 40 + 50]);
    const shut = gameResult(1, [0, 110], [0, 3]);
    expect(shut.shutout).toBe(true);
    expect(shut.finalTotals).toEqual([0, (110 + 75 + 100) * 2]);
  });
});

function r5State(hands: [string, string], extra: Partial<Rummy500State> = {}): Rummy500State {
  const s = createRummy500Game({ seed: 1 });
  return { ...s, phase: 'draw', handNumber: 1, dealer: 1, turn: 0, hands: [c(hands[0]), c(hands[1])], stock: c('2D 3D 4D 5D'), discard: [], ...extra };
}

describe('Rummy 500', () => {
  it('deals 13 cards each and turns one card up', () => {
    const { state } = applyRummy500Action(createRummy500Game({ seed: 9 }), { type: 'deal' });
    expect(state.hands.map((h) => h.length)).toEqual([13, 13]);
    expect(state.discard.length).toBe(1);
    expect(state.stock.length).toBe(25);
    expect(state.turn).toBe(0);
  });

  it('values: Ace 15, ten and court cards 10, others face value', () => {
    expect(c('AS KS TS 9S 2S').map(rummy500Value)).toEqual([15, 10, 10, 9, 2]);
  });

  it('a card below the top may be taken only if it can be used at once, and then must be used first', () => {
    const s = r5State(['8H 9H 2C 5S', 'AD'], { discard: c('KD 7H 3C QS') });
    // 7♥ fits the hearts (7-8-9); K♦ does not fit anything.
    expect(takeableIndexes(s, 0)).toEqual([1, 3]);
    const t = applyRummy500Action(s, { type: 'take_discard', player: 0, index: 1 }).state;
    expect(t.hands[0]).toEqual(c('8H 9H 2C 5S 7H 3C QS'));
    expect(t.discard).toEqual(c('KD'));
    expect(t.mustUse).toBe('7H');
    expect(r5Discards(t, 0)).toEqual([]);
    expect(() => applyRummy500Action(t, { type: 'meld', player: 0, cards: c('2C 3C 4C') })).toThrow();
    const m = applyRummy500Action(t, { type: 'meld', player: 0, cards: c('9H 7H 8H') }).state;
    expect(m.mustUse).toBeNull();
    expect(m.melds[0]!.cards).toEqual(c('7H 8H 9H'));
    expect(m.played[0]).toEqual(c('7H 8H 9H'));
  });

  it('the top discard taken alone cannot be thrown back the same turn', () => {
    const s = r5State(['8H 9H 2C', 'AD'], { discard: c('KD QS') });
    const t = applyRummy500Action(s, { type: 'take_discard', player: 0, index: 1 }).state;
    expect(t.takenTop).toBe('QS');
    expect(r5Discards(t, 0)).not.toContain('QS');
  });

  it('laying off on the opponent’s meld scores for the player who laid off', () => {
    const s = r5State(['TH 2C', 'AD 5C'], {
      phase: 'play',
      melds: [{ kind: 'run', cards: c('7H 8H 9H'), owner: 1 }],
      played: [[], c('7H 8H 9H')],
    });
    const r = applyRummy500Action(s, { type: 'lay_off', player: 0, card: 'TH', meld: 0 });
    expect(r.state.melds[0]!.cards).toEqual(c('7H 8H 9H TH'));
    expect(r.state.melds[0]!.owner).toBe(1);
    expect(r.state.played[0]).toEqual(['TH']);
    expect(r.events.find((e) => e.type === 'laid_off')).toMatchObject({ meldOwner: 1, points: 10 });
  });

  it('going out scores melded cards minus cards left in hand', () => {
    const s = r5State(['2C', 'AD 5C KS'], { phase: 'play', played: [c('7H 8H 9H'), c('3S 3D 3H')], scores: [100, 50] });
    const r = applyRummy500Action(s, { type: 'discard', player: 0, card: '2C' });
    expect(r.state.phase).toBe('hand_over');
    expect(r.state.lastHand).toMatchObject({ endedBy: 'out', outPlayer: 0, melded: [24, 9], inHand: [0, 30], total: [24, -21] });
    expect(r.state.scores).toEqual([124, 29]);
  });

  it('the hand ends when the stock is empty after a discard', () => {
    const s = r5State(['2C 9S', 'AD 5C'], { phase: 'play', stock: [] });
    const r = applyRummy500Action(s, { type: 'discard', player: 0, card: '2C' });
    expect(r.state.lastHand?.endedBy).toBe('stock');
  });

  it('the higher score at or above 500 wins; a tie plays on', () => {
    expect(rummy500Winner([510, 480], 500)).toBe(0);
    expect(rummy500Winner([510, 530], 500)).toBe(1);
    expect(rummy500Winner([510, 510], 500)).toBeNull();
    expect(rummy500Winner([490, 300], 500)).toBeNull();
  });
});
