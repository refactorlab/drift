// ── The "merge-confidence card" — a single rendered SVG that replaces the
// shields.io badge dashboard + KPI table with ONE at-a-glance hero image, in the
// style of the mockups (a ring gauge on the left, a labelled metric ledger on
// the right, two verdict pills up top).
//
// WHY an SVG instead of more markdown:
//   The header today emits ~10 shields.io `<img>` pills + a prose ledger. That
//   reads fine but it's busy, it wraps unpredictably across viewport widths, and
//   every pill is a separate network fetch through GitHub's camo proxy. A single
//   self-rendered SVG is one fetch, lays out deterministically, and can carry a
//   proper gauge + typographic hierarchy a row of pills can't.
//
// EMBEDDING REALITY (why this returns a STRING, not something we inline):
//   GitHub's markdown sanitiser STRIPS inline `<svg>` (and `<style>`, `<script>`)
//   from comments — same policy that strips `<audio>`/`<video>` (see
//   render/sections/footer.ts). The ONLY way an SVG shows up in a comment is as
//   an `<img src="https://…">` whose URL is publicly fetchable and served with
//   `Content-Type: image/svg+xml` — exactly how the shields.io badges already
//   render. So the pipeline is: render this string → host it (a public
//   raw.githubusercontent/gh-pages URL, or rasterise to PNG) → reference the URL
//   from the comment. This module owns ONLY the first step; hosting is the
//   caller's job (and is documented in the script + the action.yml notes).
//
// DESIGN PRINCIPLES:
//   • Zero dependencies — a hand-built string, like every other renderer here.
//     No headless browser, no rasteriser, no web fonts (fonts don't load inside
//     an <img>-embedded SVG, so we use the system stack only).
//   • Reads the SAME normalised facts as the header/checklist (extractFacts +
//     mergeConfidence + reviewEffort + compositeStatus) so the card can never
//     tell a different story than the rest of the comment.
//   • Deterministic: identical input → identical bytes (matters for caching the
//     hosted asset and for snapshot tests).
//   • Degrades: no value model → drift row reads "n/a", everything else still
//     renders from the call-graph facts.

import type { ScanPrOutput } from '../../report.ts';
import { extractFacts, type PrFacts } from '../lib/facts.ts';
import { mergeConfidence } from '../lib/confidence.ts';
import { reviewEffort } from '../lib/effort.ts';
import { compositeStatus } from '../lib/severity.ts';
import { signedPercent, signedInt, int, plural, escapeHtml } from '../lib/format.ts';

export type CardOptions = {
  /** PR number for the title line (`PR #123 — branch`). Omitted/0 → branch-only title. */
  prNumber?: number;
  /** Head branch for the title line. */
  branch?: string;
  /** PR / commit title — a subtitle fallback when there's no obvious "move". */
  title?: string;
  /** Canvas width in px (height is fixed). Default 1080 — a comfortable hero width. */
  width?: number;
};

// ── palette ──────────────────────────────────────────────────────────────────
// Light-theme surface colours (the metric colours themselves come from COLOR,
// the shared Primer palette, so the card matches the badges it replaces). Each
// gets a dark-theme counterpart in the embedded <style> media query below.
const SURFACE = {
  bg: '#ffffff',
  card: '#ffffff',
  cardStroke: '#d0d7de',
  fg: '#1f2328', // primary text
  muted: '#59636e', // secondary text / captions
  hair: '#d8dee4', // row separators
  track: '#eaeef2', // gauge track
} as const;

// Fixed vertical rhythm. Width scales; height does not (6 rows + header is a
// known quantity), which keeps the gauge geometry simple.
const H = 460;
const PAD = 16; // card inset from the canvas edge
const LX = 48; // inner left margin

/** A single right-column metric row: coloured dot + label + right-aligned value.
 *  `cls` is an optional theme class for the dot+value (the neutral "files" row
 *  uses `fg` so it flips with dark mode; coloured rows keep their fixed hex). */
type Row = { label: string; value: string; color: string; cls?: string };

/**
 * Render the merge-confidence card as a standalone SVG document (a string).
 * Pure: same `report` + `opts` → same bytes.
 */
export function renderConfidenceCardSvg(report: ScanPrOutput, opts: CardOptions = {}): string {
  const facts = extractFacts(report);
  const conf = mergeConfidence(facts);
  const effort = reviewEffort(facts);
  const composite = compositeStatus(facts.axes);

  const W = opts.width ?? 1080;
  const RX = W - LX; // inner right margin

  const verdict = decideVerdict(facts, composite);
  const rows = metricRows(facts, effort);

  const parts: string[] = [];
  parts.push(svgOpen(W));
  parts.push(defs());
  parts.push(`<rect class="bg" x="0" y="0" width="${W}" height="${H}" fill="${SURFACE.bg}"/>`);
  // The card surface — rounded, hairline border, soft shadow.
  parts.push(
    `<rect class="card" x="${PAD}" y="${PAD}" width="${W - 2 * PAD}" height="${H - 2 * PAD}" ` +
      `rx="18" fill="${SURFACE.card}" stroke="${SURFACE.cardStroke}" stroke-width="1" filter="url(#shadow)"/>`,
  );

  parts.push(header(opts, verdict, conf, RX));
  parts.push(`<line class="hair" x1="${LX}" y1="130" x2="${RX}" y2="130" stroke="${SURFACE.hair}" stroke-width="1"/>`);
  parts.push(gauge(conf, 196, 280));
  // Vertical divider between the gauge column and the metric ledger.
  parts.push(`<line class="hair" x1="360" y1="158" x2="360" y2="410" stroke="${SURFACE.hair}" stroke-width="1"/>`);
  parts.push(ledger(rows, RX));
  parts.push('</svg>');

  return parts.join('\n');
}

// ── document scaffold ──────────────────────────────────────────────────────

function svgOpen(W: number): string {
  // viewBox = pixel box so callers can scale freely; role/aria for a11y.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ` +
    `font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" ` +
    `role="img" aria-label="Drift merge-confidence card">`
  );
}

function defs(): string {
  // Soft drop shadow + the dark-theme overrides. NOTE: prefers-color-scheme is
  // honoured by the viewer's browser when the SVG renders as a vector (it's a
  // best-effort nicety — a viewer on a light OS but GitHub-dark theme sees the
  // light card; if the asset is rasterised to PNG this block is inert).
  return [
    '<defs>',
    '<filter id="shadow" x="-4%" y="-4%" width="108%" height="116%">',
    '<feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#1f2328" flood-opacity="0.10"/>',
    '</filter>',
    '</defs>',
    '<style>',
    '@media (prefers-color-scheme: dark){',
    '.bg{fill:#0d1117}',
    '.card{fill:#161b22;stroke:#30363d}',
    '.fg{fill:#e6edf3}',
    '.muted{fill:#8b949e}',
    '.hair{stroke:#30363d}',
    '.track{stroke:#30363d}',
    '}',
    '</style>',
  ].join('');
}

// ── header: title + subtitle + verdict pills ───────────────────────────────

function header(opts: CardOptions, verdict: Verdict, conf: ReturnType<typeof mergeConfidence>, RX: number): string {
  const title = titleText(opts);
  const subtitle = verdict.subtitle;

  const out: string[] = [];
  out.push(text(LX, 62, escapeHtml(title), { size: 26, weight: 700, cls: 'fg', fill: SURFACE.fg }));
  out.push(text(LX, 94, escapeHtml(subtitle), { size: 16, weight: 400, cls: 'muted', fill: SURFACE.muted }));

  // Two pills reading verdict-then-rubric left-to-right ("address before
  // merge" · "high risk"). We lay them out right-to-left from the inner right
  // margin, so the rubric pill (rightmost) comes first in the placement order.
  const pills = [
    { label: conf.label, color: conf.color },
    { label: verdict.pill, color: verdict.color },
  ];
  let right = RX;
  for (const p of pills) {
    const rendered = pill(p.label, p.color, right, 44);
    out.push(rendered.svg);
    right -= rendered.width + 8;
  }
  return out.join('\n');
}

function titleText(opts: CardOptions): string {
  const branch = opts.branch?.trim();
  if (opts.prNumber && opts.prNumber > 0) return `PR #${opts.prNumber} — ${branch ?? ''}`.trim();
  if (branch) return `Drift review — ${branch}`;
  return opts.title?.trim() || 'Drift review';
}

/** A rounded "pill" badge: a soft tint of `color` with `color` text. */
function pill(label: string, color: string, rightX: number, y: number): { svg: string; width: number } {
  const hex = `#${color}`;
  const h = 32;
  // No text metrics without a layout engine — approximate from the 15px
  // semibold glyph advance (~8px) plus horizontal padding. Good enough for a
  // pill that only needs to look snug, not pixel-perfect.
  const w = Math.round(label.length * 8) + 30;
  const x = rightX - w;
  const cx = x + w / 2;
  return {
    width: w,
    svg:
      `<g>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" ` +
      `fill="${hex}" fill-opacity="0.16" stroke="${hex}" stroke-opacity="0.30" stroke-width="1"/>` +
      `<text x="${cx}" y="${y + 21}" text-anchor="middle" font-size="15" font-weight="600" fill="${hex}">${escapeHtml(label)}</text>` +
      `</g>`,
  };
}

// ── the ring gauge: merge confidence N/5 ────────────────────────────────────

function gauge(conf: ReturnType<typeof mergeConfidence>, cx: number, cy: number): string {
  const r = 84;
  const sw = 18;
  const C = 2 * Math.PI * r;
  const frac = conf.score / 5;
  const arc = round2(C * frac);
  const hex = `#${conf.color}`;

  const out: string[] = [];
  // Track (full faint ring) + the coloured arc, started at 12 o'clock by
  // rotating the stroked circle −90° about its centre.
  out.push(`<circle class="track" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${SURFACE.track}" stroke-width="${sw}"/>`);
  if (arc > 0) {
    out.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${hex}" stroke-width="${sw}" ` +
        `stroke-linecap="round" stroke-dasharray="${arc} ${round2(C - arc)}" transform="rotate(-90 ${cx} ${cy})"/>`,
    );
  }
  // Big score in the middle, "/5" denominator beside it, caption + rubric below.
  out.push(text(cx, cy - 2, `${conf.score}`, { size: 56, weight: 800, anchor: 'middle', fill: hex }));
  out.push(text(cx, cy + 30, '/ 5', { size: 18, weight: 600, anchor: 'middle', cls: 'muted', fill: SURFACE.muted }));
  out.push(
    text(cx, cy + r + 30, 'MERGE CONFIDENCE', {
      size: 13,
      weight: 700,
      anchor: 'middle',
      cls: 'muted',
      fill: SURFACE.muted,
      letterSpacing: 1.2,
    }),
  );
  out.push(text(cx, cy + r + 52, conf.label, { size: 15, weight: 600, anchor: 'middle', fill: hex }));
  return out.join('\n');
}

// ── the metric ledger: 6 rows on the right ──────────────────────────────────

function metricRows(facts: PrFacts, effort: ReturnType<typeof reviewEffort>): Row[] {
  const C = COLORS;

  const driftValue = facts.overallPercent === null ? 'n/a' : signedPercent(facts.overallPercent);
  const driftColor =
    facts.overallDirection === 'up' ? C.green : facts.overallDirection === 'down' ? C.red : C.grey;

  const files =
    facts.netLoc === null
      ? `${int(facts.changedFiles)}`
      : `${int(facts.changedFiles)} · ${signedInt(facts.netLoc)} LOC`;

  const tests = facts.newTestFiles === null ? '—' : `${int(facts.newTestFiles)} added`;
  const testColor = facts.newTestFiles && facts.newTestFiles > 0 ? C.green : C.red;

  return [
    { label: 'Risks to address', value: int(facts.risksToAddress), color: facts.risksToAddress > 0 ? C.red : C.green },
    { label: 'Review effort', value: `${effort.score}/5 · ${bareMinutes(effort.minutes)}`, color: `#${effort.color}` },
    { label: 'Drift from baseline', value: driftValue, color: driftColor },
    // Neutral row — `fg` class so the value+dot flip to light text in dark mode
    // (a stylesheet rule beats the inline fill only when the media query fires).
    { label: 'Files changed', value: files, color: C.fg, cls: 'fg' },
    { label: 'Suggestions', value: `${int(facts.passing.length)} · agent-ready`, color: facts.passing.length > 0 ? C.green : C.grey },
    { label: 'New tests', value: tests, color: testColor },
  ];
}

function ledger(rows: Row[], RX: number): string {
  const dotX = 392;
  const labelX = 412;
  const top = 156;
  const rowH = 44;

  const out: string[] = [];
  rows.forEach((row, i) => {
    const mid = top + rowH * i + rowH / 2;
    // Separator above every row but the first.
    if (i > 0) out.push(`<line class="hair" x1="${labelX}" y1="${top + rowH * i}" x2="${RX}" y2="${top + rowH * i}" stroke="${SURFACE.hair}" stroke-width="1"/>`);
    const dotCls = row.cls ? ` class="${row.cls}"` : '';
    out.push(`<circle cx="${dotX}" cy="${mid}" r="6" fill="${row.color}"${dotCls}/>`);
    out.push(text(labelX, mid + 6, escapeHtml(row.label), { size: 18, weight: 500, cls: 'fg', fill: SURFACE.fg }));
    out.push(text(RX, mid + 6, escapeHtml(row.value), { size: 18, weight: 700, anchor: 'end', cls: row.cls, fill: row.color }));
  });
  return out.join('\n');
}

// ── verdict (pill + subtitle), mirrors header.ts decideVerdict/theMove ───────

type Verdict = { pill: string; color: string; subtitle: string };

function decideVerdict(facts: PrFacts, composite: ReturnType<typeof compositeStatus>): Verdict {
  const needsAttention = facts.correctness.length > 0 || facts.regressedAxes.length > 0 || composite.mixed;
  if (needsAttention) {
    const netRegression = composite.label === 'regressed' || (facts.overallDirection === 'down' && !composite.mixed);
    return { pill: 'address before merge', color: netRegression ? COLORS.redHex : COLORS.amberHex, subtitle: theMove(facts) };
  }
  if (facts.overallDirection === 'up') {
    return { pill: 'looks good', color: COLORS.greenHex, subtitle: 'Net improvement — nothing to gate on' };
  }
  return { pill: 'advisory', color: COLORS.blueHex, subtitle: 'Advisory review only — nothing flagged' };
}

/** The single highest-priority imperative, for the subtitle (a prose echo of the checklist). */
function theMove(facts: PrFacts): string {
  if (facts.regressedAxes.length > 0) {
    const worst = facts.regressedAxes.reduce((w, a) => (a.delta_percent < w.delta_percent ? a : w));
    return `Confirm the ${stripEmoji(worst.label)} ${signedPercent(worst.delta_percent)} regression before merging`;
  }
  if (facts.correctness.length > 0) {
    const n = facts.correctness.length;
    return `Fix ${int(n)} flagged correctness ${plural(n, 'issue')} before merging`;
  }
  if (facts.newTestFiles === 0 && facts.locAdded !== null && facts.locAdded > 0) {
    return `Add tests for the ${signedInt(facts.locAdded)} LOC shipped with none`;
  }
  return 'Review the changes below before merging';
}

// ── small helpers ────────────────────────────────────────────────────────────

type TextOpts = {
  size: number;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  /** Optional CSS class so the dark-theme media query can recolour it. */
  cls?: string;
  fill: string;
  letterSpacing?: number;
};

function text(x: number, y: number, content: string, o: TextOpts): string {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-size="${o.size}"`,
    o.weight ? `font-weight="${o.weight}"` : '',
    o.anchor ? `text-anchor="${o.anchor}"` : '',
    o.letterSpacing ? `letter-spacing="${o.letterSpacing}"` : '',
    o.cls ? `class="${o.cls}"` : '',
    `fill="${o.fill}"`,
  ].filter(Boolean);
  return `<text ${attrs.join(' ')}>${content}</text>`;
}

/** Drop a leading emoji/symbol run from an axis label: "💰 Money" → "Money". */
function stripEmoji(label: string): string {
  return label.replace(/^[^\p{L}\p{N}]+/u, '').trim() || label;
}

/** Strip the leading "≈ " so the time band fits compactly inside a row value. */
function bareMinutes(minutes: string): string {
  return minutes.replace(/^≈\s*/, '');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Metric colours: the shared Primer palette, prefixed with `#` for SVG fills,
// plus the surface foreground for the neutral "files" row. Kept local so this
// module owns its full colour vocabulary in one place.
const COLORS = {
  red: '#d1242f',
  green: '#2ea043',
  amber: '#d29922',
  blue: '#58a6ff',
  grey: '#8b949e',
  fg: SURFACE.fg,
  // Bare hexes (no #) for pill colours, which take the shields-style value.
  redHex: 'd1242f',
  greenHex: '2ea043',
  amberHex: 'd29922',
  blueHex: '58a6ff',
} as const;
