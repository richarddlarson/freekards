/**
 * Dialogue director (spec 08 §Who speaks). Engine-neutral: time is passed in as milliseconds and
 * randomness comes from a seeded generator, so behavior is deterministic and testable.
 *
 * The presentation layer:
 *   1. feeds it candidate reactions (see hearts-triggers.ts) with `react(candidates, now)`;
 *   2. shows any returned utterance in a bubble for `bubbleDurationMs(...)`;
 *   3. calls `bubbleEnded(now)` when the bubble closes, which may return a queued major comment.
 */
import { Rng } from '../core/rng.js';
import type { CharacterDef, DialogueCandidate, DialogueLine, Utterance } from './types.js';

export const DIALOGUE_TUNING = {
  /** Quiet time after a bubble closes before the next comment (weights below 1.0). */
  cooldownMs: 6000,
  /** Lines remembered per character to avoid repeats. */
  recentLines: 3,
  /** Bubble timing without a voice clip: base + per character, capped. */
  bubbleBaseMs: 2500,
  bubblePerCharMs: 50,
  bubbleMaxMs: 7000,
  /** With a voice clip: clip length + padding, at least the base. */
  bubbleClipPaddingMs: 600,
  /** Weight at or above which a comment skips the cooldown (but still waits for a current bubble). */
  majorWeight: 1.0,
};

export function bubbleDurationMs(text: string, clipMs?: number): number {
  const t = DIALOGUE_TUNING;
  if (clipMs !== undefined) return Math.max(t.bubbleBaseMs, clipMs + t.bubbleClipPaddingMs);
  return Math.min(t.bubbleMaxMs, t.bubbleBaseMs + t.bubblePerCharMs * text.length);
}

export class DialogueDirector {
  private readonly rng: Rng;
  private speaking = false;
  private cooldownUntil = 0;
  private pending: Utterance | null = null;
  private readonly recent = new Map<string, string[]>();

  /**
   * @param seats character at each seat; null for the human (or an empty seat).
   * @param seed  generator seed (separate from game and AI generators).
   */
  constructor(
    private readonly seats: readonly (CharacterDef | null)[],
    seed: number,
  ) {
    this.rng = new Rng(seed);
  }

  /** True while a bubble is showing. */
  get isSpeaking(): boolean {
    return this.speaking;
  }

  /**
   * Offer a set of reactions to one game moment. Returns the utterance to show now, or null.
   * Higher-weight candidates are rolled first; within the winning group, a `.self` trigger is preferred.
   */
  react(candidates: readonly DialogueCandidate[], now: number): Utterance | null {
    const usable = candidates.filter((c) => this.linesFor(c).length > 0);
    if (usable.length === 0) return null;

    const weights = [...new Set(usable.map((c) => c.weight))].sort((a, b) => b - a);
    for (const weight of weights) {
      const major = weight >= DIALOGUE_TUNING.majorWeight;
      if (!major && (this.speaking || now < this.cooldownUntil)) continue;
      if (major && this.speaking && this.pending) continue;

      const group = usable.filter((c) => c.weight === weight);
      const passed = group.filter((c) => this.rng.next() < this.chattiness(c.seat) * c.weight);
      if (passed.length === 0) continue;
      const selfOnes = passed.filter((c) => c.trigger.endsWith('.self'));
      const pool = selfOnes.length > 0 ? selfOnes : passed;
      const chosen = pool[this.rng.int(pool.length)]!;
      const utterance = this.utter(chosen);

      if (this.speaking) {
        this.pending = utterance; // major comment waits for the current bubble
        return null;
      }
      this.speaking = true;
      return utterance;
    }
    return null;
  }

  /** The current bubble closed. Returns a queued major comment to show next, if any. */
  bubbleEnded(now: number): Utterance | null {
    this.speaking = false;
    this.cooldownUntil = now + DIALOGUE_TUNING.cooldownMs;
    const next = this.pending;
    this.pending = null;
    if (next) this.speaking = true;
    return next;
  }

  /** Forget any queued comment and stop speaking (e.g. when leaving the table). */
  reset(): void {
    this.speaking = false;
    this.pending = null;
    this.cooldownUntil = 0;
  }

  private chattiness(seat: number): number {
    return this.seats[seat]?.traits.chattiness ?? 0;
  }

  private linesFor(c: DialogueCandidate): DialogueLine[] {
    return this.seats[c.seat]?.lines[c.trigger] ?? [];
  }

  private utter(c: DialogueCandidate): Utterance {
    const character = this.seats[c.seat]!;
    const lines = this.linesFor(c);
    const recent = this.recent.get(character.id) ?? [];
    const fresh = lines.filter((l) => !recent.includes(l.id));
    const pool = fresh.length > 0 ? fresh : lines;
    const line = pool[this.rng.int(pool.length)]!;
    this.recent.set(character.id, [...recent, line.id].slice(-DIALOGUE_TUNING.recentLines));
    return { seat: c.seat, characterId: character.id, trigger: c.trigger, line };
  }
}
