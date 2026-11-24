/**
 * Maps Hearts logic events to dialogue candidates (spec 08 §Triggers). Engine-neutral.
 * Perspective is relative to each computer seat: `self`, `human` (seat 0), or `other`.
 */
import { HUMAN_SEAT, type HeartsEvent, type HeartsState, type Seat } from '../hearts/types.js';
import { QUEEN_OF_SPADES } from '../hearts/engine.js';
import type { DialogueCandidate } from './types.js';

export const TRIGGER_WEIGHTS: Readonly<Record<string, number>> = {
  'game.start': 0.5,
  'game.won': 1.0,
  'hand.good': 0.3,
  'hand.bad': 0.4,
  'idle.human': 0.6,
  'hearts.queen_taken': 1.0,
  'hearts.queen_given': 0.7,
  'hearts.hearts_broken': 0.3,
  'hearts.jack_taken': 0.6,
  'hearts.moon_shot': 1.0,
  'hearts.moon_blocked': 0.8,
  'hearts.moon_block': 0.8,
  'hearts.pass.received': 0.2,
};

/** Every trigger name a character file may use (validated by tests). */
export const KNOWN_TRIGGERS: readonly string[] = [
  'game.start',
  'game.won.self', 'game.won.human', 'game.won.other',
  'hand.good.self', 'hand.good.human', 'hand.bad.self', 'hand.bad.human',
  'idle.human',
  'hearts.queen_taken.self', 'hearts.queen_taken.human', 'hearts.queen_taken.other',
  'hearts.queen_given.self',
  'hearts.hearts_broken.self', 'hearts.hearts_broken.other',
  'hearts.jack_taken.self', 'hearts.jack_taken.human',
  'hearts.moon_shot.self', 'hearts.moon_shot.human', 'hearts.moon_shot.other',
  'hearts.moon_blocked.self', 'hearts.moon_blocked.human',
  'hearts.moon_block.self',
  'hearts.pass.received',
];

const COMPUTER_SEATS: readonly Seat[] = [1, 2, 3];

function perspective(speaker: Seat, subject: Seat | null): 'self' | 'human' | 'other' {
  if (subject === speaker) return 'self';
  if (subject === HUMAN_SEAT) return 'human';
  return 'other';
}

function forAll(base: string, subject: Seat | null): DialogueCandidate[] {
  const weight = TRIGGER_WEIGHTS[base]!;
  return COMPUTER_SEATS.map((s) => ({ seat: s, trigger: `${base}.${perspective(s, subject)}`, weight }));
}

function uniqueExtreme(points: readonly number[], pick: 'min' | 'max'): Seat | null {
  const target = pick === 'min' ? Math.min(...points) : Math.max(...points);
  const seats = points.flatMap((p, i) => (p === target ? [i as Seat] : []));
  return seats.length === 1 ? seats[0]! : null;
}

/** Dialogue candidates for a new game (shown when the table first appears). */
export function gameStartCandidates(): DialogueCandidate[] {
  return COMPUTER_SEATS.map((s) => ({ seat: s, trigger: 'game.start', weight: TRIGGER_WEIGHTS['game.start']! }));
}

/** Dialogue candidates when the human has been idle on their turn. */
export function idleCandidates(): DialogueCandidate[] {
  return COMPUTER_SEATS.map((s) => ({ seat: s, trigger: 'idle.human', weight: TRIGGER_WEIGHTS['idle.human']! }));
}

/**
 * Candidates for one batch of events (the events from one action), given the state after the action.
 * Candidates may target triggers a character has no lines for; the director ignores those.
 */
export function heartsCandidates(events: readonly HeartsEvent[], after: HeartsState): DialogueCandidate[] {
  const out: DialogueCandidate[] = [];
  const moon = events.some((e) => e.type === 'moon_shot' || e.type === 'moon_shot_blocked');

  for (const e of events) {
    switch (e.type) {
      case 'queen_of_spades_taken': {
        out.push(...forAll('hearts.queen_taken', e.seat));
        const trick = after.tricks.at(-1);
        const giver = trick?.plays.find((p) => p.card === QUEEN_OF_SPADES)?.seat;
        if (trick && giver !== undefined && giver !== trick.winner && giver !== HUMAN_SEAT) {
          out.push({ seat: giver, trigger: 'hearts.queen_given.self', weight: TRIGGER_WEIGHTS['hearts.queen_given']! });
        }
        break;
      }
      case 'hearts_broken':
        for (const s of COMPUTER_SEATS) {
          out.push({ seat: s, trigger: `hearts.hearts_broken.${s === e.seat ? 'self' : 'other'}`, weight: TRIGGER_WEIGHTS['hearts.hearts_broken']! });
        }
        break;
      case 'jack_of_diamonds_taken':
        for (const s of COMPUTER_SEATS) {
          const p = perspective(s, e.seat);
          if (p !== 'other') out.push({ seat: s, trigger: `hearts.jack_taken.${p}`, weight: TRIGGER_WEIGHTS['hearts.jack_taken']! });
        }
        break;
      case 'moon_shot':
        out.push(...forAll('hearts.moon_shot', e.seat));
        break;
      case 'moon_shot_blocked':
        for (const s of COMPUTER_SEATS) {
          const w = TRIGGER_WEIGHTS['hearts.moon_blocked']!;
          if (s === e.seat) out.push({ seat: s, trigger: 'hearts.moon_blocked.self', weight: w });
          else if (s === e.blocker) out.push({ seat: s, trigger: 'hearts.moon_block.self', weight: w });
          else if (e.seat === HUMAN_SEAT) out.push({ seat: s, trigger: 'hearts.moon_blocked.human', weight: w });
        }
        break;
      case 'hand_scored': {
        if (moon) break;
        const best = uniqueExtreme(e.handPoints, 'min');
        const worst = uniqueExtreme(e.handPoints, 'max');
        for (const s of COMPUTER_SEATS) {
          if (best !== null && (best === s || best === HUMAN_SEAT)) {
            out.push({ seat: s, trigger: `hand.good.${best === s ? 'self' : 'human'}`, weight: TRIGGER_WEIGHTS['hand.good']! });
          }
          if (worst !== null && (worst === s || worst === HUMAN_SEAT)) {
            out.push({ seat: s, trigger: `hand.bad.${worst === s ? 'self' : 'human'}`, weight: TRIGGER_WEIGHTS['hand.bad']! });
          }
        }
        break;
      }
      case 'game_won':
        out.push(...forAll('game.won', e.seat));
        break;
      case 'cards_passed':
        if (e.from === HUMAN_SEAT && e.to !== HUMAN_SEAT) {
          out.push({ seat: e.to, trigger: 'hearts.pass.received', weight: TRIGGER_WEIGHTS['hearts.pass.received']! });
        }
        break;
      default:
        break;
    }
  }
  return out;
}
