// Compute the PR's changed-files set by comparing two unzipped trees (base =
// main/master, head = PR branch) entirely client-side. This replaces the
// action's `git diff` step — no git, no API. The scanner's `scan-pr` needs the
// changed-files list (required) and a numstat (optional churn signal); we
// produce both from raw bytes.

import type { FileTree } from './repoZip';

export type ChangedStatus = 'A' | 'M' | 'D';
export type ChangedFile = { path: string; status: ChangedStatus; adds: number; dels: number };

export type TreeDiff = {
  changed: ChangedFile[];
  /** Repo-relative paths, for `--changed-files` (added + modified + deleted). */
  changedPaths: string[];
  /** `path\tadds\tdels` lines, for `--diff-stats` (mirrors `git diff --numstat`). */
  diffStats: string;
};

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function isBinary(b: Uint8Array): boolean {
  // Heuristic matching git's: a NUL byte in the first 8000 bytes ⇒ binary.
  const n = Math.min(b.length, 8000);
  for (let i = 0; i < n; i++) if (b[i] === 0) return true;
  return false;
}

function lines(b: Uint8Array): string[] {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(b);
  if (text === '') return [];
  const arr = text.split('\n');
  // A trailing newline yields a final empty element; drop it so counts match
  // git's line accounting.
  if (arr.length && arr[arr.length - 1] === '') arr.pop();
  return arr;
}

/**
 * Cheap line-level churn for a modified text file: lines present only in head
 * count as additions, lines present only in base count as deletions. This is a
 * multiset difference, not a true LCS diff — exact enough for the scanner's
 * churn signal and dramatically cheaper than a real diff over a whole tree.
 */
function numstat(base: Uint8Array, head: Uint8Array): { adds: number; dels: number } {
  if (isBinary(base) || isBinary(head)) return { adds: 0, dels: 0 }; // binary: '-' in git
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const bc = count(lines(base));
  const hc = count(lines(head));
  let adds = 0;
  let dels = 0;
  for (const [line, hn] of hc) adds += Math.max(0, hn - (bc.get(line) ?? 0));
  for (const [line, bn] of bc) dels += Math.max(0, bn - (hc.get(line) ?? 0));
  return { adds, dels };
}

/**
 * Diff `base` against `head`. Status semantics match git's
 * `--diff-filter=ACMRTD` projection the action uses (renames are reported as
 * delete+add, which the scanner tolerates).
 */
export function diffTrees(base: FileTree, head: FileTree): TreeDiff {
  const changed: ChangedFile[] = [];
  for (const [path, headBytes] of head) {
    const baseBytes = base.get(path);
    if (baseBytes === undefined) {
      changed.push({ path, status: 'A', ...numstat(new Uint8Array(), headBytes) });
    } else if (!bytesEqual(baseBytes, headBytes)) {
      changed.push({ path, status: 'M', ...numstat(baseBytes, headBytes) });
    }
  }
  for (const [path, baseBytes] of base) {
    if (!head.has(path)) {
      changed.push({ path, status: 'D', ...numstat(baseBytes, new Uint8Array()) });
    }
  }
  // Deterministic ordering (path-sorted) so reruns are stable.
  changed.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    changed,
    changedPaths: changed.map((c) => c.path),
    diffStats: changed.map((c) => `${c.adds}\t${c.dels}\t${c.path}`).join('\n'),
  };
}
