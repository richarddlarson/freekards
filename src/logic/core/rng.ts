/**
 * Seeded, deterministic pseudo-random number generator (Mulberry32).
 *
 * The whole generator state is a single 32-bit unsigned integer, so it can be stored
 * in plain game-state data and replayed exactly (spec 05: determinism given a seed).
 * Algorithm (must be reproduced exactly by any port to keep seeds compatible):
 *
 *   state = (state + 0x6D2B79F5) mod 2^32
 *   t = state
 *   t = imul(t XOR (t >>> 15), t OR 1)
 *   t = t XOR (t + imul(t XOR (t >>> 7), t OR 61))
 *   result = ((t XOR (t >>> 14)) >>> 0) / 2^32        // in [0, 1)
 */

export function nextRandom(state: number): { value: number; state: number } {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: s };
}

/** Mutable convenience wrapper around the pure generator. */
export class Rng {
  state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    const r = nextRandom(this.state);
    this.state = r.state;
    return r.value;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick from empty list');
    return items[this.int(items.length)]!;
  }

  /** Fisher–Yates shuffle, returning a new array. Iterates i from last index down to 1, j = int(i + 1). */
  shuffle<T>(items: readonly T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = a[i]!;
      a[i] = a[j]!;
      a[j] = tmp;
    }
    return a;
  }
}
