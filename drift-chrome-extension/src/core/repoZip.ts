// Unzip a GitHub repo archive (github.com/{o}/{r}/archive/{ref}.zip) into a
// flat file tree. GitHub wraps every archive in a single top-level directory
// named `{repo}-{ref-or-sha}/`; we strip that prefix so paths are repo-relative
// (matching what the scanner and the diff expect). No network, no API — just
// bytes in, tree out.

import { unzipSync } from 'fflate';

/** Repo-relative path → file bytes. */
export type FileTree = Map<string, Uint8Array>;

/** Strip the leading `repo-sha/` segment GitHub adds to archive entries. */
function stripTopDir(name: string): string | null {
  const slash = name.indexOf('/');
  if (slash < 0) return null; // top-level file (e.g. the dir entry itself) — skip
  const rel = name.slice(slash + 1);
  return rel.length ? rel : null;
}

/**
 * Decode a `.zip` archive into a repo-relative {path → bytes} map. Directory
 * entries (trailing `/`) are dropped; only regular files are kept.
 */
export function unzipRepoArchive(zip: Uint8Array): FileTree {
  const entries = unzipSync(zip);
  const tree: FileTree = new Map();
  for (const name in entries) {
    if (name.endsWith('/')) continue; // directory marker
    const rel = stripTopDir(name);
    if (rel) tree.set(rel, entries[name]);
  }
  return tree;
}

/** Number of bytes across the whole tree — for progress / budget UI. */
export function treeBytes(tree: FileTree): number {
  let n = 0;
  for (const b of tree.values()) n += b.length;
  return n;
}
