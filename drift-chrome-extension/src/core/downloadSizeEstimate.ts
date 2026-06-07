// The head-tree zip total, so the download step can show "X MB / Y MB (Z%)".
// GitHub gives us NO way to learn this before/during a first download: codeload
// serves the archive chunked with no Content-Length, ignores Range, and the only
// API that reports a size (api.github.com `size`) is anon-rate-limited AND wrong
// (it's the packed .git size, not the source zip). So the one reliable, no-token,
// same-origin source is THIS DEVICE'S last successful download of the same repo,
// cached here. First run → no total (the UI shows live bytes + speed instead);
// every run after → an exact-ish percentage.

const STORAGE_KEY = 'drift:zip-size-cache';

/** `${owner}/${repo}` (lower-cased) → last successful download's byte count. */
type SizeCache = Record<string, number>;

function key(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

async function readCache(): Promise<SizeCache> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return (data[STORAGE_KEY] as SizeCache | undefined) ?? {};
}

/** Estimated total bytes for the head-tree zip: the real size from this repo's
 *  last successful download, or undefined on the first ever run. Never throws. */
export async function getCachedZipSize(owner: string, repo: string): Promise<number | undefined> {
  const n = (await readCache())[key(owner, repo)];
  return n && n > 0 ? n : undefined;
}

/** Remember a download's actual size to seed the next run's percentage. */
export async function setCachedZipSize(owner: string, repo: string, bytes: number): Promise<void> {
  if (!(bytes > 0)) return;
  const cache = await readCache();
  cache[key(owner, repo)] = bytes;
  await chrome.storage.local.set({ [STORAGE_KEY]: cache });
}
