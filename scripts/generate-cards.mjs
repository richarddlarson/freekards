#!/usr/bin/env node
/**
 * Card-deck generator for the Classic Casino theme (spec 07 §Card decks, D-027, D-062).
 *
 * For each deck in DECKS, writes one self-contained SVG per card to
 * assets/themes/classic-casino/decks/<deck>/faces/{rank}{suit}.svg plus the deck's back.svg.
 * All artwork is drawn from geometry in this file and is original work of The FreeKards
 * Contributors (MIT). Decks share the layout and differ in index font and back color.
 *
 * All lettering (corner indices, the A♠ legend) is converted to vector outlines from the deck's
 * font (OFL-1.1, assets/fonts/) with opentype.js, so the cards look the same everywhere and need no
 * font at run time (D-060).
 *
 * Usage: node scripts/generate-cards.mjs     (output is deterministic; commit the results)
 *        node scripts/generate-cards.mjs --font <file.ttf> --out <dir> [--back <#rrggbb>]
 *                                            (try another index font: writes one trial deck to <dir>)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const decksDir = join(root, 'assets', 'themes', 'classic-casino', 'decks');

/**
 * The decks a player can choose in Settings (spec 16, D-062). The ids must match CARD_DECKS in
 * src/logic/settings/player-settings.ts.
 */
const DECKS = {
  classic: { font: 'assets/fonts/fira-sans-condensed/FiraSansCondensed-Bold.ttf', back: '#a3192e' },
  rounded: { font: 'assets/fonts/nunito/Nunito-ExtraBold.ttf', back: '#1f4e9c' },
};

/** The font of the deck being drawn; set by useFont() before each deck. */
let FONT;
/** Capital height in font units, measured from "H" (some fonts leave the OS/2 value empty). */
let CAP_HEIGHT;
let RANK_SIZE;

function useFont(file) {
  const bytes = readFileSync(file);
  FONT = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  CAP_HEIGHT = -FONT.charToGlyph('H').getPath(0, 0, FONT.unitsPerEm).getBoundingBox().y1;
  RANK_SIZE = (INDEX.rankHeight * FONT.unitsPerEm) / CAP_HEIGHT;
}

/** One glyph per character, straight from the character map: card lettering needs no shaping or ligatures. */
const glyphsOf = (text) => [...text].map((ch) => FONT.charToGlyph(ch));

// ---------------------------------------------------------------- geometry & palette

const W = 250; // card width (viewBox units); poker ratio 63.5 : 88.9
const H = 350;
const RADIUS = 12.5; // 5% of width
const RED = '#c8102e';
const BLACK = '#1a1a1a';
const PAPER = '#fdfdf8';
const GOLD = '#d9a82b';
const BLUE = '#1f4e9c';
const SKIN = '#f3d6b8';

const SUITS = { C: 'club', D: 'diamond', S: 'spade', H: 'heart' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const RANK_LABEL = { T: '10' };

const suitColor = (s) => (s === 'D' || s === 'H' ? RED : BLACK);

/** Suit symbols drawn in a 100×100 box, centered on (50, 50). */
const SUIT_PATH = {
  H: 'M50 92 C 22 70 2 52 2 31 C 2 15 14 5 28 5 C 38 5 46 11 50 21 C 54 11 62 5 72 5 C 86 5 98 15 98 31 C 98 52 78 70 50 92 Z',
  D: 'M50 2 L 86 50 L 50 98 L 14 50 Z',
  S: 'M50 2 C 38 22 4 40 4 62 C 4 76 15 85 28 85 C 37 85 43 81 47 75 C 46 86 41 93 32 98 L 68 98 C 59 93 54 86 53 75 C 57 81 63 85 72 85 C 85 85 96 76 96 62 C 96 40 62 22 50 2 Z',
  C: 'M50 4 A 21 21 0 0 1 66.5 38 A 21 21 0 1 1 55 70 C 56 84 60 92 68 98 L 32 98 C 40 92 44 84 45 70 A 21 21 0 1 1 33.5 38 A 21 21 0 0 1 50 4 Z',
};

function pip(suit, cx, cy, size, rotate = false, fill = suitColor(suit)) {
  const s = size / 100;
  const rot = rotate ? ` rotate(180 50 50)` : '';
  return `<path d="${SUIT_PATH[suit]}" fill="${fill}" transform="translate(${(cx - size / 2).toFixed(2)} ${(cy - size / 2).toFixed(2)}) scale(${s})${rot}"/>`;
}

// ---------------------------------------------------------------- lettering

/**
 * A line of text as one SVG path, centered on `cx` with its baseline at `y`.
 * `tracking` adds space between letters (font units per 1000 em); `squeeze` narrows the glyphs horizontally.
 */
function lettering(text, cx, y, size, fill, { tracking = 0, squeeze = 1 } = {}) {
  const glyphs = glyphsOf(text);
  const unit = size / FONT.unitsPerEm;
  let advance = 0;
  const parts = glyphs.map((g, i) => {
    const x = advance;
    advance += g.advanceWidth * unit + (i < glyphs.length - 1 ? (tracking * size) / 1000 : 0);
    return { g, x };
  });
  // Center on the ink, not the advance box, so a glyph's side bearings don't shift it.
  let x1 = Infinity;
  let x2 = -Infinity;
  for (const { g, x } of parts) {
    const b = g.getPath(x, 0, size).getBoundingBox();
    x1 = Math.min(x1, b.x1);
    x2 = Math.max(x2, b.x2);
  }
  const shift = -(x1 + x2) / 2;
  const d = parts.map(({ g, x }) => g.getPath(x + shift, 0, size).toPathData(2)).join('');
  return `<path d="${d}" fill="${fill}" transform="translate(${cx} ${y})${squeeze === 1 ? '' : ` scale(${squeeze} 1)`}"/>`;
}

// ---------------------------------------------------------------- card frame & indices

function frame(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- FreeKards Classic Casino card. Generated by scripts/generate-cards.mjs. MIT License, (c) 2026 The FreeKards Contributors. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${RADIUS}" fill="${PAPER}" stroke="#9a9a90" stroke-width="2"/>
${inner}
</svg>
`;
}

/**
 * Jumbo corner index (D-060): the rank's capital height is about 17% of the card height, with a large
 * suit symbol under it, in a column at the left edge so a tightly fanned hand still shows it.
 */
const INDEX = {
  x: 36, // center of the index column
  top: 16, // top of the rank
  rankHeight: 60, // capital height of the rank
  gap: 13, // between the rank and the suit symbol (J and Q descend into it)
  pip: 40, // suit symbol size
};
/** Widest rank ink allowed in the index column; wider ranks (usually "10") are narrowed to fit. */
const INDEX_MAX_WIDTH = 63.6;

function inkWidth(text, size, tracking) {
  let advance = 0;
  let x1 = Infinity;
  let x2 = -Infinity;
  glyphsOf(text).forEach((g, i, all) => {
    const b = g.getPath(advance, 0, size).getBoundingBox();
    x1 = Math.min(x1, b.x1);
    x2 = Math.max(x2, b.x2);
    advance += (g.advanceWidth * size) / FONT.unitsPerEm + (i < all.length - 1 ? (tracking * size) / 1000 : 0);
  });
  return x2 - x1;
}

function index(rank, suit) {
  const label = RANK_LABEL[rank] ?? rank;
  const color = suitColor(suit);
  const base = INDEX.top + INDEX.rankHeight;
  // "10" is two figures wide, so it is set tight, then narrowed if it is still wider than the column.
  const tracking = label.length > 1 ? -50 : 0;
  const width = inkWidth(label, RANK_SIZE, tracking);
  const opts = { tracking, squeeze: width > INDEX_MAX_WIDTH ? Math.round((INDEX_MAX_WIDTH / width) * 1000) / 1000 : 1 };
  const one = lettering(label, INDEX.x, base, RANK_SIZE, color, opts) + pip(suit, INDEX.x, base + INDEX.gap + INDEX.pip / 2, INDEX.pip);
  return `<g>${one}</g><g transform="rotate(180 ${W / 2} ${H / 2})">${one}</g>`;
}

// ---------------------------------------------------------------- number cards

/** Pip columns, pulled toward the middle so they clear the jumbo indices (D-060). */
const COL = { L: 0.392, C: 0.5, R: 0.608 };
/** Rows are spread over this fraction of the traditional layout's height, around the middle. */
const ROW_SPREAD = 0.92;
const PIP_SIZE = 40;
const ROWS4 = [0.2, 0.4, 0.6, 0.8];
/** Pip positions as [column, row] fractions; rows below 0.5 are upright, above 0.5 are rotated. */
const LAYOUT = {
  2: [['C', 0.2], ['C', 0.8]],
  3: [['C', 0.2], ['C', 0.5], ['C', 0.8]],
  4: [['L', 0.2], ['R', 0.2], ['L', 0.8], ['R', 0.8]],
  5: [['L', 0.2], ['R', 0.2], ['C', 0.5], ['L', 0.8], ['R', 0.8]],
  6: [['L', 0.2], ['R', 0.2], ['L', 0.5], ['R', 0.5], ['L', 0.8], ['R', 0.8]],
  7: [['L', 0.2], ['R', 0.2], ['C', 0.35], ['L', 0.5], ['R', 0.5], ['L', 0.8], ['R', 0.8]],
  8: [['L', 0.2], ['R', 0.2], ['C', 0.35], ['L', 0.5], ['R', 0.5], ['C', 0.65], ['L', 0.8], ['R', 0.8]],
  9: [...ROWS4.flatMap((r) => [['L', r], ['R', r]]), ['C', 0.5]],
  10: [...ROWS4.flatMap((r) => [['L', r], ['R', r]]), ['C', 0.3], ['C', 0.7]],
};

function numberCard(rank, suit) {
  const n = rank === 'T' ? 10 : Number(rank);
  const pips = LAYOUT[n]
    .map(([c, r]) => pip(suit, COL[c] * W, (0.5 + (r - 0.5) * ROW_SPREAD) * H, PIP_SIZE, r > 0.5))
    .join('');
  return frame(index(rank, suit) + pips);
}

function aceCard(suit) {
  let center;
  if (suit === 'S') {
    // Decorative (original) ace of spades: large spade inside a double gold ring with small pips.
    // Sized to stay clear of the jumbo indices in the corners.
    center = `<circle cx="125" cy="175" r="70" fill="none" stroke="${GOLD}" stroke-width="4"/>
<circle cx="125" cy="175" r="63" fill="none" stroke="${BLACK}" stroke-width="1.5"/>
${[0, 90, 180, 270].map((a) => `<g transform="rotate(${a} 125 175)">${pip('S', 125, 96, 12)}</g>`).join('')}
${pip('S', 125, 172, 90)}
${lettering('FREEKARDS', 125, 283, 15, BLACK, { tracking: 200 })}`;
  } else {
    center = pip(suit, 125, 175, 92);
  }
  return frame(index('A', suit) + center);
}

// ---------------------------------------------------------------- court cards (original, simplified)

/** Robe colors per suit, so the twelve courts are distinguishable at a glance. */
const ROBE = {
  H: { main: RED, accent: GOLD, trim: BLUE },
  D: { main: GOLD, accent: RED, trim: BLUE },
  S: { main: BLUE, accent: GOLD, trim: BLACK },
  C: { main: '#2f6b3a', accent: GOLD, trim: RED },
};

/** Headwear, drawn above a head centered at (125, 108) with radius 26. */
function headwear(kind, robe) {
  if (kind === 'K') {
    return `<path d="M95 92 L95 62 L108 76 L117 54 L125 72 L133 54 L142 76 L155 62 L155 92 Z" fill="${GOLD}" stroke="${BLACK}" stroke-width="1.5"/>
<rect x="95" y="86" width="60" height="9" fill="${robe.accent === GOLD ? RED : robe.accent}" stroke="${BLACK}" stroke-width="1"/>
<circle cx="117" cy="54" r="3.5" fill="${RED}"/><circle cx="133" cy="54" r="3.5" fill="${RED}"/>`;
  }
  if (kind === 'Q') {
    return `<path d="M99 92 Q 100 66 112 70 Q 118 52 125 62 Q 132 52 138 70 Q 150 66 151 92 Z" fill="${GOLD}" stroke="${BLACK}" stroke-width="1.5"/>
<circle cx="125" cy="72" r="5" fill="${BLUE}" stroke="${BLACK}" stroke-width="1"/>`;
  }
  // Jack: soft cap with a feather.
  return `<path d="M96 96 Q 98 66 125 64 Q 156 64 156 92 Z" fill="${robe.trim}" stroke="${BLACK}" stroke-width="1.5"/>
<path d="M146 72 Q 172 48 168 30 Q 160 52 140 68 Z" fill="${robe.accent}" stroke="${BLACK}" stroke-width="1"/>`;
}

function face(kind) {
  const hair = kind === 'Q'
    ? `<path d="M98 104 Q 96 140 106 150 L 110 112 Z M152 104 Q 154 140 144 150 L 140 112 Z" fill="#c98b2b" stroke="${BLACK}" stroke-width="1"/>`
    : '';
  const beard = kind === 'K'
    ? `<path d="M103 116 Q 104 150 125 154 Q 146 150 147 116 Q 136 128 125 126 Q 114 128 103 116 Z" fill="#8a5a2b" stroke="${BLACK}" stroke-width="1"/>`
    : '';
  const mustache = kind === 'J'
    ? `<path d="M114 121 Q 125 116 136 121 Q 125 125 114 121 Z" fill="#6b4423"/>`
    : '';
  return `${hair}<circle cx="125" cy="108" r="26" fill="${SKIN}" stroke="${BLACK}" stroke-width="1.5"/>
${beard}<circle cx="116" cy="104" r="2.6" fill="${BLACK}"/><circle cx="134" cy="104" r="2.6" fill="${BLACK}"/>
<path d="M118 118 Q 125 123 132 118" fill="none" stroke="${BLACK}" stroke-width="1.6" stroke-linecap="round"/>${mustache}`;
}

/** Upper half of a court figure (head, headwear, shoulders, emblem); the lower half is its mirror. */
function courtHalf(kind, suit) {
  const robe = ROBE[suit];
  const shoulders = `<path d="M70 175 Q 72 140 104 132 L125 144 L146 132 Q 178 140 180 175 Z" fill="${robe.main}" stroke="${BLACK}" stroke-width="1.5"/>
<path d="M104 132 L125 175 L146 132 L125 144 Z" fill="${PAPER}" stroke="${BLACK}" stroke-width="1"/>
<path d="M70 175 Q 72 140 104 132 L108 140 Q 82 148 80 175 Z" fill="${robe.trim}" opacity="0.85"/>
<path d="M180 175 Q 178 140 146 132 L142 140 Q 168 148 170 175 Z" fill="${robe.trim}" opacity="0.85"/>`;
  const emblem = `<circle cx="125" cy="162" r="11" fill="${PAPER}" stroke="${robe.accent}" stroke-width="2"/>${pip(suit, 125, 162, 14)}`;
  const prop = kind === 'K'
    ? `<path d="M168 175 L 176 120 L 182 120 L 176 175 Z" fill="${GOLD}" stroke="${BLACK}" stroke-width="1"/><circle cx="179" cy="116" r="6" fill="${GOLD}" stroke="${BLACK}" stroke-width="1"/>`
    : kind === 'Q'
      ? `<path d="M74 172 Q 70 150 80 140 Q 92 150 86 172 Z" fill="${robe.accent}" stroke="${BLACK}" stroke-width="1"/><circle cx="80" cy="138" r="5" fill="${RED}" stroke="${BLACK}" stroke-width="1"/>`
      : `<path d="M172 175 L 186 112 L 190 113 L 178 175 Z" fill="#8c8c8c" stroke="${BLACK}" stroke-width="1"/>`;
  return shoulders + prop + face(kind) + headwear(kind, robe) + emblem;
}

/** The court picture is drawn on a 154×274 panel, then scaled down to sit between the jumbo indices. */
const COURT_SCALE = 0.8;

function courtCard(kind, suit) {
  const robe = ROBE[suit];
  const half = courtHalf(kind, suit);
  const panel = `<rect x="48" y="38" width="154" height="274" rx="8" fill="#fbf6e6" stroke="${robe.accent}" stroke-width="4"/>
<clipPath id="p"><rect x="50" y="40" width="150" height="270" rx="6"/></clipPath>
<g clip-path="url(#p)">${half}<g transform="rotate(180 125 175)">${half}</g></g>
<line x1="48" y1="175" x2="202" y2="175" stroke="${robe.accent}" stroke-width="2.5"/>`;
  const s = COURT_SCALE;
  return frame(index(kind, suit) + `<g transform="translate(${125 - 125 * s} ${175 - 175 * s}) scale(${s})">${panel}</g>`);
}

// ---------------------------------------------------------------- backs

function back(color) {
  const lattice = [];
  for (let i = -14; i <= 28; i++) {
    const x = i * 16;
    lattice.push(`<line x1="${x}" y1="0" x2="${x + 350}" y2="350"/>`, `<line x1="${x + 350}" y1="0" x2="${x}" y2="350"/>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- FreeKards Classic Casino card back. Generated by scripts/generate-cards.mjs. MIT License, (c) 2026 The FreeKards Contributors. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${RADIUS}" fill="${PAPER}" stroke="#9a9a90" stroke-width="2"/>
<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="8" fill="${color}"/>
<clipPath id="b"><rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="6"/></clipPath>
<g clip-path="url(#b)" stroke="${PAPER}" stroke-opacity="0.35" stroke-width="2">${lattice.join('')}</g>
<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="6" fill="none" stroke="${PAPER}" stroke-opacity="0.8" stroke-width="2"/>
<circle cx="125" cy="175" r="44" fill="${color}" stroke="${PAPER}" stroke-width="3"/>
${pip('S', 106, 160, 22, false, PAPER)}${pip('H', 144, 160, 22, false, PAPER)}${pip('D', 106, 192, 22, false, PAPER)}${pip('C', 144, 192, 22, false, PAPER)}
</svg>
`;
}

// ---------------------------------------------------------------- write

function writeDeck(fontFile, backColor, outDir) {
  useFont(fontFile);
  mkdirSync(join(outDir, 'faces'), { recursive: true });
  for (const suit of Object.keys(SUITS)) {
    for (const rank of RANKS) {
      const svg = rank === 'A' ? aceCard(suit) : 'JQK'.includes(rank) ? courtCard(rank, suit) : numberCard(rank, suit);
      writeFileSync(join(outDir, 'faces', `${rank}${suit}.svg`), svg);
    }
  }
  writeFileSync(join(outDir, 'back.svg'), back(backColor));
  console.log(`Wrote 52 faces and a back to ${outDir}`);
}

if (arg('--font')) {
  writeDeck(arg('--font'), arg('--back') ?? DECKS.rounded.back, arg('--out') ?? 'trial-deck');
} else {
  for (const [id, deck] of Object.entries(DECKS)) writeDeck(join(root, deck.font), deck.back, join(decksDir, id));
}
