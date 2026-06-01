// Dependency-free generator for Chrome Web Store listing images, at the EXACT
// dimensions the dashboard requires, as 24-bit RGB PNGs with NO alpha channel
// (color type 2) — screenshots and promo tiles reject alpha. Outputs into
// release/store-assets/ (release/ is gitignored, so these never land in git).
//
//   screenshot-1280x800.png   — required (≥1)
//   promo-small-440x280.png   — optional ("Small promo tile")
//   promo-marquee-1400x560.png— optional ("Marquee promo tile")
//
// These are clean, on-brand PLACEHOLDERS so you can submit immediately. Swap
// the screenshot for a real capture of the side panel when you have one —
// reviewers prefer actual UI.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'release', 'store-assets');

// ── palette (GitHub-dark + Drift accent) ──────────────────────────────────
const BG       = [13, 17, 23];
const BG2      = [22, 27, 34];
const PANEL    = [28, 33, 41];
const STROKE   = [48, 54, 61];
const ACCENT   = [255, 107, 61];
const ACCENT_HI= [255, 177, 153];
const TEXT     = [230, 237, 243];
const MUTED    = [139, 148, 158];
const GREEN    = [63, 185, 80];
const YELLOW   = [210, 153, 34];
const RED       = [248, 81, 73];

// ── framebuffer ────────────────────────────────────────────────────────────
function makeImg(w, h) {
  return { w, h, px: new Uint8Array(w * h * 3) };
}
function set(img, x, y, c) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 3;
  img.px[i] = c[0]; img.px[i + 1] = c[1]; img.px[i + 2] = c[2];
}
function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}
function vgradient(img, top, bottom) {
  for (let y = 0; y < img.h; y++) {
    const c = mix(top, bottom, y / (img.h - 1));
    for (let x = 0; x < img.w; x++) set(img, x, y, c);
  }
}
function rect(img, x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(img, xx, yy, c);
}
function rrect(img, x, y, w, h, r, c) {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const cx = Math.min(Math.max(xx, r), w - r);
      const cy = Math.min(Math.max(yy, r), h - r);
      if (Math.hypot(xx - cx, yy - cy) <= r + 0.5) set(img, x + xx, y + yy, c);
    }
  }
}
function rstroke(img, x, y, w, h, r, c, t = 2) {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const cx = Math.min(Math.max(xx, r), w - r);
      const cy = Math.min(Math.max(yy, r), h - r);
      const d = Math.hypot(xx - cx, yy - cy);
      if (d <= r + 0.5 && d >= r - t) set(img, x + xx, y + yy, c);
    }
  }
}
// Donut-gauge arc from -90° (top) clockwise, `frac` of the full circle filled.
function gauge(img, cx, cy, rOut, rIn, frac, c, track) {
  for (let yy = cy - rOut; yy <= cy + rOut; yy++) {
    for (let xx = cx - rOut; xx <= cx + rOut; xx++) {
      const d = Math.hypot(xx - cx, yy - cy);
      if (d > rOut || d < rIn) continue;
      let ang = Math.atan2(yy - cy, xx - cx) + Math.PI / 2; // 0 at top
      if (ang < 0) ang += Math.PI * 2;
      set(img, xx, yy, ang / (Math.PI * 2) <= frac ? c : track);
    }
  }
}

// ── the Drift "lens" mark (rounded tile + diagonal band + focal dot) ────────
function logo(img, x, y, n) {
  const r = n * 0.22, dotR = n * 0.16;
  for (let yy = 0; yy < n; yy++) {
    for (let xx = 0; xx < n; xx++) {
      const cx = Math.min(Math.max(xx, r), n - r);
      const cy = Math.min(Math.max(yy, r), n - r);
      if (Math.hypot(xx - cx, yy - cy) > r + 0.5) continue;
      const diag = (xx + yy) / (2 * n);
      const band = Math.exp(-(((diag - 0.5) * 4) ** 2));
      let rgb = mix(ACCENT, ACCENT_HI, band * 0.85);
      const dd = Math.hypot(xx - n * 0.62, yy - n * 0.4);
      if (dd < dotR) rgb = mix(rgb, BG, Math.min(1, (dotR - dd) / Math.max(1, n * 0.05)));
      set(img, x + xx, y + yy, rgb);
    }
  }
}

// ── compact 5×7 bitmap font (uppercase + digits + a little punctuation) ─────
const F = {
  A:'01110 10001 10001 11111 10001 10001 10001',B:'11110 10001 10001 11110 10001 10001 11110',
  C:'01111 10000 10000 10000 10000 10000 01111',D:'11110 10001 10001 10001 10001 10001 11110',
  E:'11111 10000 10000 11110 10000 10000 11111',F:'11111 10000 10000 11110 10000 10000 10000',
  G:'01111 10000 10000 10111 10001 10001 01111',H:'10001 10001 10001 11111 10001 10001 10001',
  I:'11111 00100 00100 00100 00100 00100 11111',J:'00111 00010 00010 00010 10010 10010 01100',
  K:'10001 10010 10100 11000 10100 10010 10001',L:'10000 10000 10000 10000 10000 10000 11111',
  M:'10001 11011 10101 10101 10001 10001 10001',N:'10001 11001 10101 10011 10001 10001 10001',
  O:'01110 10001 10001 10001 10001 10001 01110',P:'11110 10001 10001 11110 10000 10000 10000',
  Q:'01110 10001 10001 10001 10101 10010 01101',R:'11110 10001 10001 11110 10100 10010 10001',
  S:'01111 10000 10000 01110 00001 00001 11110',T:'11111 00100 00100 00100 00100 00100 00100',
  U:'10001 10001 10001 10001 10001 10001 01110',V:'10001 10001 10001 10001 10001 01010 00100',
  W:'10001 10001 10001 10101 10101 11011 10001',X:'10001 10001 01010 00100 01010 10001 10001',
  Y:'10001 10001 01010 00100 00100 00100 00100',Z:'11111 00001 00010 00100 01000 10000 11111',
  0:'01110 10011 10101 10101 11001 10001 01110',1:'00100 01100 00100 00100 00100 00100 01110',
  2:'01110 10001 00001 00110 01000 10000 11111',3:'11110 00001 00001 01110 00001 00001 11110',
  4:'00010 00110 01010 10010 11111 00010 00010',5:'11111 10000 11110 00001 00001 10001 01110',
  6:'01110 10000 10000 11110 10001 10001 01110',7:'11111 00001 00010 00100 01000 01000 01000',
  8:'01110 10001 10001 01110 10001 10001 01110',9:'01110 10001 10001 01111 00001 00001 01110',
  ' ':'00000 00000 00000 00000 00000 00000 00000','-':'00000 00000 00000 11111 00000 00000 00000',
  '.':'00000 00000 00000 00000 00000 00000 00100','/':'00001 00010 00010 00100 01000 01000 10000',
  '%':'11001 11010 00100 01000 01011 10011 00011',':':'00000 00100 00000 00000 00100 00000 00000',
};
function glyph(img, ch, x, y, s, c) {
  const rows = (F[ch] || F[' ']).split(' ');
  for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++)
    if (rows[r][col] === '1') rect(img, x + col * s, y + r * s, s, s, c);
}
function text(img, str, x, y, s, c) {
  let cx = x;
  for (const ch of str.toUpperCase()) { glyph(img, ch, cx, y, s, c); cx += 6 * s; }
  return cx;
}
function textW(str, s) { return str.length * 6 * s; }

// ── PNG encode (color type 2 = 24-bit RGB, no alpha) ────────────────────────
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encode(img) {
  const raw = Buffer.alloc(img.h * (img.w * 3 + 1));
  let p = 0;
  for (let y = 0; y < img.h; y++) {
    raw[p++] = 0;
    for (let x = 0; x < img.w; x++) { const i = (y * img.w + x) * 3; raw[p++] = img.px[i]; raw[p++] = img.px[i + 1]; raw[p++] = img.px[i + 2]; }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4); ihdr[8] = 8; ihdr[9] = 2; // RGB
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ── compositions ────────────────────────────────────────────────────────────
function metricBar(img, x, y, w, label, frac, color) {
  text(img, label, x, y, 2, MUTED);
  const by = y + 22, bw = w;
  rrect(img, x, by, bw, 14, 7, PANEL);
  rrect(img, x, by, Math.max(14, Math.round(bw * frac)), 14, 7, color);
}

function screenshot() {
  const img = makeImg(1280, 800);
  vgradient(img, BG, BG2);
  // header
  logo(img, 64, 56, 88);
  text(img, 'ANDY', 172, 64, 7, TEXT);
  text(img, 'AI PR REVIEW ASSISTANT BY DRIFT', 174, 124, 3, MUTED);
  // card
  const cx = 64, cy = 200, cw = 1152, ch = 536;
  rrect(img, cx, cy, cw, ch, 18, PANEL);
  rstroke(img, cx, cy, cw, ch, 18, STROKE, 2);
  text(img, 'ANDY READS THIS PR', cx + 48, cy + 40, 3, MUTED);
  // three gauges
  const labels = ['CORRECTNESS', 'COMPLEXITY', 'COVERAGE'];
  const fracs = [0.82, 0.64, 0.91];
  const cols = [GREEN, YELLOW, GREEN];
  for (let i = 0; i < 3; i++) {
    const gx = cx + 230 + i * 330, gy = cy + 210;
    gauge(img, gx, gy, 92, 64, fracs[i], cols[i], STROKE);
    const pct = Math.round(fracs[i] * 100) + '%';
    text(img, pct, gx - textW(pct, 4) / 2, gy - 14, 4, TEXT);
    text(img, labels[i], gx - textW(labels[i], 2) / 2, gy + 110, 2, MUTED);
  }
  // metric bars row
  const bx = cx + 48, byy = cy + 430, bw = (cw - 96 - 60) / 3;
  metricBar(img, bx, byy, bw, 'CHURN', 0.45, ACCENT);
  metricBar(img, bx + bw + 30, byy, bw, 'RISK', 0.3, GREEN);
  metricBar(img, bx + (bw + 30) * 2, byy, bw, 'DEPTH', 0.7, YELLOW);
  return img;
}

function promoSmall() {
  const img = makeImg(440, 280);
  vgradient(img, BG, BG2);
  logo(img, 170, 44, 100);
  const t = 'ANDY';
  text(img, t, (440 - textW(t, 4)) / 2, 168, 4, TEXT);
  const s = 'AI PR REVIEW ASSISTANT';
  text(img, s, (440 - textW(s, 2)) / 2, 214, 2, MUTED);
  return img;
}

function promoMarquee() {
  const img = makeImg(1400, 560);
  vgradient(img, BG, BG2);
  rect(img, 0, 556, 1400, 4, ACCENT);
  logo(img, 150, 170, 220);
  text(img, 'ANDY', 470, 178, 9, TEXT);
  text(img, 'CHAT WITH ANDY ABOUT ANY PR', 474, 268, 3, ACCENT_HI);
  text(img, 'AI PR REVIEW ASSISTANT BY DRIFT  -  NO SIGN UP', 474, 318, 2, MUTED);
  return img;
}

mkdirSync(OUT, { recursive: true });
const assets = {
  'screenshot-1280x800.png': screenshot(),
  'promo-small-440x280.png': promoSmall(),
  'promo-marquee-1400x560.png': promoMarquee(),
};
for (const [name, img] of Object.entries(assets)) writeFileSync(resolve(OUT, name), encode(img));
console.log(`store assets → ${OUT}\n  ${Object.keys(assets).join('\n  ')}`);
