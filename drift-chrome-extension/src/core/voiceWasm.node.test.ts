// Validates that the voice FSM rides inside the SINGLE drift wasm and is driven
// through the C-ABI exports WITHOUT running `_start` — the exact instantiation
// path VadEngine.create() uses (real @bjorn3/browser_wasi_shim, call ctors, then
// our vad_*/vp_* exports). Guards the single-wasm contract end to end.
//
// Node-only: it reads the built public/drift-static-profiler.wasm. Skipped
// automatically if the wasm hasn't been built yet (CI builds it before tests).

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WASI } from '@bjorn3/browser_wasi_shim';

const WASM_PATH = resolve(__dirname, '../../public/drift-static-profiler.wasm');

interface Ex {
  memory: WebAssembly.Memory;
  __wasm_call_ctors: () => void;
  vp_alloc_f32: (n: number) => number;
  vp_free_f32: (p: number, n: number) => void;
  vad_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  vad_free: (h: number) => void;
  vad_push_mic: (h: number, p: number, n: number) => number;
  vad_state_code: (h: number) => number;
  vad_resample: (ip: number, n: number, ir: number, or_: number, olp: number) => number;
}

const hasWasm = existsSync(WASM_PATH);

describe.skipIf(!hasWasm)('voice FSM in the single drift wasm (no _start)', () => {
  async function instantiate(): Promise<Ex> {
    const mod = await WebAssembly.compile(readFileSync(WASM_PATH));
    const wasi = new WASI([], [], []);
    const inst = await WebAssembly.instantiate(mod, { wasi_snapshot_preview1: wasi.wasiImport });
    const ex = inst.exports as unknown as Ex;
    ex.__wasm_call_ctors();
    return ex;
  }

  it('drives an utterance from onset to commit', async () => {
    const ex = await instantiate();
    const h = ex.vad_new(0.025, 4, 5, 30, 5, 0.6, 0.0);
    const N = 480;
    const ptr = ex.vp_alloc_f32(N);
    const fill = (lvl: number) => new Float32Array(ex.memory.buffer, ptr, N).fill(lvl);

    fill(0.2);
    expect(ex.vad_push_mic(h, ptr, N)).toBe(1); // USER_STARTED
    for (let i = 0; i < 10; i++) {
      fill(0.2);
      ex.vad_push_mic(h, ptr, N);
    }
    fill(0.0);
    let commit = 0;
    for (let i = 0; i < 60; i++) {
      if (ex.vad_push_mic(h, ptr, N) === 2) {
        commit = 1;
        break;
      }
    }
    expect(commit).toBe(1); // COMMIT
    expect(ex.vad_state_code(h)).toBe(1); // Thinking
    ex.vp_free_f32(ptr, N);
    ex.vad_free(h);
  });

  it('resamples through linear memory (24k → 16k length scaling)', async () => {
    const ex = await instantiate();
    const n = 4;
    const inPtr = ex.vp_alloc_f32(n);
    new Float32Array(ex.memory.buffer, inPtr, n).set([0, 1, 2, 3]);
    const outLenPtr = ex.vp_alloc_f32(1);
    const outPtr = ex.vad_resample(inPtr, n, 2, 1, outLenPtr); // 2:1 downsample → 2 samples
    const outLen = new Uint32Array(ex.memory.buffer, outLenPtr, 1)[0];
    const out = Array.from(new Float32Array(ex.memory.buffer, outPtr, outLen));
    expect(outLen).toBe(2);
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(2, 5);
    ex.vp_free_f32(outPtr, outLen);
    ex.vp_free_f32(outLenPtr, 1);
    ex.vp_free_f32(inPtr, n);
  });
});
