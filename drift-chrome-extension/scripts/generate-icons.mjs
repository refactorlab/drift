// Dependency-free PNG icon generator. Draws the Drift "lens" mark — an orange
// rounded tile with a lighter diagonal drift band and a focal dot — at the
// four sizes Chrome wants, writing valid 8-bit RGBA PNGs via zlib. No native
// modules, no SVG rasterizer required.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const SIZES = [16, 32, 48, 128];

const ACCENT = [0xff, 0x6b, 0x3d];
const ACCENT_HI = [0xff, 0xb1, 0x99];
const DOT = [0x16, 0x1b, 0x22];

function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

function pixel(x, y, n) {
  const r = n * 0.22; // corner radius
  // Rounded-rect mask (transparent outside the radius).
  const cx = Math.min(Math.max(x, r), n - r);
  const cy = Math.min(Math.max(y, r), n - r);
  const d = Math.hypot(x - cx, y - cy);
  if (d > r + 0.5) return [0, 0, 0, 0];
  const edge = Math.max(0, Math.min(1, r + 0.5 - d));
  const alpha = Math.round(255 * (d > r - 0.5 ? edge : 1));

  // Diagonal drift band: lighter accent along a band, plus a focal dot.
  const diag = (x + y) / (2 * n); // 0..1 across the diagonal
  const band = Math.exp(-(((diag - 0.5) * 4) ** 2)); // gaussian band
  let rgb = mix(ACCENT, ACCENT_HI, band * 0.85);

  const dotR = n * 0.16;
  const dd = Math.hypot(x - n * 0.62, y - n * 0.4);
  if (dd < dotR) rgb = mix(rgb, DOT, Math.min(1, (dotR - dd) / Math.max(1, n * 0.05)));

  return [rgb[0], rgb[1], rgb[2], alpha];
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(n) {
  const raw = Buffer.alloc(n * (n * 4 + 1));
  let p = 0;
  for (let y = 0; y < n; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < n; x++) {
      const [r, g, b, a] = pixel(x, y, n);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // [10..12] compression / filter / interlace = 0
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const n of SIZES) {
  writeFileSync(resolve(OUT_DIR, `icon-${n}.png`), encodePng(n));
}
console.log(`drift icons → ${OUT_DIR} (${SIZES.join(', ')})`);
