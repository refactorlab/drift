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

export type AcquireProgress = { phase: string; fraction: number | null };
export type AcquireStatus = 'ready' | 'acquired' | 'updated';
export type AcquireResult = { status: AcquireStatus; meta: ScannerMeta };

type SourceMeta = { version: string; source: 'bundled' | 'remote'; wasmUrl: string; metaBytes?: number };

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
  const src = await resolveSource(settings.scannerUrl);

  if (have && have.version === src.version && have.source === src.source) {
    log({ phase: `Scanner ready · v${have.version}`, fraction: 1 });
    return { status: 'ready', meta: have };
  }

  log({ phase: have ? `Updating scanner → v${src.version}…` : `Acquiring scanner v${src.version}…`, fraction: null });

  // SUPER-FAST onboarding: verify the wasm exists + has the wasm magic header
  // WITHOUT downloading the whole 22MB or compiling it. The expensive compile
  // is deferred to the first scan (loadScannerModule, memoized + pre-warmable).
  const res = await fetch(src.wasmUrl, src.source === 'remote' ? { credentials: 'omit' } : undefined);
  if (!res.ok) throw new Error(`scanner download failed: HTTP ${res.status}`);
  if (!(await hasWasmMagic(res))) throw new Error('scanner file is not a valid wasm module');

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

// Compiled-module cache so a pre-warm carries through to the scan provider and
// re-runs never recompile. Keyed by source URL.
const moduleCache = new Map<string, Promise<WebAssembly.Module>>();

/** Compile the scanner module for execution (streaming when possible), memoized. */
export async function loadScannerModule(scannerUrl?: string): Promise<WebAssembly.Module> {
  const url = scannerUrl ? `${scannerUrl.replace(/\/$/, '')}/${WASM_FILE}` : chrome.runtime.getURL(WASM_FILE);
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

/** Kick off the compile in the background (non-blocking) so the first scan is
 *  instant. Failures are swallowed — the scan will surface them if it matters. */
export function prewarmScanner(scannerUrl?: string): void {
  void loadScannerModule(scannerUrl).catch(() => {});
}
