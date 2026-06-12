#!/usr/bin/env node
// Dev-only watcher for the live-voice control plane.
//
// `make dev` runs this ALONGSIDE the Vite/CRXJS dev server. It watches the
// volley-core Rust source (crates/volley-core/src/*.rs) and, on save, re-runs
// scripts/build-voice-wasm.sh — which regenerates src/vendor/volley/* (the
// wasm-bindgen module voiceAudio.ts imports). Vite sees those vendored files
// change and HMR-reloads the side panel, so editing the turn-taking FSM in Rust
// feels as live as editing the TS.
//
// Design notes (why it's shaped like this):
//   • Zero deps — Node's built-in fs.watch, matching the repo's plain-script idiom
//     (stage-ort.mjs, tail-logs.mjs). No cargo-watch / chokidar / concurrently.
//   • NEVER kills dev. A mid-edit Rust file won't compile; a missing wasm-pack
//     just warns. Either way we log and wait for the next save — the dev server
//     keeps running. (Same warn-and-continue contract as the Makefile's ensure-*.)
//   • Debounced + coalesced. Editors emit several fs events per save and a wasm
//     build takes a few seconds, so we debounce bursts and never run two builds
//     at once (a save during a build queues exactly one follow-up).
//   • No build on startup. The committed src/vendor/volley/* is already current;
//     `make dev`'s ensure-voice-wasm covers the missing case. We only react to edits,
//     keeping dev startup fast.

import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'crates', 'volley-core', 'src');
const BUILD = join(HERE, 'build-voice-wasm.sh');

const C = {
  dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m',
  yellow: '\x1b[33m', reset: '\x1b[0m',
};
const tag = `${C.cyan}[voice-wasm]${C.reset}`;
const log = (m) => console.log(`${tag} ${m}`);

let building = false;
let queued = false;
let timer = null;

function build() {
  if (building) { queued = true; return; }
  building = true;
  log('rebuilding volley-core wasm…');
  const t0 = Date.now();
  const child = spawn('bash', [BUILD], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  child.on('error', (e) => {
    building = false;
    log(`${C.yellow}⚠ cannot run build-voice-wasm.sh${C.reset}: ${e.message} — voice wasm won't auto-rebuild`);
  });
  child.on('close', (code) => {
    building = false;
    if (code === 0) {
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      log(`${C.green}✓${C.reset} rebuilt in ${secs}s → src/vendor/volley/ ${C.dim}(HMR reloads)${C.reset}`);
    } else {
      log(`${C.yellow}⚠ build failed${C.reset} (exit ${code}) — fix the Rust and save again:`);
      // Surface only the tail; a full cargo error wall drowns the dev log.
      const tail = err.trimEnd().split('\n').slice(-12).join('\n');
      if (tail) process.stderr.write(`${tail}\n`);
    }
    if (queued) { queued = false; schedule(); }
  });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(build, 150); // coalesce an editor's multi-event save burst
}

log(`watching ${C.dim}crates/volley-core/src${C.reset} — edit the Rust and save to hot-reload the voice FSM`);
try {
  watch(SRC, { recursive: true }, (_event, file) => {
    if (file && file.endsWith('.rs')) {
      log(`changed: ${C.dim}${file}${C.reset}`);
      schedule();
    }
  });
} catch (e) {
  // fs.watch can throw (e.g. crate dir absent, recursive unsupported on old Node).
  // Don't take dev down with us — just disable the auto-rebuild.
  log(`${C.yellow}⚠ watch unavailable${C.reset}: ${e.message} — run ${C.cyan}make voice-wasm${C.reset} manually after editing the Rust`);
  process.exit(0);
}
