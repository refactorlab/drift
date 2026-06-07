// Download a branch/commit as a zip straight from github.com — NO API. The
// extension's `host_permissions: https://*/*` makes fetches from the side-panel
// page CORS-exempt and credentialed (the user's GitHub cookies), so private
// repos work too. We unzip in-memory into a repo-relative FileTree.

import { unzipRepoArchive, treeBytes, type FileTree } from './repoZip';

/**
 * Archive URL for a ref. We hit `github.com/{o}/{r}/archive/…` (NOT codeload
 * directly) so a PRIVATE repo authenticates via the user's github.com session
 * cookie, then 302-redirects to a signed codeload URL — exactly how the
 * browser's "Download ZIP" works. Hitting codeload directly would 403 on
 * private repos because the session cookie isn't scoped to that host.
 * `ref` may be a 40-char SHA or a branch name (branch → `refs/heads/` so
 * slashes like `feature/x` resolve cleanly).
 */
export function archiveUrl(owner: string, repo: string, ref: string): string {
  const isSha = /^[0-9a-f]{7,40}$/i.test(ref);
  const refPath = isSha ? ref : `refs/heads/${ref}`;
  return `https://github.com/${owner}/${repo}/archive/${refPath}.zip`;
}

// `total` is the Content-Length when the server sends one. GitHub's codeload
// generates the archive on the fly (Transfer-Encoding: chunked) and usually
// OMITS it — so the real total is often undefined. When the caller supplies an
// `estimatedTotal` (a cached prior size or GitHub's repo size) we use it instead
// and set `estimated: true` so the UI can mark the percentage approximate. With
// neither, the UI just shows downloaded bytes ticking up.
export type DownloadProgress = {
  phase: string;
  bytes: number;
  total?: number;
  estimated?: boolean;
  /** Running average download speed in bytes/sec, once enough has elapsed to be
   *  meaningful. Lets the UI show live progress even with no total to divide by
   *  — the only honest feedback GitHub leaves us on a first, uncached download. */
  bytesPerSec?: number;
};

/**
 * Fetch a ref's archive as raw zip bytes, WITHOUT unzipping. The unzip is the
 * expensive, main-thread-blocking part, so callers that scan in a Web Worker
 * hand these bytes straight across the wire (zero-copy transfer) and unzip off
 * the UI thread. Streams the body so download progress is live.
 */
export async function downloadArchive(
  owner: string,
  repo: string,
  ref: string,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
  estimatedTotal?: number,
): Promise<Uint8Array> {
  const url = archiveUrl(owner, repo, ref);
  const label = `${owner}/${repo}@${shortRef(ref)}`;
  // Surface the estimate up front so the (sometimes slow) wait for the first
  // byte already shows "0 B / ~X MB" instead of a sizeless "fetching".
  onProgress?.({ phase: `fetching ${label}`, bytes: 0, total: estimatedTotal, estimated: !!estimatedTotal });
  const res = await fetch(url, { credentials: 'include', redirect: 'follow', signal });
  if (!res.ok) {
    throw new Error(`download ${label} failed: HTTP ${res.status}`);
  }
  return readBodyWithProgress(res, `downloading ${label}`, onProgress, estimatedTotal);
}

/** Fetch + unzip a ref into a FileTree. Throws with a useful message on HTTP/zip errors. */
export async function downloadTree(
  owner: string,
  repo: string,
  ref: string,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
  estimatedTotal?: number,
): Promise<FileTree> {
  const url = archiveUrl(owner, repo, ref);
  const label = `${owner}/${repo}@${shortRef(ref)}`;
  onProgress?.({ phase: `fetching ${label}`, bytes: 0, total: estimatedTotal, estimated: !!estimatedTotal });
  const res = await fetch(url, { credentials: 'include', redirect: 'follow', signal });
  if (!res.ok) {
    throw new Error(`download ${label} failed: HTTP ${res.status}`);
  }
  const buf = await readBodyWithProgress(res, `downloading ${label}`, onProgress, estimatedTotal);
  onProgress?.({ phase: `unzipping ${label}`, bytes: buf.length, total: buf.length });
  const tree = unzipRepoArchive(buf);
  onProgress?.({ phase: `unzipped ${tree.size} files`, bytes: treeBytes(tree) });
  return tree;
}

/**
 * Stream the response body, summing bytes as chunks arrive so the caller can
 * render live download progress. Throttled to ~120ms so a fast download
 * doesn't flood React with state updates. Falls back to a single buffered read
 * if the body isn't a readable stream (older runtimes). Aborting the fetch
 * rejects `reader.read()` with AbortError, which propagates as expected.
 */
async function readBodyWithProgress(
  res: Response,
  phase: string,
  onProgress?: (p: DownloadProgress) => void,
  estimatedTotal?: number,
): Promise<Uint8Array> {
  // Real Content-Length wins; otherwise fall back to the caller's estimate and
  // flag it (codeload's chunked archives omit Content-Length, so the estimate
  // is the usual path here).
  const real = Number(res.headers.get('content-length')) || undefined;
  const total = real ?? (estimatedTotal && estimatedTotal > 0 ? estimatedTotal : undefined);
  const estimated = real == null && total != null;
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    // A buffered read already has the true size — report it exactly, not the estimate.
    onProgress?.({ phase, bytes: buf.length, total: buf.length });
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let lastTick = 0;
  const startMs = Date.now();
  // Average speed, suppressed until a little has elapsed so the first reading
  // isn't a wild divide-by-near-zero.
  const speed = (nowMs: number): number | undefined => {
    const elapsed = nowMs - startMs;
    return elapsed > 250 ? Math.round((received / elapsed) * 1000) : undefined;
  };
  onProgress?.({ phase, bytes: 0, total, estimated });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    received += value.length;
    const nowMs = Date.now();
    if (nowMs - lastTick > 120) {
      lastTick = nowMs;
      onProgress?.({ phase, bytes: received, total, estimated, bytesPerSec: speed(nowMs) });
    }
  }
  // The stream is fully drained: `received` is the true size, so report it as an
  // exact total regardless of the estimate.
  onProgress?.({ phase, bytes: received, total: received, bytesPerSec: speed(Date.now()) });

  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function shortRef(ref: string): string {
  return /^[0-9a-f]{40}$/i.test(ref) ? ref.slice(0, 7) : ref;
}
