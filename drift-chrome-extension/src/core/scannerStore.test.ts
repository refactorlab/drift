import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock } from '../test/chromeMock';
import { ensureScanner, loadScannerModule, META_FILE, WASM_FILE } from './scannerStore';
import { downloadScanner } from './scannerDownload';
import { getSettings, patchSettings, type ScannerMeta } from '../state/settings';

// Minimal in-memory CacheStorage so downloadScanner can persist + loadScanner-
// Module can read back the downloaded wasm without a browser.
function installCachesMock(): Map<string, Response> {
  const store = new Map<string, Response>();
  const cache = {
    async put(req: RequestInfo | URL, res: Response) {
      store.set(String(req), res);
    },
    async match(req: RequestInfo | URL) {
      const r = store.get(String(req));
      return r ? r.clone() : undefined;
    },
    async delete(req: RequestInfo | URL) {
      return store.delete(String(req));
    },
  };
  (globalThis as unknown as { caches: unknown }).caches = {
    open: async () => cache,
    delete: async () => true,
  };
  return store;
}

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

// Bad magic bytes — valid 200 response, wrong content (not a wasm module).
const BAD_MAGIC = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]);

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

describe('scannerStore.ensureScanner — first-install race condition (bundled)', () => {
  beforeEach(() => {
    installChromeMock();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries and succeeds when the first two fetches return non-WASM (Chrome race)', async () => {
    let wasmHits = 0;
    globalThis.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.endsWith(META_FILE))
        return new Response(JSON.stringify({ version: '0.8.0', bytes: TINY_WASM.length }), { status: 200 });
      if (url.endsWith(WASM_FILE)) {
        wasmHits++;
        // First two calls simulate file not yet extracted; third has valid WASM.
        return new Response(wasmHits < 3 ? BAD_MAGIC : TINY_WASM, { status: 200 });
      }
      return new Response('nope', { status: 404 });
    }) as typeof fetch;

    const promise = ensureScanner();
    await vi.runAllTimersAsync();
    const r = await promise;

    expect(r.status).toBe('acquired');
    expect(wasmHits).toBe(3);
  });

  it('throws after exhausting all 3 retries if the file is always invalid', async () => {
    globalThis.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.endsWith(META_FILE))
        return new Response(JSON.stringify({ version: '0.8.0', bytes: 8 }), { status: 200 });
      if (url.endsWith(WASM_FILE))
        return new Response(BAD_MAGIC, { status: 200 });
      return new Response('nope', { status: 404 });
    }) as typeof fetch;

    const promise = ensureScanner();
    // Attach the rejection handler BEFORE draining timers so the rejection is
    // never unhandled while timers run.
    const rejection = expect(promise).rejects.toThrow('scanner file is not a valid wasm module');
    await vi.runAllTimersAsync();
    await rejection;

    const wasmCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.endsWith(WASM_FILE));
    expect(wasmCalls.length).toBe(3); // tried all 3 attempts
  });

  it('does NOT retry for a remote scanner URL — bad server response is not transient', async () => {
    vi.useRealTimers(); // no fake timers needed; we expect a single attempt
    let wasmHits = 0;
    globalThis.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.endsWith(META_FILE))
        return new Response(JSON.stringify({ version: '0.8.0', bytes: 8 }), { status: 200 });
      if (url.endsWith(WASM_FILE)) {
        wasmHits++;
        return new Response(BAD_MAGIC, { status: 200 });
      }
      return new Response('nope', { status: 404 });
    }) as typeof fetch;
    await patchSettings({ scannerUrl: 'https://cdn.example.com/scanner' });

    await expect(ensureScanner()).rejects.toThrow('scanner file is not a valid wasm module');
    expect(wasmHits).toBe(1); // no retry for remote
  });
});

describe('scannerStore.downloadScanner — explicit release download (override)', () => {
  let cacheStore: Map<string, Response>;
  beforeEach(() => {
    installChromeMock();
    cacheStore = installCachesMock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the wasm from the release, caches it, and records source:remote', async () => {
    stubFetch('0.9.0');
    const phases: string[] = [];

    const r = await downloadScanner((p) => phases.push(p.phase));

    expect(r.status).toBe('acquired');
    expect(r.meta).toMatchObject({ version: '0.9.0', source: 'remote', bytes: TINY_WASM.length });
    // persisted to settings + CacheStorage
    expect((await getSettings()).scanner?.source).toBe('remote');
    expect(cacheStore.size).toBe(1);
    expect(phases.at(-1)).toMatch(/ready/i);
  });

  it('short-circuits to ready when the same version is already cached', async () => {
    stubFetch('0.9.0');
    await downloadScanner();
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockClear();

    const r = await downloadScanner();
    expect(r.status).toBe('ready');
    // only the meta probe ran — the 22 MB wasm was NOT re-downloaded
    const wasmCalls = fetchSpy.mock.calls.map((c) => String(c[0])).filter((u) => u.endsWith(WASM_FILE));
    expect(wasmCalls.length).toBe(0);
  });

  it('rejects a release file that is not valid wasm (and caches nothing)', async () => {
    globalThis.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.endsWith(META_FILE)) return new Response(JSON.stringify({ version: '0.9.0' }), { status: 200 });
      if (url.endsWith(WASM_FILE)) return new Response(BAD_MAGIC, { status: 200 });
      return new Response('nope', { status: 404 });
    }) as typeof fetch;

    await expect(downloadScanner()).rejects.toThrow('scanner file is not a valid wasm module');
    expect(cacheStore.size).toBe(0);
    expect((await getSettings()).scanner).toBeUndefined();
  });
});

describe('scannerStore.loadScannerModule — source preference', () => {
  beforeEach(() => {
    installChromeMock();
    installCachesMock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('compiles the cached download when a remote scanner is recorded', async () => {
    stubFetch('0.9.0');
    await downloadScanner(); // populates cache + records source:remote

    // bundled fetch would 404 here; if loadScannerModule used it, this throws.
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 404 })) as typeof fetch;

    const mod = await loadScannerModule();
    expect(mod).toBeInstanceOf(WebAssembly.Module);
  });

  it('compiles the bundled build when no remote download is recorded', async () => {
    // No settings.scanner → bundled branch; serve the wasm from the bundled URL.
    globalThis.fetch = vi.fn(async (input: unknown) =>
      String(input).endsWith(WASM_FILE)
        ? new Response(TINY_WASM, { status: 200 })
        : new Response('nope', { status: 404 }),
    ) as typeof fetch;

    const mod = await loadScannerModule();
    expect(mod).toBeInstanceOf(WebAssembly.Module);
  });
});
