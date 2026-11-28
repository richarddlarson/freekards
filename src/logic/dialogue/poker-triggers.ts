/**
 * Maps poker events to dialogue candidates (spec 08 §Poker triggers). Engine-neutral. Perspective is
 * relative to each computer seat: `self`, `human` (seat 0), or `other` (another computer player).
 */
import type { DrawEvent } from '../poker/draw.js';
import type { DialogueCandidate } from './types.js';

export const POKER_TRIGGER_WEIGHTS: Readonly<Record<string, number>> = {
  'poker.won_pot': 0.4,
  'poker.big_pot': 1.0,
  'poker.bluff': 0.8,
  'poker.stood_pat': 0.6,
  'poker.raise': 0.3,
  'poker.fold': 0.2,
  'poker.bad_beat': 0.9,
  'poker.big_hand': 0.8,
  'poker.busted': 1.0,
  'poker.sit_down': 0.8,
};

/** Every poker trigger a character file may use (validated by tests). */
export const POKER_TRIGGERS: readonly string[] = [
  'poker.won_pot.self', 'poker.won_pot.human', 'poker.won_pot.other',
  'poker.big_pot.self', 'poker.big_pot.human',
  'poker.bluff.self',
  'poker.stood_pat.self', 'poker.stood_pat.human',
  'poker.raise.self', 'poker.raise.human',
  'poker.fold.self',
  'poker.bad_beat.self', 'poker.bad_beat.human',
  'poker.big_hand.self', 'poker.big_hand.human',
  'poker.busted.self', 'poker.busted.human',
  'poker.sit_down.self',
];

/** A pot of at least this many antes is a big pot. */
export const BIG_POT_ANTES = 20;
/** Losing a showdown with this category or better (three of a kind) is a bad beat. */
export const BAD_BEAT_CATEGORY = 3;
/** Winning a showdown with this category or better (a full house) is a big hand. */
export const BIG_HAND_CATEGORY = 6;

export interface PokerTalkContext {
  /** Seats with a computer player sitting in them. */
  computerSeats: readonly number[];
  ante: number;
  /** Seats whose last bet was a bluff (from the computer players). */
  bluffing?: ReadonlySet<number>;
}

function forSubject(base: string, subject: number, ctx: PokerTalkContext, other: boolean): DialogueCandidate[] {
  const weight = POKER_TRIGGER_WEIGHTS[base]!;
  const out: DialogueCandidate[] = [];
  for (const s of ctx.computerSeats) {
    if (s === subject) out.push({ seat: s, trigger: `${base}.self`, weight });
    else if (subject === 0) out.push({ seat: s, trigger: `${base}.human`, weight });
    else if (other) out.push({ seat: s, trigger: `${base}.other`, weight });
  }
  return out;
}

const selfOnly = (base: string, seat: number, ctx: PokerTalkContext): DialogueCandidate[] =>
  ctx.computerSeats.includes(seat) ? [{ seat, trigger: `${base}.self`, weight: POKER_TRIGGER_WEIGHTS[base]! }] : [];

export function pokerCandidates(events: readonly DrawEvent[], ctx: PokerTalkContext): DialogueCandidate[] {
  const out: DialogueCandidate[] = [];
  let showdown: Extract<DrawEvent, { type: 'showdown' }> | null = null;
  let potTotal = 0;
  for (const e of events) if (e.type === 'pot_won') potTotal += e.amount;
  for (const e of events) {
    switch (e.type) {
      case 'bet_action':
        if (e.kind === 'raise') out.push(...forSubject('poker.raise', e.seat, ctx, false));
        if (e.kind === 'fold') out.push(...selfOnly('poker.fold', e.seat, ctx));
        break;
      case 'drew':
        if (e.count === 0) out.push(...forSubject('poker.stood_pat', e.seat, ctx, false));
        break;
      case 'showdown':
        showdown = e;
        break;
      case 'pot_won': {
        if (e.potIndex !== 0) break; // talk about the main pot only
        const winner = e.winners[0]!;
        if (potTotal >= BIG_POT_ANTES * ctx.ante) out.push(...forSubject('poker.big_pot', winner, ctx, false));
        if (e.handName === null && ctx.bluffing?.has(winner)) out.push(...selfOnly('poker.bluff', winner, ctx));
        out.push(...forSubject('poker.won_pot', winner, ctx, true));
        if (showdown) {
          const best = showdown.hands.find((h) => h.seat === winner);
          if (best && best.value.category >= BIG_HAND_CATEGORY) out.push(...forSubject('poker.big_hand', winner, ctx, false));
          for (const h of showdown.hands) {
            if (!e.winners.includes(h.seat) && h.value.category >= BAD_BEAT_CATEGORY) out.push(...forSubject('poker.bad_beat', h.seat, ctx, false));
          }
        }
        break;
      }
      case 'busted':
        out.push(...forSubject('poker.busted', e.seat, ctx, false));
        break;
      case 'sat':
        out.push(...selfOnly('poker.sit_down', e.seat, ctx));
        break;
      default:
        break;
    }
  }
  return out;
}
