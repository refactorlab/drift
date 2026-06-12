// Per-PR diff workspace — the SDK-native way to give Andy the FULL diff as context.
//
// The Agent SDK has no file-upload / document mechanism: its model of "files in
// context" is the filesystem + Read/Grep/Glob tools (see docs/agent-sdk). So the
// extension POSTs a PR's whole pr_diff to /context; we materialize it to an
// ISOLATED temp dir as one `<path>.diff` per file + an INDEX.md, and /turn runs
// the query with cwd = that dir + read-only tools. Andy then pulls only the files
// a question needs — no truncation, scales past what fits inline. Pure helpers
// here (path safety + rendering) are unit-tested; the IO writer is thin.

import { mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type WsLine = { type: "add" | "del" | "context"; text: string };
export type WsHunk = { header: string; lines: WsLine[] };
export type WsFile = {
  path: string;
  oldPath?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  binary?: boolean;
  hunks?: WsHunk[];
};

/** Root for all PR workspaces, under the OS temp dir (never the user's repo). */
export function workspaceRoot(): string {
  return path.join(os.tmpdir(), "drift-brain-ws");
}

/** A filesystem-safe directory name for a PR key like "acme/webapp#142". */
export function sanitizeKey(key: string): string {
  const s = key.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "pr";
}

/** Absolute workspace dir for a key. */
export function workspaceDirFor(key: string): string {
  return path.join(workspaceRoot(), sanitizeKey(key));
}

/**
 * Resolve a client-supplied file path to an absolute path INSIDE `base`, or null
 * if it would escape (path traversal via "..", absolute paths, etc.). This is the
 * security boundary: the client controls these paths, so we never trust them.
 */
export function safeJoin(base: string, rel: string): string | null {
  const cleaned = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  const abs = path.resolve(base, cleaned);
  const baseWithSep = base.endsWith(path.sep) ? base : base + path.sep;
  if (abs !== base && !abs.startsWith(baseWithSep)) return null; // escaped the base
  return abs;
}

/** Render ONE file's full diff (no budget — the workspace holds everything). */
export function renderFileDiff(f: WsFile): string {
  const head = f.oldPath && f.oldPath !== f.path ? `${f.oldPath} -> ${f.path}` : f.path;
  const lines: string[] = [
    `# ${head}`,
    `# ${f.status ?? "M"}, +${f.additions ?? 0} -${f.deletions ?? 0}${f.binary ? ", binary" : ""}`,
    "",
  ];
  for (const h of f.hunks ?? []) {
    lines.push(h.header);
    for (const ln of h.lines) {
      const sign = ln.type === "add" ? "+" : ln.type === "del" ? "-" : " ";
      lines.push(`${sign}${ln.text}`);
    }
  }
  return lines.join("\n") + "\n";
}

/** The INDEX.md Andy reads first to know what's on disk and where. */
export function renderIndex(files: WsFile[]): string {
  const lines = [
    "# PR diff workspace",
    "",
    "Each changed file's full diff is in `<path>.diff` (same directory layout as the repo).",
    "Read the ones a question needs; Grep across `**/*.diff` to find a symbol.",
    "",
    "## Files",
  ];
  for (const f of files) {
    const head = f.oldPath && f.oldPath !== f.path ? `${f.oldPath} -> ${f.path}` : f.path;
    lines.push(`- ${head}.diff (${f.status ?? "M"}, +${f.additions ?? 0} -${f.deletions ?? 0})`);
  }
  return lines.join("\n") + "\n";
}

export interface WriteResult {
  dir: string;
  written: number;
  skipped: string[]; // paths rejected by the safety check
}

/**
 * Materialize a PR's diff into its workspace dir, replacing any prior content for
 * that key. Returns the dir + how many files landed. Unsafe paths are skipped, not
 * fatal. Binary / hunk-less files still get a stub so the path exists to Read.
 */
export async function writeWorkspace(key: string, files: WsFile[]): Promise<WriteResult> {
  const dir = workspaceDirFor(key);
  await rm(dir, { recursive: true, force: true }); // fresh each scan — no stale files
  await mkdir(dir, { recursive: true });

  const skipped: string[] = [];
  let written = 0;
  for (const f of files) {
    if (!f?.path) continue;
    const abs = safeJoin(dir, `${f.path}.diff`);
    if (!abs) {
      skipped.push(f.path);
      continue;
    }
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, renderFileDiff(f), "utf8");
    written++;
  }
  await writeFile(path.join(dir, "INDEX.md"), renderIndex(files), "utf8");
  return { dir, written, skipped };
}
