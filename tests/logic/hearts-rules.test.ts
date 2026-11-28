import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/logic/core/cards.js';
import {
  applyHeartsAction,
  computeHandResult,
  createHeartsGame,
  gameWinner,
  HeartsRuleError,
  legalPlays,
  passDirectionFor,
  passTarget,
  type HeartsState,
} from '../../src/logic/hearts/index.js';
import { playState } from './helpers.js';

const filler = (n: number, suit: 'C' | 'D' | 'S' | 'H', from = 2): Card[] =>
  Array.from({ length: n }, (_, i) => `${'23456789TJQKA'[from - 2 + i]}${suit}` as Card);

describe('pass cycle', () => {
  it('goes left, right, across, none and repeats', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(passDirectionFor)).toEqual([
      'left', 'right', 'across', 'none', 'left', 'right', 'across', 'none',
    ]);
  });

  it('maps directions to seats (left = next clockwise)', () => {
    expect(passTarget(0, 'left')).toBe(1);
    expect(passTarget(0, 'right')).toBe(3);
    expect(passTarget(0, 'across')).toBe(2);
    expect(passTarget(3, 'left')).toBe(0);
  });
});

describe('deal and pass', () => {
  const dealt = (): HeartsState => applyHeartsAction(createHeartsGame({ ruleSet: 'standard', seed: 7 }), { type: 'deal' }).state;

  it('deals 13 cards to each seat and enters the pass phase', () => {
    const s = dealt();
    expect(s.phase).toBe('pass');
    expect(s.handNumber).toBe(1);
    expect(s.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(s.hands.flat()).size).toBe(52);
  });

  it('is deterministic for a seed', () => {
    expect(dealt().hands).toEqual(dealt().hands);
    const other = applyHeartsAction(createHeartsGame({ ruleSet: 'standard', seed: 8 }), { type: 'deal' }).state;
    expect(other.hands).not.toEqual(dealt().hands);
  });

  it('emits hand start events in order', () => {
    const r = applyHeartsAction(createHeartsGame({ ruleSet: 'standard', seed: 7 }), { type: 'deal' });
    expect(r.events.map((e) => e.type)).toEqual(['hand_started', 'cards_dealt', 'pass_direction_announced']);
  });

  it('rejects bad passes', () => {
    const s = dealt();
    const hand = s.hands[0];
    expect(() => applyHeartsAction(s, { type: 'pass', seat: 0, cards: hand.slice(0, 2) })).toThrow(HeartsRuleError);
    expect(() => applyHeartsAction(s, { type: 'pass', seat: 0, cards: [hand[0]!, hand[0]!, hand[1]!] })).toThrow(HeartsRuleError);
    expect(() => applyHeartsAction(s, { type: 'pass', seat: 0, cards: s.hands[1].slice(0, 3) })).toThrow(HeartsRuleError);
    const once = applyHeartsAction(s, { type: 'pass', seat: 0, cards: hand.slice(0, 3) }).state;
    expect(() => applyHeartsAction(once, { type: 'pass', seat: 0, cards: once.hands[0].slice(3, 6) })).toThrow(HeartsRuleError);
  });

  it('exchanges all passes simultaneously to the left on hand 1, then the 2♣ holder leads', () => {
    let s = dealt();
    const before = s.hands.map((h) => [...h]);
    const chosen = before.map((h) => h.slice(0, 3));
    let events: string[] = [];
    for (const seat of [0, 1, 2, 3] as const) {
      const r = applyHeartsAction(s, { type: 'pass', seat, cards: chosen[seat]! });
      s = r.state;
      events = r.events.map((e) => e.type);
      if (seat < 3) expect(s.phase).toBe('pass');
    }
    expect(events).toEqual(['cards_passed', 'cards_passed', 'cards_passed', 'cards_passed', 'trick_started']);
    for (const seat of [0, 1, 2, 3] as const) {
      const to = passTarget(seat, 'left');
      for (const c of chosen[seat]!) expect(s.hands[to]).toContain(c);
      expect(s.received[to]).toEqual(chosen[seat]);
      expect(s.hands[seat]).toHaveLength(13);
    }
    expect(s.phase).toBe('play');
    expect(s.hands[s.trick.leader]).toContain('2C');
    expect(legalPlays(s, s.trick.leader)).toEqual(['2C']);
  });

  it('skips passing on hand 4', () => {
    let s = createHeartsGame({ ruleSet: 'standard', seed: 3 });
    s.handNumber = 3;
    const r = applyHeartsAction(s, { type: 'deal' });
    s = r.state;
    expect(s.passDirection).toBe('none');
    expect(s.phase).toBe('play');
    expect(r.events.map((e) => e.type)).toContain('trick_started');
  });
});

describe('legal plays', () => {
  it('requires the 2♣ lead on the first trick', () => {
    const s = playState({
      hands: [['2C', 'AC', 'KH', ...filler(10, 'D')], filler(13, 'S'), filler(12, 'H'), filler(11, 'C', 3)],
      leader: 0,
    });
    expect(legalPlays(s, 0)).toEqual(['2C']);
    expect(() => applyHeartsAction(s, { type: 'play', seat: 0, card: 'AC' })).toThrow(HeartsRuleError);
  });

  it('only allows the player whose turn it is', () => {
    const s = playState({ hands: [['2C'], ['3C'], ['4C'], ['5C']], leader: 0 });
    expect(legalPlays(s, 1)).toEqual([]);
    expect(() => applyHeartsAction(s, { type: 'play', seat: 1, card: '3C' })).toThrow(HeartsRuleError);
  });

  it('requires following suit', () => {
    const s = playState({
      hands: [[], ['3C', 'AD', 'KH'], [], []],
      leader: 0,
      plays: [{ seat: 0, card: '2C' }],
    });
    expect(legalPlays(s, 1)).toEqual(['3C']);
  });

  it('forbids hearts and Q♠ on the first trick when void, if other cards exist', () => {
    const s = playState({
      hands: [[], ['QS', 'KH', 'AD', '5S'], [], []],
      leader: 0,
      plays: [{ seat: 0, card: '2C' }],
    });
    expect(legalPlays(s, 1).sort()).toEqual(['5S', 'AD']);
  });

  it('allows points on the first trick if the player holds nothing else', () => {
    const s = playState({
      hands: [[], ['QS', 'KH', 'AH'], [], []],
      leader: 0,
      plays: [{ seat: 0, card: '2C' }],
    });
    expect(legalPlays(s, 1).sort()).toEqual(['AH', 'KH', 'QS']);
  });

  it('allows the J♦ (not a point card) on the first trick', () => {
    const s = playState({
      ruleSet: 'jack-of-diamonds',
      hands: [[], ['JD', 'KH'], [], []],
      leader: 0,
      plays: [{ seat: 0, card: '2C' }],
    });
    expect(legalPlays(s, 1)).toEqual(['JD']);
  });

  it('forbids leading hearts before they are broken', () => {
    const s = playState({ hands: [['KH', '3D', '4S'], [], [], []], leader: 0, firstTrick: false });
    expect(legalPlays(s, 0).sort()).toEqual(['3D', '4S']);
  });

  it('allows leading hearts when the leader holds only hearts', () => {
    const s = playState({ hands: [['KH', '3H'], [], [], []], leader: 0, firstTrick: false });
    expect(legalPlays(s, 0).sort()).toEqual(['3H', 'KH']);
  });

  it('allows leading hearts once broken', () => {
    const s = playState({ hands: [['KH', '3D'], [], [], []], leader: 0, firstTrick: false, heartsBroken: true });
    expect(legalPlays(s, 0).sort()).toEqual(['3D', 'KH']);
  });
});

describe('trick play', () => {
  it('Q♠ does not break hearts; a heart does, with one event', () => {
    let s = playState({
      hands: [['3D', '9D'], ['QS', '5H'], ['4D', '6D'], ['5D', '7D']],
      leader: 0,
      firstTrick: false,
    });
    const play = (seat: 0 | 1 | 2 | 3, card: Card) => {
      const r = applyHeartsAction(s, { type: 'play', seat, card });
      s = r.state;
      return r.events.map((e) => e.type);
    };
    play(0, '3D');
    expect(play(1, 'QS')).toEqual(['card_played']);
    expect(s.heartsBroken).toBe(false);
    play(2, '4D');
    const end = play(3, '5D');
    expect(end).toEqual(['card_played', 'trick_won', 'queen_of_spades_taken', 'trick_started']);
    expect(s.taken[3]).toContain('QS'); // 5♦ highest diamond
    expect(s.trick.leader).toBe(3);
    play(3, '7D');
    play(0, '9D');
    expect(play(1, '5H')).toEqual(['card_played', 'hearts_broken']);
    expect(s.heartsBroken).toBe(true);
  });

  it('the highest card of the led suit wins; off-suit cards never win', () => {
    let s = playState({
      hands: [['4C'], ['AH'], ['3C'], ['AS']],
      leader: 0,
      firstTrick: false,
      heartsBroken: true,
    });
    for (const [seat, card] of [[0, '4C'], [1, 'AH'], [2, '3C'], [3, 'AS']] as const) {
      s = applyHeartsAction(s, { type: 'play', seat, card }).state;
    }
    expect(s.tricks.at(-1)!.winner).toBe(0);
  });

  it('emits jack_of_diamonds_taken only in the J♦ rule set', () => {
    for (const ruleSet of ['standard', 'jack-of-diamonds'] as const) {
      let s = playState({ ruleSet, hands: [['JD', '2S'], ['3D', '3S'], ['4D', '4S'], ['5D', '5S']], leader: 0, firstTrick: false });
      let types: string[] = [];
      for (const [seat, card] of [[0, 'JD'], [1, '3D'], [2, '4D'], [3, '5D']] as const) {
        const r = applyHeartsAction(s, { type: 'play', seat, card });
        s = r.state;
        types = r.events.map((e) => e.type);
      }
      expect(types.includes('jack_of_diamonds_taken')).toBe(ruleSet === 'jack-of-diamonds');
    }
  });
});

describe('scoring', () => {
  const allHearts = filler(13, 'H');

  it('standard: 1 per heart, 13 for Q♠, J♦ worth nothing', () => {
    const { result } = computeHandResult([allHearts.slice(0, 5), [...allHearts.slice(5), 'JD'], ['QS'], []], 'standard');
    expect(result.points).toEqual([5, 8, 13, 0]);
    expect(result.moonShooter).toBeNull();
  });

  it('J♦ rule set: J♦ is −10', () => {
    const { result } = computeHandResult([allHearts.slice(0, 5), [...allHearts.slice(5), 'JD'], ['QS'], []], 'jack-of-diamonds');
    expect(result.points).toEqual([5, -2, 13, 0]);
  });

  it('shoot the moon: shooter 0, everyone else +26', () => {
    const { result } = computeHandResult([[], [...allHearts, 'QS'], [], ['JD']], 'standard');
    expect(result.points).toEqual([26, 0, 26, 26]);
    expect(result.moonShooter).toBe(1);
  });

  it('shoot the moon with J♦: the jack still counts for whoever took it', () => {
    const shooterHasJack = computeHandResult([[], [...allHearts, 'QS', 'JD'], [], []], 'jack-of-diamonds');
    expect(shooterHasJack.result.points).toEqual([26, -10, 26, 26]);
    const otherHasJack = computeHandResult([['JD'], [...allHearts, 'QS'], [], []], 'jack-of-diamonds');
    expect(otherHasJack.result.points).toEqual([16, 0, 26, 26]);
  });

  it('reports a blocked moon shot (13 of 14 point cards)', () => {
    const { result, nearMoon } = computeHandResult([[], [...allHearts.slice(1), 'QS'], [allHearts[0]!], []], 'standard');
    expect(result.moonShooter).toBeNull();
    expect(nearMoon).toEqual({ seat: 1, blocker: 2 });
  });
});

describe('game end', () => {
  it('continues until someone reaches the target', () => {
    expect(gameWinner([99, 50, 20, 10], 100)).toBeNull();
    expect(gameWinner([100, 50, 20, 10], 100)).toBe(3);
  });

  it('keeps playing while the lowest score is tied', () => {
    expect(gameWinner([104, 50, 20, 20], 100)).toBeNull();
    expect(gameWinner([104, 50, 19, 20], 100)).toBe(2);
  });

  it('continue → game_over with game_won, or back to deal', () => {
    const s = createHeartsGame({ ruleSet: 'standard', seed: 1 });
    s.phase = 'score';
    s.scores = [110, 40, 30, 30];
    const tied = applyHeartsAction(s, { type: 'continue' });
    expect(tied.state.phase).toBe('deal');
    s.scores = [110, 40, 30, 29];
    const over = applyHeartsAction(s, { type: 'continue' });
    expect(over.state.phase).toBe('game_over');
    expect(over.state.winner).toBe(3);
    expect(over.events.map((e) => e.type)).toEqual(['game_won']);
  });

  it('honors a custom target score', () => {
    const s = createHeartsGame({ ruleSet: 'standard', seed: 1, targetScore: 50 });
    s.phase = 'score';
    s.scores = [50, 10, 20, 30];
    expect(applyHeartsAction(s, { type: 'continue' }).state.winner).toBe(1);
  });

  it('rejects actions in the wrong phase', () => {
    const s = createHeartsGame({ ruleSet: 'standard', seed: 1 });
    expect(() => applyHeartsAction(s, { type: 'continue' })).toThrow(HeartsRuleError);
    expect(() => applyHeartsAction(s, { type: 'play', seat: 0, card: '2C' })).toThrow(HeartsRuleError);
  });
});

describe('immutability', () => {
  it('never mutates the input state', () => {
    const s0 = applyHeartsAction(createHeartsGame({ ruleSet: 'standard', seed: 5 }), { type: 'deal' }).state;
    const snapshot = JSON.stringify(s0);
    applyHeartsAction(s0, { type: 'pass', seat: 0, cards: s0.hands[0].slice(0, 3) });
    expect(JSON.stringify(s0)).toBe(snapshot);
  });
});

describe('ties at the end of a game (spec 06 §2, D-100)', () => {
  it('names the players tied for lowest when someone has passed the target', async () => {
    const { tieBreakerSeats, gameWinner } = await import('../../src/logic/hearts/engine.js');
    expect(tieBreakerSeats([86, 60, 106, 60], 100)).toEqual([1, 3]);
    expect(gameWinner([86, 60, 106, 60], 100)).toBeNull();
    expect(tieBreakerSeats([86, 59, 106, 60], 100)).toBeNull();
    expect(tieBreakerSeats([60, 60, 90, 70], 100)).toBeNull(); // nobody at 100 yet
  });
});
