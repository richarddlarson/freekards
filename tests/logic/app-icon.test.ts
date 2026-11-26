import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/** Decode an 8-bit RGBA, non-interlaced PNG (what Electron's toPNG writes) into its pixels. */
function decodePng(file: URL): { width: number; height: number; px: Uint8Array } {
  const buf = readFileSync(file);
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect([data[8], data[9], data[12]]).toEqual([8, 6, 0]); // 8-bit, RGBA, not interlaced
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= 4 ? px[y * stride + x - 4]! : 0;
      const b = y > 0 ? px[(y - 1) * stride + x]! : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4]! : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter]!;
      px[y * stride + x] = (v + pred) & 0xff;
    }
  }
  return { width, height, px };
}

describe('app icon (D-067, D-083)', () => {
  it('build/icon.png is 1024 square with a fully transparent border around the tile', () => {
    const { width, height, px } = decodePng(new URL('../../build/icon.png', import.meta.url));
    expect([width, height]).toEqual([1024, 1024]);
    const alpha = (x: number, y: number) => px[(y * width + x) * 4 + 3]!;
    // The tile spans 64–960 (build/icon.svg); everything in the 64 px margin, including the right and
    // bottom edges where the render page's scrollbars once showed, must be transparent.
    let maxEdge = 0;
    for (let i = 0; i < width; i++) {
      for (const d of [0, 1, 2, 30, 62]) {
        maxEdge = Math.max(maxEdge, alpha(i, d), alpha(i, height - 1 - d), alpha(d, i), alpha(width - 1 - d, i));
      }
    }
    expect(maxEdge).toBe(0);
    expect(alpha(512, 512)).toBe(255);
  });
});
