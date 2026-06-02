#!/usr/bin/env node
// Stage onnxruntime-web's WASM binaries into public/ort/ so the in-tab Kokoro
// engine (kokoro-js → @huggingface/transformers → onnxruntime-web) loads them
// from the EXTENSION ORIGIN rather than a CDN. MV3's content-security-policy
// (`script-src 'self' 'wasm-unsafe-eval'`) forbids executing remote script, so
// the ort runtime + its .wasm must be served by the extension itself; we point
// transformers' `env.backends.onnx.wasm.wasmPaths` at chrome.runtime.getURL('ort/').
//
// Only the ENGINE is bundled here (a few MB of .wasm). The Kokoro *model* (~86 MB
// q8) is non-code data and is fetched from the Hugging Face Hub on first use and
// cached by the browser — the same "download the dependency on demand" shape the
// scanner uses. This script is idempotent and runs as part of dev/build.
//
//   node scripts/stage-ort.mjs

import { cpSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDir = resolve(root, 'node_modules/onnxruntime-web/dist');
const destDir = resolve(root, 'public/ort');

if (!existsSync(srcDir)) {
  console.error(`✗ onnxruntime-web not found at ${srcDir} — run npm install first.`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });

// The ort runtime resolves its threaded/JSEP siblings (.wasm + worker .mjs) from
// wasmPaths at runtime. Copy every `ort-wasm-*` artifact so whichever variant
// onnxruntime picks (jsep vs plain, threaded worker) is present beside it.
const wanted = readdirSync(srcDir).filter((f) => /^ort-wasm-.*\.(wasm|mjs)$/.test(f));
if (wanted.length === 0) {
  console.error('✗ no ort-wasm-* artifacts found — onnxruntime-web layout changed?');
  process.exit(1);
}

let bytes = 0;
for (const f of wanted) {
  cpSync(join(srcDir, f), join(destDir, f));
  bytes += statSync(join(srcDir, f)).size;
}
console.log(`→ staged ${wanted.length} ort runtime files (${(bytes / 1024 / 1024).toFixed(0)} MB) → public/ort/`);
