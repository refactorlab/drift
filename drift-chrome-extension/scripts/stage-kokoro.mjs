#!/usr/bin/env node
// Stage the Kokoro-82M voice MODEL into public/ so it ships INSIDE the extension
// (no runtime Hugging Face download) — the same "bundled, offline-capable"
// contract as the scanner wasm (build-wasm.sh) and the ort engine (stage-ort.mjs).
//
// What it stages under public/models/onnx-community/Kokoro-82M-v1.0-ONNX/:
//   config.json, tokenizer.json, tokenizer_config.json   ← tiny model config
//   onnx/model_quantized.onnx                            ← q8 acoustic model (~92 MB)
//   voices/<name>.bin                                    ← the 28 catalog voices (~522 KB each)
//
// At runtime kokoroRuntime.ts points @huggingface/transformers at this dir
// (`env.localModelPath`) and pre-seeds the voice CacheStorage from these files,
// so synthesis is fully on-device with nothing fetched from the network.
//
// Idempotent: existing, correctly-sized files are skipped. Re-run after a model
// bump. Writes public/kokoro.meta.json { version, bytes } for the Settings UI.
//
//   node scripts/stage-kokoro.mjs

import { createWriteStream, existsSync, mkdirSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const REPO = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const REVISION = 'main';
const VERSION = 'Kokoro-82M-v1.0';

// The English catalog the extension exposes (= KOKORO_VOICE_SID in ttsProvider.ts).
const VOICES = [
  'af_alloy', 'af_aoede', 'af_bella', 'af_heart', 'af_jessica', 'af_kore',
  'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky', 'am_adam',
  'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael', 'am_onyx',
  'am_puck', 'am_santa', 'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily',
  'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis',
];

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const modelRoot = resolve(root, 'public/models', REPO);

const files = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/model_quantized.onnx',
  ...VOICES.map((v) => `voices/${v}.bin`),
];

const hubUrl = (p) => `https://huggingface.co/${REPO}/resolve/${REVISION}/${p}`;

async function download(relPath) {
  const dest = join(modelRoot, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest) && statSync(dest).size > 0) return statSync(dest).size; // idempotent skip

  const res = await fetch(hubUrl(relPath));
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${relPath}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return statSync(dest).size;
}

console.log(`→ staging Kokoro model ${VERSION} (${files.length} files) → public/models/${REPO}/`);

let total = 0;
let done = 0;
for (const f of files) {
  const bytes = await download(f);
  total += bytes;
  done += 1;
  if (f.endsWith('.onnx') || done === files.length || done % 10 === 0) {
    process.stdout.write(`  ${done}/${files.length} (${(total / 1024 / 1024).toFixed(0)} MB)\n`);
  }
}

// Recompute the true on-disk total (covers skipped files too).
function dirSize(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    n += e.isDirectory() ? dirSize(p) : statSync(p).size;
  }
  return n;
}
const staged = dirSize(modelRoot);
writeFileSync(resolve(root, 'public/kokoro.meta.json'), `${JSON.stringify({ version: VERSION, bytes: staged }, null, 2)}\n`);
console.log(`✓ staged ${(staged / 1024 / 1024).toFixed(0)} MB → public/models/${REPO}/  (+ public/kokoro.meta.json)`);
