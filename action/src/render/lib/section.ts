// Collapsible-section framing — turns each major comment section into an
// expandable <details> whose <summary> is the section title + a one-line TLDR.
//
// WHY: a Drift review can be long (value dashboard + suggestions + risks +
// before/after architecture + tech debt). Rendering every section fully
// expanded forces the reviewer to scroll past everything. Instead we surface a
// scannable list of TLDRs — "📊 Business value — Overall drift +32% ▲", "🛰 Risks —
// 2 to address" — and let the reviewer expand only what they care about. The
// header (verdict + KPI badges + "Before you merge" checklist) stays OUTSIDE
// this framing: it IS the whole-PR TLDR and its task boxes must stay visible
// for GitHub to tally merge-readiness.
//
// The summary carries the title so we strip the section's own leading
// `##`/`###` heading (no redundant heading inside the expanded body).

import { escapeHtml } from './format.ts';

/**
 * Split a section's leading markdown heading (`## …`) from its body.
 * Only the FIRST non-blank line is considered, and only when it's an ATX
 * heading — otherwise the whole string is returned as the body with no title.
 */
export function splitHeading(md: string): { title: string | null; body: string } {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  const m = lines[i]?.match(/^#{1,6}\s+(.+?)\s*$/);
  if (!m) return { title: null, body: md };
  const body = lines.slice(i + 1).join('\n').replace(/^\n+/, '');
  return { title: m[1].trim(), body };
}

export type CollapsibleOpts = {
  /** Plain title text (may contain `&`, emoji); HTML-escaped for the summary. */
  title: string;
  /** One-line teaser shown next to the title in the collapsed state. */
  tldr?: string;
  /** Section markdown shown when expanded. */
  body: string;
  /** Render expanded by default. */
  open?: boolean;
};

/**
 * Wrap `body` in a `<details>` whose summary is `**title** — tldr`.
 * Blank lines around the body are required so GitHub parses the inner
 * markdown (tables, mermaid fences, nested <details>) correctly.
 */
export function collapsibleSection(opts: CollapsibleOpts): string {
  const openAttr = opts.open ? ' open' : '';
  const tldr = opts.tldr?.trim() ? ` — ${escapeHtml(opts.tldr.trim())}` : '';
  const summary = `<summary><strong>${escapeHtml(opts.title)}</strong>${tldr}</summary>`;
  return [`<details${openAttr}>`, summary, '', opts.body.trim(), '', '</details>'].join('\n');
}

/**
 * Convenience: take a section's full markdown (heading + body), move the
 * heading into the collapsible summary alongside the TLDR, and return the
 * wrapped block. A section with no leading heading is wrapped whole under
 * `fallbackTitle`.
 */
export function wrapSection(
  md: string,
  opts: { tldr?: string; open?: boolean; fallbackTitle?: string },
): string {
  const { title, body } = splitHeading(md);
  return collapsibleSection({
    title: title ?? opts.fallbackTitle ?? 'Details',
    tldr: opts.tldr,
    body: title ? body : md,
    open: opts.open,
  });
}
