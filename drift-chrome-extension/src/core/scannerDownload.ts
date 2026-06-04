// ── Remote scanner download (DEV / SIDELOAD ONLY — never in the store build) ──
//
// This module fetches the prebuilt scanner wasm from a GitHub release and
// persists it in CacheStorage, so a device can run the latest scanner without
// waiting for a Web Store update. It is the ONE place that fetches + commits
// remote WebAssembly, which is exactly the pattern Chrome Web Store MV3 review
// rejects (remotely-hosted code). It is therefore kept in a SEPARATE module and
// referenced only behind the static `__DRIFT_STORE_BUILD__` flag: the store
// build (flag === true) dead-code-eliminates every reference, so this module
// never enters the shipping bundle. scripts/verify-store-build.mjs asserts that.
//
// The bundled-wasm path (scannerStore.ts: ensureScanner / loadScannerModule)
// is the store default and does NOT live here.

import { SCANNER_RELEASES_API, SCANNER_RELEASE_DOWNLOAD, SCANNER_TAG_PREFIX } from '../config';
import { getSettings, patchSettings, type ScannerMeta } from '../state/settings';
import {
  CACHED_WASM_KEY,
  invalidateRemoteModule,
  loadCachedWasm,
  META_FILE,
  openScannerCache,
  WASM_FILE,
  type AcquireProgress,
  type AcquireResult,
} from './scannerStore';

// Greppable marker so verify-store-build.mjs can PROVE this module's code is
// absent from the store bundle. It is referenced below (in a thrown message)
// so the bundler retains the literal whenever the module IS included.
export const REMOTE_SCANNER_TAG = '__DRIFT_REMOTE_SCANNER_CAPABILITY__';

/** Stream a response body to a single ArrayBuffer, reporting byte progress. */
async function readBodyWithProgress(res: Response, onLoaded: (loaded: number) => void): Promise<ArrayBuffer> {
  const reader = res.body?.getReader?.();
  if (!reader) return res.arrayBuffer();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onLoaded(loaded);
    }
  }
  const out = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out.buffer;
}

/**
 * Resolve the tag-pinned download base for the NEWEST profiler release. The
 * repo-wide `releases/latest` points at the desktop app (a different release
 * train), so we query the releases API — which returns releases newest-first —
 * and take the first published `drift-static-profiler-v*` tag. Returns e.g.
 * `…/releases/download/drift-static-profiler-v0.8.2`.
 */
async function resolveLatestProfilerBase(): Promise<string> {
  const res = await fetch(SCANNER_RELEASES_API, {
    credentials: 'omit',
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`scanner release lookup failed: HTTP ${res.status}`);
  const releases = (await res.json()) as Array<{ tag_name?: string; draft?: boolean; prerelease?: boolean }>;
  const rel = releases.find((r) => !r.draft && !r.prerelease && r.tag_name?.startsWith(SCANNER_TAG_PREFIX));
  if (!rel?.tag_name) throw new Error(`no published ${SCANNER_TAG_PREFIX}* release found`);
  return `${SCANNER_RELEASE_DOWNLOAD}/${rel.tag_name}`;
}

/**
 * DOWNLOAD the scanner wasm from a release (the user's explicit Settings
 * action) and persist it in CacheStorage. Idempotent: if the same version is
 * already cached it short-circuits to "ready". Records source:'remote' so
 * {@link loadScannerModule} compiles the cached bytes instead of the bundled
 * build. `baseUrl` overrides the source (defaults to settings.scannerUrl, then
 * the release base in config).
 */
export async function downloadScanner(
  onProgress?: (p: AcquireProgress) => void,
  baseUrl?: string,
): Promise<AcquireResult> {
  const log = onProgress ?? (() => {});
  const settings = await getSettings();
  const have = settings.scanner ?? null;

  // An explicit base (param or settings.scannerUrl) is used verbatim; otherwise
  // resolve the newest profiler release via the API (the repo-wide `latest` is a
  // different release train and 404s — see config.ts).
  const explicit = baseUrl ?? settings.scannerUrl;
  if (!explicit) log({ phase: 'Finding latest scanner release…', fraction: null });
  const base = (explicit ?? (await resolveLatestProfilerBase())).replace(/\/$/, '');

  log({ phase: 'Fetching scanner manifest…', fraction: null });
  let version = 'remote';
  let advertisedBytes: number | undefined;
  try {
    const m = await fetch(`${base}/${META_FILE}`, { credentials: 'omit' });
    if (m.ok) {
      const j = (await m.json()) as { version?: string; bytes?: number };
      version = j.version ?? version;
      advertisedBytes = j.bytes;
    }
  } catch {
    /* no meta → keep 'remote'; the wasm download below is what matters */
  }

  // Already downloaded this exact version and still cached → nothing to do.
  if (have?.source === 'remote' && have.version === version && (await loadCachedWasm())) {
    log({ phase: `Scanner ready · v${version}`, fraction: 1 });
    return { status: 'ready', meta: have };
  }

  log({ phase: `Downloading scanner v${version}…`, fraction: advertisedBytes ? 0 : null });
  const res = await fetch(`${base}/${WASM_FILE}`, { credentials: 'omit' });
  if (!res.ok) throw new Error(`scanner download failed: HTTP ${res.status}`);

  const total = Number(res.headers.get('content-length')) || advertisedBytes || 0;
  const bytes = await readBodyWithProgress(res, (loaded) =>
    log({ phase: `Downloading scanner v${version}…`, fraction: total ? Math.min(loaded / total, 1) : null }),
  );

  // Verify the wasm magic before we commit it to the cache.
  const head = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  if (!(head.length >= 4 && head[0] === 0x00 && head[1] === 0x61 && head[2] === 0x73 && head[3] === 0x6d)) {
    throw new Error('scanner file is not a valid wasm module');
  }

  const cache = await openScannerCache();
  // The marker is referenced here so it survives into any bundle that includes
  // this module; the store build excludes the module entirely.
  if (!cache) throw new Error(`CacheStorage unavailable — cannot persist the downloaded scanner [${REMOTE_SCANNER_TAG}]`);
  await cache.put(
    CACHED_WASM_KEY,
    new Response(bytes, { headers: { 'content-type': 'application/wasm' } }),
  );
  invalidateRemoteModule(); // drop any stale compiled module

  const meta: ScannerMeta = { version, bytes: bytes.byteLength, source: 'remote', acquiredAt: Date.now() };
  await patchSettings({ scanner: meta });
  log({ phase: `Scanner ready · v${version}`, fraction: 1 });
  return { status: have ? 'updated' : 'acquired', meta };
}
