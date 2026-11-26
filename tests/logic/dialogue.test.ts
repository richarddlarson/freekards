import { describe, expect, it } from 'vitest';
import {
  DialogueDirector,
  DIALOGUE_TUNING,
  ALL_TRIGGERS,
  spadesCandidates,
  bubbleDurationMs,
  heartsCandidates,
  type CharacterDef,
  type RosterDef,
} from '../../src/logic/dialogue/index.js';
import type { HeartsEvent, HeartsState } from '../../src/logic/hearts/index.js';
import { createHeartsGame } from '../../src/logic/hearts/index.js';

async function loadRoster(): Promise<CharacterDef[]> {
  const roster = (await import('../../spec/content/characters/roster.json')).default as RosterDef;
  return Promise.all(
    roster.characters.map(async (id) => (await import(`../../spec/content/characters/${id}.json`)).default as CharacterDef),
  );
}

function character(id: string, chattiness: number, lines: Record<string, string[]>): CharacterDef {
  return {
    schemaVersion: 1, id, name: id, nickname: id, kind: 'human', gender: 'female', ageRange: '', tagline: '',
    bio: '', look: '', voice: { description: '', pitch: '', pace: '' },
    traits: { tone: '', chattiness, risk: 0.5, skillAdjust: 0 },
    lines: Object.fromEntries(
      Object.entries(lines).map(([t, texts]) => [t, texts.map((text, i) => ({ id: `${id}.${t}.${i + 1}`, text }))]),
    ),
  };
}

const scores: [number, number, number, number] = [0, 0, 0, 0];

describe('character content (spec/content/characters)', () => {
  it('has six valid characters, three male and three female, all human', async () => {
    const chars = await loadRoster();
    expect(chars).toHaveLength(6);
    expect(chars.filter((c) => c.gender === 'male')).toHaveLength(3);
    expect(chars.filter((c) => c.gender === 'female')).toHaveLength(3);
    expect(chars.every((c) => c.kind === 'human')).toBe(true);
  });

  it('follows the schema, id format, trait ranges, and length limits', async () => {
    const chars = await loadRoster();
    const seen = new Set<string>();
    for (const c of chars) {
      expect(c.schemaVersion).toBe(1);
      expect(c.id).toMatch(/^[a-z]+$/);
      for (const f of ['name', 'nickname', 'tagline', 'bio', 'look'] as const) expect(c[f].length).toBeGreaterThan(0);
      expect(c.traits.chattiness).toBeGreaterThanOrEqual(0);
      expect(c.traits.chattiness).toBeLessThanOrEqual(1);
      expect(c.traits.risk).toBeGreaterThanOrEqual(0);
      expect(c.traits.risk).toBeLessThanOrEqual(1);
      expect(Math.abs(c.traits.skillAdjust)).toBeLessThanOrEqual(0.15);
      for (const [trigger, lines] of Object.entries(c.lines)) {
        expect(ALL_TRIGGERS, `${c.id}: unknown trigger ${trigger}`).toContain(trigger);
        expect(lines.length).toBeGreaterThan(0);
        lines.forEach((l, i) => {
          expect(l.id).toBe(`${c.id}.${trigger}.${i + 1}`);
          expect(seen.has(l.id)).toBe(false);
          seen.add(l.id);
          expect(l.text.length, l.id).toBeLessThanOrEqual(120);
        });
      }
    }
  });
});

describe('dialogue director', () => {
  it('always speaks for a major event when chattiness × weight = 1', () => {
    const d = new DialogueDirector([null, character('a', 1, { 'hearts.moon_shot.self': ['Moon!'] }), null, null], 1);
    const u = d.react([{ seat: 1, trigger: 'hearts.moon_shot.self', weight: 1 }], 0);
    expect(u?.line.text).toBe('Moon!');
    expect(d.isSpeaking).toBe(true);
  });

  it('never speaks when chattiness is 0 or the character has no lines', () => {
    const d = new DialogueDirector([null, character('a', 0, { 'game.start': ['Hi'] }), character('b', 1, {}), null], 1);
    expect(d.react([{ seat: 1, trigger: 'game.start', weight: 1 }, { seat: 2, trigger: 'game.start', weight: 1 }], 0)).toBeNull();
  });

  it('respects the cooldown for minor comments but not for major ones', () => {
    const c = character('a', 1, { 'hand.bad.self': ['Ugh'], 'hearts.queen_taken.self': ['Queen!'] });
    const d = new DialogueDirector([null, c, null, null], 1);
    expect(d.react([{ seat: 1, trigger: 'hand.bad.self', weight: 1 }], 0)).not.toBeNull();
    expect(d.bubbleEnded(1000)).toBeNull();
    // Within cooldown: a minor (weight < 1) comment is suppressed ...
    expect(d.react([{ seat: 1, trigger: 'hand.bad.self', weight: 0.99 }], 1000 + DIALOGUE_TUNING.cooldownMs - 1)).toBeNull();
    // ... but a major one goes through.
    expect(d.react([{ seat: 1, trigger: 'hearts.queen_taken.self', weight: 1 }], 1500)).not.toBeNull();
  });

  it('queues a major comment while another bubble is showing', () => {
    const c = character('a', 1, { 'game.start': ['Hello'], 'hearts.moon_shot.other': ['Wow'] });
    const d = new DialogueDirector([null, c, null, null], 1);
    expect(d.react([{ seat: 1, trigger: 'game.start', weight: 1 }], 0)?.line.text).toBe('Hello');
    expect(d.react([{ seat: 1, trigger: 'hearts.moon_shot.other', weight: 1 }], 100)).toBeNull();
    expect(d.bubbleEnded(2000)?.line.text).toBe('Wow');
    expect(d.isSpeaking).toBe(true);
  });

  it('prefers .self triggers and avoids repeating the last 3 lines', () => {
    const c = character('a', 1, { 'game.won.self': ['1', '2', '3', '4'], 'game.won.other': ['x'] });
    const other = character('b', 1, { 'game.won.other': ['y'] });
    const d = new DialogueDirector([null, c, other, null], 7);
    const said: string[] = [];
    for (let i = 0; i < 8; i++) {
      const u = d.react([
        { seat: 2, trigger: 'game.won.other', weight: 1 },
        { seat: 1, trigger: 'game.won.self', weight: 1 },
      ], i * 100_000);
      expect(u?.trigger).toBe('game.won.self');
      said.push(u!.line.text);
      d.bubbleEnded(i * 100_000 + 1);
    }
    for (let i = 3; i < said.length; i++) expect(said.slice(i - 3, i)).not.toContain(said[i]);
  });

  it('is deterministic for a given seed', () => {
    const chars = [null, character('a', 0.5, { 'game.start': ['1', '2', '3'] }), character('b', 0.5, { 'game.start': ['4', '5'] }), null];
    const run = () => {
      const d = new DialogueDirector(chars, 42);
      const out: (string | null)[] = [];
      for (let i = 0; i < 20; i++) {
        const u = d.react([{ seat: 1, trigger: 'game.start', weight: 0.5 }, { seat: 2, trigger: 'game.start', weight: 0.5 }], i * 100_000);
        out.push(u?.line.id ?? null);
        if (u) d.bubbleEnded(i * 100_000 + 1);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('computes bubble durations per spec', () => {
    expect(bubbleDurationMs('')).toBe(2500);
    expect(bubbleDurationMs('x'.repeat(40))).toBe(4500);
    expect(bubbleDurationMs('x'.repeat(200))).toBe(7000);
    expect(bubbleDurationMs('hi', 3000)).toBe(3600);
    expect(bubbleDurationMs('hi', 500)).toBe(2500);
  });
});

describe('hearts triggers', () => {
  const after = (): HeartsState => createHeartsGame({ ruleSet: 'standard', seed: 1 });

  it('maps the queen of spades to perspectives and credits the giver', () => {
    const s = after();
    s.tricks = [{ leader: 0, winner: 0, plays: [{ seat: 0, card: 'AS' }, { seat: 1, card: 'QS' }, { seat: 2, card: '2S' }, { seat: 3, card: '3S' }] }];
    const ev: HeartsEvent[] = [{ type: 'queen_of_spades_taken', seat: 0, cards: ['QS'], scores }];
    const c = heartsCandidates(ev, s);
    expect(c).toContainEqual({ seat: 1, trigger: 'hearts.queen_taken.human', weight: 1 });
    expect(c).toContainEqual({ seat: 2, trigger: 'hearts.queen_taken.human', weight: 1 });
    expect(c).toContainEqual({ seat: 1, trigger: 'hearts.queen_given.self', weight: 0.7 });
  });

  it('maps moon blocks to victim, blocker, and the human perspective', () => {
    const ev: HeartsEvent[] = [{ type: 'moon_shot_blocked', seat: 0, blocker: 2, cards: [], scores }];
    const c = heartsCandidates(ev, after());
    expect(c).toContainEqual({ seat: 2, trigger: 'hearts.moon_block.self', weight: 0.8 });
    expect(c).toContainEqual({ seat: 1, trigger: 'hearts.moon_blocked.human', weight: 0.8 });
  });

  it('marks best and worst hands only when unique, and skips them after a moon event', () => {
    const scored: HeartsEvent = { type: 'hand_scored', handPoints: [0, 20, 3, 3], seat: null, cards: [], scores };
    const c = heartsCandidates([scored], after());
    expect(c).toContainEqual({ seat: 1, trigger: 'hand.bad.self', weight: 0.4 });
    expect(c).toContainEqual({ seat: 3, trigger: 'hand.good.human', weight: 0.3 });
    expect(heartsCandidates([{ type: 'moon_shot', seat: 1, cards: [], scores }, scored], after())
      .some((x) => x.trigger.startsWith('hand.'))).toBe(false);
  });

  it('only lets the receiver comment on cards passed by the human', () => {
    const ev: HeartsEvent[] = [
      { type: 'cards_passed', seat: 0, from: 0, to: 1, direction: 'left', cards: ['2C', '3C', '4C'], scores },
      { type: 'cards_passed', seat: 1, from: 1, to: 2, direction: 'left', cards: ['5C', '6C', '7C'], scores },
    ];
    expect(heartsCandidates(ev, after())).toEqual([{ seat: 1, trigger: 'hearts.pass.received', weight: 0.2 }]);
  });
});

describe('Spades triggers', () => {
  const sc: [number, number] = [0, 0];
  const team = (over: Partial<import('../../src/logic/spades/index.js').TeamHandResult>) => ({
    contract: 4, counted: 4, made: true, contractPoints: 40, bags: 0, nils: [], nilPoints: 0, bagPenalty: 0, total: 40, ...over,
  });

  it('a Nil bid speaks to the bidder and their partner, not the opponents', () => {
    const c = spadesCandidates([{ type: 'bid_made', seat: 0, cards: [], scores: sc, bid: 0 }]);
    expect(c).toEqual([{ seat: 2, trigger: 'spades.bid_nil.partner', weight: 0.6 }]);
  });

  it('a failed Nil uses self / partner / opponent', () => {
    const c = spadesCandidates([{ type: 'nil_failed', seat: 1, cards: [], scores: sc }]);
    expect(c.map((x) => `${x.seat}:${x.trigger}`)).toEqual(['1:spades.nil_failed.self', '2:spades.nil_failed.opponent', '3:spades.nil_failed.partner']);
  });

  it('a set and the hand result use the team perspective', () => {
    const results = [team({ made: false, contractPoints: -50, total: -50, contract: 5, counted: 3 }), team({})] as [ReturnType<typeof team>, ReturnType<typeof team>];
    const c = spadesCandidates([{ type: 'hand_scored', seat: null, cards: [], scores: sc, results }]);
    const t = c.map((x) => `${x.seat}:${x.trigger}`);
    expect(t).toContain('2:spades.set.us');
    expect(t).toContain('1:spades.set.them');
    expect(t).toContain('1:hand.good.self');
    expect(t).toContain('2:hand.bad.self');
    expect(t).toContain('3:hand.bad.human');
  });

  it('the player\'s team winning is game.won.self for North and game.won.human for the others', () => {
    const c = spadesCandidates([{ type: 'game_won', seat: null, cards: [], scores: sc, team: 0 }]);
    expect(c.map((x) => `${x.seat}:${x.trigger}`)).toEqual(['1:game.won.human', '2:game.won.self', '3:game.won.human']);
  });
});

describe('Gin Rummy and Rummy 500 triggers', () => {
  const sc: [number, number] = [0, 0];

  it('every character has lines for every Gin and Rummy 500 trigger', async () => {
    const { RUMMY_TRIGGERS } = await import('../../src/logic/dialogue/index.js');
    for (const c of await loadRoster()) for (const t of RUMMY_TRIGGERS) expect(c.lines[t]?.length ?? 0, `${c.id} ${t}`).toBeGreaterThan(0);
  });

  it('Gin: the computer speaks from seat 1 with self / human perspectives', async () => {
    const { ginCandidates } = await import('../../src/logic/dialogue/index.js');
    const t = (events: Parameters<typeof ginCandidates>[0]) => ginCandidates(events).map((x) => `${x.seat}:${x.trigger}`);
    expect(t([{ type: 'gin', player: 1, cards: [], scores: sc }])).toEqual(['1:gin.gin.self']);
    expect(t([{ type: 'knocked', player: 0, cards: [], scores: sc, deadwoodValue: 4 }])).toEqual(['1:gin.knock.human']);
    expect(t([{ type: 'undercut', player: 0, cards: [], scores: sc }])).toEqual(['1:gin.undercut.human']);
    expect(t([{ type: 'drew', player: 0, cards: ['5H'], scores: sc, source: 'discard' }])).toEqual(['1:gin.took_discard.human']);
    expect(t([{ type: 'drew', player: 0, cards: ['5H'], scores: sc, source: 'stock' }])).toEqual([]);
    expect(t([{ type: 'game_won', player: 0, cards: [], scores: sc, result: { winner: 0, gameBonus: 100, boxBonus: [0, 0], shutout: false, finalTotals: [0, 0] } }])).toEqual(['1:game.won.human']);
  });

  it('Rummy 500: big pick-ups, lay-offs on the computer’s melds, going out, and being caught', async () => {
    const { rummy500Candidates } = await import('../../src/logic/dialogue/index.js');
    const t = (events: Parameters<typeof rummy500Candidates>[0]) => rummy500Candidates(events).map((x) => x.trigger);
    expect(t([{ type: 'took_discard', player: 1, cards: ['2H', '3H', '4H'], scores: sc, index: 0 }])).toEqual(['rummy.took_pile.self']);
    expect(t([{ type: 'took_discard', player: 0, cards: ['2H'], scores: sc, index: 3 }])).toEqual([]);
    expect(t([{ type: 'laid_off', player: 0, cards: ['TH'], scores: sc, meld: 0, meldOwner: 1, points: 10 }])).toEqual(['rummy.layoff.human']);
    expect(t([{ type: 'laid_off', player: 0, cards: ['TH'], scores: sc, meld: 0, meldOwner: 0, points: 10 }])).toEqual([]);
    expect(t([{ type: 'melded', player: 0, cards: ['AH', 'AS', 'AD'], scores: sc, meld: 0, points: 45 }])).toEqual(['rummy.big_meld.human']);
    const result = { endedBy: 'out' as const, outPlayer: 0 as const, melded: [80, 20] as [number, number], inHand: [0, 45] as [number, number], handCards: [[], []] as [never[], never[]], total: [80, -25] as [number, number] };
    expect(t([{ type: 'went_out', player: 0, cards: [], scores: sc }, { type: 'hand_scored', player: null, cards: [], scores: sc, result }])).toEqual([
      'rummy.went_out.human', 'rummy.caught.self', 'hand.good.human', 'hand.bad.self',
    ]);
  });
});
