import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DECKS = join(__dirname, '../../assets/themes/classic-casino/decks');

describe('generated card art (spec 07)', () => {
  it('every deck has 52 faces and a back, and no path data a browser would drop', () => {
    for (const deck of readdirSync(DECKS)) {
      const faces = readdirSync(join(DECKS, deck, 'faces')).filter((f) => f.endsWith('.svg'));
      expect(faces, deck).toHaveLength(52);
      for (const file of [...faces.map((f) => join(deck, 'faces', f)), join(deck, 'back.svg')]) {
        const svg = readFileSync(join(DECKS, file), 'utf8');
        for (const [, d] of svg.matchAll(/\sd="([^"]*)"/g)) {
          // A browser stops drawing a path at its first invalid number (the Rounded "8" bug).
          expect(d, file).not.toMatch(/NaN|Infinity|undefined/);
        }
      }
    }
  });
});
