// Release preflight gate. Verifies that the PACKAGED tree (dist/, what gets
// zipped to the Chrome Web Store) actually contains the runtime dependencies
// the extension needs — so we can never again publish a build that's missing
// them. Run by `npm run zip` (before packaging) and by CI.
//
// Two tiers, matching the runtime contract:
//   REQUIRED  drift-static-profiler.wasm (+ drift-scanner.meta.json)
//             The live scan is dead without it → a missing/invalid wasm is a
//             HARD failure that blocks the package.
//   OPTIONAL  kokoro/ (the in-tab TTS engine)
//             Large; the spoken summary fails SOFT to the browser's system
//             voice when it's absent (see SpokenSummary.tsx). So a missing
//             engine is a WARNING, not a failure — we ship the small scanner
//             and serve/voice TTS on demand.
//
// Output uses GitHub Actions `::error::`/`::warning::` annotations so failures
// surface inline in the workflow log; exit code is non-zero on any required
// failure. Pure Node, no deps — also runnable by hand: `node scripts/verify-assets.mjs [dir]`.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, process.argv[2] ?? 'dist');

// A valid WebAssembly module begins with the magic `\0asm` + version 1.
const WASM_MAGIC = Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00);
// The real scanner is ~22 MB; anything tiny is a truncated/placeholder file.
const MIN_WASM_BYTES = 1_000_000;

const errors = [];
const warnings = [];
const ok = [];

const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const pass = (m) => ok.push(m);

/** Validate a bundled .wasm: present, real magic header, above the size floor. */
function checkWasm(rel, { minBytes }) {
  const path = join(dir, rel);
  if (!existsSync(path)) {
    err(`${rel} is missing from the package — run \`npm run build:wasm\` before packaging.`);
    return null;
  }
  const buf = readFileSync(path);
  const headOk = buf.length >= 8 && WASM_MAGIC.every((b, i) => buf[i] === b);
  if (!headOk) {
    err(`${rel} is not a valid WebAssembly module (bad magic header) — the build is corrupt.`);
    return null;
  }
  if (buf.length < minBytes) {
    err(`${rel} is suspiciously small (${buf.length} bytes < ${minBytes}) — likely a truncated/placeholder build.`);
    return null;
  }
  pass(`${rel} — valid wasm, ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
  return buf.length;
}

/** Validate a `{version,bytes}` meta sidecar agrees with the file it describes. */
function checkMeta(rel, actualBytes) {
  const path = join(dir, rel);
  if (!existsSync(path)) {
    err(`${rel} is missing — the extension records the scanner version from it.`);
    return;
  }
  let meta;
  try {
    meta = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(`${rel} is not valid JSON (${e instanceof Error ? e.message : e}).`);
    return;
  }
  if (!meta.version || typeof meta.version !== 'string') {
    err(`${rel} has no \`version\` string.`);
  }
  if (actualBytes != null && typeof meta.bytes === 'number' && meta.bytes !== actualBytes) {
    err(`${rel} \`bytes\`=${meta.bytes} disagrees with the actual wasm size ${actualBytes} — stale meta.`);
  }
  if (meta.version) pass(`${rel} — v${meta.version}`);
}

console.log(`🔎 verifying packaged assets in ${dir}`);
if (!existsSync(dir)) {
  err(`package dir not found: ${dir} — run \`npm run build\` first.`);
} else {
  // ── REQUIRED: the static-profiler scanner ────────────────────────────────
  const wasmBytes = checkWasm('drift-static-profiler.wasm', { minBytes: MIN_WASM_BYTES });
  checkMeta('drift-scanner.meta.json', wasmBytes);

  // ── OPTIONAL: the Kokoro TTS engine (fails soft to the system voice) ──────
  if (existsSync(join(dir, 'kokoro', 'sherpa-onnx-wasm-main-tts.js'))) {
    pass('kokoro/ — in-tab TTS engine bundled');
    if (!existsSync(join(dir, 'kokoro', 'kokoro.meta.json'))) {
      warn('kokoro/kokoro.meta.json missing — the engine version won’t be recorded.');
    }
  } else {
    warn('kokoro/ TTS engine not bundled — the spoken summary will use the browser’s system voice (this is fine).');
  }
}

for (const m of ok) console.log(`  ✓ ${m}`);
for (const m of warnings) console.log(`::warning::${m}`);
for (const m of errors) console.log(`::error::${m}`);

if (errors.length) {
  console.error(`\n✗ asset verification failed: ${errors.length} problem(s). Package NOT shippable.`);
  process.exit(1);
}
console.log(`\n✓ assets verified — package is shippable${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
