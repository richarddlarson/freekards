#!/usr/bin/env node
/**
 * Music build (spec 13 §3 and §5, D-045). For every track in spec/content/audio.json:
 *   1. get the ORIGINAL file (cached in .cache/music-src/, else downloaded from `source`, the Wayback
 *      Machine copy of its freepd.com URL);
 *   2. verify its SHA-256 against `sourceSha256` (stop if it differs);
 *   3. encode it with ffmpeg to Opus at the settings below, writing `file` (assets/audio/music/*.opus).
 * Output is deterministic for a given ffmpeg/libopus version. Re-run after changing the track list.
 *
 * Usage: node scripts/build-music.mjs   (needs ffmpeg with libopus on PATH)
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(root, '.cache', 'music-src');
const manifest = JSON.parse(readFileSync(join(root, 'spec', 'content', 'audio.json'), 'utf8'));
const enc = manifest.musicEncoding;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

mkdirSync(cacheDir, { recursive: true });
for (const t of manifest.music) {
  const cached = join(cacheDir, `${t.id}.src`);
  let data = existsSync(cached) ? readFileSync(cached) : null;
  if (!data || sha256(data) !== t.sourceSha256) {
    process.stdout.write(`downloading ${t.title} … `);
    const res = await fetch(t.source);
    if (!res.ok) throw new Error(`${t.id}: HTTP ${res.status} from ${t.source}`);
    data = Buffer.from(await res.arrayBuffer());
    writeFileSync(cached, data);
    console.log('done');
  }
  const got = sha256(data);
  if (got !== t.sourceSha256) throw new Error(`${t.id}: SHA-256 mismatch (got ${got}, expected ${t.sourceSha256})`);

  const out = join(root, t.file);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', cached,
    '-map', '0:a:0', '-map_metadata', '-1',
    '-c:a', 'libopus', '-b:a', `${enc.bitrateKbps}k`, '-vbr', 'on', '-compression_level', '10',
    '-application', 'audio', '-ar', '48000', '-ac', '2',
    '-metadata', `title=${t.title}`, '-metadata', `artist=${t.composer}`,
    '-metadata', 'comment=CC0 1.0 via FreePD.com; re-encoded for FreeKards',
    '-fflags', '+bitexact', '-flags:a', '+bitexact',
    out,
  ]);
  console.log(`${t.id}: ${(readFileSync(out).length / 1048576).toFixed(2)} MB`);
}
