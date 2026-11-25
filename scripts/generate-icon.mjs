#!/usr/bin/env node
/**
 * App icon generator (spec 07 §App icon, D-067).
 *
 * Draws the FreeKards icon from geometry in this file (original work of The FreeKards Contributors,
 * MIT) and writes build/icon.svg. The suit shapes are the same as the card generator's
 * (scripts/generate-cards.mjs). electron-builder reads build/icon.png (1024×1024), which
 * `npm run icon` renders from the SVG with Electron (scripts/render-icon.cjs).
 *
 * Usage: node scripts/generate-icon.mjs                 writes build/icon.svg for the chosen design
 *        node scripts/generate-icon.mjs --drafts <dir>  writes every design to <dir>/<name>.svg
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The design that ships (owner's choice, D-067). */
const CHOSEN = 'fan';

const RED = '#c8102e';
const BLACK = '#1a1a1a';
const PAPER = '#fdfdf8';
const GOLD = '#d9a82b';
const GOLD_DARK = '#8a6414';
const FELT = '#0d6a31';
const FELT_DARK = '#063d1b';
const BACK_RED = '#a3192e';
const BACK_BLUE = '#1f4e9c';

/** Suit symbols in a 100×100 box (copied from scripts/generate-cards.mjs). */
const SUIT_PATH = {
  H: 'M50 92 C 22 70 2 52 2 31 C 2 15 14 5 28 5 C 38 5 46 11 50 21 C 54 11 62 5 72 5 C 86 5 98 15 98 31 C 98 52 78 70 50 92 Z',
  D: 'M50 2 L 86 50 L 50 98 L 14 50 Z',
  S: 'M50 2 C 38 22 4 40 4 62 C 4 76 15 85 28 85 C 37 85 43 81 47 75 C 46 86 41 93 32 98 L 68 98 C 59 93 54 86 53 75 C 57 81 63 85 72 85 C 85 85 96 76 96 62 C 96 40 62 22 50 2 Z',
  C: 'M50 4 A 21 21 0 0 1 66.5 38 A 21 21 0 1 1 55 70 C 56 84 60 92 68 98 L 32 98 C 40 92 44 84 45 70 A 21 21 0 1 1 33.5 38 A 21 21 0 0 1 50 4 Z',
};
const suitColor = (s) => (s === 'H' || s === 'D' ? RED : BLACK);

function suit(s, cx, cy, size, fill = suitColor(s)) {
  const k = size / 100;
  return `<path d="${SUIT_PATH[s]}" fill="${fill}" transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${k})"/>`;
}

const DEFS = `<defs>
  <radialGradient id="felt" cx="50%" cy="42%" r="62%">
    <stop offset="0" stop-color="#14833f"/><stop offset="0.6" stop-color="${FELT}"/><stop offset="1" stop-color="${FELT_DARK}"/>
  </radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f0c54d"/><stop offset="1" stop-color="${GOLD_DARK}"/>
  </linearGradient>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.45"/>
  </filter>
</defs>`;

/** Rounded-square felt tile with a gold rim; 64 px margin so Windows and Linux shells don't crop it. */
const TILE = `<rect x="64" y="64" width="896" height="896" rx="190" fill="url(#gold)"/>
<rect x="88" y="88" width="848" height="848" rx="168" fill="url(#felt)"/>`;

/** A card centered on (cx, cy), rotated `deg` degrees, with `inner` drawn in card coordinates. */
function card(cx, cy, w, h, deg, fill, inner = '') {
  return `<g transform="translate(${cx} ${cy}) rotate(${deg})" filter="url(#shadow)">
  <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${w * 0.08}" fill="${PAPER}"/>
  ${fill === PAPER ? '' : `<rect x="${-w / 2 + w * 0.07}" y="${-h / 2 + w * 0.07}" width="${w * 0.86}" height="${h - w * 0.14}" rx="${w * 0.05}" fill="${fill}"/>`}
  ${inner}
</g>`;
}

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">\n${DEFS}\n${body}\n</svg>\n`;

const DESIGNS = {
  /** Three fanned cards: the two deck backs behind, a big heart in front. */
  fan: () =>
    svg(
      TILE +
        card(372, 540, 330, 462, -18, BACK_BLUE) +
        card(652, 540, 330, 462, 18, BACK_RED) +
        card(512, 512, 360, 504, 0, PAPER, suit('H', 0, 6, 250)),
    ),
  /** One ace of hearts, slightly tilted, on the felt. */
  ace: () =>
    svg(
      TILE +
        card(512, 520, 470, 658, -8, PAPER, suit('H', 0, 10, 300) + suit('H', -158, -248, 72) + suit('H', 158, 268, 72)),
    ),
  /** The four suits on a cream disc, in the hearts-first hand order (D-065). */
  suits: () =>
    svg(
      TILE +
        `<circle cx="512" cy="512" r="350" fill="${PAPER}" filter="url(#shadow)"/>
<circle cx="512" cy="512" r="324" fill="none" stroke="${GOLD}" stroke-width="12"/>` +
        suit('H', 392, 392, 200) +
        suit('S', 632, 392, 200) +
        suit('D', 392, 632, 200) +
        suit('C', 632, 632, 200),
    ),
  /** A casino chip with a heart in the middle. */
  chip: () => {
    const stripes = Array.from({ length: 8 }, (_, i) => {
      const a = (i * 45 * Math.PI) / 180;
      const x = 512 + Math.cos(a) * 330;
      const y = 512 + Math.sin(a) * 330;
      return `<rect x="${x - 40}" y="${y - 62}" width="80" height="124" rx="10" fill="${PAPER}" transform="rotate(${i * 45 + 90} ${x} ${y})"/>`;
    }).join('');
    return svg(
      TILE +
        `<g filter="url(#shadow)"><circle cx="512" cy="512" r="390" fill="${BACK_RED}"/>${stripes}</g>
<circle cx="512" cy="512" r="262" fill="${PAPER}"/>
<circle cx="512" cy="512" r="240" fill="none" stroke="${GOLD}" stroke-width="14" stroke-dasharray="36 22"/>` +
        suit('H', 512, 520, 270),
    );
  },
};

const di = process.argv.indexOf('--drafts');
if (di > 0) {
  const dir = process.argv[di + 1];
  if (!dir) throw new Error('--drafts needs a directory');
  mkdirSync(dir, { recursive: true });
  for (const [name, draw] of Object.entries(DESIGNS)) writeFileSync(join(dir, `${name}.svg`), draw());
  console.log(`wrote ${Object.keys(DESIGNS).length} drafts to ${dir}`);
} else {
  writeFileSync(join(root, 'build', 'icon.svg'), DESIGNS[CHOSEN]());
  console.log(`wrote build/icon.svg (${CHOSEN})`);
}
