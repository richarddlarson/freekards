/**
 * Maps Gin Rummy and Rummy 500 events to dialogue candidates (spec 08 §Rummy triggers). Engine-neutral.
 * Both are 2-player games: the computer opponent is player 1 and speaks from dialogue seat 1, and the
 * perspectives are `self` (the computer) and `human` (the player).
 */
import type { GinEvent, Player } from '../gin/types.js';
import type { Rummy500Event } from '../rummy500/types.js';
import { TRIGGER_WEIGHTS } from './hearts-triggers.js';
import type { DialogueCandidate } from './types.js';

export const RUMMY_TRIGGER_WEIGHTS: Readonly<Record<string, number>> = {
  'gin.gin': 1.0,
  'gin.knock': 0.6,
  'gin.undercut': 0.9,
  'gin.dead_hand': 0.5,
  'gin.took_discard': 0.3,
  'rummy.went_out': 0.8,
  'rummy.caught': 0.8,
  'rummy.took_pile': 0.5,
  'rummy.layoff': 0.4,
  'rummy.big_meld': 0.4,
};

/** Every Gin Rummy and Rummy 500 trigger a character file may use (validated by tests). */
export const RUMMY_TRIGGERS: readonly string[] = [
  'gin.gin.self', 'gin.gin.human',
  'gin.knock.self', 'gin.knock.human',
  'gin.undercut.self', 'gin.undercut.human',
  'gin.dead_hand',
  'gin.took_discard.human',
  'rummy.went_out.self', 'rummy.went_out.human',
  'rummy.caught.self', 'rummy.caught.human',
  'rummy.took_pile.self', 'rummy.took_pile.human',
  'rummy.layoff.human',
  'rummy.big_meld.self', 'rummy.big_meld.human',
];

/** The computer's dialogue seat. */
const SPEAKER = 1;
/** Rummy 500: a hand left with at least this many points counts as "caught". */
export const CAUGHT_POINTS = 30;
/** Rummy 500: a pick-up of at least this many cards. */
export const BIG_PICKUP = 3;
/** Rummy 500: a single meld of at least 4 cards or this many points. */
export const BIG_MELD_POINTS = 30;

const who = (p: Player | null): 'self' | 'human' => (p === 1 ? 'self' : 'human');

function cand(base: string, perspective?: string): DialogueCandidate {
  const weight = RUMMY_TRIGGER_WEIGHTS[base] ?? TRIGGER_WEIGHTS[base]!;
  return { seat: SPEAKER, trigger: perspective ? `${base}.${perspective}` : base, weight };
}

/** The shared hand.* and game.* triggers for a 2-player hand or game won by `winner`. */
function handOutcome(winner: Player): DialogueCandidate[] {
  return winner === 1 ? [cand('hand.good', 'self'), cand('hand.bad', 'human')] : [cand('hand.good', 'human'), cand('hand.bad', 'self')];
}

export function ginCandidates(events: readonly GinEvent[]): DialogueCandidate[] {
  const out: DialogueCandidate[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'drew':
        // Taking the computer's discard (the opening upcard doesn't count).
        if (e.source === 'discard' && e.player === 0) out.push(cand('gin.took_discard', 'human'));
        break;
      case 'gin':
        out.push(cand('gin.gin', who(e.player)));
        break;
      case 'knocked':
        out.push(cand('gin.knock', who(e.player)));
        break;
      case 'undercut':
        out.push(cand('gin.undercut', who(e.player)));
        break;
      case 'hand_dead':
        out.push(cand('gin.dead_hand'));
        break;
      case 'hand_scored':
        if (e.result.winner !== null) out.push(...handOutcome(e.result.winner));
        break;
      case 'game_won':
        out.push(cand('game.won', who(e.player)));
        break;
      default:
        break;
    }
  }
  return out;
}

export function rummy500Candidates(events: readonly Rummy500Event[]): DialogueCandidate[] {
  const out: DialogueCandidate[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'took_discard':
        if (e.cards.length >= BIG_PICKUP) out.push(cand('rummy.took_pile', who(e.player)));
        break;
      case 'melded':
        if (e.cards.length >= 4 || e.points >= BIG_MELD_POINTS) out.push(cand('rummy.big_meld', who(e.player)));
        break;
      case 'laid_off':
        if (e.player === 0 && e.meldOwner === 1) out.push(cand('rummy.layoff', 'human'));
        break;
      case 'went_out':
        out.push(cand('rummy.went_out', who(e.player)));
        break;
      case 'hand_scored': {
        const r = e.result;
        for (const p of [0, 1] as Player[]) if (r.inHand[p] >= CAUGHT_POINTS) out.push(cand('rummy.caught', who(p)));
        if (r.total[0] !== r.total[1]) out.push(...handOutcome(r.total[1] > r.total[0] ? 1 : 0));
        break;
      }
      case 'game_won':
        out.push(cand('game.won', who(e.player)));
        break;
      default:
        break;
    }
  }
  return out;
}
