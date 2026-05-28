// Small, dependency-free formatting primitives shared by every section.
// Kept pure (no report/context coupling) so they're trivially unit-tested.

/** Round to `decimals` places (default 1). */
export function round(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Signed percent for prose/labels: `+10.3%` · `−15.9%` (U+2212 minus, which
 * renders cleaner than ASCII `-`) · `0.0%`. Always one decimal so a column of
 * them aligns. NOTE: shields.io badge values must be URL-encoded instead — use
 * `badgeUrl()`, not this.
 */
export function signedPercent(n: number, decimals = 1): string {
  const r = round(n, decimals);
  const mag = Math.abs(r).toFixed(decimals);
  if (r > 0) return `+${mag}%`;
  if (r < 0) return `−${mag}%`;
  return `${(0).toFixed(decimals)}%`;
}

/** Unsigned magnitude percent, one decimal: `15.9%`. */
export function magnitudePercent(n: number, decimals = 1): string {
  return `${Math.abs(round(n, decimals)).toFixed(decimals)}%`;
}

/**
 * Signed decimal with NO unit, U+2212 minus: `+2.1` · `−1.0` · `0.0`. For
 * "percentage point" deltas where the caller appends its own `pp`/unit.
 */
export function signedNumber(n: number, decimals = 1): string {
  const r = round(n, decimals);
  const mag = Math.abs(r).toFixed(decimals);
  if (r > 0) return `+${mag}`;
  if (r < 0) return `−${mag}`;
  return (0).toFixed(decimals);
}

/** A 0..1 confidence as a whole-number percent: `0.78 → "78%"`. */
export function confidencePercent(conf01: number): string {
  return `${Math.round(clamp(conf01, 0, 1) * 100)}%`;
}

/** Signed integer with a thousands separator: `2175 → "+2,175"`, `-88 → "−88"`. */
export function signedInt(n: number): string {
  const r = Math.round(n);
  const mag = Math.abs(r).toLocaleString('en-US');
  if (r > 0) return `+${mag}`;
  if (r < 0) return `−${mag}`;
  return '0';
}

/** Plain integer with a thousands separator: `2263 → "2,263"`. */
export function int(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** `n === 1 ? singular : (plural ?? singular + 's')`. */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/** Escape the five XML/HTML entities so dynamic text is safe inside <table>. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a capped, middot-joined inline list with a "…+N more" tail:
 *   ["a","b","c"], 2 → "`a` · `b` · *…+1 more*"
 * `code` wraps each item in backticks (default true).
 */
export function inlineList(items: string[], max: number, code = true): string {
  const wrap = (s: string) => (code ? `\`${s}\`` : s);
  const shown = items.slice(0, max).map(wrap);
  if (items.length > shown.length) shown.push(`*…+${items.length - shown.length} more*`);
  return shown.join(' · ');
}

/** The final path segment: `src/lib/theme.ts → theme.ts`. */
export function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

/**
 * Wrap arbitrary content in a fenced code block whose fence is longer than any
 * backtick run inside it — so a formula or diff that itself contains ``` can't
 * terminate the block early (CommonMark fence nesting). `info` is the optional
 * language hint (e.g. `diff`).
 */
export function fencedBlock(content: string, info = ''): string {
  const longest = (content.match(/`+/g) ?? []).reduce((m, r) => Math.max(m, r.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${info}\n${content}\n${fence}`;
}
