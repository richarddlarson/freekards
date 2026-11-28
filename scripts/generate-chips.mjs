#!/usr/bin/env node
/**
 * Poker-chip generator for the Classic Casino theme (spec 19 §4.3, D-091).
 *
 * Writes one SVG per denomination to assets/themes/classic-casino/chips/<value>.svg: a chip seen at
 * an angle (an ellipse with an edge), so chips stack by drawing each one a few units above the last.
 * All artwork is drawn from geometry in this file and is original work of The FreeKards Contributors
 * (MIT). The value is outlined from Fira Sans Condensed Bold (OFL-1.1) with opentype.js, as on the
 * cards, so the chips need no font at run time.
 *
 * Usage: node scripts/generate-chips.mjs     (output is deterministic; commit the results)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'themes', 'classic-casino', 'chips');

/** Denominations and colors (the usual casino colors). Must match CHIP_VALUES in the renderer. */
const CHIPS = [
  { value: 1, body: '#eeeae0', edge: '#c9c3b2', insert: '#2b5aa8', ink: '#2b5aa8' },
  { value: 5, body: '#c0262d', edge: '#8a1a20', insert: '#f7f2e3', ink: '#c0262d' },
  { value: 25, body: '#1f8a46', edge: '#155f30', insert: '#f7f2e3', ink: '#1f8a46' },
  { value: 100, body: '#262626', edge: '#0f0f0f', insert: '#f7f2e3', ink: '#262626' },
  { value: 500, body: '#6b3fa0', edge: '#4a2a70', insert: '#f7f2e3', ink: '#6b3fa0' },
  { value: 1000, body: '#e0a020', edge: '#a87410', insert: '#7a3e12', ink: '#7a3e12' },
];

// Geometry (viewBox units): a circle of radius R seen at an angle, squashed to R × RY, THICK deep.
const W = 120;
const H = 84;
const CX = 60;
const CY = 34;
const R = 56;
const RY = 30;
const THICK = 12;
const SQUASH = RY / R;

const bytes = readFileSync(join(root, 'assets/fonts/fira-sans-condensed/FiraSansCondensed-Bold.ttf'));
const FONT = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

const f = (n) => Number(n.toFixed(2));
const rad = (deg) => (deg * Math.PI) / 180;

/** Path data with 2 decimals, guarding against opentype.js formatting tiny numbers as NaN (see generate-cards.mjs). */
function pathData(path) {
  for (const c of path.commands) for (const k of ['x', 'y', 'x1', 'y1', 'x2', 'y2']) if (c[k] !== undefined && Math.abs(c[k]) < 1e-9) c[k] = 0;
  const d = path.toPathData(2);
  if (/NaN|Infinity/.test(d)) throw new Error(`bad path data: ${d.slice(0, 80)}`);
  return d;
}

/** The value as outlines, centered on (0, 0) in the chip's top-face (circle) space, `height` tall. */
function valueText(text, height, fill) {
  const capH = -FONT.charToGlyph('8').getPath(0, 0, FONT.unitsPerEm).getBoundingBox().y1;
  const size = (height * FONT.unitsPerEm) / capH;
  const path = FONT.getPath(text, 0, 0, size);
  const b = path.getBoundingBox();
  const maxW = 56;
  const squeeze = b.x2 - b.x1 > maxW ? maxW / (b.x2 - b.x1) : 1;
  const tx = -(b.x1 + b.x2) / 2;
  const ty = -(b.y1 + b.y2) / 2;
  return `<path d="${pathData(FONT.getPath(text, tx, ty, size))}" fill="${fill}"${squeeze === 1 ? '' : ` transform="scale(${f(squeeze)} 1)"`}/>`;
}

/** A point on the top face's rim at angle `deg` (0 = right, 90 = nearest the viewer). */
const rim = (deg, r = R) => [CX + r * Math.cos(rad(deg)), CY + r * SQUASH * Math.sin(rad(deg))];

/** The visible part of the edge between two angles (front half only), as a closed path. */
function edgeBand(a1, a2) {
  const steps = 6;
  const top = [];
  for (let i = 0; i <= steps; i++) top.push(rim(a1 + ((a2 - a1) * i) / steps));
  const bottom = [...top].reverse().map(([x, y]) => [x, y + THICK]);
  return `M${[...top, ...bottom].map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`;
}

function chipSvg(c) {
  const label = c.value >= 1000 ? '1K' : String(c.value);
  const inserts = [22.5, 67.5, 112.5, 157.5].map((a) => `<path d="${edgeBand(a - 9, a + 9)}" fill="${c.insert}"/>`).join('');
  // Rim spots on the top face, drawn in circle space and squashed with the face.
  const spots = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((k) => {
      const a = 22.5 + k * 45;
      const [a1, a2] = [rad(a - 8), rad(a + 8)];
      const p = (r, t) => `${f(r * Math.cos(t))} ${f(r * Math.sin(t))}`;
      return `<path d="M${p(R - 1, a1)} A${R - 1} ${R - 1} 0 0 1 ${p(R - 1, a2)} L${p(R - 13, a2)} A${R - 13} ${R - 13} 0 0 0 ${p(R - 13, a1)} Z" fill="${c.insert}"/>`;
    })
    .join('');
  const outline = 'rgba(0,0,0,0.35)';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/><stop offset="1" stop-color="#000000" stop-opacity="0.12"/></linearGradient></defs>
<path d="M${CX - R} ${CY} L${CX - R} ${CY + THICK} A${R} ${RY} 0 0 0 ${CX + R} ${CY + THICK} L${CX + R} ${CY} Z" fill="${c.edge}" stroke="${outline}" stroke-width="1"/>
${inserts}
<ellipse cx="${CX}" cy="${CY}" rx="${R}" ry="${RY}" fill="${c.body}" stroke="${outline}" stroke-width="1"/>
<g transform="translate(${CX} ${CY}) scale(1 ${f(SQUASH)})">${spots}<circle r="${R - 17}" fill="none" stroke="${c.insert}" stroke-width="2" stroke-dasharray="5 4"/><circle r="${R - 22}" fill="#f7f2e3"/>${valueText(label, 22, c.ink)}</g>
<ellipse cx="${CX}" cy="${CY}" rx="${R}" ry="${RY}" fill="url(#face)"/>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
for (const c of CHIPS) writeFileSync(join(outDir, `${c.value}.svg`), chipSvg(c));
console.log(`wrote ${CHIPS.length} chips to ${outDir}`);
