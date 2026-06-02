import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import { ensureScanner, META_FILE, WASM_FILE } from './scannerStore';
import { getSettings, patchSettings, type ScannerMeta } from '../state/settings';

// A minimal valid wasm module (magic + version) — enough for WebAssembly.compile
// to accept it, so we can exercise the acquire/verify path without the 22MB build.
const TINY_WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

function stubFetch(version: string) {
  globalThis.fetch = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.endsWith(META_FILE)) {
      return new Response(JSON.stringify({ version, bytes: TINY_WASM.length }), { status: 200 });
    }
    if (url.endsWith(WASM_FILE)) {
      return new Response(TINY_WASM, { status: 200 });
    }
    return new Response('nope', { status: 404 });
  }) as typeof fetch;
}

describe('scannerStore.ensureScanner — versioned acquisition', () => {
  beforeEach(() => {
    installChromeMock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('first install (no recorded version) → acquires + records it', async () => {
    stubFetch('0.8.0');
    expect((await getSettings()).scanner).toBeUndefined();

    const r = await ensureScanner();
    expect(r.status).toBe('acquired');
    expect(r.meta).toMatchObject({ version: '0.8.0', source: 'bundled', bytes: TINY_WASM.length });

    const saved = (await getSettings()).scanner;
    expect(saved?.version).toBe('0.8.0');
  });

  it('same version already recorded → ready, no re-download', async () => {
    stubFetch('0.8.0');
    const meta: ScannerMeta = { version: '0.8.0', bytes: 8, source: 'bundled', acquiredAt: 1 };
    await patchSettings({ scanner: meta });

    const r = await ensureScanner();
    expect(r.status).toBe('ready');
    // meta unchanged (acquiredAt preserved → no re-acquire happened)
    expect((await getSettings()).scanner?.acquiredAt).toBe(1);
    // only the meta.json was fetched (the check), never the wasm
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.endsWith(WASM_FILE))).toBe(false);
  });

  it('bundled version bumped → re-acquires as an update', async () => {
    stubFetch('0.9.0'); // packaged build advanced
    await patchSettings({ scanner: { version: '0.8.0', bytes: 8, source: 'bundled', acquiredAt: 1 } });

    const r = await ensureScanner();
    expect(r.status).toBe('updated');
    expect(r.meta.version).toBe('0.9.0');
    expect((await getSettings()).scanner?.version).toBe('0.9.0');
  });

  it('reports progress phases through acquisition', async () => {
    stubFetch('0.8.0');
    const phases: string[] = [];
    await ensureScanner((p) => phases.push(p.phase));
    expect(phases[0]).toMatch(/Checking/);
    expect(phases.some((p) => /Acquiring|Updating/.test(p))).toBe(true);
    expect(phases.at(-1)).toMatch(/ready/i);
  });
});
