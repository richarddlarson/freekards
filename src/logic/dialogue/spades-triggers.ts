/**
 * Maps Spades logic events to dialogue candidates (spec 08 §Triggers, spec 17). Engine-neutral.
 * Spades is a partnership game, so its own triggers use the perspectives `self`, `partner`, and
 * `opponent` for a player, and `us` / `them` for a team, relative to each computer seat. The shared
 * `game.*`, `hand.*`, and `idle.*` triggers keep their meanings (`human` = the player's team).
 */
import { HUMAN_SEAT, type Seat } from '../core/seats.js';
import { partnerOf, teamOf } from '../spades/engine.js';
import type { SpadesEvent, Team } from '../spades/types.js';
import type { DialogueCandidate } from './types.js';
import { TRIGGER_WEIGHTS } from './hearts-triggers.js';

export const SPADES_TRIGGER_WEIGHTS: Readonly<Record<string, number>> = {
  'spades.bid_nil': 0.6,
  'spades.nil_made': 0.9,
  'spades.nil_failed': 0.9,
  'spades.set': 0.8,
  'spades.bags': 0.7,
  'spades.trumped': 0.3,
};

/** Every Spades trigger name a character file may use (validated by tests). */
export const SPADES_TRIGGERS: readonly string[] = [
  'spades.bid_nil.self', 'spades.bid_nil.partner',
  'spades.nil_made.self', 'spades.nil_made.partner', 'spades.nil_made.opponent',
  'spades.nil_failed.self', 'spades.nil_failed.partner', 'spades.nil_failed.opponent',
  'spades.set.us', 'spades.set.them',
  'spades.bags.us', 'spades.bags.them',
  'spades.trumped.self', 'spades.trumped.partner',
];

const COMPUTER_SEATS: readonly Seat[] = [1, 2, 3];

function relation(speaker: Seat, subject: Seat): 'self' | 'partner' | 'opponent' {
  if (subject === speaker) return 'self';
  return subject === partnerOf(speaker) ? 'partner' : 'opponent';
}

function w(base: string): number {
  return SPADES_TRIGGER_WEIGHTS[base] ?? TRIGGER_WEIGHTS[base]!;
}

/** Candidates for one batch of Spades events (the events from one action). */
export function spadesCandidates(events: readonly SpadesEvent[]): DialogueCandidate[] {
  const out: DialogueCandidate[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'bid_made':
        if (e.bid !== 0 || e.seat === null) break;
        for (const s of COMPUTER_SEATS) {
          const r = relation(s, e.seat);
          if (r !== 'opponent') out.push({ seat: s, trigger: `spades.bid_nil.${r}`, weight: w('spades.bid_nil') });
        }
        break;
      case 'nil_failed':
        if (e.seat === null) break;
        for (const s of COMPUTER_SEATS) out.push({ seat: s, trigger: `spades.nil_failed.${relation(s, e.seat)}`, weight: w('spades.nil_failed') });
        break;
      case 'trick_won':
        if (!e.trumped || e.seat === null) break;
        for (const s of COMPUTER_SEATS) {
          const r = relation(s, e.seat);
          if (r !== 'opponent') out.push({ seat: s, trigger: `spades.trumped.${r}`, weight: w('spades.trumped') });
        }
        break;
      case 'hand_scored': {
        for (const team of [0, 1] as Team[]) {
          const r = e.results[team];
          for (const n of r.nils) {
            if (!n.made) continue;
            for (const s of COMPUTER_SEATS) out.push({ seat: s, trigger: `spades.nil_made.${relation(s, n.seat)}`, weight: w('spades.nil_made') });
          }
          if (r.contract > 0 && !r.made) {
            for (const s of COMPUTER_SEATS) out.push({ seat: s, trigger: `spades.set.${teamOf(s) === team ? 'us' : 'them'}`, weight: w('spades.set') });
          }
        }
        const [a, b] = [e.results[0].total, e.results[1].total];
        if (a !== b) {
          const good: Team = a > b ? 0 : 1;
          for (const s of COMPUTER_SEATS) {
            const mine = teamOf(s) === good;
            // The better team "did well": self for its computer players, human for the others when it's the player's team.
            if (mine) out.push({ seat: s, trigger: 'hand.good.self', weight: w('hand.good') });
            else if (good === teamOf(HUMAN_SEAT)) out.push({ seat: s, trigger: 'hand.good.human', weight: w('hand.good') });
            if (!mine) out.push({ seat: s, trigger: 'hand.bad.self', weight: w('hand.bad') });
            else if (good !== teamOf(HUMAN_SEAT)) out.push({ seat: s, trigger: 'hand.bad.human', weight: w('hand.bad') });
          }
        }
        break;
      }
      case 'bag_penalty':
        for (const s of COMPUTER_SEATS) out.push({ seat: s, trigger: `spades.bags.${teamOf(s) === e.team ? 'us' : 'them'}`, weight: w('spades.bags') });
        break;
      case 'game_won':
        for (const s of COMPUTER_SEATS) {
          const trigger = teamOf(s) === e.team ? 'game.won.self' : e.team === teamOf(HUMAN_SEAT) ? 'game.won.human' : 'game.won.other';
          out.push({ seat: s, trigger, weight: w('game.won') });
        }
        break;
      default:
        break;
    }
  }
  return out;
}
