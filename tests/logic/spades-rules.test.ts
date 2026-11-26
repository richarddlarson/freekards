import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/logic/core/cards.js';
import {
  applySpadesAction,
  createSpadesGame,
  currentSeat,
  gameWinner,
  legalPlays,
  scoreTeam,
  trickWinner,
  type Seat,
  type SpadesState,
} from '../../src/logic/spades/index.js';

function dealt(seed = 7): SpadesState {
  return applySpadesAction(createSpadesGame({ seed }), { type: 'deal' }).state;
}

/** A play-phase state with the given hands and bids. */
function playState(opts: {
  hands: [Card[], Card[], Card[], Card[]];
  leader: Seat;
  plays?: { seat: Seat; card: Card }[];
  spadesBroken?: boolean;
  bids?: [number, number, number, number];
}): SpadesState {
  const s = createSpadesGame({ seed: 1 });
  s.phase = 'play';
  s.handNumber = 1;
  s.dealer = 0;
  s.hands = opts.hands;
  s.bids = opts.bids ?? [3, 3, 3, 3];
  s.trick = { leader: opts.leader, plays: opts.plays ?? [] };
  s.spadesBroken = opts.spadesBroken ?? false;
  return s;
}

describe('deal and bidding', () => {
  it('South deals hand 1; West bids first; the dealer moves clockwise', () => {
    const s = dealt();
    expect(s.dealer).toBe(0);
    expect(s.phase).toBe('bid');
    expect(currentSeat(s)).toBe(1);
    for (const hand of s.hands) expect(hand).toHaveLength(13);
    expect(new Set(s.hands.flat()).size).toBe(52);
  });

  it('deals one card at a time starting at the dealer’s left', () => {
    const a = createSpadesGame({ seed: 99 });
    const s = applySpadesAction(a, { type: 'deal' }).state;
    // Same shuffle as a fresh generator: card 0 goes to West (dealer South + 1).
    const step = applySpadesAction(a, { type: 'deal' });
    expect(step.events.map((e) => e.type)).toEqual(['hand_started', 'cards_dealt']);
    expect(step.events[0]!.seat).toBe(0);
    expect(s.hands[1]).toHaveLength(13);
  });

  it('takes bids in turn and rejects out-of-turn or invalid bids', () => {
    let s = dealt();
    expect(() => applySpadesAction(s, { type: 'bid', seat: 0, bid: 3 })).toThrow();
    expect(() => applySpadesAction(s, { type: 'bid', seat: 1, bid: 14 })).toThrow();
    expect(() => applySpadesAction(s, { type: 'bid', seat: 1, bid: 2.5 })).toThrow();
    const events = [];
    for (const [seat, bid] of [[1, 3], [2, 0], [3, 4], [0, 5]] as const) {
      const r = applySpadesAction(s, { type: 'bid', seat, bid });
      s = r.state;
      events.push(...r.events);
    }
    expect(s.phase).toBe('play');
    expect(s.bids).toEqual([5, 3, 0, 4]);
    expect(events.map((e) => e.type)).toEqual(['bid_made', 'bid_made', 'bid_made', 'bid_made', 'bidding_complete', 'trick_started']);
    expect(currentSeat(s)).toBe(1); // dealer's left leads
  });

  it('second hand is dealt by West, so North bids and leads first', () => {
    let s = dealt();
    s = { ...s, phase: 'score' };
    s = applySpadesAction(s, { type: 'continue' }).state;
    s = applySpadesAction(s, { type: 'deal' }).state;
    expect(s.dealer).toBe(1);
    expect(currentSeat(s)).toBe(2);
  });
});

describe('play rules', () => {
  it('spades cannot be led until broken, unless only spades are held', () => {
    const s = playState({ hands: [['2S', '3H', '4D'], [], [], []], leader: 0 });
    expect(legalPlays(s, 0).sort()).toEqual(['3H', '4D']);
    expect(legalPlays({ ...s, spadesBroken: true }, 0)).toContain('2S');
    const only = playState({ hands: [['2S', '9S'], [], [], []], leader: 0 });
    expect(legalPlays(only, 0).sort()).toEqual(['2S', '9S']);
  });

  it('must follow suit; when void may trump or discard', () => {
    const s = playState({ hands: [[], ['5H', 'KD', '2S'], [], []], leader: 0, plays: [{ seat: 0, card: '9H' }] });
    expect(legalPlays(s, 1)).toEqual(['5H']);
    const v = playState({ hands: [[], ['KD', '2S'], [], []], leader: 0, plays: [{ seat: 0, card: '9H' }] });
    expect(legalPlays(v, 1).sort()).toEqual(['2S', 'KD']);
  });

  it('the highest spade wins, else the highest card of the led suit', () => {
    const plays = (cards: Card[]) => ({ leader: 0 as Seat, plays: cards.map((card, i) => ({ seat: i as Seat, card })) });
    expect(trickWinner(plays(['9H', 'AH', 'KD', '3H']))).toBe(1);
    expect(trickWinner(plays(['9H', 'AH', '2S', '3H']))).toBe(2);
    expect(trickWinner(plays(['9H', '3S', '2S', 'AS']))).toBe(3);
  });

  it('breaks spades, reports trumping, and announces a failed Nil once', () => {
    let s = playState({
      hands: [['9H', '8H'], ['2S', '7D'], ['5H', '6H'], ['4H', '3H']],
      leader: 0,
      bids: [3, 0, 3, 3],
    });
    const types: string[] = [];
    let trumped: boolean | undefined;
    for (const [seat, card] of [[0, '9H'], [1, '2S'], [2, '5H'], [3, '4H']] as const) {
      const r = applySpadesAction(s, { type: 'play', seat, card });
      s = r.state;
      for (const e of r.events) {
        types.push(e.type);
        if (e.type === 'trick_won') trumped = e.trumped;
      }
    }
    expect(types).toContain('spades_broken');
    expect(trumped).toBe(true);
    expect(types.filter((t) => t === 'nil_failed')).toHaveLength(1);
    expect(s.won[1]).toBe(1);
  });

  it('rejects illegal plays without changing anything', () => {
    const s = playState({ hands: [['2S', '3H'], [], [], []], leader: 0 });
    expect(() => applySpadesAction(s, { type: 'play', seat: 0, card: '2S' })).toThrow();
    expect(() => applySpadesAction(s, { type: 'play', seat: 1, card: '3H' })).toThrow();
    expect(s.hands[0]).toEqual(['2S', '3H']);
  });
});

describe('scoring', () => {
  it('made contract: 10 per bid trick plus 1 per bag (spec example)', () => {
    const { result, bagsAfter } = scoreTeam(0, [4, 0, 3, 0], [5, 0, 4, 0], 0);
    expect(result).toMatchObject({ contract: 7, counted: 9, made: true, contractPoints: 70, bags: 2, total: 72 });
    expect(bagsAfter).toBe(2);
  });

  it('set contract: minus 10 per bid trick, no bags', () => {
    const { result } = scoreTeam(1, [0, 5, 0, 4], [0, 3, 0, 4], 0);
    expect(result).toMatchObject({ contract: 9, counted: 7, made: false, contractPoints: -90, bags: 0, total: -90 });
  });

  it('Nil: +100 made, −100 failed; the Nil bidder’s tricks are bags, not toward the contract', () => {
    const made = scoreTeam(0, [0, 0, 4, 0], [0, 0, 4, 0], 0).result;
    expect(made).toMatchObject({ contract: 4, made: true, nilPoints: 100, total: 140 });
    const failed = scoreTeam(0, [0, 0, 4, 0], [2, 0, 3, 0], 0).result;
    expect(failed).toMatchObject({ contract: 4, counted: 3, made: false, contractPoints: -40, bags: 2, nilPoints: -100, total: -138 });
  });

  it('every 10 bags costs 100 and resets by 10', () => {
    const { result, bagsAfter } = scoreTeam(0, [3, 0, 3, 0], [6, 0, 4, 0], 6);
    expect(result).toMatchObject({ bags: 4, bagPenalty: -100, total: 60 + 4 - 100 });
    expect(bagsAfter).toBe(0);
  });

  it('game ends at the target or at −200, with a higher score winning; ties play on', () => {
    expect(gameWinner([510, 420], 500)).toBe(0);
    expect(gameWinner([510, 530], 500)).toBe(1);
    expect(gameWinner([520, 520], 500)).toBeNull();
    expect(gameWinner([-210, 100], 500)).toBe(1);
    expect(gameWinner([490, 300], 500)).toBeNull();
    expect(gameWinner([300, 120], 300)).toBe(0);
  });
});
