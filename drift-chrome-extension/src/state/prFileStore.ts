// Persistent per-PR FILE store — the substrate the iterative agent reads from.
//
// WHY IndexedDB (not chrome.storage.local, not RAM): a scan already downloads the
// PR's HEAD tree as a ZIP. Rather than hold that tree in memory (it can be tens of
// MB) or re-fetch per question, we persist ONLY the changed files (content @ HEAD
// + their diff) to IndexedDB, keyed by PR url + head sha. `read_file` then serves
// a file instantly and offline, and nothing large is retained in JS heap once the
// scan returns. `unlimitedStorage` (manifest) keeps the store from being evicted.
//
// The pure helpers (`fileDiffToText`, `selectShasToEvict`, `buildPrFileEntries`)
// carry the logic and unit-test without a real IndexedDB.

import type { FileDiff } from './../core/prDiff';
import type { FileTree } from './../core/repoZip';

const DB_NAME = 'drift-pr-files';
const DB_VERSION = 1;
const STORE = 'files';

/** Keep at most this many head-shas per PR url — re-scanning a PR a few times
 *  shouldn't grow storage without bound. Oldest shas are evicted on write. */
export const MAX_SHAS_PER_PR = 2;
/** Cap stored file content so one pathological file can't bloat the DB. The agent
 *  reads with its own (smaller) per-file token budget anyway. */
export const MAX_FILE_CHARS = 256 * 1024;

/** One stored file: its text at HEAD plus the literal diff for this PR. */
export interface PrFileEntry {
  path: string;
  /** ChangedFileStatus code: 'A' | 'M' | 'D' | 'R' | 'C' | 'T'. */
  status: string;
  /** File text at HEAD (decoded UTF-8), capped to MAX_FILE_CHARS. */
  content: string;
  /** The file's +/- hunks rendered as unified-diff text (may be empty). */
  diff: string;
}

interface StoredFile extends PrFileEntry {
  /** Primary key: `${url}@${sha}::${path}`. */
  key: string;
  /** `${url}@${sha}` — groups a single scan's files (index `byPrKey`). */
  prKey: string;
  /** Index `byUrl` — all shas ever stored for a PR, for eviction. */
  url: string;
  sha: string;
  /** Write time (epoch ms) — newest sha wins during eviction. */
  ts: number;
}

const prKeyOf = (url: string, sha: string): string => `${url}@${sha}`;
const fileKeyOf = (url: string, sha: string, path: string): string => `${prKeyOf(url, sha)}::${path}`;

// ── pure helpers (no IndexedDB) ──────────────────────────────────────────────

/** Render a parsed FileDiff back to unified-diff text (`@@ header` + +/-/space
 *  prefixed lines) so the agent sees the literal change alongside the file. */
export function fileDiffToText(fd: FileDiff | undefined): string {
  if (!fd) return '';
  if (fd.binary) return '(binary file — no textual diff)';
  const out: string[] = [];
  for (const h of fd.hunks) {
    out.push(h.header);
    for (const l of h.lines) {
      const sign = l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' ';
      out.push(`${sign}${l.text}`);
    }
  }
  let text = out.join('\n');
  if (fd.truncated) text += '\n… (diff truncated — file change is larger)';
  return text;
}

/** Decode + assemble the store entries for the CHANGED files of a scan: file
 *  bytes from the head-tree ZIP paired with each file's diff + status. Pure (no
 *  IndexedDB), so the persist path is trivially testable. Files absent from the
 *  tree (e.g. deletes) are skipped — there's nothing at HEAD to read. */
export function buildPrFileEntries(
  tree: FileTree,
  fileDiffs: FileDiff[],
  changedPaths: string[],
): PrFileEntry[] {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const diffByPath = new Map(fileDiffs.map((d) => [d.path, d]));
  const entries: PrFileEntry[] = [];
  for (const path of changedPaths) {
    const bytes = tree.get(path);
    if (!bytes) continue; // deleted / not present at HEAD
    const fd = diffByPath.get(path);
    const content = decoder.decode(bytes).slice(0, MAX_FILE_CHARS);
    entries.push({ path, status: fd?.status ?? 'M', content, diff: fileDiffToText(fd) });
  }
  return entries;
}

/** Given every stored (prKey, ts) row for a url, return the prKeys to DELETE so at
 *  most `max` newest shas survive. Newest = the row's max ts for that prKey. */
export function selectShasToEvict(rows: Array<{ prKey: string; ts: number }>, max: number): string[] {
  const latest = new Map<string, number>();
  for (const r of rows) latest.set(r.prKey, Math.max(latest.get(r.prKey) ?? 0, r.ts));
  const keep = [...latest.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
  const keepSet = new Set(keep);
  return [...latest.keys()].filter((k) => !keepSet.has(k));
}

// ── IndexedDB plumbing ───────────────────────────────────────────────────────

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'key' });
        os.createIndex('byPrKey', 'prKey', { unique: false });
        os.createIndex('byUrl', 'url', { unique: false });
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  }).catch((e) => {
    dbPromise = null; // allow a later retry if the first open failed
    throw e;
  });
  return dbPromise;
}

/** Persist a scan's changed files for (url, sha), replacing any prior set for that
 *  exact sha, then evict old shas beyond MAX_SHAS_PER_PR. Best-effort: a storage
 *  failure must never break the scan, so callers should `.catch`. */
export async function putPrFiles(url: string, sha: string, entries: PrFileEntry[]): Promise<void> {
  const db = await openDb();
  const ts = Date.now();
  const prKey = prKeyOf(url, sha);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    const os = tx.objectStore(STORE);
    for (const e of entries) {
      const rec: StoredFile = { ...e, key: fileKeyOf(url, sha, e.path), prKey, url, sha, ts };
      os.put(rec);
    }
  });
  await evictOldShas(db, url).catch(() => {});
}

/** Read one stored file for (url, sha, path), or null if not persisted. */
export async function getPrFile(url: string, sha: string, path: string): Promise<PrFileEntry | null> {
  const db = await openDb();
  const rec = await req<StoredFile | undefined>(
    db.transaction(STORE, 'readonly').objectStore(STORE).get(fileKeyOf(url, sha, path)),
  );
  if (!rec) return null;
  return { path: rec.path, status: rec.status, content: rec.content, diff: rec.diff };
}

/** List the paths (+ status) stored for a scan — what `read_file` can serve. */
export async function listPrFiles(url: string, sha: string): Promise<Array<{ path: string; status: string }>> {
  const db = await openDb();
  const recs = await req<StoredFile[]>(
    db.transaction(STORE, 'readonly').objectStore(STORE).index('byPrKey').getAll(prKeyOf(url, sha)),
  );
  return recs.map((r) => ({ path: r.path, status: r.status }));
}

/** Drop every file stored for one (url, sha). */
export async function clearPrFiles(url: string, sha: string): Promise<void> {
  const db = await openDb();
  await deleteByPrKey(db, prKeyOf(url, sha));
}

async function evictOldShas(db: IDBDatabase, url: string): Promise<void> {
  const rows = await req<StoredFile[]>(
    db.transaction(STORE, 'readonly').objectStore(STORE).index('byUrl').getAll(url),
  );
  const evict = selectShasToEvict(rows.map((r) => ({ prKey: r.prKey, ts: r.ts })), MAX_SHAS_PER_PR);
  for (const prKey of evict) await deleteByPrKey(db, prKey);
}

function deleteByPrKey(db: IDBDatabase, prKey: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const idx = tx.objectStore(STORE).index('byPrKey');
    const cursorReq = idx.openCursor(IDBKeyRange.only(prKey));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}
