// PR context — the GitHub-side facts the scan JSON does NOT carry (PR title,
// repo slug, head SHA, …). main.ts builds this from `context.payload` and
// threads it into the renderer so the comment can show the PR title and turn
// file/line references into clickable, SHA-pinned permalinks.
//
// EVERYTHING degrades gracefully: with no context (unit tests, local preview
// without an event) the link helpers fall back to plain `code spans`, so the
// comment is always valid markdown — just non-navigable.

import { basename } from './lib/format.ts';

export type PrContext = {
  owner?: string;
  repo?: string;
  /** Head commit SHA — permalinks pin to this so lines never drift, AND a
   *  bare blob permalink auto-expands into an inline code snippet in the PR. */
  sha?: string;
  prNumber?: number;
  prTitle?: string;
  htmlUrl?: string;
  baseRef?: string;
  author?: string;
};

/** `owner/repo` when both are known, else null. */
export function repoSlug(ctx?: PrContext): string | null {
  return ctx?.owner && ctx?.repo ? `${ctx.owner}/${ctx.repo}` : null;
}

/** True when we can build SHA-pinned blob permalinks. */
export function canLink(ctx?: PrContext): boolean {
  return !!(ctx?.owner && ctx?.repo && ctx?.sha);
}

/** Raw blob permalink to a path (optionally a single line or a line range). */
export function permalinkUrl(
  ctx: PrContext | undefined,
  path: string,
  line?: number,
  endLine?: number,
): string | null {
  if (!canLink(ctx)) return null;
  const base = `https://github.com/${ctx!.owner}/${ctx!.repo}/blob/${ctx!.sha}/${encodePath(path)}`;
  if (typeof line === 'number' && typeof endLine === 'number' && endLine !== line) {
    return `${base}#L${line}-L${endLine}`;
  }
  if (typeof line === 'number') return `${base}#L${line}`;
  return base;
}

/**
 * A markdown link to a file location, falling back to a `code span` when there
 * is no context. `label` defaults to `basename:line` (the compact form the
 * template uses in tables), or just the path when no line is given.
 */
export function fileLink(
  ctx: PrContext | undefined,
  path: string,
  line?: number,
  label?: string,
): string {
  const text = label ?? (typeof line === 'number' ? `${basename(path)}:${line}` : path);
  const url = permalinkUrl(ctx, path, line);
  return url ? `[\`${text}\`](${url})` : `\`${text}\``;
}

/**
 * A markdown link whose anchor text is a symbol name (e.g. a dead export),
 * pointing at its definition line. Falls back to plain `` `symbol` ``.
 */
export function symbolLink(
  ctx: PrContext | undefined,
  symbol: string,
  path: string,
  line?: number,
): string {
  const url = permalinkUrl(ctx, path, line);
  return url ? `[\`${symbol}\`](${url})` : `\`${symbol}\``;
}

/**
 * A BARE blob permalink with a line range on its own line. GitHub auto-expands
 * a bare commit-pinned permalink into a rendered, syntax-highlighted snippet
 * inline in the PR — so this is shown as a plain URL (no markdown link), which
 * is the form that triggers the expansion. Returns null without context.
 */
export function snippetPermalink(
  ctx: PrContext | undefined,
  path: string,
  startLine: number,
  endLine: number,
): string | null {
  return permalinkUrl(ctx, path, startLine, endLine);
}

// Encode each path segment but keep the slashes — GitHub expects raw `/`.
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
