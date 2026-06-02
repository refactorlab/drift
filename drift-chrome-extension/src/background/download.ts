// Download a GitHub Actions artifact and decode it. Lives apart from the
// service-worker entry (which registers chrome.* listeners at import time) so
// it can be unit-tested with a stubbed global fetch. The fetch itself happens
// in the worker context because an extension SW with host_permissions is
// CORS-exempt for GitHub's signed-blob redirect; we send the user's cookies.

import type { FetchedArtifact } from '../core/messaging';
import { decodeArtifact, isZip } from '../core/artifactDecode';

export async function downloadArtifact(url: string, binary = false): Promise<FetchedArtifact> {
  console.log('[drift] download →', url, binary ? '(binary)' : '');
  try {
    const res = await fetch(url, { credentials: 'include', redirect: 'follow' });
    console.log('[drift] response', res.status, res.headers.get('content-type'), 'final:', res.url);
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };

    const buf = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get('content-type');
    console.log('[drift] bytes', buf.length, 'zip?', isZip(buf));

    const decoded = decodeArtifact(buf, { binary, contentType });
    if (!decoded.ok) return { ok: false, status: res.status, error: decoded.error, bytes: buf.length };
    return { ...decoded, status: res.status, contentType, bytes: buf.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'fetch failed (CORS?)';
    console.warn('[drift] download failed', error);
    return { ok: false, error };
  }
}
