// Versioned acquisition of the WASM scanner dependency (the static drift
// profiler compiled to wasm32-wasip1). This is the "download the needed
// dependencies of the static profiler, latest, recorded in settings" flow.
//
// First install        → no recorded version  → acquire (download + verify) → 'acquired'
// Returning, same ver  → recorded == target   → no work                     → 'ready'
// Version bumped        → recorded != target   → re-acquire                  → 'updated'
//
// Source is pluggable: by default the scanner is the packaged build (its
// version comes from the bundled `drift-scanner.meta.json`). If `settings
// .scannerUrl` is set, the meta + wasm are fetched from there instead — the
// hook for tracking the latest published build. Either way the resolved version
// is recorded in settings so the UI can show it and skip redundant work.

import { getSettings, patchSettings, type ScannerMeta } from '../state/settings';

export const WASM_FILE = 'drift-static-profiler.wasm';
export const META_FILE = 'drift-scanner.meta.json';

// CacheStorage where an explicitly-downloaded (remote) scanner is persisted, so
// it survives reloads and never re-downloads (the data-not-code counterpart of
// how the Kokoro model is cached). The key is a synthetic, stable request URL —
// CacheStorage keys by request URL; the value is the wasm Response.
export const SCANNER_CACHE = 'drift-scanner-cache-v1';
export const CACHED_WASM_KEY = 'https://drift-scanner.local/drift-static-profiler.wasm';

export type AcquireProgress = { phase: string; fraction: number | null };
export type AcquireStatus = 'ready' | 'acquired' | 'updated';
export type AcquireResult = { status: AcquireStatus; meta: ScannerMeta };

type SourceMeta = { version: string; source: 'bundled' | 'remote'; wasmUrl: string; metaBytes?: number };

/** Parse a leading `MAJOR.MINOR.PATCH` into a tuple, or null if it isn't clean
 *  numeric semver (e.g. the generic 'bundled'/'remote' fallback tags). */
function parseSemver(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True ONLY when both versions are clean semver and `a` is strictly older than
 *  `b`. Anything unparseable → false: we never downgrade a scanner on a guess. */
export function isOlderVersion(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i];
  return false;
}

/** The version of the wasm shipped INSIDE this extension build (from the bundled
 *  meta). Used to detect a stale remote scanner that's older than what we ship. */
async function readBundledMetaVersion(): Promise<string | undefined> {
  try {
    const res = await fetch(chrome.runtime.getURL(META_FILE));
    if (!res.ok) return undefined;
    const j = (await res.json()) as { version?: string };
    return j.version;
  } catch {
    return undefined;
  }
}

/** Resolve where the scanner comes from + its advertised version. */
async function resolveSource(scannerUrl?: string): Promise<SourceMeta> {
  if (scannerUrl) {
    const base = scannerUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/${META_FILE}`, { credentials: 'omit' });
    if (!res.ok) throw new Error(`scanner meta fetch failed: HTTP ${res.status}`);
    const j = (await res.json()) as { version?: string; bytes?: number };
    return { version: j.version ?? 'remote', source: 'remote', wasmUrl: `${base}/${WASM_FILE}`, metaBytes: j.bytes };
  }
  // Packaged build: read the meta emitted by build-wasm.sh, fall back to a
  // generic tag if it isn't present (older builds).
  const metaUrl = chrome.runtime.getURL(META_FILE);
  let version = 'bundled';
  let metaBytes: number | undefined;
  try {
    const res = await fetch(metaUrl);
    if (res.ok) {
      const j = (await res.json()) as { version?: string; bytes?: number };
      version = j.version ?? version;
      metaBytes = j.bytes;
    }
  } catch {
    /* no meta file → 'bundled' */
  }
  return { version, source: 'bundled', wasmUrl: chrome.runtime.getURL(WASM_FILE), metaBytes };
}

/**
 * Make sure the recorded scanner matches the target source, acquiring it if
 * not. Idempotent + cheap on the common path (just a settings read + a small
 * meta fetch when nothing changed).
 */
export async function ensureScanner(onProgress?: (p: AcquireProgress) => void): Promise<AcquireResult> {
  const log = onProgress ?? (() => {});
  log({ phase: 'Checking scanner…', fraction: null });

  const settings = await getSettings();
  const have = settings.scanner ?? null;

  // A downloaded (remote, cached) scanner is authoritative: the bundled launch
  // check must NOT silently downgrade it — UNLESS it's older than what we now
  // ship (a stale build from the old "resolve newest release" bug), which
  // isRemoteScannerStale drops so we fall through and re-acquire the bundled one.
  // Re-acquiring a NEWER remote is the explicit "Download latest" action.
  if (have?.source === 'remote' && !(await isRemoteScannerStale(have.version))) {
    log({ phase: `Scanner ready · v${have.version}`, fraction: 1 });
    return { status: 'ready', meta: have };
  }

  const src = await resolveSource(settings.scannerUrl);

  if (have && have.version === src.version && have.source === src.source) {
    log({ phase: `Scanner ready · v${have.version}`, fraction: 1 });
    return { status: 'ready', meta: have };
  }

  log({ phase: have ? `Updating scanner → v${src.version}…` : `Acquiring scanner v${src.version}…`, fraction: null });

  // SUPER-FAST onboarding: verify the wasm exists + has the wasm magic header
  // WITHOUT downloading the whole 22MB or compiling it. The expensive compile
  // is deferred to the first scan (loadScannerModule, memoized + pre-warmable).
  //
  // Retry up to 3× for bundled source: on a fresh Chrome install the CRX is
  // extracted asynchronously, and the side panel can open before the 22 MB wasm
  // is fully written to disk. The fetch returns 200 but the body is empty/
  // truncated. Remote URLs don't benefit from retrying — a server returning
  // non-WASM content won't fix itself on the next request.
  const fetchOpts = src.source === 'remote' ? { credentials: 'omit' as const } : undefined;
  const maxAttempts = src.source === 'bundled' ? 3 : 1;
  let valid = false;
  for (let attempt = 0; attempt < maxAttempts && !valid; attempt++) {
    if (attempt > 0) await new Promise<void>((r) => setTimeout(r, 300 * attempt));
    const res = await fetch(src.wasmUrl, fetchOpts);
    if (!res.ok) throw new Error(`scanner download failed: HTTP ${res.status}`);
    valid = await hasWasmMagic(res);
  }
  if (!valid) throw new Error('scanner file is not a valid wasm module');

  const meta: ScannerMeta = {
    version: src.version,
    bytes: src.metaBytes ?? 0,
    source: src.source,
    acquiredAt: Date.now(),
  };
  await patchSettings({ scanner: meta });
  log({ phase: `Scanner ready · v${meta.version}`, fraction: 1 });
  return { status: have ? 'updated' : 'acquired', meta };
}

/** Read just the first chunk and check the `\0asm` magic — cheap existence +
 *  format probe that avoids pulling the full multi-MB body. */
async function hasWasmMagic(res: Response): Promise<boolean> {
  const reader = res.body?.getReader?.();
  const head = reader
    ? await reader.read().then((r) => { void reader.cancel(); return r.value; })
    : new Uint8Array(await res.arrayBuffer());
  return !!head && head.length >= 4 && head[0] === 0x00 && head[1] === 0x61 && head[2] === 0x73 && head[3] === 0x6d;
}

// ── Cached scanner read (shared with the dev/sideload download module) ───────
//
// The bytes are PUT into this cache only by scannerDownload.ts (the dev/sideload
// override, excluded from the store build). The store build never populates the
// cache, so loadScannerModule's cache branch is inert there and it always
// compiles the bundled wasm. Reading CacheStorage is not remote code — only the
// fetch+commit in scannerDownload.ts is, which is why that lives elsewhere.

export async function openScannerCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null; // no CacheStorage in this context
  return caches.open(SCANNER_CACHE);
}

/** Read the cached downloaded wasm, if one was previously stored. */
export async function loadCachedWasm(): Promise<Response | undefined> {
  const cache = await openScannerCache();
  return cache ? cache.match(CACHED_WASM_KEY) : undefined;
}

// Compiled-module cache so a pre-warm carries through to the scan provider and
// re-runs never recompile. Keyed by source ('cache:remote' or the bundled URL).
const moduleCache = new Map<string, Promise<WebAssembly.Module>>();

/** Drop the memoized compiled module for a downloaded scanner so the next load
 *  recompiles from freshly-cached bytes. Called by scannerDownload after a
 *  successful download. */
export function invalidateRemoteModule(): void {
  moduleCache.delete('cache:remote');
}

/**
 * Compile the scanner module for execution, memoized. Prefers an explicitly
 * downloaded (cached, source:'remote') scanner; otherwise compiles the bundled
 * build (streaming when possible). The store build always takes the bundled
 * branch since nothing records a remote download.
 */
export async function loadScannerModule(): Promise<WebAssembly.Module> {
  const settings = await getSettings();

  if (settings.scanner?.source === 'remote' && !(await isRemoteScannerStale(settings.scanner.version))) {
    const cached = await loadCachedWasm();
    if (cached) {
      let p = moduleCache.get('cache:remote');
      if (!p) {
        p = cached.arrayBuffer().then((buf) => WebAssembly.compile(buf));
        p.catch(() => moduleCache.delete('cache:remote'));
        moduleCache.set('cache:remote', p);
      }
      return p;
    }
    // Recorded as remote but the cache is gone (cleared) → fall through to the
    // bundled build so a scan still works.
  }

  const url = chrome.runtime.getURL(WASM_FILE);
  let p = moduleCache.get(url);
  if (!p) {
    p = (async () => {
      try {
        return await WebAssembly.compileStreaming(fetch(url));
      } catch {
        return WebAssembly.compile(await (await fetch(url)).arrayBuffer());
      }
    })();
    p.catch(() => moduleCache.delete(url)); // let a failed compile retry later
    moduleCache.set(url, p);
  }
  return p;
}

/**
 * A downloaded (remote) scanner is only ever meant to be NEWER than the build's
 * bundled wasm — it's the "run the latest" override. But a remote build cached by
 * the old buggy "resolve newest release" logic can be OLDER, and because the
 * cache survives every extension reload it stays pinned as authoritative — older
 * builds reject flags this extension passes (clap exit 2) on every scan, and a
 * rebuild never clears it. So when the recorded remote version is strictly older
 * than what we now ship, treat it as stale: drop the record + compiled module so
 * this and future scans use the known-good bundled build. Self-healing, no user
 * action needed. Returns true when the remote was stale (caller skips it).
 */
async function isRemoteScannerStale(remoteVersion: string): Promise<boolean> {
  const bundled = await readBundledMetaVersion();
  if (!bundled || !isOlderVersion(remoteVersion, bundled)) return false;
  moduleCache.delete('cache:remote');
  // Clear the stale record so ensureScanner re-acquires the bundled build and the
  // Settings UI stops showing the outdated remote version. Fire-and-forget.
  void patchSettings({ scanner: undefined }).catch(() => {});
  return true;
}

/** Kick off the compile in the background (non-blocking) so the first scan is
 *  instant. Failures are swallowed — the scan will surface them if it matters. */
export function prewarmScanner(): void {
  void loadScannerModule().catch(() => {});
}
