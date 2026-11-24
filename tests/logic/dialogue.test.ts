import { describe, expect, it } from 'vitest';
import {
  DialogueDirector,
  DIALOGUE_TUNING,
  KNOWN_TRIGGERS,
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
        expect(KNOWN_TRIGGERS, `${c.id}: unknown trigger ${trigger}`).toContain(trigger);
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
